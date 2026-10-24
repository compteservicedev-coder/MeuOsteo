import { z } from 'zod'
import {
  MERGE_FIELDS,
  type DuplicateReason,
  type MergeField,
  type MergePicks,
} from '../domain/duplicates'

/** « À rapprocher » (SPEC §3): cases the application could not settle by itself. */

export interface DuplicateTask {
  /** Older record (smaller short number): the one kept by default. */
  a: { id: string; name: string }
  b: { id: string; name: string }
  reasons: DuplicateReason[]
}

/** Doctolib appointments without a record (resolved from lot 4). */
export interface PendingRdvTask {
  key: string
  nomAffiche: string
  date: string
  heure: string | null
  match: 'pending_new' | 'pending_multi'
}

export interface ReconcileTasks {
  duplicates: DuplicateTask[]
  doctolib: PendingRdvTask[]
}

export interface MergeRecordSummary {
  id: string
  shortNo: number
  /** Imported from the old tool (`legacy_key`). */
  imported: boolean
  createdAt: string
  seances: number
  lastSeance: string | null
}

export interface MergeRow {
  field: MergeField
  label: string
  /** Displayed values; empty string when not filled in. */
  a: string
  b: string
  same: boolean
}

export interface MergeComparison {
  a: MergeRecordSummary
  b: MergeRecordSummary
  reasons: DuplicateReason[]
  rows: MergeRow[]
  picks: MergePicks
  /** Days on which both records have a session (R-08): the merge is refused. */
  conflictDates: string[]
}

export interface MergeRequest {
  keepId: string
  removeId: string
  picks: MergePicks
}

export type MergeResult =
  | { ok: true; keptId: string; name: string; seances: number }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'same_day_conflict'; dates: string[] }

export const patientIdSchema = z.string().min(1).max(64)

const side = z.enum(['a', 'b'])

export const mergeRequestSchema = z.object({
  keepId: patientIdSchema,
  removeId: patientIdSchema,
  picks: z.object(
    Object.fromEntries(MERGE_FIELDS.map((f) => [f, side])) as Record<MergeField, typeof side>,
  ),
})
