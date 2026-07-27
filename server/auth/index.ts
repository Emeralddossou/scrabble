import { cookies } from 'next/headers';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { getDb, type Row } from '@/server/db';
import { AppError, unauthorized, validationError } from '@/server/security/errors';

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = 'scrabble_session';
const SESSION_IDLE_SECONDS = 2 * 60 * 60;

export type SessionUser = { id: number; username: string };

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32 || /change|example|replace|secret/i.test(secret)) {
    throw new Error('AUTH_SECRET doit être une valeur aléatoire d’au moins 32 caractères.');
  }
  return secret;
}

function tokenHash(token: string): string {
  return createHmac('sha256', authSecret()).update(token).digest('hex');
}

export function validatePassword(password: string): boolean {
  return (
    password.length >= 10 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    // PHP bcrypt hashes are intentionally handled by the migration login bridge when bcrypt is installed.
    return false;
  }
  const [algorithm, salt, digest] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !digest) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(digest, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(user: SessionUser): Promise<void> {
  const rawToken = randomBytes(32).toString('base64url');
  const expiry = new Date(Date.now() + SESSION_IDLE_SECONDS * 1000).toISOString();
  const db = await getDb();
  await db.execute('INSERT INTO sessions(user_id,token_hash,expires_at) VALUES(?,?,?)', [
    user.id,
    tokenHash(rawToken),
    expiry,
  ]);
  const store = await cookies();
  store.set(COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_IDLE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  const rawToken = store.get(COOKIE_NAME)?.value;
  if (rawToken) {
    const db = await getDb();
    await db.execute('UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?', [
      tokenHash(rawToken),
    ]);
  }
  store.delete(COOKIE_NAME);
}

export async function currentUser(): Promise<SessionUser | null> {
  const rawToken = (await cookies()).get(COOKIE_NAME)?.value;
  if (!rawToken) return null;
  const db = await getDb();
  const rows = await db.query<Row>(
    `SELECT u.id,u.username,s.id AS session_id FROM sessions s
     JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP`,
    [tokenHash(rawToken)],
  );
  const session = rows[0];
  if (!session) return null;
  const nextExpiry = new Date(Date.now() + SESSION_IDLE_SECONDS * 1000).toISOString();
  await db.execute('UPDATE sessions SET last_seen_at=CURRENT_TIMESTAMP,expires_at=? WHERE id=?', [
    nextExpiry,
    session.session_id,
  ]);
  return { id: Number(session.id), username: String(session.username) };
}

export async function requireUser(): Promise<SessionUser> {
  return (await currentUser()) ?? Promise.reject(unauthorized());
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  if (!validatePassword(nextPassword))
    throw validationError('Le mot de passe ne respecte pas la politique de sécurité.');
  const db = await getDb();
  const user = (await db.query<Row>('SELECT password_hash FROM users WHERE id=?', [userId]))[0];
  if (!user || !(await verifyPassword(currentPassword, String(user.password_hash)))) {
    throw new AppError('INVALID_CREDENTIALS', 401, 'Mot de passe actuel incorrect.');
  }
  await db.transaction(async (tx) => {
    await tx.execute('UPDATE users SET password_hash=? WHERE id=?', [
      await hashPassword(nextPassword),
      userId,
    ]);
    await tx.execute('UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=?', [userId]);
  });
}

export async function issuePasswordReset(username: string): Promise<string | null> {
  const db = await getDb();
  const user = (await db.query<Row>('SELECT id FROM users WHERE username=?', [username]))[0];
  if (!user) return null;
  const rawToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await db.transaction(async (tx) => {
    await tx.execute(
      'UPDATE password_resets SET used_at=CURRENT_TIMESTAMP WHERE user_id=? AND used_at IS NULL',
      [user.id],
    );
    await tx.execute('INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES(?,?,?)', [
      user.id,
      tokenHash(rawToken),
      expiresAt,
    ]);
  });
  return rawToken;
}

export async function resetPassword(rawToken: string, password: string): Promise<void> {
  if (!validatePassword(password))
    throw validationError('Le mot de passe ne respecte pas la politique de sécurité.');
  const db = await getDb();
  await db.transaction(async (tx) => {
    const reset = (
      await tx.query<Row>(
        'SELECT id,user_id FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP',
        [tokenHash(rawToken)],
      )
    )[0];
    if (!reset)
      throw new AppError(
        'INVALID_RESET_TOKEN',
        400,
        'Ce lien de réinitialisation est invalide ou expiré.',
      );
    await tx.execute(
      'UPDATE password_resets SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL',
      [reset.id],
    );
    await tx.execute('UPDATE users SET password_hash=? WHERE id=?', [
      await hashPassword(password),
      reset.user_id,
    ]);
    await tx.execute('UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=?', [
      reset.user_id,
    ]);
  });
}
