import type { CriterionCheck } from '../domain/matching'
import type { AgendaSettings, CardKind, Creneau, NewRdvError, Slot } from '../domain/planning'
import type { PatientDraft } from '../domain/patientValidation'
import type { PatientErrors } from '../domain/patientValidation'

export interface PlanningCard {
  /** Session id, or the Doctolib key of an appointment still to reconcile. */
  id: string
  seanceId: string | null
  patientId: string | null
  rdvKey: string | null
  heure: string | null
  nom: string
  motif: string
  kind: CardKind
}

export interface PlanningBlock {
  id: string
  date: string
  creneau: Creneau
  motif: string | null
}

export interface PlanningDay {
  date: string
  cards: PlanningCard[]
  blocks: PlanningBlock[]
  /** Appointments that are not cancelled. */
  count: number
}

export interface PlanningWeek {
  monday: string
  days: PlanningDay[]
  count: number
}

export interface PlanningView {
  weeks: PlanningWeek[]
  agenda: AgendaSettings
}

export interface DaySlots {
  date: string
  slots: Slot[]
  /** « 3 RDV ce jour-là · matin bloqué ». */
  summary: string
  patientHasSession: boolean
}

export interface NewRdvInput {
  patientId: string
  date: string
  heure: string
  motif: string
}

export type NewRdvResult =
  { ok: true; seanceId: string; patientId: string } | { ok: false; errors: NewRdvError[] }

export interface BlockInput {
  from: string
  to: string
  creneau: Creneau
  motif: string
}

export interface BlockPreview {
  days: number
  /** Appointments already in the period (warning, R-23). */
  conflicts: number
}

// --- « À rapprocher » (SPEC §3) -----------------------------------------------------------

export interface RdvView {
  key: string
  date: string
  heure: string | null
  nomAffiche: string
  telephone: string | null
  email: string | null
  motif: string | null
  receivedAt: string
}

export interface CandidateView {
  patientId: string
  nom: string
  prenom: string
  ddn: string
  lastSeance: string | null
  checks: CriterionCheck
  score: number
  /** « Motif « Bilan enfant » : … » on an adult. */
  note: string | null
}

export interface RdvCandidates {
  rdv: RdvView
  candidates: CandidateView[]
  /** Prefill of « Nouveau patient ». */
  prefill: { nom: string; prenom: string; portable: string; email: string }
}

export type AlertKind = 'done_cancelled' | 'done_moved' | 'block_conflict'

export interface AlertTask {
  id: string
  kind: AlertKind
  title: string
  sub: string
  patientId: string | null
  seanceId: string | null
}

export type AttachResult =
  | { ok: true; patientId: string; seanceId: string | null }
  | { ok: false; reason: 'not_found' | 'same_day' }

export type CreateAndAttachResult =
  | { ok: true; patientId: string; seanceId: string | null }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'invalid'; errors: PatientErrors }

export interface CreateAndAttachInput {
  key: string
  draft: PatientDraft
}

// --- Synchronisation (GMAIL_DOCTOLIB.md §2 – 4) --------------------------------------------

export interface SyncStatus {
  state: 'off' | 'idle' | 'running' | 'error'
  lastSyncAt: string | null
  /** Doctolib e-mails no parser recognised (Message-ID and subject in the logs only). */
  unrecognized: number
  error: 'auth' | 'network' | 'label' | 'other' | null
  /** Appointments created or updated by the last run. */
  lastChanges: number
}

export interface ExportImportReport {
  rows: number
  created: number
  updated: number
  cancelled: number
  pending: number
  ignored: number
}

export type ExportImportResult =
  | { ok: true; report: ExportImportReport }
  | { ok: false; reason: 'canceled' | 'unreadable' | 'columns'; missing?: string[] }
