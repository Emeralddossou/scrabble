import { getDb } from '@/server/db';
import { migrate } from '@/server/db/migrations';

async function main(): Promise<void> {
  const applied = await migrate(await getDb());
  process.stdout.write(
    applied.length ? `Migrations appliquées : ${applied.join(', ')}\n` : 'Schéma déjà à jour.\n',
  );
}

void main();
