import { timingSafeEqual } from 'node:crypto';

import { NextRequest } from 'next/server';

import { getDb, type Row } from '@/server/db';
import { failure, success } from '@/server/http';
import { isValidTimeZone, localDateTime, pushErrorStatus, sendDailyReminder } from '@/server/push';
import { AppError } from '@/server/security/errors';

export const runtime = 'nodejs';
export const maxDuration = 60;

type SubscriptionRow = Row & {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  notification_hour: number;
  time_zone: string;
};

function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    if (!cronAuthorized(request)) throw new AppError('CRON_UNAUTHORIZED', 401, 'Cron non autorisé.');
    const db = await getDb();
    const subscriptions = await db.query<SubscriptionRow>(
      `SELECT id,endpoint,p256dh,auth,notification_hour,time_zone FROM push_subscriptions
       WHERE enabled=1`,
    );
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let removed = 0;

    for (const subscription of subscriptions) {
      const timeZone = String(subscription.time_zone);
      if (!isValidTimeZone(timeZone)) {
        await db.execute('UPDATE push_subscriptions SET enabled=0 WHERE id=?', [subscription.id]);
        removed += 1;
        continue;
      }
      const local = localDateTime(timeZone);
      if (local.hour !== Number(subscription.notification_hour)) {
        skipped += 1;
        continue;
      }

      const claimed = await db.transaction(async (tx) => {
        const existing = await tx.query<Row>(
          'SELECT id FROM push_deliveries WHERE subscription_id=? AND local_date=?',
          [subscription.id, local.date],
        );
        if (existing[0]) return false;
        await tx.execute(
          `INSERT INTO push_deliveries(subscription_id,local_date,status) VALUES(?,?,'pending')`,
          [subscription.id, local.date],
        );
        return true;
      });
      if (!claimed) {
        skipped += 1;
        continue;
      }

      try {
        await sendDailyReminder(subscription);
        await db.execute(
          `UPDATE push_deliveries SET status='sent',sent_at=CURRENT_TIMESTAMP
           WHERE subscription_id=? AND local_date=?`,
          [subscription.id, local.date],
        );
        sent += 1;
      } catch (error) {
        const status = pushErrorStatus(error);
        if (status === 404 || status === 410) {
          await db.execute('DELETE FROM push_deliveries WHERE subscription_id=?', [subscription.id]);
          await db.execute('DELETE FROM push_subscriptions WHERE id=?', [subscription.id]);
          removed += 1;
        } else {
          await db.execute(
            `UPDATE push_deliveries SET status='failed' WHERE subscription_id=? AND local_date=?`,
            [subscription.id, local.date],
          );
          failed += 1;
        }
      }
    }
    return success({ sent, skipped, failed, removed }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
