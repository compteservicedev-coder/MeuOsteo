import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

/** The subset of Electron's `safeStorage` (DPAPI on Windows) used to protect the key. */
export interface SecretProtector {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

interface KeyFile {
  version: 1
  /** false only in development when the OS offers no protection (see `allowUnprotected`). */
  protected: boolean
  data: string
}

export class DatabaseKeyError extends Error {
  constructor(
    readonly reason: 'missing_key' | 'unreadable_key' | 'protection_unavailable',
    message: string,
  ) {
    super(message)
    this.name = 'DatabaseKeyError'
  }
}

export interface LoadKeyOptions {
  keyFile: string
  databaseFile: string
  protector: SecretProtector
  /** Development only: store the key unprotected when `safeStorage` is unavailable. */
  allowUnprotected: boolean
}

/**
 * Returns the database key, creating it on first launch. The key is random (256 bits), never
 * derived from the access code (R-21), and only stored encrypted by `safeStorage`.
 *
 * A new key is generated only when neither the key nor the database exists: an existing database
 * without its key must stay untouched so that it can still be recovered.
 */
export function loadOrCreateDatabaseKey(options: LoadKeyOptions): string {
  const { keyFile, databaseFile } = options
  if (existsSync(keyFile)) return readKey(keyFile, options)
  if (existsSync(databaseFile)) {
    throw new DatabaseKeyError('missing_key', 'The database exists but its key file is missing')
  }
  const hexKey = randomBytes(32).toString('hex')
  writeKey(keyFile, hexKey, options)
  return hexKey
}

function readKey(keyFile: string, { protector, allowUnprotected }: LoadKeyOptions): string {
  let file: KeyFile
  try {
    file = JSON.parse(readFileSync(keyFile, 'utf8')) as KeyFile
  } catch {
    throw new DatabaseKeyError('unreadable_key', 'The key file is corrupted')
  }
  if (!file.protected) {
    // Only development writes unprotected keys: the installed app never trusts one.
    if (allowUnprotected) return file.data
    throw new DatabaseKeyError('unreadable_key', 'Unprotected key refused')
  }
  try {
    return protector.decryptString(Buffer.from(file.data, 'base64'))
  } catch {
    throw new DatabaseKeyError('unreadable_key', 'The key cannot be decrypted for this user')
  }
}

/** Writes a key file (protected by safeStorage), e.g. the key of a backup from another PC. */
export function writeDatabaseKey(
  keyFile: string,
  hexKey: string,
  options: Pick<LoadKeyOptions, 'protector' | 'allowUnprotected'>,
): void {
  writeKey(keyFile, hexKey, options as LoadKeyOptions)
}

function writeKey(keyFile: string, hexKey: string, options: LoadKeyOptions): void {
  const { protector, allowUnprotected } = options
  let file: KeyFile
  if (protector.isEncryptionAvailable()) {
    file = { version: 1, protected: true, data: protector.encryptString(hexKey).toString('base64') }
  } else if (allowUnprotected) {
    file = { version: 1, protected: false, data: hexKey }
  } else {
    throw new DatabaseKeyError('protection_unavailable', 'safeStorage is not available')
  }
  const tmp = `${keyFile}.tmp`
  writeFileSync(tmp, JSON.stringify(file), { mode: 0o600 })
  renameSync(tmp, keyFile)
}
