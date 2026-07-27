import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createSession, hashPassword, validatePassword } from '@/server/auth';
import { getDb, type Row } from '@/server/db';
import { assertMutationOrigin, body, failure, success } from '@/server/http';
import { AppError, validationError } from '@/server/security/errors';
import { consumeRateLimit } from '@/server/security/rate-limit';

export const runtime = 'nodejs';

const input = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[\p{L}\p{N}_-]+$/u),
  password: z.string(),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const value = await body(request, input);
    await consumeRateLimit(`register:${value.username.toLowerCase()}`, 5, 15 * 60);
    if (!validatePassword(value.password))
      throw validationError(
        'Le mot de passe doit contenir 10 caractères, une majuscule, une minuscule, un chiffre et un symbole.',
      );
    const db = await getDb();
    const exists = (
      await db.query<Row>('SELECT id FROM users WHERE username=?', [value.username])
    )[0];
    if (exists) throw new AppError('USERNAME_TAKEN', 409, 'Ce nom de joueur est déjà utilisé.');
    const created = await db.execute('INSERT INTO users(username,password_hash) VALUES(?,?)', [
      value.username,
      await hashPassword(value.password),
    ]);
    await createSession({ id: created.insertId, username: value.username });
    return success({ user: { id: created.insertId, username: value.username } }, requestId, 201);
  } catch (error) {
    return failure(error, requestId);
  }
}
