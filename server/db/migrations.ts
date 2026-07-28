import type { Database } from './index';

type Migration = { version: number; sqlite: string[]; mysql: string[] };

type DatabaseError = {
  code?: string;
  message?: string;
};

const sqliteId = 'INTEGER PRIMARY KEY AUTOINCREMENT';
const mysqlId = 'BIGINT AUTO_INCREMENT PRIMARY KEY';

const schema = (id: string, text: string): string[] => [
  `CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE users (
    id ${id}, username VARCHAR(24) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
    bio VARCHAR(2000) NOT NULL DEFAULT '', avatar VARCHAR(255), wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0, draws INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE sessions (
    id ${id}, user_id BIGINT NOT NULL, token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL, last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX sessions_user_index ON sessions(user_id)`,
  `CREATE TABLE login_attempts (
    id ${id}, identifier VARCHAR(128) NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    locked_until DATETIME, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(identifier)
  )`,
  `CREATE TABLE password_resets (
    id ${id}, user_id BIGINT NOT NULL, token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL, used_at DATETIME, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX password_resets_expiry_index ON password_resets(expires_at)`,
  `CREATE TABLE games (
    id ${id}, status VARCHAR(16) NOT NULL DEFAULT 'active', mode VARCHAR(16) NOT NULL DEFAULT 'free',
    is_solo INTEGER NOT NULL DEFAULT 0, ai_level VARCHAR(16), current_player_id BIGINT,
    winner_id BIGINT, end_reason VARCHAR(16), time_limit_seconds INTEGER NOT NULL DEFAULT 0,
    increment_seconds INTEGER NOT NULL DEFAULT 0, turn_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    board ${text} NOT NULL, bag ${text} NOT NULL, version INTEGER NOT NULL DEFAULT 1,
    consecutive_scoreless INTEGER NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME, FOREIGN KEY (current_player_id) REFERENCES users(id),
    FOREIGN KEY (winner_id) REFERENCES users(id)
  )`,
  `CREATE TABLE game_players (
    game_id BIGINT NOT NULL, user_id BIGINT NOT NULL, rack ${text} NOT NULL, score INTEGER NOT NULL DEFAULT 0,
    time_remaining INTEGER NOT NULL DEFAULT 0, turn_order INTEGER NOT NULL,
    PRIMARY KEY (game_id, user_id), UNIQUE(game_id, turn_order),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX games_current_player_index ON games(current_player_id, status)`,
  `CREATE INDEX game_players_user_index ON game_players(user_id, game_id)`,
  `CREATE TABLE moves (
    id ${id}, game_id BIGINT NOT NULL, user_id BIGINT, kind VARCHAR(16) NOT NULL,
    words ${text} NOT NULL, points INTEGER NOT NULL DEFAULT 0, placements ${text} NOT NULL,
    snapshot ${text}, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX moves_game_index ON moves(game_id, id)`,
  `CREATE TABLE game_actions (
    id ${id}, game_id BIGINT NOT NULL, user_id BIGINT NOT NULL, action_id VARCHAR(72) NOT NULL,
    response ${text} NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, user_id, action_id), FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE invitations (
    id ${id}, from_user_id BIGINT NOT NULL, to_user_id BIGINT NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'pending',
    mode VARCHAR(16) NOT NULL DEFAULT 'free', time_limit_seconds INTEGER NOT NULL DEFAULT 900,
    increment_seconds INTEGER NOT NULL DEFAULT 0, active_key VARCHAR(80), expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(active_key),
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX invitations_recipient_index ON invitations(to_user_id, status, expires_at)`,
  `CREATE TABLE presence (
    user_id BIGINT PRIMARY KEY, last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX presence_last_seen_index ON presence(last_seen)`,
];

const migrations: Migration[] = [
  {
    version: 1,
    sqlite: schema(sqliteId, 'TEXT'),
    mysql: schema(mysqlId, 'LONGTEXT'),
  },
  {
    version: 2,
    sqlite: [
      'ALTER TABLE users ADD COLUMN email VARCHAR(320)',
      'CREATE UNIQUE INDEX users_email_unique ON users(email) WHERE email IS NOT NULL',
    ],
    mysql: [
      'ALTER TABLE users ADD COLUMN email VARCHAR(320) NULL AFTER username',
      'CREATE UNIQUE INDEX users_email_unique ON users(email)',
    ],
  },
];

function resumableStatement(statement: string, dialect: Database['dialect']): string {
  if (statement.startsWith('CREATE TABLE ')) {
    return statement.replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ');
  }
  if (dialect === 'sqlite' && statement.startsWith('CREATE INDEX ')) {
    return statement.replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ');
  }
  return statement;
}

function isHarmlessExistingObject(error: unknown): boolean {
  const databaseError = error as DatabaseError;
  return (
    databaseError.code === 'ER_TABLE_EXISTS_ERROR' ||
    databaseError.code === 'ER_DUP_KEYNAME' ||
    databaseError.code === 'ER_DUP_FIELDNAME' ||
    /already exists|duplicate key name|duplicate column name/i.test(databaseError.message ?? '')
  );
}

async function executeMigrationStatement(database: Database, statement: string): Promise<void> {
  try {
    await database.execute(resumableStatement(statement, database.dialect));
  } catch (error) {
    if (isHarmlessExistingObject(error)) return;
    throw error;
  }
}

export async function migrate(database: Database): Promise<number[]> {
  const applied: number[] = [];
  const hasSchema = await database.query<{ name?: string }>(
    database.dialect === 'sqlite'
      ? "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
      : "SHOW TABLES LIKE 'schema_migrations'",
  );
  const completed = hasSchema.length
    ? new Set(
        (await database.query<{ version: number }>('SELECT version FROM schema_migrations')).map(
          (row) => Number(row.version),
        ),
      )
    : new Set<number>();

  for (const migration of migrations) {
    if (completed.has(migration.version)) continue;
    await database.transaction(async (tx) => {
      for (const statement of migration[database.dialect]) {
        await executeMigrationStatement(tx, statement);
      }
      await tx.execute('INSERT INTO schema_migrations(version) VALUES(?)', [migration.version]);
    });
    applied.push(migration.version);
  }
  return applied;
}
