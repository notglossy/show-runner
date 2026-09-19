import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { env } from '@/lib/env';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;
/** A transaction handle; helpers that should work inside or outside a transaction accept `DbOrTx`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;

const globalForDb = globalThis as unknown as {
  __showrunnerDb?: { db: Db; sqlite: Database.Database };
};

function migrationsDir() {
  return process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), 'drizzle');
}

/** Opens (and migrates) the SQLite database once per process. */
export function getDb(): Db {
  if (!globalForDb.__showrunnerDb) {
    const file = env().DATABASE_PATH;
    if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    const sqlite = new Database(file);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('busy_timeout = 5000');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: migrationsDir() });
    globalForDb.__showrunnerDb = { db, sqlite };
  }
  return globalForDb.__showrunnerDb.db;
}

/** For tests only. */
export function closeDb() {
  globalForDb.__showrunnerDb?.sqlite.close();
  globalForDb.__showrunnerDb = undefined;
}
