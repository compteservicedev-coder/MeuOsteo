import type { SecurityStatus } from './security'

export type StartupError = 'key_unavailable' | 'key_protection_unavailable' | 'database_unavailable'

export type StartupState =
  { ok: true; security: SecurityStatus; version: string } | { ok: false; error: StartupError }

/** « Résumé du jour » of the opening screen, also used by the sidebar. */
export interface TodaySummary {
  appointmentsToday: number
  /** Doctolib appointments waiting in « À rapprocher ». */
  toReconcile: number
  lastBackupAt: string | null
}
