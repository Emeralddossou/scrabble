import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { getDb, type Row } from '@/server/db';
import { assertMutationOrigin, body, failure, success } from '@/server/http';
import { isValidTimeZone } from '@/server/push';
import { validationError } from '@/server/security/errors';

export const runtime = 'nodejs';

const subscriptionInput = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2000),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({ p256dh: z.string().min(16).max(1000), auth: z.string().min(8).max(1000) }),
  }),
  notificationHour: z.number().int().min(0).max(23),
  timeZone: z.string().trim().min(1).max(100),
});

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const db = await getDb();
    const subscription = (
      await db.query<Row>(
        `SELECT notification_hour,time_zone FROM push_subscriptions
         WHERE user_id=? AND enabled=1 ORDER BY updated_at DESC LIMIT 1`,
        [user.id],
      )
    )[0];
    return success(
      subscription
        ? {
            enabled: true,
            notificationHour: Number(subscription.notification_hour),
            timeZone: String(subscription.time_zone),
          }
        : { enabled: false, notificationHour: 18, timeZone: null },
      requestId,
    );
  } catch (error) {
    return failure(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const user = await requireUser();
    const value = await body(request, subscriptionInput);
    if (!isValidTimeZone(value.timeZone)) throw validationError('Fuseau horaire invalide.');
    const db = await getDb();
    await db.transaction(async (tx) => {
      // An endpoint can be re-created after a browser update or moved to another account.
      // Removing the old row keeps the endpoint unique on SQLite and MySQL alike.
      const previous = await tx.query<Row>('SELECT id FROM push_subscriptions WHERE endpoint=?', [
        value.subscription.endpoint,
      ]);
      for (const item of previous) {
        await tx.execute('DELETE FROM push_deliveries WHERE subscription_id=?', [item.id]);
      }
      await tx.execute('DELETE FROM push_subscriptions WHERE endpoint=?', [value.subscription.endpoint]);
      await tx.execute(
        `INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth,notification_hour,time_zone,enabled)
         VALUES(?,?,?,?,?,?,1)`,
        [
          user.id,
          value.subscription.endpoint,
          value.subscription.keys.p256dh,
          value.subscription.keys.auth,
          value.notificationHour,
          value.timeZone,
        ],
      );
    });
    return success({ enabled: true }, requestId, 201);
  } catch (error) {
    return failure(error, requestId);
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const user = await requireUser();
    const db = await getDb();
    await db.transaction(async (tx) => {
      const subscriptions = await tx.query<Row>('SELECT id FROM push_subscriptions WHERE user_id=?', [
        user.id,
      ]);
      for (const subscription of subscriptions) {
        await tx.execute('DELETE FROM push_deliveries WHERE subscription_id=?', [subscription.id]);
      }
      await tx.execute('DELETE FROM push_subscriptions WHERE user_id=?', [user.id]);
    });
    return success({ enabled: false }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
