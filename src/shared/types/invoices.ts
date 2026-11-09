import type {
  CabinetIdentity,
  EmailTemplate,
  EnvoiKind,
  InvoiceBlocker,
  InvoiceStatusKey,
  Reglement,
  UnlockReason,
} from '../domain/invoice'

/** Practitioner details copied on each invoice (R-12). */
export interface CabinetSnapshotView extends CabinetIdentity {
  mentionTva: string
}

/** Everything the note d'honoraires template prints (PDF, preview, register panel). */
export interface InvoiceDocumentData {
  kind: 'facture' | 'avoir'
  numero: string
  /** Number shown « (provisoire) » until the invoice is issued. */
  provisional: boolean
  dateEmission: string
  cabinet: CabinetSnapshotView
  /** `data:` URL of the signature image, if any. */
  signature: string | null
  patientNom: string
  patientAdresse: string
  dateSeance: string
  libelle: string
  montantCents: number
  /** « Acquittée le … · règlement : … » or « Règlement attendu ». */
  reglementMention: string
  /** Credit note: « Annule la facture N° … ». */
  reference: string | null
}

export type SendError = 'not_configured' | 'no_email' | 'auth' | 'network' | 'pdf' | 'other'

export type SendOutcome =
  | { ok: true; to: string }
  | {
      ok: false
      error: SendError
      /** Technical code, for « Tester la connexion ». */ code?: string
    }

export type InvoicePreview =
  | {
      ok: true
      seanceId: string
      patientId: string
      email: string | null
      motif: string | null
      document: InvoiceDocumentData
      reglement: Reglement
      reglementSummary: string
      /** Labels of the mandatory practitioner details still empty (Paramètres). */
      missingCabinet: string[]
      mailConfigured: boolean
    }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'blocked'; blockers: InvoiceBlocker[] }

export type IssueResult =
  | {
      ok: true
      factureId: string
      numero: string
      /** The PDF could be generated and archived. */
      pdf: boolean
      sent: SendOutcome | null
    }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'blocked'; blockers: InvoiceBlocker[] }
  | { ok: false; reason: 'cabinet_incomplete'; missing: string[] }

export interface InvoiceRow {
  id: string
  numero: string
  dateEmission: string
  patientId: string | null
  patientNom: string
  montantCents: number
  statut: 'emise' | 'deleted'
  reglement: Reglement
  modePaiement: string | null
  statusKey: InvoiceStatusKey
  envoi: EnvoiKind
  /** « E-mail · 23/10 à 17:52 », « Imprimée », « Non envoyé ». */
  envoiLabel: string
  seanceId: string | null
  dateSeance: string
  deletedAt: string | null
  modifiedAt: string | null
}

export interface EnvoiView {
  canal: 'email' | 'print'
  destinataire: string | null
  at: string
  ok: boolean
  error: string | null
}

export interface InvoiceDetail {
  row: InvoiceRow
  document: InvoiceDocumentData
  envois: EnvoiView[]
  /** Current e-mail of the patient, for « Renvoyer ». */
  email: string | null
  /** The session still exists (« ouvrir → »). */
  seanceExists: boolean
  modifiedNote: string | null
  avoirNumero: string | null
  mailConfigured: boolean
}

export type InvoiceActionResult =
  { ok: true } | { ok: false; reason: 'not_found' | 'not_allowed' | 'pdf' }

export type DeleteInvoiceResult =
  { ok: true; avoirNumero: string } | { ok: false; reason: 'not_found' | 'not_allowed' }

export type SaveFileResult =
  { ok: true; path: string } | { ok: false; reason: 'canceled' | 'error' }

export interface InvoiceSettingsView {
  cabinet: CabinetIdentity
  hasSignature: boolean
  signature: string | null
  tarifs: { list: number[]; defaultCents: number }
  mentionTva: string
  emailTemplate: EmailTemplate
  /** « 2026-0143 », read-only (R-11). */
  nextNumber: string
  /** The year's numbering can still start from another number (no invoice issued this year). */
  canSetStart: boolean
  missingCabinet: string[]
}

export interface InvoiceSettingsInput {
  cabinet: CabinetIdentity
  tarifs: { list: number[]; defaultCents: number }
  mentionTva: string
  emailTemplate: EmailTemplate
}

export type UnlockResult = { ok: true } | { ok: false; reason: 'not_found' | 'not_allowed' }

export type { UnlockReason }

export interface GmailStatus {
  address: string
  hasPassword: boolean
  connected: boolean
}

export interface GmailSettingsInput {
  address: string
  /** New application password; `null` keeps the stored one. */
  password: string | null
}

export type GmailTestStep = 'login' | 'send'

export interface GmailTestResult {
  steps: Array<{ step: GmailTestStep; ok: boolean; detail: string }>
  ok: boolean
}
