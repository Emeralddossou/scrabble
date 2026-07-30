import { describe, expect, it } from 'vitest';

import { createDatabase } from '@/server/db';
import { migrate } from '@/server/db/migrations';

describe('migrations SQLite', () => {
  it('applique le schéma versionné et ses contraintes', async () => {
    process.env.DB_TYPE = 'sqlite';
    process.env.DATABASE_URL = `file:/tmp/scrabble-integration-${process.pid}-${Date.now()}.db`;
    const database = await createDatabase();
    expect(await migrate(database)).toEqual([1, 2, 3, 4, 5]);
    expect(await migrate(database)).toEqual([]);
    await database.execute('INSERT INTO users(username,email,password_hash) VALUES(?,?,?)', [
      'alice',
      'alice@example.com',
      'hash',
    ]);
    await expect(
      database.execute('INSERT INTO users(username,password_hash) VALUES(?,?)', ['alice', 'hash']),
    ).rejects.toThrow();
    await expect(
      database.execute('INSERT INTO users(username,email,password_hash) VALUES(?,?,?)', [
        'alice2',
        'alice@example.com',
        'hash',
      ]),
    ).rejects.toThrow();
    await database.execute(
      `INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth,notification_hour,time_zone)
       VALUES(?,?,?,?,?,?)`,
      [1, 'https://push.example.test/subscription', 'public-key', 'auth-key', 18, 'Europe/Paris'],
    );
    await expect(
      database.execute(
        `INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth,notification_hour,time_zone)
         VALUES(?,?,?,?,?,?)`,
        [1, 'https://push.example.test/subscription', 'other-key', 'other-auth', 18, 'Europe/Paris'],
      ),
    ).rejects.toThrow();
  });
});
