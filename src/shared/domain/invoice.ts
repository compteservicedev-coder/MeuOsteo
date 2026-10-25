/**
 * Invoicing rules (SPEC §5.5 – 6): R-10 issuing conditions, R-11 numbering, R-12 snapshot,
 * R-13 « Supprimer la facture » and R-04 unlocking of an invoiced session.
 */
import { formatIsoDateFr } from './dates'
import type { Paiement, SeanceStatus } from './seance'

export type Reglement = 'acquittee' | 'attente'

/** Designation printed on every invoice. */
export const INVOICE_LIBELLE = 'Séance d’ostéopathie'
export const DEFAULT_TITRE = 'Ostéopathe D.O.'
export const DEFAULT_MENTION_TVA = 'TVA non applicable, article 261-4-1° du CGI.'

/** Reasons offered by « Déverrouiller date et tarif… » (R-04). */
export const UNLOCK_REASONS = [
  'Erreur de saisie',
  'Erreur de date',
  'Changement de tarif',
  'Autre',
] as const
export type UnlockReason = (typeof UNLOCK_REASONS)[number]

// --- R-10 · Issuing conditions -------------------------------------------------------------

export interface InvoiceableSeance {
  status: SeanceStatus
  tarifCents: number
  /** An active (`emise`) invoice exists for the session. */
  invoiced: boolean
}

export type InvoiceBlocker = 'not_done' | 'editing' | 'free' | 'already_invoiced' | 'address'

/** Why the session cannot be invoiced, in the order the footer explains it. Empty: it can. */
export function invoiceBlockers(
  s: InvoiceableSeance,
  ctx: { editing: boolean; addressComplete: boolean },
): InvoiceBlocker[] {
  const blockers: InvoiceBlocker[] = []
  if (s.status !== 'done') blockers.push('not_done')
  if (ctx.editing) blockers.push('editing')
  if (s.invoiced) blockers.push('already_invoiced')
  if (s.tarifCents <= 0) blockers.push('free')
  if (!ctx.addressComplete) blockers.push('address')
  return blockers
}

export type InvoiceAction = 'generate' | 'complete_address' | 'view' | 'free' | null

/**
 * Footer of a done session in consultation (SPEC §5.3): « Générer la facture », « Compléter
 * l’adresse », « Voir la facture », or the « séance gratuite » mention. `null` otherwise.
 */
export function invoiceAction(
  s: InvoiceableSeance,
  ctx: { editing: boolean; addressComplete: boolean },
): InvoiceAction {
  if (s.status !== 'done' || ctx.editing) return null
  if (s.invoiced) return 'view'
  if (s.tarifCents <= 0) return 'free'
  if (!ctx.addressComplete) return 'complete_address'
  return 'generate'
}

// --- R-11 · Numbering ----------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(4, '0')

/** `2026-0001`: continuous sequence per calendar year of the issue date. */
export function formatInvoiceNumber(annee: number, sequence: number): string {
  return `${annee}-${pad(sequence)}`
}

/** `AV-2026-0001`: credit notes have their own continuous sequence (R-13). */
export function formatAvoirNumber(annee: number, sequence: number): string {
  return `AV-${annee}-${pad(sequence)}`
}

/** Next number of the year, from the highest sequence already used (`null`: none yet). */
export function nextSequence(lastSequence: number | null): number {
  return (lastSequence ?? 0) + 1
}

/** Year of an ISO date (`2026-10-24` → 2026). */
export const yearOf = (isoDate: string) => Number(isoDate.slice(0, 4))

/** Gaps in a list of sequences of one year: must stay empty (no number lost). */
export function sequenceGaps(sequences: number[]): number[] {
  const sorted = [...new Set(sequences)].sort((a, b) => a - b)
  const gaps: number[] = []
  let expected = 1
  for (const s of sorted) {
    for (; expected < s; expected++) gaps.push(expected)
    expected = s + 1
  }
  return gaps
}

// --- R-12 · Snapshot -----------------------------------------------------------------------

/** « Virement en attente » (or no payment entered yet) means the invoice awaits payment. */
export function reglementOf(paiement: Paiement | null): Reglement {
  return paiement === null || paiement === 'virement_attente' ? 'attente' : 'acquittee'
}

const MODE_LABELS: Record<Paiement, string> = {
  especes: 'espèces',
  cheque: 'chèque',
  virement_attente: 'virement',
  virement_recu: 'virement',
}

