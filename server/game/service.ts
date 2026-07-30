import { randomUUID } from 'node:crypto';

import { emptyBoard, validateAndScore } from '@/domain/scrabble/rules';
import { createBag, draw, rackValue } from '@/domain/scrabble/tiles';
import type {
  Board,
  GameMode,
  MoveKind,
  Placement,
  Tile,
  WordScore,
} from '@/domain/scrabble/types';
import { getDb, type Database, type Row } from '@/server/db';
import { getDictionary } from '@/server/game/dictionary';
import { chooseAiMove, suggestMoves, type AiLevel } from '@/server/game/suggestions';
import { conflict, forbidden, notFound, validationError } from '@/server/security/errors';

type GameRow = Row & {
  id: number;
  uuid: string;
  status: string;
  mode: GameMode;
  is_solo: number;
  current_player_id: number;
  time_limit_seconds: number;
  increment_seconds: number;
  board: string;
  bag: string;
  version: number;
  consecutive_scoreless: number;
  turn_started_at: string | Date;
  ai_level: string | null;
  share_enabled: number;
  share_token: string | null;
};
type PlayerRow = Row & {
  game_id: number;
  user_id: number;
  rack: string;
  score: number;
  time_remaining: number;
  turn_order: number;
};
type ActionResponse = Record<string, unknown>;
type ActionTransactionResult = { timedOut: true } | { timedOut: false; response: ActionResponse };
type CreateGameInput = {
  userId: number;
  opponentId?: number;
  mode: GameMode;
  timeLimitMinutes: number;
  incrementSeconds: number;
  aiLevel?: AiLevel;
};

const parse = <T>(value: unknown): T =>
  typeof value === 'string' ? (JSON.parse(value) as T) : (value as T);
const json = (value: unknown): string => JSON.stringify(value);

function activeLockSql(dialect: Database['dialect']): string {
  return dialect === 'mysql' ? ' FOR UPDATE' : '';
}

function currentRemaining(game: GameRow, player: PlayerRow, now = Date.now()): number {
  if (game.mode !== 'timer' || Number(game.current_player_id) !== Number(player.user_id)) {
    return Number(player.time_remaining);
  }
  const rawStartedAt = game.turn_started_at;
  const startedAt =
    rawStartedAt instanceof Date
      ? rawStartedAt.getTime()
      : Date.parse(
          /(?:Z|[+-]\d{2}:\d{2})$/.test(rawStartedAt)
            ? rawStartedAt
            : `${rawStartedAt.replace(' ', 'T')}Z`,
        );
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  return Math.max(0, Number(player.time_remaining) - elapsed);
}

