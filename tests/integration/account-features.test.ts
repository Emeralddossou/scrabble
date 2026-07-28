import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  changePassword,
  hashPassword,
  issuePasswordReset,
  resetPassword,
  verifyPassword,
} from '@/server/auth';
import { getDb, resetDbSingletonForTests, type Database, type Row } from '@/server/db';
import { migrate } from '@/server/db/migrations';

const configuredDialect = process.env.DB_TYPE ?? 'sqlite';
const configuredUrl = process.env.DATABASE_URL;
let database: Database;

async function clearData(): Promise<void> {
  for (const table of [
    'game_actions',
    'moves',
    'game_players',
    'games',
    'invitations',
    'presence',
    'password_resets',
    'sessions',
    'login_attempts',
    'users',
  ]) {
    await database.execute(`DELETE FROM ${table}`);
  }
}

beforeAll(async () => {
  process.env.DB_TYPE = configuredDialect;
  process.env.DATABASE_URL =
    configuredDialect === 'sqlite'
      ? `file:/tmp/scrabble-account-${process.pid}-${Date.now()}.db`
      : configuredUrl;
  resetDbSingletonForTests();
  database = await getDb();
  await migrate(database);
});

beforeEach(clearData);

describe(`fonctions de compte (${configuredDialect})`, () => {
  it('stocke une adresse de récupération unique après la migration', async () => {
    const passwordHash = await hashPassword('Initial!2026');
    await database.execute(
      'INSERT INTO users(username,email,password_hash,avatar) VALUES(?,?,?,?)',
      ['ProfilTest', 'profil@example.com', passwordHash, 'owl'],
    );
    const [user] = await database.query<Row>('SELECT email,avatar FROM users WHERE username=?', [
      'ProfilTest',
    ]);
    expect(user.email).toBe('profil@example.com');
    expect(user.avatar).toBe('owl');
    await expect(
      database.execute('INSERT INTO users(username,email,password_hash) VALUES(?,?,?)', [
        'DuplicateEmail',
        'profil@example.com',
        passwordHash,
      ]),
    ).rejects.toThrow();
  });

  it('réinitialise puis change le mot de passe en révoquant les sessions', async () => {
    const created = await database.execute(
      'INSERT INTO users(username,email,password_hash) VALUES(?,?,?)',
      ['Recoverable', 'recover@example.com', await hashPassword('Initial!2026')],
    );
    await database.execute(
      'INSERT INTO sessions(user_id,token_hash,expires_at) VALUES(?,?,?)',
      [created.insertId, 'test-session-token', new Date(Date.now() + 60_000).toISOString()],
    );

    const token = await issuePasswordReset('Recoverable');
    expect(token).toBeTruthy();
    await resetPassword(String(token), 'ResetDone!2026');
    let [user] = await database.query<Row>('SELECT password_hash FROM users WHERE id=?', [
      created.insertId,
    ]);
    expect(await verifyPassword('ResetDone!2026', String(user.password_hash))).toBe(true);

    await changePassword(created.insertId, 'ResetDone!2026', 'FinalPass!2026');
    [user] = await database.query<Row>('SELECT password_hash FROM users WHERE id=?', [created.insertId]);
    expect(await verifyPassword('FinalPass!2026', String(user.password_hash))).toBe(true);
    const [session] = await database.query<Row>('SELECT revoked_at FROM sessions WHERE user_id=?', [
      created.insertId,
    ]);
    expect(session.revoked_at).toBeTruthy();
  });
});
