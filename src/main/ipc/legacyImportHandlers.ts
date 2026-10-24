import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron'
import { z } from 'zod'
import { isoDateInParis } from '@shared/domain/dates'
import type { LegacyImportPlan } from '@shared/domain/legacyImport'
import { legacyFileIdSchema, legacyImportRequestSchema } from '@shared/types/legacyImport'
import { log } from '../logger'
import { analyzeLegacyFile, runLegacyImport } from '../services/legacyImport'
import type { createRegistrar } from './register'

/**
 * Paramètres > Données & import. The renderer never sends a path: main opens the file dialog and
 * hands back an opaque id. Logs hold counts only, never names nor content.
 */
export function registerLegacyImportHandlers(register: ReturnType<typeof createRegistrar>): void {
  // Only the last chosen file is kept, with its analysis until it is imported.
  let chosen: { fileId: string; path: string; fileName: string } | null = null
  let analysed: { fileId: string; plan: LegacyImportPlan } | null = null

  register('legacy-import:choose-file', z.tuple([]), async () => {
    const options: OpenDialogOptions = {
      title: 'Choisir le fichier MeuOsteo',
      properties: ['openFile'],
      filters: [{ name: 'Classeur MeuOsteo', extensions: ['xlsm', 'xlsx'] }],
    }
    const window = BrowserWindow.getFocusedWindow()
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    const path = result.filePaths[0]
    if (result.canceled || !path) return { canceled: true }
    chosen = { fileId: randomUUID(), path, fileName: basename(path) }
    analysed = null
    return { canceled: false, fileId: chosen.fileId, fileName: chosen.fileName }
  })

  register('legacy-import:analyze', z.tuple([legacyFileIdSchema]), async ({ db }, fileId) => {
    if (chosen?.fileId !== fileId) return { ok: false, reason: 'file_unknown' }
    const started = Date.now()
    let data: Buffer
    try {
      data = await readFile(chosen.path)
    } catch {
      return { ok: false, reason: 'unreadable' }
    }
    const today = isoDateInParis(new Date())
    const result = await analyzeLegacyFile(db, data, chosen, today)
    if (!result.ok) {
      log.warn(`Legacy import: analysis refused (${result.reason})`)
      return result
    }
    analysed = { fileId, plan: result.plan }
    const { report } = result
    log.info(
      `Legacy import: analysed in ${Date.now() - started} ms, ${report.patients} patients, ` +
        `${report.seances} sessions, ${report.anomalies.length} anomalies`,
    )
    return { ok: true, report }
  })

  register('legacy-import:run', z.tuple([legacyImportRequestSchema]), ({ db }, request) => {
    if (analysed?.fileId !== request.fileId) return { ok: false, reason: 'file_unknown' }
    const result = runLegacyImport(
      db,
      analysed.plan,
      request.corrections,
      isoDateInParis(new Date()),
    )
    if (result.ok) {
      log.info(`Legacy import: ${result.patients} patients, ${result.seances} sessions imported`)
      chosen = null
      analysed = null
    } else {
      log.warn(`Legacy import refused (${result.reason})`)
    }
    return result
  })
}
