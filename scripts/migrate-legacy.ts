import { readFile } from 'node:fs/promises';

import { getDb, type Database } from '@/server/db';
import { migrate } from '@/server/db/migrations';

type LegacyExport = {
  users?: Array<{
    id: number;
    username: string;
    password_hash: string;
    wins?: number;
    losses?: number;
    draws?: number;
  }>;
  games?: Array<Record<string, unknown>>;
  game_players?: Array<Record<string, unknown>>;
  moves?: Array<Record<string, unknown>>;
  invitations?: Array<Record<string, unknown>>;
};

function argument(name: string): string | undefined {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function importRows(db: Database, exported: LegacyExport): Promise<Record<string, number>> {
  const report = { users: 0, games: 0, game_players: 0, moves: 0, invitations: 0 };
  await db.transaction(async (tx) => {
    for (const user of exported.users ?? []) {
      const result = await tx.execute(
        'INSERT INTO users(id,username,password_hash,wins,losses,draws) VALUES(?,?,?,?,?,?)',
        [
          user.id,
          user.username,
          user.password_hash,
          user.wins ?? 0,
          user.losses ?? 0,
          user.draws ?? 0,
        ],
      );
      report.users += result.affectedRows;
    }
    for (const game of exported.games ?? []) {
      const result = await tx.execute(
        `INSERT INTO games(id,status,mode,is_solo,current_player_id,winner_id,board,bag,version,consecutive_scoreless,time_limit_seconds,increment_seconds)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          game.id,
          game.status ?? 'finished',
          game.mode ?? 'free',
          game.is_solo ?? 0,
          game.current_player_id ?? null,
          game.winner_id ?? null,
          game.board ?? '[]',
          game.bag ?? '[]',
          game.version ?? 1,
          game.consecutive_passes ?? 0,
          Number(game.time_limit ?? 0) * 60,
          game.increment ?? 0,
        ],
      );
      report.games += result.affectedRows;
    }
    for (const player of exported.game_players ?? []) {
      const result = await tx.execute(
        'INSERT INTO game_players(game_id,user_id,rack,score,time_remaining,turn_order) VALUES(?,?,?,?,?,?)',
        [
          player.game_id,
          player.user_id,
          player.rack ?? '[]',
          player.score ?? 0,
          player.time_remaining ?? 0,
          player.turn_order ?? 1,
        ],
      );
      report.game_players += result.affectedRows;
    }
    for (const move of exported.moves ?? []) {
      const result = await tx.execute(
        'INSERT INTO moves(id,game_id,user_id,kind,words,points,placements) VALUES(?,?,?,?,?,?,?)',
        [
          move.id,
          move.game_id,
          move.user_id ?? null,
          move.move_type ?? 'play',
          move.word ? JSON.stringify([move.word]) : '[]',
          move.points ?? 0,
          move.coordinates ?? '[]',
        ],
      );
      report.moves += result.affectedRows;
    }
  });
  return report;
}

async function main(): Promise<void> {
  const source = argument('source');
  const dryRun = process.argv.includes('--dry-run');
  if (!source)
    throw new Error('Utilisation : npm run migrate:legacy -- --source=export.json [--dry-run]');
  const exported = JSON.parse(await readFile(source, 'utf8')) as LegacyExport;
  const db = await getDb();
  await migrate(db);
  const existing = await db.query('SELECT id FROM users LIMIT 1');
  if (existing.length)
    throw new Error('La base cible n’est pas vide ; restaurez une base vierge avant import.');
  const report = dryRun
    ? {
        users: exported.users?.length ?? 0,
        games: exported.games?.length ?? 0,
        game_players: exported.game_players?.length ?? 0,
        moves: exported.moves?.length ?? 0,
        invitations: exported.invitations?.length ?? 0,
      }
    : await importRows(db, exported);
  process.stdout.write(`${JSON.stringify({ dryRun, report })}\n`);
}

void main();
