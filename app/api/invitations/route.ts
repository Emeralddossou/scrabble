import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireUser } from '@/server/auth';
import { getDb, type Row } from '@/server/db';
import { assertMutationOrigin, body, failure, success } from '@/server/http';
import { AppError, validationError } from '@/server/security/errors';
import { consumeRateLimit } from '@/server/security/rate-limit';

export const runtime = 'nodejs';
const input = z.object({
  toUserId: z.number().int().positive(),
  mode: z.enum(['free', 'timer']),
  timeLimitMinutes: z.number().int().min(1).max(120),
  incrementSeconds: z.number().int().min(0).max(120),
});
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const user = await requireUser();
    const value = await body(request, input);
    if (value.toUserId === user.id)
      throw validationError('Vous ne pouvez pas vous inviter vous-même.');
    await consumeRateLimit(`invite:${user.id}`, 20, 60 * 60);
    const db = await getDb();
    const recipient = (await db.query<Row>('SELECT id FROM users WHERE id=?', [value.toUserId]))[0];
    if (!recipient) throw new AppError('USER_NOT_FOUND', 404, 'Ce joueur n’existe pas.');
    const activeKey = `${user.id}:${value.toUserId}`;
    const invitation = await db.execute(
      `INSERT INTO invitations(from_user_id,to_user_id,mode,time_limit_seconds,increment_seconds,active_key,expires_at)
       VALUES(?,?,?,?,?,?,?)`,
      [
        user.id,
        value.toUserId,
        value.mode,
        value.timeLimitMinutes * 60,
        value.incrementSeconds,
        activeKey,
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      ],
    );
    return success({ invitationId: invitation.insertId }, requestId, 201);
  } catch (error) {
    return failure(error, requestId);
  }
}
