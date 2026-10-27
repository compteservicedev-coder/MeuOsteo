import { writeFile } from 'node:fs/promises'
import { BrowserWindow, dialog } from 'electron'
import { z } from 'zod'
import { monthLabelFr } from '@shared/domain/bilan'
import {
  budgetSettingsSchema,
  exceptionalExpensesSchema,
  idSchema,
  lineOverrideSchema,
  monthSchema,
} from '@shared/types/schemas'
import { log } from '../logger'
import type { createRegistrar } from './register'

/** R-27 · Bilan mensuel. Refused while the interface is locked. */
export function registerBilanHandlers(register: ReturnType<typeof createRegistrar>): void {
  const byMonth = z.tuple([monthSchema])

  register('bilan:view', byMonth, ({ bilan }, month) => bilan.view(month))
  register(
    'bilan:set-line',
    z.tuple([monthSchema, idSchema, lineOverrideSchema]),
    ({ bilan }, month, seanceId, change) => bilan.setLine(month, seanceId, change),
  )
  register('bilan:set-all', z.tuple([monthSchema, z.boolean()]), ({ bilan }, month, included) =>
    bilan.setAll(month, included),
  )
  register(
    'bilan:set-exceptional',
    z.tuple([monthSchema, exceptionalExpensesSchema]),
    ({ bilan }, month, list) => bilan.setExceptional(month, list),
  )
  register('bilan:save-budget', z.tuple([budgetSettingsSchema]), ({ bilan }, settings) =>
    bilan.saveBudget(settings),
  )
  register('bilan:export', byMonth, async ({ bilan }, month) => {
    const window = BrowserWindow.getFocusedWindow()
    const options = {
      defaultPath: `Bilan ${monthLabelFr(month)}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    }
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { ok: false, reason: 'canceled' }
    try {
      await writeFile(result.filePath, await bilan.exportWorkbook(month))
      return { ok: true, path: result.filePath }
    } catch (error) {
      log.error('Monthly statement export failed', error)
      return { ok: false, reason: 'error' }
    }
  })
}
