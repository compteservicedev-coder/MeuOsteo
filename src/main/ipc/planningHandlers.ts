import { readFile } from 'node:fs/promises'
import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron'
import { z } from 'zod'
import {
  agendaSettingsSchema,
  blockInputSchema,
  idSchema,
  isoDateSchema,
  newRdvInputSchema,
  patientDraftSchema,
  rdvKeySchema,
} from '@shared/types/schemas'
import { log } from '../logger'
import { importDoctolibExport } from '../services/doctolibExport'
import type { createRegistrar } from './register'

/** Planning (SPEC §3), « À rapprocher » for Doctolib, synchronisation and Paramètres > Agenda. */
export function registerPlanningHandlers(register: ReturnType<typeof createRegistrar>): void {
  const none = z.tuple([])

  register('planning:weeks', z.tuple([isoDateSchema]), ({ planning }, monday) =>
    planning.weeks(monday),
  )
  register(
    'planning:blocked-dates',
    z.tuple([isoDateSchema, isoDateSchema]),
    ({ planning }, a, b) => planning.blockedDates(a, b),
  )
  register(
    'planning:day-slots',
    z.tuple([isoDateSchema, idSchema.nullable()]),
    ({ planning }, date, patientId) => planning.daySlots(date, patientId),
  )
  register('planning:create-rdv', z.tuple([newRdvInputSchema]), ({ planning }, input) =>
    planning.createRdv(input),
  )
  register('planning:preview-block', z.tuple([blockInputSchema]), ({ planning }, input) =>
    planning.previewBlock(input),
  )
  register('planning:add-blocks', z.tuple([blockInputSchema]), ({ planning }, input) =>
    planning.addBlocks(input),
  )
  register('planning:remove-block', z.tuple([idSchema]), ({ planning }, id) =>
    planning.removeBlock(id),
  )

  register('agenda:get', none, ({ planning }) => planning.agenda())
  register('agenda:save', z.tuple([agendaSettingsSchema]), ({ planning }, value) =>
    planning.saveAgenda(value),
  )

  register('doctolib:candidates', z.tuple([rdvKeySchema]), ({ pipeline }, key) =>
    pipeline.candidates(key),
  )
  register(
    'doctolib:attach',
    z.tuple([rdvKeySchema, idSchema, z.boolean()]),
    ({ pipeline }, key, patientId, remember) => pipeline.attach(key, patientId, remember),
  )
  register(
    'doctolib:create-and-attach',
    z.tuple([rdvKeySchema, patientDraftSchema]),
    ({ pipeline }, key, draft) => pipeline.createAndAttach(key, draft),
  )
  register('doctolib:dismiss-alert', z.tuple([z.string().min(1).max(200)]), ({ pipeline }, id) =>
    pipeline.dismissAlert(id),
  )
  register('doctolib:import-export', none, async ({ pipeline }) => {
    const options: OpenDialogOptions = {
      title: 'Importer un export Doctolib',
      properties: ['openFile'],
      filters: [{ name: 'Export Doctolib', extensions: ['xlsx'] }],
    }
    const window = BrowserWindow.getFocusedWindow()
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    const path = result.filePaths[0]
    if (result.canceled || !path) return { ok: false, reason: 'canceled' }
    let data: Buffer
    try {
      data = await readFile(path)
    } catch {
      return { ok: false, reason: 'unreadable' }
    }
    const imported = await importDoctolibExport(data, pipeline)
    if (imported.ok) {
      const r = imported.report
      log.info(`Doctolib export: ${r.rows} rows, ${r.created} attached, ${r.pending} pending`)
    } else {
      log.warn(`Doctolib export refused (${imported.reason})`)
    }
    return imported
  })

  register('sync:get-status', none, ({ sync }) => sync.status())
  register('sync:run', none, ({ sync }) => sync.run())
}
