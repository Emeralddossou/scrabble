import { createClient, type Client } from '@libsql/client';
import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from 'mysql2/promise';

export type Row = Record<string, unknown>;
export type Dialect = 'sqlite' | 'mysql';

export type Database = {
  dialect: Dialect;
  query<T extends Row>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ insertId: number; affectedRows: number }>;
  transaction<T>(fn: (database: Database) => Promise<T>): Promise<T>;
};

let singleton: Promise<Database> | undefined;

function configuredDialect(): Dialect {
  const configured = (process.env.DB_TYPE ?? 'sqlite').toLowerCase();
  if (configured === 'mysql' || configured === 'sqlite') return configured;
  throw new Error('DB_TYPE doit être mysql ou sqlite.');
}

function configuredUrl(dialect: Dialect): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production')
    throw new Error('DATABASE_URL est obligatoire en production.');
  return dialect === 'sqlite' ? 'file:./data/scrabble.db' : '';
}

function sqliteDatabase(client: Client): Database {
  return {
    dialect: 'sqlite',
    async query<T extends Row>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = await client.execute({ sql, args: params as never[] });
      return result.rows as unknown as T[];
    },
    async execute(sql: string, params: unknown[] = []) {
      const result = await client.execute({ sql, args: params as never[] });
      return { insertId: Number(result.lastInsertRowid ?? 0), affectedRows: result.rowsAffected };
    },
    async transaction<T>(fn: (database: Database) => Promise<T>): Promise<T> {
      const transaction = await client.transaction('write');
      const db = sqliteDatabase(transaction as unknown as Client);
      try {
        const value = await fn(db);
        await transaction.commit();
        return value;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    },
  };
}

function mysqlDatabase(connection: Pool | PoolConnection): Database {
  return {
    dialect: 'mysql',
    async query<T extends Row>(sql: string, params: unknown[] = []): Promise<T[]> {
      const [rows] = await connection.query(sql, params);
      return rows as T[];
    },
    async execute(sql: string, params: unknown[] = []) {
      const [result] = await connection.query(sql, params);
      const header = result as ResultSetHeader;
      return { insertId: Number(header.insertId), affectedRows: header.affectedRows };
    },
    async transaction<T>(fn: (database: Database) => Promise<T>): Promise<T> {
      if (!('getConnection' in connection)) return fn(mysqlDatabase(connection));
      const transaction = await connection.getConnection();
      await transaction.beginTransaction();
      try {
        const value = await fn(mysqlDatabase(transaction));
        await transaction.commit();
        return value;
      } catch (error) {
        await transaction.rollback();
        throw error;
      } finally {
        transaction.release();
      }
    },
  };
}

export async function createDatabase(): Promise<Database> {
  const dialect = configuredDialect();
  const url = configuredUrl(dialect);
  if (dialect === 'sqlite') return sqliteDatabase(createClient({ url }));
  return mysqlDatabase(mysql.createPool({ uri: url, connectionLimit: 5, enableKeepAlive: true }));
}

export function getDb(): Promise<Database> {
  singleton ??= createDatabase();
  return singleton;
}

export function resetDbSingletonForTests(): void {
  singleton = undefined;
}

export const sqlNow = (): string => 'CURRENT_TIMESTAMP';
