/** Sessions (séances): displayed status and the rules R-01 to R-08. */
import { formatIsoDateFr } from './dates'

export type SeanceStatus = 'planned' | 'done' | 'cancelled'
export type SeanceSource = 'doctolib' | 'manual' | 'import'
export type Paiement = 'especes' | 'cheque' | 'virement_attente' | 'virement_recu'

export const PAIEMENT_OPTIONS: ReadonlyArray<{ value: Paiement; label: string; short: string }> = [
  { value: 'especes', label: 'Espèces', short: 'Espèces' },
  { value: 'cheque', label: 'Chèque', short: 'Chèque' },
  { value: 'virement_attente', label: 'Virement en attente', short: 'En attente' },
  { value: 'virement_recu', label: 'Virement reçu', short: 'Virement' },
]

/** Default list of the mock-up; configurable in Paramètres > Cabinet & factures (lot 3). */
export const DEFAULT_TARIFS_CENTS = [0, 5000, 5500, 6000, 6500] as const
export const DEFAULT_TARIF_CENTS = 6000

export function tarifLabel(cents: number): string {
  return cents === 0
    ? 'Gratuit'
    : `${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2).replace('.', ',')} €`
}

export const paiementLabel = (p: Paiement) => PAIEMENT_OPTIONS.find((o) => o.value === p)!.label

export interface SeanceState {
  date: string
  status: SeanceStatus
  paiement: Paiement | null
}

/** Status shown to the user (R-01), computed from the stored status and the date (Europe/Paris). */
export type DisplayStatus = 'upcoming' | 'today' | 'to_complete' | 'paid' | 'waiting' | 'cancelled'

export function displayStatus(s: SeanceState, today: string): DisplayStatus {
  if (s.status === 'cancelled') return 'cancelled'
  if (s.status === 'done') return s.paiement === 'virement_attente' ? 'waiting' : 'paid'
  if (s.date > today) return 'upcoming'
  if (s.date === today) return 'today'
  return 'to_complete'
}

export const DISPLAY_STATUS_LABELS: Record<DisplayStatus, string> = {
  upcoming: 'À venir',
  today: 'Aujourd’hui',
  to_complete: 'À compléter',
  paid: 'Réglée',
  waiting: 'Paiement en attente',
  cancelled: 'Annulée',
}

/** Badge of the session header: « Réglée · chèque », « Paiement en attente », « À venir »… */
export function statusLabel(s: SeanceState, today: string): string {
  const status = displayStatus(s, today)
  if (status === 'paid' && s.paiement) return `Réglée · ${paiementLabel(s.paiement).toLowerCase()}`
  return DISPLAY_STATUS_LABELS[status]
}

/** Short badge of the session list: the payment for a done session, the status otherwise. */
export function shortStatusLabel(s: SeanceState, today: string): string {
  if (s.status === 'done') {
    return s.paiement ? PAIEMENT_OPTIONS.find((o) => o.value === s.paiement)!.short : 'Réalisée'
  }
  return DISPLAY_STATUS_LABELS[displayStatus(s, today)]
}

/** A session not done yet (« à venir », « aujourd’hui » or « à compléter »). */
export const isOpen = (s: { status: SeanceStatus }) => s.status === 'planned'

export interface ListTagInput {
  status: SeanceStatus
  source: SeanceSource
  heure: string | null
  invoiced: boolean
}

/** Tag of a list item: « RDV · 11:30 », « Planifiée » or « Facturée ». */
export function listTag(s: ListTagInput): string | null {
  if (s.status === 'planned') return s.heure ? `RDV · ${s.heure}` : 'Planifiée'
  return s.invoiced ? 'Facturée' : null
}

/** R-02 · « ✓ Séance réalisée »: date ≤ today, motif filled in, payment chosen. */
export type MarkDoneError = 'future' | 'motif_missing' | 'payment_missing'

export const MARK_DONE_MESSAGES: Record<MarkDoneError, string> = {
  future: 'La séance n’a pas encore eu lieu',
  motif_missing: 'Saisissez le motif avant de valider',
  payment_missing: 'Choisissez le mode de paiement avant de valider',
}

export function markDoneErrors(
  s: { date: string; motif: string | null; paiement: Paiement | null },
  today: string,
): MarkDoneError[] {
  const errors: MarkDoneError[] = []
  if (s.date > today) errors.push('future')
  if (!s.motif?.trim()) errors.push('motif_missing')
  if (!s.paiement) errors.push('payment_missing')
  return errors
}

/**
 * R-03 / R-04 · What can be edited. A planned session is editable; a done one only in « Modifier »
 * mode, and then its date and tarif stay locked while an invoice is attached (unless unlocked).
 */
export function editability(
  s: { status: SeanceStatus },
  opts: { editing: boolean; invoiced: boolean; unlocked?: boolean },
): { fields: boolean; dateAndTarif: boolean } {
  const fields = s.status === 'planned' || (s.status === 'done' && opts.editing)
  const dateAndTarif = fields && (!opts.invoiced || Boolean(opts.unlocked))
  return { fields, dateAndTarif }
}

/** R-06 · Reasons offered when cancelling a session. */
export const CANCEL_REASONS = [
  'Annulée par le patient',
  'Patient absent',
  'Reportée',
  'Erreur de saisie',
] as const

/**
 * R-06 / R-07 · The bin icon: a planned session can be cancelled, a done one deleted, but never
 * an invoiced session (the invoice must be deleted first, R-13) nor a cancelled one.
 */
export function binAction(s: {
  status: SeanceStatus
  invoiced: boolean
}): 'cancel' | 'delete' | null {
  if (s.invoiced || s.status === 'cancelled') return null
  return s.status === 'done' ? 'delete' : 'cancel'
}

/** R-08 · At most one non-cancelled session per patient and per day. */
export function sameDaySeance<T extends { id: string; date: string; status: SeanceStatus }>(
  seances: T[],
  date: string,
  exceptId?: string,
): T | undefined {
  return seances.find((s) => s.date === date && s.status !== 'cancelled' && s.id !== exceptId)
}

/** Toast of « Nouvelle » when a session already exists that day (R-08). */
export function existingSessionMessage(s: {
  date: string
  source: SeanceSource
  heure: string | null
}): string {
  const rdv = s.heure ? ` (RDV ${s.heure})` : ''
  return `Une séance existe déjà le ${formatIsoDateFr(s.date)}${rdv} : ouverte au lieu d’en créer une seconde`
}

/** Most recent first; for the same day, the latest hour first. */
export function compareSeancesDesc(
  a: { date: string; heure: string | null },
  b: { date: string; heure: string | null },
): number {
  return b.date.localeCompare(a.date) || (b.heure ?? '').localeCompare(a.heure ?? '')
}
