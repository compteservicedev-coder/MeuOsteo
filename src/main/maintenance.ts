import { journalCutoff } from '@shared/domain/journal'
import { purgeJournal } from './db/repositories/journalRepository'
import { getSetting } from './db/repositories/settingsRepository'
import { log } from './logger'
import type { Runtime } from './runtime'
import { DEFAULT_JOURNAL_RETENTION, journalRetentionSchema } from './services/settingsSchemas'

/**
 * Daily housekeeping, run at start-up: purge of the records deleted more than 30 days ago (R-14)
 * and of the journal lines past their retention (R-20). Counts only in the log, never names.
 */
export function runMaintenance(runtime: Pick<Runtime, 'db' | 'patients'>, now = new Date()): void {
  try {
    const purged = runtime.patients.purgeDue()
    const months = getSetting(
      runtime.db,
      'journal_retention_months',
      journalRetentionSchema,
      DEFAULT_JOURNAL_RETENTION,
    )
    const lines = purgeJournal(runtime.db, journalCutoff(now, months))
    if (purged || lines)
      log.info(`Maintenance: ${purged} record(s) purged, ${lines} journal line(s)`)
  } catch (error) {
    log.error('Maintenance failed', error)
  }
}