/** Payment mode as printed on the invoice (« chèque », « virement »…). */
export function modePaiementLabel(paiement: Paiement | null): string | null {
  return paiement ? MODE_LABELS[paiement] : null
}

/** « Acquittée le 09/10/2026 · règlement : chèque. » or « Règlement attendu par virement. » */
export function reglementMention(input: {
  reglement: Reglement
  modePaiement: string | null
  /** Date the payment was received (the session date, or the day the transfer arrived). */
  acquitteeLe: string
}): string {
  if (input.reglement === 'attente') {
    return input.modePaiement
      ? `Règlement attendu par ${input.modePaiement}.`
      : 'Règlement attendu.'
  }
  return `Acquittée le ${formatIsoDateFr(input.acquitteeLe)}${
    input.modePaiement ? ` · règlement : ${input.modePaiement}` : ''
  }.`
}

/** Short label of the side summary: « Acquittée · Chèque » / « En attente (virement) ». */
export function reglementSummary(reglement: Reglement, modePaiement: string | null): string {
  if (reglement === 'attente') return modePaiement ? `En attente (${modePaiement})` : 'En attente'
  return modePaiement
    ? `Acquittée · ${modePaiement.charAt(0).toUpperCase()}${modePaiement.slice(1)}`
    : 'Acquittée'
}

export interface CabinetIdentity {
  nom: string
  titre: string
  adresse: string
  telephone: string
  adeli: string
  siret: string
}

/** Mandatory practitioner details missing for a valid invoice (DATA_MODEL.md §factures). */
export function missingCabinetFields(c: CabinetIdentity): Array<keyof CabinetIdentity> {
  const keys: Array<keyof CabinetIdentity> = ['nom', 'adresse', 'adeli', 'siret']
  return keys.filter((k) => !c[k].trim())
}

export const CABINET_FIELD_LABELS: Record<keyof CabinetIdentity, string> = {
  nom: 'prénom et nom',
  titre: 'titre',
  adresse: 'adresse du cabinet',
  telephone: 'téléphone',
  adeli: 'n° ADELI',
  siret: 'SIRET',
}

// --- Money and e-mail ----------------------------------------------------------------------

/** `6000` → « 60,00 € », `-6000` → « −60,00 € », `125000` → « 1 250,00 € ». */
export function formatEuros(cents: number): string {
  const abs = Math.abs(cents)
  const units = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const decimals = String(abs % 100).padStart(2, '0')
  return `${cents < 0 ? '−' : ''}${units},${decimals} €`
}

