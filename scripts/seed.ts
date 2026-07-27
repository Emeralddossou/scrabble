import { hashPassword } from '@/server/auth';
import { getDb } from '@/server/db';
import { migrate } from '@/server/db/migrations';

async function main(): Promise<void> {
  const db = await getDb();
  await migrate(db);
  const username = process.env.SEED_USERNAME ?? 'demo';
  const existing = await db.query('SELECT id FROM users WHERE username=?', [username]);
  if (!existing.length) {
    await db.execute('INSERT INTO users(username,password_hash,bio) VALUES(?,?,?)', [
      username,
      await hashPassword(process.env.SEED_PASSWORD ?? 'DemoScrabble!42'),
      'Compte de démonstration local.',
    ]);
  }
  process.stdout.write(`Compte ${username} prêt.\n`);
}

void main();
