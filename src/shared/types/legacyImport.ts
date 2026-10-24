import { z } from 'zod'
import type { ImportAnomaly } from '../domain/legacyImport'

/** Reprise de l'historique (docs/MIGRATION.md): what main and the renderer exchange. */

export type ChooseLegacyFileResult =
  { canceled: true } | { canceled: false; fileId: string; fileName: string }

export interface LegacyImportReport {
  fileId: string
  fileName: string
  /** Records and sessions that will be imported (orphan sessions excluded). */
  patients: number
  seances: number
  anomalies: ImportAnomaly[]
  /** R-19 pairs among the imported records, sent to « À rapprocher » after the import. */
  duplicates: number
  /** Ignored fields and columns. */
  notes: string[]
  /** Records already in the database: the import is then refused. */
  existingPatients: number
  /** Range accepted for a typed session date. */
  seanceDateRange: { min: string; max: string }
  today: string
}

export type LegacyAnalyzeResult =
  | { ok: true; report: LegacyImportReport }
  | { ok: false; reason: 'file_unknown' | 'unreadable' }
  | { ok: false; reason: 'tables_missing' | 'columns_missing'; missing: string[] }

export interface LegacyImportRequest {
  fileId: string
  /** Correction key (`ddn:12`, `date:34`) → ISO date. */
  corrections: Record<string, string>
}

export type LegacyImportResult =
  | { ok: true; patients: number; seances: number; duplicates: number; datesToFix: number }
  | { ok: false; reason: 'file_unknown' | 'database_not_empty' }
  | { ok: false; reason: 'invalid_corrections' | 'corrections_required'; keys: string[] }

export const legacyFileIdSchema = z.string().uuid()

export const legacyImportRequestSchema = z.object({
  fileId: legacyFileIdSchema,
  corrections: z.record(
    z.string().regex(/^(ddn|date):\d{1,7}$/),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ),
})
