import { resolve } from 'node:path'
import { openDatabase, type AppDatabase } from '../db/client'

export const MIGRATIONS_FOLDER = resolve(__dirname, '../db/migrations')

/** Fresh in-memory database with every migration applied. */
export function createTestDatabase(): AppDatabase {
  return openDatabase({ file: ':memory:', migrationsFolder: MIGRATIONS_FOLDER })
}