/** « 60 € », « 1 250 € », « 52,50 € »: compact form used in indicators and the journal. */
export function formatEurosShort(cents: number): string {
  if (cents % 100 !== 0) return formatEuros(cents)
  const units = Math.abs(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${cents < 0 ? '−' : ''}${units} €`
}

export interface EmailTemplate {
  subject: string
  body: string
}

export const DEFAULT_EMAIL_TEMPLATE: EmailTemplate = {
  subject: 'Votre note d’honoraires du {date}',
  body: 'Bonjour {prénom},\n\nVeuillez trouver ci-joint votre note d’honoraires pour la séance du {date}.\n\nBien cordialement,',
}

/** Replaces `{prénom}` (or `{prenom}`) and `{date}` (session date, JJ/MM/AAAA). */
export function renderEmailTemplate(
  template: EmailTemplate,
  values: { prenom: string; dateSeance: string; signature?: string },
): EmailTemplate {
  const fill = (text: string) =>
    text
      .replace(/\{pr[ée]nom\}/gi, values.prenom)
      .replace(/\{date\}/gi, formatIsoDateFr(values.dateSeance))
  const body = fill(template.body)
  return {
    subject: fill(template.subject).replace(/\s+/g, ' ').trim(),
    body: values.signature ? `${body}\n${values.signature}` : body,
  }
}

// --- Register (SPEC §6) --------------------------------------------------------------------

export type InvoiceStatusKey = 'ok' | 'wait' | 'cancel'

export const INVOICE_STATUS_LABELS: Record<InvoiceStatusKey, string> = {
  ok: 'Acquittée',
  wait: 'En attente',
  cancel: 'Supprimée',
}

export function invoiceStatusKey(f: { statut: 'emise' | 'deleted'; reglement: Reglement }) {
  if (f.statut === 'deleted') return 'cancel' as const
  return f.reglement === 'attente' ? ('wait' as const) : ('ok' as const)
}

export type EnvoiKind = 'E-mail' | 'Imprimée' | 'Non envoyé'

/** « Envoi » column: the last successful sending wins. */
export function envoiKind(envois: Array<{ canal: 'email' | 'print'; ok: boolean }>): EnvoiKind {
  const last = [...envois].reverse().find((e) => e.ok)
  if (!last) return 'Non envoyé'
  return last.canal === 'email' ? 'E-mail' : 'Imprimée'
}

export interface RegisterTotals {
  count: number
  totalCents: number
  pendingCents: number
  deleted: number
}

/** Indicators of the register, computed on the rows on screen (deleted ones excluded from sums). */
export function registerTotals(
  rows: Array<{ statut: 'emise' | 'deleted'; reglement: Reglement; montantCents: number }>,
): RegisterTotals {
  let totalCents = 0
  let pendingCents = 0
  let deleted = 0
  for (const r of rows) {
    if (r.statut === 'deleted') {
      deleted++
      continue
    }
    totalCents += r.montantCents
    if (r.reglement === 'attente') pendingCents += r.montantCents
  }
  return { count: rows.length, totalCents, pendingCents, deleted }
}

// --- Accounting export ---------------------------------------------------------------------

export interface AccountingLine {
  type: 'Facture' | 'Avoir'
  numero: string
  date: string
  patient: string
  montantCents: number
  reglement: string
  modePaiement: string
  reference: string
}

const csvCell = (value: string) =>
  /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

/** Amount for spreadsheets: « 60,00 » / « -60,00 » (no currency sign, French decimal comma). */
export const csvAmount = (cents: number) =>
  `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)},${String(Math.abs(cents) % 100).padStart(2, '0')}`

/**
 * CSV for Excel (French locale): `;` separator, CRLF, UTF-8 BOM. Invoices and credit notes in
 * chronological order, then by number.
 */
export function accountingCsv(lines: AccountingLine[]): string {
  const header = [
    'Type',
    'Numéro',
    'Date',
    'Patient',
    'Montant',
    'Règlement',
    'Mode de paiement',
    'Référence',
  ]
  const sorted = [...lines].sort(
    (a, b) => a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero),
  )
  const rows = sorted.map((l) => [
    l.type,
    l.numero,
    formatIsoDateFr(l.date),
    l.patient,
    csvAmount(l.montantCents),
    l.reglement,
    l.modePaiement,
    l.reference,
  ])
  return `\uFEFF${[header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')}\r\n`
}

/** Generic CSV (same format) for « Exporter la sélection » and the journal export. */
export function toCsv(rows: string[][]): string {
  return `\uFEFF${rows.map((r) => r.map(csvCell).join(';')).join('\r\n')}\r\n`
}

// --- Paramètres > Cabinet & factures -------------------------------------------------------

/** « 60 € », « 52,50 », « Gratuit » → cents; `null` if not a price. */
export function parseTarif(text: string): number | null {
  const t = text.trim().toLowerCase()
  if (t === 'gratuit' || t === '0') return 0
  const m = /^(\d{1,4})(?:[,.](\d{1,2}))?\s*€?$/.exec(t)
  if (!m) return null
  return Number(m[1]) * 100 + Number((m[2] ?? '0').padEnd(2, '0'))
}

/** « Gratuit, 50 €, 55 €, 65 € » → sorted cents, or the first invalid item. */
export function parseTarifList(
  text: string,
): { ok: true; cents: number[] } | { ok: false; bad: string } {
  const items = text
    .split(/[;,/]|\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const cents: number[] = []
  for (const item of items) {
    const value = parseTarif(item)
    if (value === null) return { ok: false, bad: item }
    cents.push(value)
  }
  return { ok: true, cents: [...new Set(cents)].sort((a, b) => a - b) }
}

/** « Gratuit, 50 €, 55 € » (the default tarif excluded). */
export function formatTarifList(cents: number[], exclude: number): string {
  return cents
    .filter((c) => c !== exclude)
    .map((c) => (c === 0 ? 'Gratuit' : formatEurosShort(c)))
    .join(', ')
}

/** ADELI: 9 digits; SIRET: 14 digits (spaces allowed while typing). */
export const isAdeli = (v: string) => /^\d{9}$/.test(v.replace(/\s/g, ''))
export const isSiret = (v: string) => /^\d{14}$/.test(v.replace(/\s/g, ''))
