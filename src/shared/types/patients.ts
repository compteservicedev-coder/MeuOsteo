import type { DuplicateCriterion } from '../domain/creationDuplicates'
import type { Sexe, Situation } from '../domain/patient'
import type { PatientDraft, PatientErrors } from '../domain/patientValidation'
import type { Relation } from '../domain/relatives'
import type { MarkDoneError, Paiement, SeanceSource, SeanceStatus } from '../domain/seance'
import type { JournalType } from '../domain/journal'

/** A row of the Patients list (SPEC §4). */
export interface PatientListItem {
  id: string
  nom: string
  prenom: string
  profession: string | null
  ddn: string
  commune: string | null
  portable: string | null
  /** Date of the last done session. */
  lastSeance: string | null
}

export interface PatientSearchResult {
  items: PatientListItem[]
  /** True when the list was cut (more matches than shown). */
  truncated: boolean
}

/** « Aujourd’hui » panel. */
export interface TodayAppointment {
  seanceId: string
  patientId: string
  nom: string
  prenom: string
  heure: string | null
  motif: string | null
  /** First session of this patient. */
  isNew: boolean
}

export interface PatientRecord {
  id: string
  shortNo: number
  nom: string
  prenom: string
  ddn: string
  sexe: Sexe | null
  situation: Situation | null
  enfants: number | null
  profession: string | null
  adresse: string | null
  cp: string | null
  commune: string | null
  portable: string | null
  fixe: string | null
  email: string | null
  commentaire: string | null
  commentaireUpdatedAt: string | null
  antecedentsTags: string[]
  createdAt: string
  deletedAt: string | null
}

export interface SeanceView {
  id: string
  patientId: string
  date: string
  heure: string | null
  status: SeanceStatus
  source: SeanceSource
  motif: string | null
  anamnese: string | null
  pratique: string | null
  tarifCents: number
  paiement: Paiement | null
  doneAt: string | null
  cancelReason: string | null
  cancelledAt: string | null
  /** Active invoice attached to the session (R-10), if any. */
  invoice: { id: string; numero: string } | null
}

export interface RelativeView {
  patientId: string
  nom: string
  prenom: string
  /** What this relative is to the patient of the record. */
  relation: Relation
}

export interface PatientDetail {
  patient: PatientRecord
  /** Most recent first. */
  seances: SeanceView[]
  relatives: RelativeView[]
  invoiceCount: number
  tarifsCents: number[]
}

export type SavePatientResult =
  { ok: true; id: string; changed: string[] } | { ok: false; errors: PatientErrors }

export interface DuplicateView {
  id: string
  nom: string
  prenom: string
  ddn: string
  commune: string | null
  criteria: DuplicateCriterion[]
}

export interface DuplicateQuery extends Pick<
  PatientDraft,
  'nom' | 'prenom' | 'ddn' | 'portable' | 'fixe' | 'email'
> {
  excludeId?: string
}

export interface LinkCandidate {
  id: string
  nom: string
  prenom: string
  /** « 36 ans · Vincennes » */
  ddn: string
  commune: string | null
}

export type LinkResult =
  { ok: true } | { ok: false; reason: 'self' | 'already_linked' | 'not_found' }

export interface DeletedPatientView {
  id: string
  shortNo: number
  nom: string
  prenom: string
  deletedAt: string
  daysLeft: number
  seances: number
}

export interface JournalLineView {
  id: string
  at: string
  type: JournalType
  subject: string
  action: string
}

/** Fields of a session the detail panel can change. */
export interface SeanceChanges {
  date?: string
  motif?: string | null
  anamnese?: string | null
  pratique?: string | null
  tarifCents?: number
  paiement?: Paiement | null
}

export type SeanceFailure =
  | { ok: false; reason: 'not_found' | 'not_editable' | 'locked' | 'invoiced' | 'invalid_date' }
  | { ok: false; reason: 'same_day'; existingId: string }
  | { ok: false; reason: 'mark_done'; errors: MarkDoneError[] }

export type SeanceResult = { ok: true; seance: SeanceView } | SeanceFailure

export type CreateSeanceResult =
  { ok: true; seance: SeanceView; existing: boolean } | { ok: false; reason: 'not_found' }