function shuffleTiles(tiles: Tile[]): Tile[] {
  const shuffled = [...tiles];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

async function ensureBot(tx: Database, level: string): Promise<number> {
  const username = `LexiBot-${level}`;
  const existing = (await tx.query<Row>('SELECT id FROM users WHERE username=?', [username]))[0];
  if (existing) return Number(existing.id);
  const created = await tx.execute('INSERT INTO users(username,password_hash,bio) VALUES(?,?,?)', [
    username,
    'disabled-ai-account',
    'Joueur automatique de LexiForge.',
  ]);
  return created.insertId;
}

async function createGameInTransaction(
  tx: Database,
  input: CreateGameInput,
): Promise<{ gameId: number; uuid: string }> {
  const opponentId = input.aiLevel ? await ensureBot(tx, input.aiLevel) : input.opponentId;
  if (!opponentId) throw validationError('Un adversaire est requis.');
  if (Number(opponentId) === Number(input.userId)) {
    throw validationError('Vous ne pouvez pas jouer contre vous-même.');
  }

  const participants = await tx.query<Row>('SELECT id FROM users WHERE id IN (?,?)', [
    input.userId,
    opponentId,
  ]);
  if (new Set(participants.map((participant) => Number(participant.id))).size !== 2) {
    throw validationError('Un des joueurs est introuvable.');
  }

  const uuid = randomUUID();
  let bag = createBag();
  const first = draw(bag, 7);
  bag = first.bag;
  const second = draw(bag, 7);
  bag = second.bag;
  const seconds = input.mode === 'timer' ? input.timeLimitMinutes * 60 : 0;
  const game = await tx.execute(
    `INSERT INTO games(uuid,status,mode,is_solo,ai_level,current_player_id,time_limit_seconds,increment_seconds,board,bag)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [
      uuid,
      'active',
      input.mode,
      input.aiLevel ? 1 : 0,
      input.aiLevel ?? null,
      input.userId,
      seconds,
      input.incrementSeconds,
      json(emptyBoard()),
      json(bag),
    ],
  );
  await tx.execute(
    'INSERT INTO game_players(game_id,user_id,rack,score,time_remaining,turn_order) VALUES(?,?,?,?,?,?)',
    [game.insertId, input.userId, json(first.tiles), 0, seconds, 1],
  );
  await tx.execute(
    'INSERT INTO game_players(game_id,user_id,rack,score,time_remaining,turn_order) VALUES(?,?,?,?,?,?)',
    [game.insertId, opponentId, json(second.tiles), 0, seconds, 2],
  );
  return { gameId: game.insertId, uuid };
}

export async function createGame(
  input: CreateGameInput,
): Promise<{ gameId: number; uuid: string }> {
  const db = await getDb();
  return db.transaction((tx) => createGameInTransaction(tx, input));
}

export async function acceptInvitation(
  invitationId: number,
  recipientId: number,
): Promise<{ gameId: number; uuid: string }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const invitation = (
      await tx.query<Row>(
        `SELECT * FROM invitations
         WHERE id=? AND status='pending' AND expires_at>CURRENT_TIMESTAMP${activeLockSql(tx.dialect)}`,
        [invitationId],
      )
    )[0];
    if (!invitation) throw conflict('Invitation introuvable, expirée ou déjà traitée.');
    if (Number(invitation.to_user_id) !== recipientId) {
      throw forbidden('Cette invitation ne vous est pas destinée.');
    }

    const changed = await tx.execute(
      "UPDATE invitations SET status='accepted',active_key=NULL WHERE id=? AND status='pending'",
      [invitationId],
    );
    if (changed.affectedRows !== 1) throw conflict('Invitation déjà traitée.');

    return createGameInTransaction(tx, {
      userId: Number(invitation.from_user_id),
      opponentId: recipientId,
      mode: invitation.mode === 'timer' ? 'timer' : 'free',
      timeLimitMinutes: Math.max(1, Math.floor(Number(invitation.time_limit_seconds) / 60)),
      incrementSeconds: Number(invitation.increment_seconds),
    });
  });
}

export async function resolveGameUuid(uuid: string): Promise<number> {
  const db = await getDb();
  const game = (await db.query<GameRow>('SELECT id FROM games WHERE uuid=?', [uuid]))[0];
  if (!game) throw validationError('Partie introuvable.');
  return Number(game.id);
}

async function gameAndPlayer(
  tx: Database,
  gameId: number,
  userId: number,
): Promise<{ game: GameRow; player: PlayerRow }> {
  const game = (
    await tx.query<GameRow>(`SELECT * FROM games WHERE id=?${activeLockSql(tx.dialect)}`, [gameId])
  )[0];
  if (!game) throw validationError('Partie introuvable.');
  const player = (
    await tx.query<PlayerRow>(
      `SELECT * FROM game_players WHERE game_id=? AND user_id=?${activeLockSql(tx.dialect)}`,
      [gameId, userId],
    )
  )[0];
  if (!player) throw forbidden('Vous ne participez pas à cette partie.');
  return { game, player };
}

async function persistAction(
  tx: Database,
  gameId: number,
  userId: number,
  actionId: string,
  response: ActionResponse,
): Promise<void> {
  await tx.execute('INSERT INTO game_actions(game_id,user_id,action_id,response) VALUES(?,?,?,?)', [
    gameId,
    userId,
    actionId,
    json(response),
  ]);
}

async function priorAction(
  tx: Database,
  gameId: number,
  userId: number,
  actionId: string,
): Promise<ActionResponse | null> {
  const action = (
    await tx.query<Row>(
      'SELECT response FROM game_actions WHERE game_id=? AND user_id=? AND action_id=?',
      [gameId, userId, actionId],
    )
  )[0];
  return action ? parse<ActionResponse>(action.response) : null;
}

async function finalize(
  tx: Database,
  game: GameRow,
  reason: 'empty_rack' | 'scoreless' | 'resign' | 'timeout',
  emptiedUserId?: number,
  winnerHint?: number,
): Promise<boolean> {
  const changed = await tx.execute(
    "UPDATE games SET status='finished',end_reason=?,ended_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND status='active'",
    [reason, game.id],
  );
  if (changed.affectedRows !== 1) return false;

  const players = await tx.query<PlayerRow>(
    'SELECT * FROM game_players WHERE game_id=? ORDER BY turn_order',
    [game.id],
  );
  const penalties = new Map(
    players.map((player) => [Number(player.user_id), rackValue(parse<Tile[]>(player.rack))]),
  );
  for (const player of players) {
    await tx.execute('UPDATE game_players SET score=score-? WHERE game_id=? AND user_id=?', [
      penalties.get(Number(player.user_id)) ?? 0,
      game.id,
      player.user_id,
    ]);
  }
  if (emptiedUserId) {
    const bonus = players
      .filter((player) => Number(player.user_id) !== emptiedUserId)
      .reduce((total, player) => total + (penalties.get(Number(player.user_id)) ?? 0), 0);
    await tx.execute('UPDATE game_players SET score=score+? WHERE game_id=? AND user_id=?', [
      bonus,
      game.id,
      emptiedUserId,
    ]);
  }

  const ranked = await tx.query<Row>(
    'SELECT user_id,score FROM game_players WHERE game_id=? ORDER BY score DESC,user_id',
    [game.id],
  );
  // Exclure les comptes bots des mises à jour de statistiques.
  const botNames = new Set(
    (
      await tx.query<Row>(
        "SELECT id FROM users WHERE username LIKE 'LexiBot-%' AND id IN (?,?)",
        [ranked[0]?.user_id, ranked[1]?.user_id],
      )
    ).map((row) => Number(row.id)),
  );
  const forcedWinner = winnerHint !== undefined;
  const tie =
    !forcedWinner && ranked.length > 1 && Number(ranked[0].score) === Number(ranked[1].score);
  const winnerId = forcedWinner ? winnerHint : tie ? null : Number(ranked[0]?.user_id ?? 0);
  await tx.execute('UPDATE games SET winner_id=? WHERE id=?', [winnerId ?? null, game.id]);

  if (ranked.length === 2) {
    const humanIds = [Number(ranked[0].user_id), Number(ranked[1].user_id)].filter(
      (id) => !botNames.has(id),
    );
    if (tie && humanIds.length > 0) {
      await tx.execute('UPDATE users SET draws=draws+1 WHERE id IN (?,?)', humanIds);
    } else if (!tie) {
      if (!botNames.has(Number(winnerId))) {
        await tx.execute('UPDATE users SET wins=wins+1 WHERE id=?', [winnerId]);
      }
      const loserIds = [Number(ranked[0].user_id), Number(ranked[1].user_id)].filter(
        (id) => id !== Number(winnerId) && !botNames.has(id),
      );
      if (loserIds.length > 0) {
        await tx.execute('UPDATE users SET losses=losses+1 WHERE id IN (?,?)', loserIds);
      }
    }
  }
  return true;
}

async function finalizeTimedOutPlayer(
  tx: Database,
  game: GameRow,
  activePlayer: PlayerRow,
): Promise<boolean> {
  if (
    game.status !== 'active' ||
    game.mode !== 'timer' ||
    Number(game.current_player_id) !== Number(activePlayer.user_id) ||
    currentRemaining(game, activePlayer) > 0
  ) {
    return false;
  }

  const opponent = (
    await tx.query<PlayerRow>('SELECT * FROM game_players WHERE game_id=? AND user_id<>?', [
      game.id,
      activePlayer.user_id,
    ])
  )[0];
  await tx.execute('UPDATE game_players SET time_remaining=0 WHERE game_id=? AND user_id=?', [
    game.id,
    activePlayer.user_id,
  ]);
  const finalized = await finalize(tx, game, 'timeout', undefined, Number(opponent?.user_id));
  if (finalized) {
    await tx.execute(
      'INSERT INTO moves(game_id,user_id,kind,words,points,placements,snapshot) VALUES(?,?,?,?,?,?,?)',
      [game.id, activePlayer.user_id, 'timeout', '[]', 0, '[]', game.board],
    );
  }
  return finalized;
}

async function expireTimedOutGame(gameId: number): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const game = (
      await tx.query<GameRow>(`SELECT * FROM games WHERE id=?${activeLockSql(tx.dialect)}`, [
        gameId,
      ])
    )[0];
    if (!game || game.status !== 'active' || game.mode !== 'timer') return false;

    const activePlayer = (
      await tx.query<PlayerRow>(
        `SELECT * FROM game_players WHERE game_id=? AND user_id=?${activeLockSql(tx.dialect)}`,
        [game.id, game.current_player_id],
      )
    )[0];
    return activePlayer ? finalizeTimedOutPlayer(tx, game, activePlayer) : false;
  });
}

function assertActiveTurn(game: GameRow, player: PlayerRow): void {
  if (game.status !== 'active') throw conflict('Cette partie est terminée.');
  if (Number(game.current_player_id) !== Number(player.user_id)) {
    throw conflict('Ce n’est pas votre tour.');
  }
}

function assertExpectedVersion(game: GameRow, expectedVersion: number): void {
  if (Number(game.version) !== expectedVersion) {
    throw conflict('La partie a changé. Rechargez son état.');
  }
}

async function advanceTurn(
  tx: Database,
  game: GameRow,
  actor: PlayerRow,
  scoreless: number,
): Promise<void> {
  const opponent = (
    await tx.query<PlayerRow>(
      'SELECT * FROM game_players WHERE game_id=? AND user_id<>? ORDER BY turn_order',
      [game.id, actor.user_id],
    )
  )[0];
  const remaining = currentRemaining(game, actor);
  const nextTime =
    game.mode === 'timer'
      ? remaining + Number(game.increment_seconds)
      : Number(actor.time_remaining);
  await tx.execute('UPDATE game_players SET time_remaining=? WHERE game_id=? AND user_id=?', [
    nextTime,
    game.id,
    actor.user_id,
  ]);
  const update = await tx.execute(
    `UPDATE games SET current_player_id=?,turn_started_at=CURRENT_TIMESTAMP,consecutive_scoreless=?,version=version+1
     WHERE id=? AND version=? AND status='active'`,
    [opponent?.user_id ?? actor.user_id, scoreless, game.id, game.version],
  );
  if (update.affectedRows !== 1) throw conflict('Une autre action a déjà modifié la partie.');
}

export async function playMove(input: {
  gameId: number;
  userId: number;
  placements: Placement[];
  expectedVersion: number;
  actionId: string;
}): Promise<ActionResponse> {
  await expireTimedOutGame(input.gameId);
  const db = await getDb();
  const outcome = await db.transaction<ActionTransactionResult>(async (tx) => {
    const previous = await priorAction(tx, input.gameId, input.userId, input.actionId);
    if (previous) return { timedOut: false, response: previous };
    const { game, player } = await gameAndPlayer(tx, input.gameId, input.userId);
    assertActiveTurn(game, player);
    if (await finalizeTimedOutPlayer(tx, game, player)) return { timedOut: true };
    assertExpectedVersion(game, input.expectedVersion);

    const rack = parse<Tile[]>(player.rack);
    const result = validateAndScore(
      parse<Board>(game.board),
      rack,
      input.placements,
      await getDictionary(),
    );
    if (!result.valid) throw validationError(result.error);

    const tileIds = new Set(input.placements.map((placement) => placement.tileId));
    const remaining = rack.filter((tile) => !tileIds.has(tile.id));
    const refill = draw(parse<Tile[]>(game.bag), 7 - remaining.length);
    const finalRack = [...remaining, ...refill.tiles];
    await tx.execute('UPDATE game_players SET rack=?,score=score+? WHERE game_id=? AND user_id=?', [
      json(finalRack),
      result.score,
      game.id,
      player.user_id,
    ]);
    await tx.execute('UPDATE games SET board=?,bag=? WHERE id=?', [
      json(result.board),
      json(refill.bag),
      game.id,
    ]);
    await tx.execute(
      'INSERT INTO moves(game_id,user_id,kind,words,points,placements,snapshot) VALUES(?,?,?,?,?,?,?)',
      [
        game.id,
        player.user_id,
        'play',
        json(result.words),
        result.score,
        json(input.placements),
        json(result.board),
      ],
    );

    const scoreless = result.score === 0 ? Number(game.consecutive_scoreless) + 1 : 0;
    await advanceTurn(tx, game, player, scoreless);
    if (refill.bag.length === 0 && finalRack.length === 0) {
      await finalize(tx, game, 'empty_rack', input.userId);
    } else if (scoreless >= 6) {
      await finalize(tx, game, 'scoreless');
    }

    const response = { score: result.score, words: result.words };
    await persistAction(tx, game.id, input.userId, input.actionId, response);
    return { timedOut: false, response };
  });
  if (outcome.timedOut) throw conflict('Votre temps est écoulé.');
  await maybePlayAi(input.gameId);
  return outcome.response;
}

export async function gameAction(input: {
  gameId: number;
  userId: number;
  kind: Exclude<MoveKind, 'play' | 'timeout' | 'end'>;
  tileIds: string[];
  expectedVersion: number;
  actionId: string;
}): Promise<ActionResponse> {
  await expireTimedOutGame(input.gameId);
  const db = await getDb();
  const outcome = await db.transaction<ActionTransactionResult>(async (tx) => {
    const previous = await priorAction(tx, input.gameId, input.userId, input.actionId);
    if (previous) return { timedOut: false, response: previous };
    const { game, player } = await gameAndPlayer(tx, input.gameId, input.userId);
    assertActiveTurn(game, player);
    if (await finalizeTimedOutPlayer(tx, game, player)) return { timedOut: true };
    assertExpectedVersion(game, input.expectedVersion);

    const opponent = (
      await tx.query<PlayerRow>('SELECT * FROM game_players WHERE game_id=? AND user_id<>?', [
        game.id,
        player.user_id,
      ])
    )[0];

    if (input.kind === 'resign') {
      await tx.execute(
        'INSERT INTO moves(game_id,user_id,kind,words,points,placements,snapshot) VALUES(?,?,?,?,?,?,?)',
        [game.id, player.user_id, 'resign', '[]', 0, '[]', game.board],
      );
      await finalize(tx, game, 'resign', undefined, Number(opponent?.user_id));
    } else {
      if (input.kind === 'exchange') {
        const rack = parse<Tile[]>(player.rack);
        const ids = new Set(input.tileIds);
        const removed = rack.filter((tile) => ids.has(tile.id));
        const bag = parse<Tile[]>(game.bag);
        if (removed.length === 0 || removed.length !== ids.size) {
          throw validationError('Sélection de lettres invalide.');
        }
        if (bag.length < 7) {
          throw validationError('Il faut au moins sept lettres dans la pioche pour échanger.');
        }
        const drawResult = draw(bag, removed.length);
        await tx.execute('UPDATE game_players SET rack=? WHERE game_id=? AND user_id=?', [
          json([...rack.filter((tile) => !ids.has(tile.id)), ...drawResult.tiles]),
          game.id,
          player.user_id,
        ]);
        await tx.execute('UPDATE games SET bag=? WHERE id=?', [
          json(shuffleTiles([...drawResult.bag, ...removed])),
          game.id,
        ]);
      }
      await tx.execute(
        'INSERT INTO moves(game_id,user_id,kind,words,points,placements,snapshot) VALUES(?,?,?,?,?,?,?)',
        [game.id, player.user_id, input.kind, '[]', 0, json(input.tileIds), game.board],
      );
      const scoreless = Number(game.consecutive_scoreless) + 1;
      await advanceTurn(tx, game, player, scoreless);
      if (scoreless >= 6) await finalize(tx, game, 'scoreless');
    }

    const response = { accepted: true };
    await persistAction(tx, game.id, input.userId, input.actionId, response);
    return { timedOut: false, response };
  });
  if (outcome.timedOut) throw conflict('Votre temps est écoulé.');
  if (input.kind !== 'resign') await maybePlayAi(input.gameId);
  return outcome.response;
}

async function stateParts(
  db: Database,
  gameId: number,
): Promise<{ game: GameRow; players: Array<PlayerRow & { username: string }>; moves: Array<Row & { words: string; placements: string }> }> {
  const game = (await db.query<GameRow>('SELECT * FROM games WHERE id=?', [gameId]))[0];
  if (!game) throw notFound('Partie introuvable.');
  const players = await db.query<PlayerRow & { username: string }>(
    `SELECT gp.*,u.username FROM game_players gp JOIN users u ON u.id=gp.user_id WHERE gp.game_id=? ORDER BY gp.turn_order`,
    [gameId],
  );
  const moves = await db.query<Row & { words: string; placements: string }>(
    `SELECT m.*,u.username FROM moves m LEFT JOIN users u ON u.id=m.user_id WHERE m.game_id=? ORDER BY m.id`,
    [gameId],
  );
  return { game, players, moves };
}

function serializedState(
  game: GameRow,
  players: Array<PlayerRow & { username: string }>,
  moves: Array<Row & { words: string; placements: string }>,
  viewerId?: number,
): Record<string, unknown> {
  return {
    ...game,
    board: parse<Board>(game.board),
    bag_count: parse<Tile[]>(game.bag).length,
    server_time: new Date().toISOString(),
    players: players.map((player) => ({
      ...player,
      time_remaining: currentRemaining(game, player),
      rack: Number(player.user_id) === viewerId ? parse<Tile[]>(player.rack) : undefined,
      rack_count: parse<Tile[]>(player.rack).length,
    })),
    moves: moves.map((move) => ({
      ...move,
      words: parse<WordScore[]>(move.words),
      placements: parse<Placement[]>(move.placements),
    })),
  };
}

export async function gameState(gameId: number, userId: number): Promise<Record<string, unknown>> {
  await expireTimedOutGame(gameId);
  const db = await getDb();
  const { game, players, moves } = await stateParts(db, gameId);
  if (!players.some((player) => Number(player.user_id) === userId)) throw forbidden();

  // Throttle de présence : ne rafraîchir last_seen qu'une fois par minute maximum,
  // afin d'éviter une écriture DB à chaque poll de l'état de partie.
  const staleThreshold =
    db.dialect === 'mysql'
      ? 'DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 60 SECOND)'
      : "DATETIME(CURRENT_TIMESTAMP,'-60 seconds')";
  const recent = (
    await db.query<Row>(`SELECT user_id FROM presence WHERE user_id=? AND last_seen<=${staleThreshold}`, [
      userId,
    ])
  )[0];
  const hasPresence = (
    await db.query<Row>('SELECT user_id FROM presence WHERE user_id=?', [userId])
  )[0];
  if (!hasPresence) {
    try {
      await db.execute('INSERT INTO presence(user_id) VALUES(?)', [userId]);
    } catch {
      await db.execute('UPDATE presence SET last_seen=CURRENT_TIMESTAMP WHERE user_id=?', [userId]);
    }
  } else if (recent) {
    await db.execute('UPDATE presence SET last_seen=CURRENT_TIMESTAMP WHERE user_id=?', [userId]);
  }

  return serializedState(game, players, moves, userId);
}

export async function setReplaySharing(
  gameId: number,
  userId: number,
  enabled: boolean,
): Promise<{ enabled: boolean; token?: string }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const { game } = await gameAndPlayer(tx, gameId, userId);
    if (game.status !== 'finished') throw conflict('Le replay ne peut être partagé qu’une fois la partie terminée.');
    if (!enabled) {
      await tx.execute('UPDATE games SET share_enabled=0 WHERE id=?', [gameId]);
      return { enabled: false };
    }
    const token = String(game.share_token ?? '') || randomUUID();
    await tx.execute('UPDATE games SET share_enabled=1,share_token=? WHERE id=?', [token, gameId]);
    return { enabled: true, token };
  });
}

export async function sharedReplayState(token: string): Promise<Record<string, unknown>> {
  const db = await getDb();
  const game = (
    await db.query<GameRow>(
      "SELECT * FROM games WHERE share_token=? AND share_enabled=1 AND status='finished'",
      [token],
    )
  )[0];
  if (!game) throw notFound('Ce replay partagé est indisponible.');
  const { players, moves } = await stateParts(db, Number(game.id));
  return serializedState(game, players, moves);
}

export async function suggestionsForGame(
  gameId: number,
  userId: number,
): Promise<import('./suggestions').Suggestion[]> {
  const db = await getDb();
  const { game, player } = await db.transaction((tx) => gameAndPlayer(tx, gameId, userId));
  if (!Number(game.is_solo)) {
    throw forbidden('Les suggestions sont réservées à l’entraînement solo.');
  }
  return suggestMoves(parse<Board>(game.board), parse<Tile[]>(player.rack));
}

export function chooseAiExchange(rack: Tile[], level: AiLevel): string[] {
  const letterValue = (tile: Tile): number => {
    if (tile.letter === '*') return 24;
    if ('ERSAITN'.includes(tile.letter)) return 8;
    if ('LODU'.includes(tile.letter)) return 4;
    if (tile.letter === 'Q') return rack.some((other) => other.letter === 'U') ? 1 : -7;
    if ('JKWXYZ'.includes(tile.letter)) return -5;
    return 1;
  };
  const sorted = [...rack].sort((left, right) => letterValue(left) - letterValue(right));
  const maximum = level === 'expert' ? 5 : level === 'hard' ? 4 : level === 'medium' ? 3 : 2;
  const undesirable = sorted.filter((tile) => letterValue(tile) <= 1).slice(0, maximum);
  return (undesirable.length ? undesirable : sorted.slice(0, Math.min(2, sorted.length))).map(
    (tile) => tile.id,
  );
}

function normalizedAiLevel(value: unknown): AiLevel {
  return value === 'easy' || value === 'hard' || value === 'expert' ? value : 'medium';
}

async function maybePlayAi(gameId: number): Promise<void> {
  const db = await getDb();
  const game = (
    await db.query<GameRow>("SELECT * FROM games WHERE id=? AND status='active' AND is_solo=1", [
      gameId,
    ])
  )[0];
  if (!game) return;
  const bot = (
    await db.query<PlayerRow>('SELECT * FROM game_players WHERE game_id=? AND user_id=?', [
      gameId,
      game.current_player_id,
    ])
  )[0];
  if (!bot) return;
  const name = (await db.query<Row>('SELECT username FROM users WHERE id=?', [bot.user_id]))[0]
    ?.username;
  if (typeof name !== 'string' || !name.startsWith('LexiBot-')) return;
  if (game.mode === 'timer' && currentRemaining(game, bot) <= 0) {
    // Le bot a écoulé son temps : finaliser immédiatement plutôt que d'attendre
    // la prochaine action du joueur humain.
    await expireTimedOutGame(gameId);
    return;
  }

  const level = normalizedAiLevel(game.ai_level);
  const rack = parse<Tile[]>(bot.rack);
  const budget =
    level === 'expert' ? 1800 : level === 'hard' ? 1400 : level === 'medium' ? 1000 : 700;
  const options = await suggestMoves(parse<Board>(game.board), rack, 48, budget, level);
  const actionId = `ai-${game.id}-${game.version}-${randomUUID()}`;
  const pick = chooseAiMove(options, level, `${game.id}:${game.version}:${bot.user_id}`);
  if (pick) {
    await playMove({
      gameId,
      userId: Number(bot.user_id),
      placements: pick.placements,
      expectedVersion: Number(game.version),
      actionId,
    });
    return;
  }

  const bag = parse<Tile[]>(game.bag);
  const exchangeIds = bag.length >= 7 ? chooseAiExchange(rack, level) : [];
  await gameAction({
    gameId,
    userId: Number(bot.user_id),
    kind: exchangeIds.length ? 'exchange' : 'pass',
    tileIds: exchangeIds,
    expectedVersion: Number(game.version),
    actionId,
  });
}
