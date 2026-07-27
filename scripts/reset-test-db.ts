import { getDb } from '@/server/db';

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') throw new Error('db:reset est réservé aux tests.');
  const db = await getDb();
  const tables = [
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
  ];
  await db.transaction(async (tx) => {
    for (const table of tables) await tx.execute(`DELETE FROM ${table}`);
  });
  process.stdout.write('Base de test réinitialisée.\n');
}

void main();
