import type { JournalType } from '../domain/journal'

/** Tableau de bord (SPEC §7). Amounts in cents. */
export interface DashboardView {
  month: {
    seances: number
    previousSeances: number
    revenueCents: number
    newPatients: number
    totalPatients: number
  }
  yearRevenueCents: number
  pendingCents: number
  /** 12 months, oldest first: `2026-10` and the revenue of done sessions. */
  revenueByMonth: Array<{ month: string; cents: number }>
  pending: PendingPayment[]
  lastInvoices: Array<{
    id: string
    numero: string
    dateEmission: string
    patientNom: string
    montantCents: number
    statusKey: 'ok' | 'wait' | 'cancel'
  }>
  lastBackupAt: string | null
}

export interface PendingPayment {
  seanceId: string
  patientId: string
  nom: string
  date: string
  montantCents: number
  /** Invoice of the session, if any: « Marquer reçu » acquits it too. */
  factureId: string | null
  numero: string | null
}

export interface JournalEntry {
  id: string
  at: string
  type: JournalType
  subject: string
  action: string
}

export interface BackupStatus {
  folder: string
  keep: number
  lastAt: string | null
  files: Array<{ name: string; at: string; sizeBytes: number }>
}

export type BackupRunResult =
  { ok: true; name: string; sizeBytes: number } | { ok: false; reason: 'folder' | 'error' }

export type RestoreResult =
  | { ok: true; patients: number; seances: number; factures: number }
  | {
      ok: false
      reason: 'canceled' | 'wrong_key' | 'corrupt' | 'unreadable' | 'file_unknown'
      fileId?: string
    }
