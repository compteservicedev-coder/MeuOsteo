import { rmSync } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { BrowserWindow, dialog, shell } from 'electron'
import { ulid } from 'ulid'
import { z } from 'zod'
import { MAX_DOCUMENT_BYTES, safeFileName } from '@shared/domain/documents'
import type { AddDocumentsResult, DocumentUpload } from '@shared/types/documents'
import { documentChangesSchema, documentUploadsSchema, idSchema } from '@shared/types/schemas'
import { log } from '../logger'
import { appPaths } from '../paths'
import type { createRegistrar } from './register'

/** Decrypted copies opened with the PC's software. Emptied at start-up and at closing. */
export const openedDocumentsFolder = () => join(appPaths.userData, 'tmp', 'documents')

export function clearOpenedDocuments(): void {
  try {
    rmSync(openedDocumentsFolder(), { recursive: true, force: true })
  } catch {
    // A file still open in Word stays until the next start.
  }
}

/** R-26 · Documents du patient. Refused while the interface is locked, like every record call. */
export function registerDocumentHandlers(register: ReturnType<typeof createRegistrar>): void {
  const byId = z.tuple([idSchema])

  register('documents:list', byId, ({ documents }, patientId) => documents.list(patientId))
  register(
    'documents:add',
    z.tuple([idSchema, documentUploadsSchema]),
    ({ documents }, patientId, uploads) => documents.add(patientId, uploads),
  )
  register('documents:choose-and-add', byId, async ({ documents }, patientId) => {
    const window = BrowserWindow.getFocusedWindow()
    const options = {
      title: 'Ajouter des documents',
      properties: ['openFile' as const, 'multiSelections' as const],
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return { added: [], refused: [] }
    const uploads: DocumentUpload[] = []
    const refused: AddDocumentsResult['refused'] = []
    for (const path of result.filePaths.slice(0, 50)) {
      const name = basename(path)
      try {
        // Checked before reading: a 2 Go video is never loaded in memory.
        if ((await stat(path)).size > MAX_DOCUMENT_BYTES) {
          refused.push({ name, reason: 'too_large' })
          continue
        }
        uploads.push({ name, bytes: await readFile(path) })
      } catch {
        refused.push({ name, reason: 'unreadable' })
      }
    }
    const added = uploads.length ? documents.add(patientId, uploads) : { added: [], refused: [] }
    if (!added) return null
    return { added: added.added, refused: [...refused, ...added.refused] }
  })
  register(
    'documents:update',
    z.tuple([idSchema, documentChangesSchema]),
    ({ documents }, id, changes) => documents.update(id, changes),
  )
  register('documents:delete', byId, ({ documents }, id) => documents.delete(id))
  register('documents:content', byId, ({ documents }, id) => documents.content(id))
  register('documents:email', byId, ({ documents }, id) => documents.email(id))

  register('documents:open', byId, async ({ documents }, id) => {
    const file = documents.file(id)
    if (!file) return { ok: false, reason: 'not_found' }
    try {
      const folder = join(openedDocumentsFolder(), ulid())
      await mkdir(folder, { recursive: true })
      const path = join(folder, safeFileName(file.titre, file.fileName))
      await writeFile(path, file.bytes)
      const error = await shell.openPath(path)
      if (error) log.warn('Document cannot be opened by the system')
      return error ? { ok: false, reason: 'error' } : { ok: true }
    } catch (error) {
      log.error('Document copy for opening failed', error)
      return { ok: false, reason: 'error' }
    }
  })

  register('documents:save-as', byId, async ({ documents }, id) => {
    const file = documents.file(id)
    if (!file) return { ok: false, reason: 'error' }
    const window = BrowserWindow.getFocusedWindow()
    const options = { defaultPath: safeFileName(file.titre, file.fileName) }
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { ok: false, reason: 'canceled' }
    try {
      await writeFile(result.filePath, file.bytes)
      return { ok: true, path: result.filePath }
    } catch (error) {
      log.error('Document save failed', error)
      return { ok: false, reason: 'error' }
    }
  })
}
