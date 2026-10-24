import Database from 'better-sqlite3-multiple-ciphers'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type BetterSqlite3 from 'better-sqlite3'
import * as schema from './schema'

export type AppDatabase = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database }

const HEX_KEY = /^[0-9a-f]{64}$/

export interface OpenDatabaseOptions {
  /** Path of the database file, or `:memory:` for tests. */
  file: string
  /** 256-bit key as 64 hex characters. Omitted only for in-memory test databases. */
  hexKey?: string
  migrationsFolder: string
}

/**
 * Opens the database (SQLCipher 4 format through SQLite3 Multiple Ciphers), applies pending
 * migrations and returns the Drizzle instance. Throws `SQLITE_NOTADB` when the key is wrong.
 */
export function openDatabase({ file, hexKey, migrationsFolder }: OpenDatabaseOptions): AppDatabase {
  const sqlite = new Database(file)
  try {
    if (hexKey !== undefined) {
      if (!HEX_KEY.test(hexKey)) throw new Error('Invalid database key format')
      sqlite.pragma(`cipher='sqlcipher'`)
      sqlite.pragma('legacy=4')
      sqlite.pragma(`hexkey='${hexKey}'`)
    }
    // First read of the file: fails here if the key does not match.
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    sqlite.pragma('synchronous = NORMAL')
    sqlite.pragma('busy_timeout = 5000')
    const db = drizzle({ client: sqlite as unknown as BetterSqlite3.Database, schema })
    migrate(db, { migrationsFolder })
    return db
  } catch (error) {
    sqlite.close()
    throw error
  }
}

export function closeDatabase(db: AppDatabase): void {
  if (db.$client.open) db.$client.close()
}
