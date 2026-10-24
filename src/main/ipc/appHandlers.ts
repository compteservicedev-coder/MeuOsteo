import { ipcMain } from 'electron'
import { z } from 'zod'
import { isoDateInParis } from '@shared/domain/dates'
import type { StartupState } from '@shared/types/app'
import { getSetting } from '../db/repositories/settingsRepository'
import { getTodaySummary } from '../db/repositories/summaryRepository'
import type { IpcContext, createRegistrar } from './register'

const backupSettingSchema = z.object({ lastAt: z.string().nullable() })

export function registerAppHandlers(
  ctx: IpcContext,
  register: ReturnType<typeof createRegistrar>,
  version: string,
): void {
  // Answered even when start-up failed, so that the opening screen can explain the problem.
  ipcMain.handle('app:get-startup-state', async (event): Promise<StartupState> => {
    if (!ctx.isTrustedSender(event)) throw new Error('Untrusted sender')
    const started = await ctx.startup
    if (!started.ok) return { ok: false, error: started.error }
    return { ok: true, security: started.runtime.accessCode.getStatus(), version }
  })

  register('app:get-today-summary', z.tuple([]), ({ db }) => {
    const { lastAt } = getSetting(db, 'backup', backupSettingSchema, { lastAt: null })
    return getTodaySummary(db, isoDateInParis(new Date()), lastAt)
  })
}
