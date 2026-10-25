import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { BrowserWindow, dialog, shell, type SaveDialogOptions } from 'electron'
import { z } from 'zod'
import { accountingCsv, toCsv } from '@shared/domain/invoice'
import { isoDateInParis } from '@shared/domain/dates'
import type { GmailTestResult, SaveFileResult, SendOutcome } from '@shared/types/invoices'
import {
  csvRowsSchema,
  fileNameSchema,
  gmailSettingsInputSchema,
  idSchema,
  invoiceSettingsInputSchema,
  issueOptionsSchema,
  numberingStartSchema,
  unlockReasonSchema,
} from '@shared/types/schemas'
import { log } from '../logger'
import type { createRegistrar } from './register'

async function askSavePath(options: SaveDialogOptions): Promise<string | null> {
  const window = BrowserWindow.getFocusedWindow()
  const result = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
  return result.canceled || !result.filePath ? null : result.filePath
}

async function saveText(defaultName: string, content: string): Promise<SaveFileResult> {
  const path = await askSavePath({
    defaultPath: defaultName,
    filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }],
  })
  if (!path) return { ok: false, reason: 'canceled' }
  try {
    await writeFile(path, content, 'utf8')
    return { ok: true, path }
  } catch (error) {
    log.error('CSV export failed', error)
    return { ok: false, reason: 'error' }
  }
}

const SEND_DETAILS: Record<string, string> = {
  not_configured: 'Gmail n’est pas configuré',
  auth: 'Adresse ou mot de passe d’application refusé par Gmail',
  network: 'Gmail injoignable : vérifiez la connexion internet',
  other: 'Gmail a refusé l’envoi',
}
const detailOf = (o: SendOutcome, okText: string) =>
  o.ok ? okText : (SEND_DETAILS[o.error] ?? SEND_DETAILS['other']!)

/** Invoices (SPEC §5.5 – 6), R-04 unlock, Cabinet & factures and Gmail settings. */
export function registerInvoiceHandlers(register: ReturnType<typeof createRegistrar>): void {
  const none = z.tuple([])
  const byId = z.tuple([idSchema])

  register('seances:unlock', z.tuple([idSchema, unlockReasonSchema]), ({ seances }, id, reason) =>
    seances.unlock(id, reason),
  )
  register('seances:relock', byId, ({ seances }, id) => seances.relock(id))

  register('invoices:preview', byId, ({ invoices }, id) => invoices.preview(id))
  register('invoices:issue', z.tuple([idSchema, issueOptionsSchema]), ({ invoices }, id, o) =>
    invoices.issue(id, o),
  )
  register('invoices:list', none, ({ invoices }) => invoices.list())
  register('invoices:detail', byId, ({ invoices }, id) => invoices.detail(id))
  register('invoices:send', byId, ({ invoices }, id) => invoices.send(id))
  register('invoices:print', byId, ({ invoices }, id) => invoices.print(id))
  register('invoices:mark-paid', byId, ({ invoices }, id) => invoices.markPaid(id))
  register('invoices:delete', byId, ({ invoices }, id) => invoices.delete(id))

  register('invoices:save-pdf', byId, async ({ invoices }, id) => {
    const file = await invoices.pdfFile(id)
    if (!file) return { ok: false, reason: 'error' }
    const path = await askSavePath({
      defaultPath: `Note d'honoraires ${file.numero}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (!path) return { ok: false, reason: 'canceled' }
    try {
      await copyFile(file.path, path)
      return { ok: true, path }
    } catch (error) {
      log.error('PDF copy failed', error)
      return { ok: false, reason: 'error' }
    }
  })

  register('invoices:open-pdf', byId, async ({ invoices }, id) => {
    const file = await invoices.pdfFile(id)
    if (!file) return { ok: false, reason: 'pdf' }
    const error = await shell.openPath(file.path)
    return error ? { ok: false, reason: 'pdf' } : { ok: true }
  })

  register(
    'invoices:export-selection',
    z.tuple([csvRowsSchema, fileNameSchema]),
    (_runtime, rows, fileName) => saveText(`${fileName}.csv`, toCsv(rows)),
  )
  register('invoices:export-accounting', none, ({ invoices }) =>
    saveText(
      `Export comptable ${isoDateInParis(new Date())}.csv`,
      accountingCsv(invoices.accountingLines()),
    ),
  )

  register('invoices:get-settings', none, ({ invoices }) => invoices.settingsView())
  register('invoices:save-settings', z.tuple([invoiceSettingsInputSchema]), ({ invoices }, input) =>
    invoices.saveSettings(input),
  )
  register('invoices:choose-signature', none, async ({ invoices }) => {
    const window = BrowserWindow.getFocusedWindow()
    const options = {
      title: 'Image de signature',
      properties: ['openFile' as const],
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg'] }],
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    const path = result.filePaths[0]
    if (result.canceled || !path) return invoices.settingsView()
    const content = await readFile(path)
    // A signature is a small image: refuse anything heavy for the PDFs.
    if (content.length > 2_000_000) return invoices.settingsView()
    return invoices.setSignature(content, extname(path))
  })
  register('invoices:remove-signature', none, ({ invoices }) => invoices.removeSignature())
  register('invoices:set-numbering-start', z.tuple([numberingStartSchema]), ({ invoices }, n) =>
    invoices.setNumberingStart(n),
  )

  register('gmail:get-status', none, ({ gmail }) => gmail.status())
  register('gmail:save', z.tuple([gmailSettingsInputSchema]), ({ gmail }, input) =>
    gmail.save(input),
  )
  register('gmail:set-connected', z.tuple([z.boolean()]), ({ gmail }, c) => gmail.setConnected(c))
  register('gmail:test', none, async ({ mailer }): Promise<GmailTestResult> => {
    const steps: GmailTestResult['steps'] = []
    const login = await mailer.verify()
    steps.push({
      step: 'login',
      ok: login.ok,
      detail: detailOf(login, 'Connexion à Gmail réussie'),
    })
    if (login.ok) {
      const sent = await mailer.sendTest()
      steps.push({
        step: 'send',
        ok: sent.ok,
        detail: detailOf(sent, sent.ok ? `E-mail de test envoyé à ${sent.to}` : ''),
      })
    }
    return { steps, ok: steps.every((s) => s.ok) && steps.length === 2 }
  })
}
