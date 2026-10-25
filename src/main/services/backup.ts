/**
 * R-22 · Sauvegarde: a consistent copy of the database (`VACUUM INTO`), encrypted with the same
 * key as the database (SQLCipher), named `MeuOsteo_AAAA-MM-JJ_HHmm.mosave`, at each closing and on
 * demand. The last 30 copies are kept. Restoring checks the file, keeps a safety copy of the
 * current state, then replaces the database (the application restarts).
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3-multiple-ciphers'
import { z } from 'zod'
import { isoDateInParis, timeInParis } from '@shared/domain/dates'
import type { AppDatabase } from '../db/client'
import { getSetting, setSetting } from '../db/repositories/settingsRepository'
import { log } from '../logger'

export const BACKUP_EXTENSION = '.mosave'
export const DEFAULT_KEEP = 30

/** Stored partially: the folder and the number kept appeared after `lastAt`. */
export const backupSettingSchema = z
  .object({
    folder: z.string().nullable(),
    keep: z.number().int().min(1).max(365),
    lastAt: z.string().nullable(),
  })
  .partial()
export interface BackupSetting {
  folder: string | null
  keep: number
  lastAt: string | null
}

const DEFAULT_SETTING: BackupSetting = { folder: null, keep: DEFAULT_KEEP, lastAt: null }

export interface BackupFileView {
  name: string
  path: string
  at: string
  sizeBytes: number
}

export type CheckResult =
  | { ok: true; patients: number; seances: number; factures: number }
  | { ok: false; reason: 'wrong_key' | 'corrupt' | 'unreadable' }

/** `MeuOsteo_2026-10-25_0941.mosave` (Europe/Paris). */
export function backupFileName(now: Date): string {
  return `MeuOsteo_${isoDateInParis(now)}_${timeInParis(now).replace(':', '')}${BACKUP_EXTENSION}`
}

/** Opens a backup file with a key and checks it (integrity and expected tables). */
export function checkBackupFile(path: string, hexKey: string): CheckResult {
  if (!/^[0-9a-f]{64}$/.test(hexKey)) return { ok: false, reason: 'wrong_key' }
  let db: Database.Database | null = null
  try {
    db = new Database(path, { readonly: true, fileMustExist: true })
    db.pragma(`cipher='sqlcipher'`)
    db.pragma('legacy=4')
    db.pragma(`hexkey='${hexKey}'`)
    try {
      db.prepare('SELECT count(*) FROM sqlite_master').get()
    } catch {
      return { ok: false, reason: 'wrong_key' }
    }
    const integrity = db.pragma('integrity_check', { simple: true })
    if (integrity !== 'ok') return { ok: false, reason: 'corrupt' }
    const count = (table: string) =>
      (db!.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n
    return {
      ok: true,
      patients: count('patients'),
      seances: count('seances'),
      factures: count('factures'),
    }
  } catch {
    return { ok: false, reason: 'unreadable' }
  } finally {
    db?.close()
  }
}

export class BackupService {
  constructor(
    private readonly deps: {
      db: AppDatabase
      databaseFile: string
      defaultFolder: string
      now?: () => Date
    },
  ) {}

  private now() {
    return this.deps.now?.() ?? new Date()
  }

  setting(): BackupSetting {
    return { ...DEFAULT_SETTING, ...getSetting(this.deps.db, 'backup', backupSettingSchema, {}) }
  }

  folder(): string {
    return this.setting().folder ?? this.deps.defaultFolder
  }

  setFolder(folder: string): BackupSetting {
    setSetting(this.deps.db, 'backup', { ...this.setting(), folder })
    return this.setting()
  }

  setKeep(keep: number): BackupSetting {
    setSetting(this.deps.db, 'backup', { ...this.setting(), keep })
    this.rotate()
    return this.setting()
  }

  list(): BackupFileView[] {
    const folder = this.folder()
    if (!existsSync(folder)) return []
    return readdirSync(folder)
      .filter((f) => /^MeuOsteo_\d{4}-\d{2}-\d{2}_\d{4}(-\d+)?\.mosave$/.test(f))
      .sort()
      .reverse()
      .map((name) => {
        const path = join(folder, name)
        const st = statSync(path)
        return { name, path, at: st.mtime.toISOString(), sizeBytes: st.size }
      })
  }

  /** Keeps the newest `keep` copies. */
  private rotate(): number {
    const { keep } = this.setting()
    const old = this.list().slice(keep)
    for (const f of old) rmSync(f.path, { force: true })
    return old.length
  }

  /** « Sauvegarder maintenant » and the backup at closing. Synchronous (a few ms to seconds). */
  backupNow(): { ok: true; file: BackupFileView } | { ok: false; reason: 'folder' | 'error' } {
    const folder = this.folder()
    try {
      mkdirSync(folder, { recursive: true })
    } catch {
      return { ok: false, reason: 'folder' }
    }
    const now = this.now()
    let name = backupFileName(now)
    for (let i = 2; existsSync(join(folder, name)); i++) {
      name = backupFileName(now).replace(BACKUP_EXTENSION, `-${i}${BACKUP_EXTENSION}`)
    }
    const target = join(folder, name)
    const tmp = `${target}.part`
    try {
      rmSync(tmp, { force: true })
      // Same cipher and key as the database: the copy is encrypted and consistent.
      this.deps.db.$client.prepare('VACUUM INTO ?').run(tmp)
      renameSync(tmp, target)
    } catch (error) {
      rmSync(tmp, { force: true })
      log.error('Backup failed', error)
      return { ok: false, reason: 'error' }
    }
    setSetting(this.deps.db, 'backup', { ...this.setting(), lastAt: now.toISOString() })
    const removed = this.rotate()
    log.info(`Backup written (${statSync(target).size} bytes, ${removed} old copies removed)`)
    const st = statSync(target)
    return { ok: true, file: { name, path: target, at: now.toISOString(), sizeBytes: st.size } }
  }

  /**
   * Prepares a restore: the file is checked, the current state is backed up, then the file is
   * copied next to the database as `meuosteo.db.restore`. The swap itself happens at the next
   * start (`applyPendingRestore`), before the database is opened.
   */
  prepareRestore(
    path: string,
    hexKey: string,
    writePendingKey?: (hexKey: string) => void,
  ): CheckResult {
    const check = checkBackupFile(path, hexKey)
    if (!check.ok) return check
    const safety = this.backupNow()
    if (!safety.ok) log.warn('Safety backup before restore failed')
    copyFileSync(path, `${this.deps.databaseFile}.restore`)
    // A backup from another PC comes with its own key, typed by the user.
    writePendingKey?.(hexKey)
    return check
  }
}

/** At start-up, before opening the database: swaps in a prepared restore. */
export function applyPendingRestore(databaseFile: string, keyFile: string): boolean {
  const pending = `${databaseFile}.restore`
  if (!existsSync(pending)) return false
  for (const suffix of ['-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true })
  renameSync(pending, databaseFile)
  if (existsSync(`${keyFile}.restore`)) renameSync(`${keyFile}.restore`, keyFile)
  log.info('Backup restored')
  return true
}
