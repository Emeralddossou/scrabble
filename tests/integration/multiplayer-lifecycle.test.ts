import { randomUUID } from 'node:crypto';

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getDb, resetDbSingletonForTests, type Database, type Row } from '@/server/db';
import { migrate } from '@/server/db/migrations';
import { acceptInvitation, createGame, gameAction, gameState } from '@/server/game/service';

const configuredDialect = process.env.DB_TYPE ?? 'sqlite';
const configuredUrl = process.env.DATABASE_URL;
let database: Database;

async function createUser(username: string): Promise<number> {
  const created = await database.execute('INSERT INTO users(username,password_hash) VALUES(?,?)', [
    username,
    'test-password-hash',
  ]);
  return created.insertId;
}

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
      ? `file:/tmp/scrabble-multiplayer-${process.pid}-${Date.now()}.db`
      : configuredUrl;
  resetDbSingletonForTests();
  database = await getDb();
  await migrate(database);
});

beforeEach(clearData);

describe(`cycle de vie multijoueur (${configuredDialect})`, () => {
  it('accepte une invitation une seule fois et crée une seule partie', async () => {
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    const invitation = await database.execute(
      `INSERT INTO invitations(from_user_id,to_user_id,mode,time_limit_seconds,increment_seconds,active_key,expires_at)
       VALUES(?,?,?,?,?,?,?)`,
      [alice, bob, 'timer', 900, 5, `${alice}:${bob}`, new Date(Date.now() + 60_000).toISOString()],
    );

    const gameId = await acceptInvitation(invitation.insertId, bob);
    expect(gameId).toBeGreaterThan(0);
    await expect(acceptInvitation(invitation.insertId, bob)).rejects.toThrow();

    const games = await database.query<Row>('SELECT id FROM games');
    const [savedInvitation] = await database.query<Row>(
      'SELECT status,active_key FROM invitations WHERE id=?',
      [invitation.insertId],
    );
    expect(games).toHaveLength(1);
    expect(savedInvitation.status).toBe('accepted');
    expect(savedInvitation.active_key).toBeNull();
  });

  it('laisse une partie libre active sans limite de temps', async () => {
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    const gameId = await createGame({
      userId: alice,
      opponentId: bob,
      mode: 'free',
      timeLimitMinutes: 1,
      incrementSeconds: 0,
    });
    await database.execute("UPDATE games SET turn_started_at='2000-01-01 00:00:00' WHERE id=?", [
      gameId,
    ]);

    const state = await gameState(gameId, bob);
    expect(state.status).toBe('active');
    expect(state.mode).toBe('free');
    expect(state.winner_id).toBeNull();
    expect(
      (state.players as Array<{ time_remaining: number }>).every(
        (player) => Number(player.time_remaining) === 0,
      ),
    ).toBe(true);
  });

  it('ajoute l’incrément au joueur après son tour chronométré', async () => {
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    const gameId = await createGame({
      userId: alice,
      opponentId: bob,
      mode: 'timer',
      timeLimitMinutes: 1,
      incrementSeconds: 5,
    });

    await gameAction({
      gameId,
      userId: alice,
      kind: 'pass',
      tileIds: [],
      expectedVersion: 1,
      actionId: randomUUID(),
    });

    const [aliceState] = await database.query<Row>(
      'SELECT time_remaining FROM game_players WHERE game_id=? AND user_id=?',
      [gameId, alice],
    );
    const [game] = await database.query<Row>('SELECT current_player_id FROM games WHERE id=?', [
      gameId,
    ]);
    expect(Number(aliceState.time_remaining)).toBeGreaterThanOrEqual(64);
    expect(Number(aliceState.time_remaining)).toBeLessThanOrEqual(65);
    expect(Number(game.current_player_id)).toBe(bob);
  });

  it('termine atomiquement une partie chronométrée et attribue la victoire une seule fois', async () => {
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    const gameId = await createGame({
      userId: alice,
      opponentId: bob,
      mode: 'timer',
      timeLimitMinutes: 1,
      incrementSeconds: 0,
    });
    await database.execute(
      'UPDATE game_players SET time_remaining=0 WHERE game_id=? AND user_id=?',
      [gameId, alice],
    );

    await expect(
      gameAction({
        gameId,
        userId: alice,
        kind: 'pass',
        tileIds: [],
        expectedVersion: 1,
        actionId: randomUUID(),
      }),
    ).rejects.toThrow();

    const state = await gameState(gameId, bob);
    await gameState(gameId, bob);
    expect(state.status).toBe('finished');
    expect(Number(state.winner_id)).toBe(bob);
    expect(state.end_reason).toBe('timeout');

    const users = await database.query<Row>('SELECT id,wins,losses,draws FROM users ORDER BY id');
    expect(Number(users.find((user) => Number(user.id) === bob)?.wins)).toBe(1);
    expect(Number(users.find((user) => Number(user.id) === alice)?.losses)).toBe(1);
  });

  it('attribue toujours la victoire à l’adversaire après un abandon, même à score égal', async () => {
    const alice = await createUser('Alice');
    const bob = await createUser('Bob');
    const gameId = await createGame({
      userId: alice,
      opponentId: bob,
      mode: 'free',
      timeLimitMinutes: 15,
      incrementSeconds: 0,
    });

    await gameAction({
      gameId,
      userId: alice,
      kind: 'resign',
      tileIds: [],
      expectedVersion: 1,
      actionId: randomUUID(),
    });

    const state = await gameState(gameId, bob);
    expect(state.status).toBe('finished');
    expect(Number(state.winner_id)).toBe(bob);
    expect(state.end_reason).toBe('resign');

    const [winner] = await database.query<Row>('SELECT wins,draws FROM users WHERE id=?', [bob]);
    const [loser] = await database.query<Row>('SELECT losses,draws FROM users WHERE id=?', [alice]);
    expect(Number(winner.wins)).toBe(1);
    expect(Number(winner.draws)).toBe(0);
    expect(Number(loser.losses)).toBe(1);
    expect(Number(loser.draws)).toBe(0);
  });
});
