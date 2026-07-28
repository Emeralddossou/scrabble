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
  email: z.union([z.literal(''), z.string().trim().toLowerCase().email().max(320)]).optional(),
  password: z.string(),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    assertMutationOrigin(request);
    const value = await body(request, input);
    await consumeRateLimit(`register:${value.username.toLowerCase()}`, 5, 15 * 60);
    if (!validatePassword(value.password)) {
      throw validationError(
        'Le mot de passe doit contenir 10 caractères, une majuscule, une minuscule, un chiffre et un symbole.',
      );
    }
    const email = value.email || null;
    const db = await getDb();
    const usernameExists = (
      await db.query<Row>('SELECT id FROM users WHERE LOWER(username)=LOWER(?)', [value.username])
    )[0];
    if (usernameExists) {
      throw new AppError('USERNAME_TAKEN', 409, 'Ce nom de joueur est déjà utilisé.');
    }
    if (email) {
      const emailExists = (
        await db.query<Row>('SELECT id FROM users WHERE LOWER(email)=LOWER(?)', [email])
      )[0];
      if (emailExists) {
        throw new AppError('EMAIL_TAKEN', 409, 'Cette adresse e-mail est déjà utilisée.');
      }
    }
    const created = await db.execute(
      'INSERT INTO users(username,email,password_hash,avatar) VALUES(?,?,?,?)',
      [value.username, email, await hashPassword(value.password), 'tile'],
    );
    await createSession({ id: created.insertId, username: value.username });
    return success({ user: { id: created.insertId, username: value.username } }, requestId, 201);
  } catch (error) {
    return failure(error, requestId);
  }
}
