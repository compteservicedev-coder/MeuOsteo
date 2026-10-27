import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MIGRATIONS_FOLDER, createTestDatabase } from '../test/db'
import { closeDatabase, openDatabase } from './client'
import { patients } from './schema'

const dirs: string[] = []
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'meuosteo-db-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const KEY = 'a'.repeat(64)

describe('base SQLite chiffrée', () => {
  it('applique la première migration : toutes les tables de DATA_MODEL.md', () => {
    const db = createTestDatabase()
    const tables = db.$client
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite%' ORDER BY name",
      )
      .pluck()
      .all()
    expect(tables).toEqual([
      'avoirs',
      'blocages',
      'communes',
      'contact_memory',
      'doctolib_rdv',
      'document_contents',
      'documents',
      'duplicate_ignored',
      'envois',
      'factures',
      'journal',
      'patient_links',
      'patients',
      'seances',
      'settings',
    ])
    expect(db.$client.pragma('foreign_keys', { simple: true })).toBe(1)
  })

  it('chiffre le fichier : aucune donnée lisible sur le disque, mode WAL', () => {
    const file = join(tempDir(), 'test.db')
    const db = openDatabase({ file, hexKey: KEY, migrationsFolder: MIGRATIONS_FOLDER })
    expect(db.$client.pragma('journal_mode', { simple: true })).toBe('wal')
    db.insert(patients)
      .values({
        shortNo: 1,
        nom: 'Zorglub',
        prenom: 'Fictif',
        ddn: '1990-01-01',
        searchKey: 'zorglub fictif',
      })
      .run()
    closeDatabase(db)
    const bytes = readFileSync(file)
    expect(bytes.subarray(0, 15).toString()).not.toBe('SQLite format 3')
    expect(bytes.includes(Buffer.from('Zorglub'))).toBe(false)

    const reopened = openDatabase({ file, hexKey: KEY, migrationsFolder: MIGRATIONS_FOLDER })
    expect(reopened.select().from(patients).all()[0]?.nom).toBe('Zorglub')
    closeDatabase(reopened)
  })

  it('refuse d’ouvrir la base avec une autre clé', () => {
    const file = join(tempDir(), 'test.db')
    closeDatabase(openDatabase({ file, hexKey: KEY, migrationsFolder: MIGRATIONS_FOLDER }))
    expect(() =>
      openDatabase({ file, hexKey: 'b'.repeat(64), migrationsFolder: MIGRATIONS_FOLDER }),
    ).toThrow(/not a database/)
  })

  it('refuse une clé mal formée', () => {
    const file = join(tempDir(), 'test.db')
    expect(() =>
      openDatabase({ file, hexKey: "x'; DROP TABLE", migrationsFolder: MIGRATIONS_FOLDER }),
    ).toThrow(/Invalid database key/)
  })
})
