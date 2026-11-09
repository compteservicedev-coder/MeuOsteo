import type { AgendaSettings, CardKind, Creneau, NewRdvError, Slot } from '../domain/planning'

export interface PlanningCard {
  /** Session id. */
  id: string
  seanceId: string | null
  patientId: string | null
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
