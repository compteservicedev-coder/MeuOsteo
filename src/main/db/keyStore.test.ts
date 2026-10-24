import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseKeyError, loadOrCreateDatabaseKey, type SecretProtector } from './keyStore'

/** Stands in for safeStorage: reversible, but the output differs from the input. */
const fakeProtector = (available = true): SecretProtector => ({
  isEncryptionAvailable: () => available,
  encryptString: (s) => Buffer.from(`enc:${[...s].reverse().join('')}`),
  decryptString: (b) => {
    const s = b.toString()
    if (!s.startsWith('enc:')) throw new Error('bad')
    return [...s.slice(4)].reverse().join('')
  },
})

let dir: string
let keyFile: string
let databaseFile: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'meuosteo-key-'))
  keyFile = join(dir, 'meuosteo.key')
  databaseFile = join(dir, 'meuosteo.db')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('clé de la base (safeStorage)', () => {
  it('génère une clé de 256 bits au premier lancement et ne l’écrit que chiffrée', () => {
    const key = loadOrCreateDatabaseKey({
      keyFile,
      databaseFile,
      protector: fakeProtector(),
      allowUnprotected: false,
    })
    expect(key).toMatch(/^[0-9a-f]{64}$/)
    const stored = readFileSync(keyFile, 'utf8')
    expect(stored).not.toContain(key)
    expect(JSON.parse(stored)).toMatchObject({ version: 1, protected: true })
  })

  it('relit la même clé aux lancements suivants', () => {
    const options = { keyFile, databaseFile, protector: fakeProtector(), allowUnprotected: false }
    const first = loadOrCreateDatabaseKey(options)
    writeFileSync(databaseFile, 'existing')
    expect(loadOrCreateDatabaseKey(options)).toBe(first)
  })

  it('ne remplace jamais la clé d’une base existante', () => {
    writeFileSync(databaseFile, 'existing')
    expect(() =>
      loadOrCreateDatabaseKey({
        keyFile,
        databaseFile,
        protector: fakeProtector(),
        allowUnprotected: false,
      }),
    ).toThrow(DatabaseKeyError)
    expect(existsSync(keyFile)).toBe(false)
  })

  it('signale une clé illisible pour cet utilisateur', () => {
    writeFileSync(keyFile, JSON.stringify({ version: 1, protected: true, data: 'AAAA' }))
    expect(() =>
      loadOrCreateDatabaseKey({
        keyFile,
        databaseFile,
        protector: fakeProtector(),
        allowUnprotected: false,
      }),
    ).toThrow(expect.objectContaining({ reason: 'unreadable_key' }))
  })

  it('refuse de stocker la clé en clair hors développement', () => {
    expect(() =>
      loadOrCreateDatabaseKey({
        keyFile,
        databaseFile,
        protector: fakeProtector(false),
        allowUnprotected: false,
      }),
    ).toThrow(expect.objectContaining({ reason: 'protection_unavailable' }))
    const key = loadOrCreateDatabaseKey({
      keyFile,
      databaseFile,
      protector: fakeProtector(false),
      allowUnprotected: true,
    })
    expect(JSON.parse(readFileSync(keyFile, 'utf8'))).toEqual({
      version: 1,
      protected: false,
      data: key,
    })
    // The installed app never reads a key that development left unprotected.
    expect(() =>
      loadOrCreateDatabaseKey({
        keyFile,
        databaseFile,
        protector: fakeProtector(),
        allowUnprotected: false,
      }),
    ).toThrow(expect.objectContaining({ reason: 'unreadable_key' }))
  })

  it('R-21 la clé de chiffrement ne dépend pas du code d’accès', () => {
    // The key is random and created before any code exists: two databases never share a key.
    const a = loadOrCreateDatabaseKey({
      keyFile,
      databaseFile,
      protector: fakeProtector(),
      allowUnprotected: false,
    })
    rmSync(keyFile)
    const b = loadOrCreateDatabaseKey({
      keyFile,
      databaseFile,
      protector: fakeProtector(),
      allowUnprotected: false,
    })
    expect(a).not.toBe(b)
  })
})
