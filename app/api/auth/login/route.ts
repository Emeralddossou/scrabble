import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createSession, verifyPassword } from '@/server/auth';
import { getDb, type Row } from '@/server/db';
import { assertMutationOrigin, body, failure, success } from '@/server/http';
import { AppError } from '@/server/security/errors';
import { clearRateLimit, consumeRateLimit } from '@/server/security/rate-limit';

export const runtime = 'nodejs';
const input = z.object({ username: z.string().trim().min(1).max(24), password: z.string().min(1) });

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const value = await body(request, input);
    const key = `login:${value.username.toLowerCase()}`;
    await consumeRateLimit(key, 5, 15 * 60);
    const db = await getDb();
    const user = (
      await db.query<Row>('SELECT id,username,password_hash FROM users WHERE username=?', [
        value.username,
      ])
    )[0];
    if (!user || !(await verifyPassword(value.password, String(user.password_hash)))) {
      throw new AppError('INVALID_CREDENTIALS', 401, 'Identifiants invalides.');
    }
    await clearRateLimit(key);
    await db.execute('UPDATE users SET last_seen=CURRENT_TIMESTAMP WHERE id=?', [user.id]);
    await createSession({ id: Number(user.id), username: String(user.username) });
    return success({ user: { id: Number(user.id), username: String(user.username) } }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
