import { randomUUID } from 'node:crypto';

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { hashPassword } from '@/server/auth';
import { getDb, resetDbSingletonForTests, type Database, type Row } from '@/server/db';
import { migrate } from '@/server/db/migrations';
import { createGame, gameAction, gameState } from '@/server/game/service';

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
      ? `file:/tmp/scrabble-solo-${process.pid}-${Date.now()}.db`
      : configuredUrl;
  resetDbSingletonForTests();
  database = await getDb();
  await migrate(database);
});

beforeEach(clearData);

describe(`cycle solo avec IA (${configuredDialect})`, () => {
  it('fait répondre le bot expert puis restitue le tour au joueur', async () => {
    const created = await database.execute(
      'INSERT INTO users(username,password_hash) VALUES(?,?)',
      ['SoloHuman', await hashPassword('Scrabble!2026')],
    );
    const { gameId } = await createGame({
      userId: created.insertId,
      mode: 'free',
      timeLimitMinutes: 15,
      incrementSeconds: 0,
      aiLevel: 'hard',
    });

    await gameAction({
      gameId,
      userId: created.insertId,
      kind: 'pass',
      tileIds: [],
      expectedVersion: 1,
      actionId: randomUUID(),
    });

    const state = await gameState(gameId, created.insertId);
    expect(Number(state.current_player_id)).toBe(created.insertId);
    const moves = state.moves as Array<{ username: string; kind: string }>;
    expect(moves[0]?.kind).toBe('pass');
    expect(moves.some((move) => move.username === 'LexiBot-hard')).toBe(true);
    expect(moves.some((move) => ['play', 'exchange', 'pass'].includes(move.kind))).toBe(true);

    const [game] = await database.query<Row>('SELECT ai_level,is_solo FROM games WHERE id=?', [
      gameId,
    ]);
    expect(game.ai_level).toBe('hard');
    expect(Number(game.is_solo)).toBe(1);
  });
});
