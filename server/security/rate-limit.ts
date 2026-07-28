import { createHash } from 'node:crypto';

import { getDb, type Row } from '@/server/db';
import { AppError } from '@/server/security/errors';

function storageKey(identifier: string): string {
  if (identifier.length <= 120) return identifier;
  return `sha256:${createHash('sha256').update(identifier).digest('hex')}`;
}

export async function consumeRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const key = storageKey(identifier);
  const db = await getDb();
  const current = (
    await db.query<Row>(
      'SELECT attempts,locked_until,updated_at FROM login_attempts WHERE identifier=?',
      [key],
    )
  )[0];
  const now = Date.now();
  if (current?.locked_until && new Date(String(current.locked_until)).getTime() > now) {
    throw new AppError('RATE_LIMITED', 429, 'Trop de tentatives. Réessayez plus tard.');
  }
  const previous = current ? new Date(String(current.updated_at)).getTime() : 0;
  const attempts =
    current && now - previous < windowSeconds * 1000 ? Number(current.attempts) + 1 : 1;
  const lockedUntil = attempts >= limit ? new Date(now + windowSeconds * 1000).toISOString() : null;
  if (current) {
    await db.execute(
      'UPDATE login_attempts SET attempts=?,locked_until=?,updated_at=CURRENT_TIMESTAMP WHERE identifier=?',
      [attempts, lockedUntil, key],
    );
  } else {
    await db.execute('INSERT INTO login_attempts(identifier,attempts,locked_until) VALUES(?,?,?)', [
      key,
      attempts,
      lockedUntil,
    ]);
  }
  if (attempts > limit) {
    throw new AppError('RATE_LIMITED', 429, 'Trop de tentatives. Réessayez plus tard.');
  }
}

export async function clearRateLimit(identifier: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM login_attempts WHERE identifier=?', [storageKey(identifier)]);
}
