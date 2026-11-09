import { writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import {
  BrowserWindow,
  app,
  dialog,
  safeStorage,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { formatDateTimeFr, isoDateInParis } from '@shared/domain/dates'
import { toCsv } from '@shared/domain/invoice'
import { JOURNAL_TYPE_LABELS } from '@shared/domain/journal'
import type { BackupStatus, RestoreResult } from '@shared/types/pilotage'
import { idSchema } from '@shared/types/schemas'
import { writeDatabaseKey } from '../db/keyStore'
import { getSetting, setSetting } from '../db/repositories/settingsRepository'
import { DEFAULT_JOURNAL_RETENTION, journalRetentionSchema } from '../services/settingsSchemas'
import { journal } from '../db/schema'
import { log } from '../logger'
import { appPaths } from '../paths'
import { buildFullExport } from '../services/dataExport'
import type { Runtime } from '../runtime'
import type { createRegistrar } from './register'

const focused = () => BrowserWindow.getFocusedWindow()

async function askSave(options: SaveDialogOptions) {
  const w = focused()
  const r = w ? await dialog.showSaveDialog(w, options) : await dialog.showSaveDialog(options)
  return r.canceled || !r.filePath ? null : r.filePath
}

async function askOpen(options: OpenDialogOptions) {
  const w = focused()
  const r = w ? await dialog.showOpenDialog(w, options) : await dialog.showOpenDialog(options)
  return r.canceled ? null : (r.filePaths[0] ?? null)
}

/** 64 hex characters ↔ « 3F2A-91C0-… » (16 groups of 4), as shown for the backup key. */
export const formatBackupKey = (hex: string) => hex.toUpperCase().match(/.{4}/g)!.join('-')
export const parseBackupKey = (text: string) => text.replace(/[\s-]/g, '').toLowerCase()

function backupStatus({ backup }: Runtime): BackupStatus {
  const s = backup.setting()
  return {
    folder: backup.folder(),
    keep: s.keep,
    lastAt: s.lastAt,
    files: backup.list().map((f) => ({ name: f.name, at: f.at, sizeBytes: f.sizeBytes })),
  }
}

/** Tableau de bord, Sauvegarde (R-22), Journal (R-20) and Données & import (SPEC §7 – 8). */
export function registerPilotageHandlers(register: ReturnType<typeof createRegistrar>): void {
  const none = z.tuple([])
  // The backup chosen for a restore that needs its key (another PC).
  let pendingRestore: { fileId: string; path: string } | null = null

  register('dashboard:get', none, ({ dashboard }) => dashboard.view())
  register('dashboard:year', z.tuple([z.number().int().min(1900).max(2200)]), ({ dashboard }, y) =>
    dashboard.year(y),
  )
  register('dashboard:mark-received', z.tuple([idSchema]), ({ dashboard }, id) =>
    dashboard.markReceived(id),
  )

  register('backup:get-status', none, (rt) => backupStatus(rt))
  register('backup:run', none, ({ backup }) => {
    const r = backup.backupNow()
    return r.ok ? { ok: true, name: r.file.name, sizeBytes: r.file.sizeBytes } : r
  })
  register('backup:choose-folder', none, async (rt) => {
    const w = focused()
    const options: OpenDialogOptions = {
      title: 'Dossier de sauvegarde',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: rt.backup.folder(),
    }
    const r = w ? await dialog.showOpenDialog(w, options) : await dialog.showOpenDialog(options)
    if (!r.canceled && r.filePaths[0]) rt.backup.setFolder(r.filePaths[0])
    return backupStatus(rt)
  })
  register('backup:set-keep', z.tuple([z.number().int().min(1).max(365)]), (rt, keep) => {
    rt.backup.setKeep(keep)
    return backupStatus(rt)
  })
  register('backup:show-key', none, ({ databaseKey }) => formatBackupKey(databaseKey))

  const finishRestore = (
    rt: Runtime,
    path: string,
    key: string,
    otherKey: boolean,
  ): RestoreResult => {
    const r = rt.backup.prepareRestore(
      path,
      key,
      otherKey
        ? (k) =>
            writeDatabaseKey(`${appPaths.keyFile}.restore`, k, {
              protector: safeStorage,
              allowUnprotected: rt.allowUnprotectedKey,
            })
        : undefined,
    )
    if (!r.ok) return r
    log.info('Restore prepared, restarting')
    // The database is swapped at the next start; no closing backup over it.
    setTimeout(() => {
      process.env['MEUOSTEO_SKIP_CLOSE_BACKUP'] = '1'
      app.relaunch()
      app.quit()
    }, 1500)
    return r
  }

  register('backup:restore', none, async (rt) => {
    const path = await askOpen({
      title: 'Restaurer une sauvegarde',
      defaultPath: rt.backup.folder(),
      properties: ['openFile'],
      filters: [{ name: 'Sauvegarde MeuOsteo', extensions: ['mosave'] }],
    })
    if (!path) return { ok: false, reason: 'canceled' }
    const r = finishRestore(rt, path, rt.databaseKey, false)
    if (!r.ok && r.reason === 'wrong_key') {
      pendingRestore = { fileId: randomUUID(), path }
      return { ...r, fileId: pendingRestore.fileId }
    }
    return r
  })
  register(
    'backup:restore-with-key',
    z.tuple([z.string().max(64), z.string().max(120)]),
    (rt, fileId, keyText) => {
      if (pendingRestore?.fileId !== fileId) return { ok: false, reason: 'file_unknown' }
      const key = parseBackupKey(keyText)
      return finishRestore(rt, pendingRestore.path, key, key !== rt.databaseKey)
    },
  )

  register(
    'journal:list',
    z.tuple([z.enum(['patient', 'facture', 'verrouillage', 'reglage']).nullable()]),
    ({ db }, type) =>
      db
        .select({
          id: journal.id,
          at: journal.at,
          type: journal.type,
          subject: journal.subject,
          action: journal.action,
        })
        .from(journal)
        .where(type ? eq(journal.type, type) : undefined)
        .orderBy(desc(journal.at))
        .limit(500)
        .all(),
  )
  register(
    'journal:set-retention',
    z.tuple([z.union([z.literal(12), z.literal(24), z.literal(36)])]),
    ({ db }, months) => {
      setSetting(db, 'journal_retention_months', months)
      return months
    },
  )
  register('journal:get-retention', none, ({ db }) =>
    getSetting(db, 'journal_retention_months', journalRetentionSchema, DEFAULT_JOURNAL_RETENTION),
  )
  register('journal:export', none, async ({ db }) => {
    const path = await askSave({
      defaultPath: `Journal MeuOsteo ${isoDateInParis(new Date())}.csv`,
      filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }],
    })
    if (!path) return { ok: false, reason: 'canceled' }
    const rows = db.select().from(journal).orderBy(desc(journal.at)).all()
    await writeFile(
      path,
      toCsv([
        ['Date', 'Type', 'Sujet', 'Action'],
        ...rows.map((r) => [
          formatDateTimeFr(new Date(r.at)),
          JOURNAL_TYPE_LABELS[r.type],
          r.subject,
          r.action,
        ]),
      ]),
      'utf8',
    )
    return { ok: true, path }
  })

  register('data:export-all', none, async ({ db }) => {
    const path = await askSave({
      defaultPath: `MeuOsteo export complet ${isoDateInParis(new Date())}.xlsx`,
      filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }],
    })
    if (!path) return { ok: false, reason: 'canceled' }
    try {
      await writeFile(path, await buildFullExport(db))
      return { ok: true, path }
    } catch (error) {
      log.error('Full export failed', error)
      return { ok: false, reason: 'error' }
    }
  })
}
