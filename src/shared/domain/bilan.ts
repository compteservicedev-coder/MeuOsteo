/**
 * R-27 · Bilan mensuel: the sessions cashed in a month (by payment date), chosen one by one, a
 * recap by means of payment (correctable in the statement only), then what to keep on the
 * business account and the salary that can be taken out.
 */
import type { Paiement } from './seance'

export const BILAN_MODES = ['especes', 'cheque', 'virement', 'autre'] as const
export type BilanMode = (typeof BILAN_MODES)[number]

export const BILAN_MODE_LABELS: Record<BilanMode, string> = {
  especes: 'Espèces',
  cheque: 'Chèque',
  virement: 'Virement',
  autre: 'Autre / non renseigné',
}

export const BUDGET_PERIODS = ['mensuel', 'annuel'] as const
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number]

export interface BudgetItem {
  id: string
  label: string
  cents: number
  period: BudgetPeriod
}

/** Rates in basis points of a percent: 2450 = 24,50 %. */
export interface BudgetSettings {
  cotisationsBp: number
  reserveBp: number
  fixedCosts: BudgetItem[]
  provisions: BudgetItem[]
}

export const DEFAULT_BUDGET: BudgetSettings = {
  cotisationsBp: 0,
  reserveBp: 0,
  fixedCosts: [],
  provisions: [],
}

export interface ExceptionalExpense {
  id: string
  label: string
  cents: number
}

export interface LineOverride {
  included?: boolean
  mode?: BilanMode
}

/** A done session as read from the database, before the choices of the statement. */
export interface BilanSource {
  seanceId: string
  date: string
  montantCents: number
  paiement: Paiement | null
  /** Day a transfer was marked received (session or invoice), if known. */
  recuLe: string | null
}

export function modeOfPaiement(p: Paiement | null): BilanMode {
  if (p === 'especes' || p === 'cheque') return p
  if (p === 'virement_attente' || p === 'virement_recu') return 'virement'
  return 'autre'
}

/**
 * R-27 day the money came in: the session day for cash, cheque or unknown; the day a transfer
 * was received (the session day when it was not recorded); null while a transfer is awaited.
 */
export function encaissementDate(s: Pick<BilanSource, 'date' | 'paiement' | 'recuLe'>) {
  if (s.paiement === 'virement_attente') return null
  if (s.paiement === 'virement_recu') return s.recuLe ?? s.date
  return s.date
}

export interface BilanLine extends BilanSource {
  encaisseLe: string | null
  pending: boolean
  included: boolean
  mode: BilanMode
  /** The mode was changed in this statement (the session itself is not). */
  modeChanged: boolean
}

/**
 * R-27 lines of a month: cashed in the month (ticked by default), and transfers still awaited for
 * sessions of the month (unticked by default). The practitioner's choices then apply.
 */
export function bilanLines(
  month: string,
  sources: BilanSource[],
  overrides: Record<string, LineOverride>,
): BilanLine[] {
  const lines: BilanLine[] = []
  for (const s of sources) {
    const encaisseLe = encaissementDate(s)
    const pending = encaisseLe === null
    const inMonth = pending ? s.date.startsWith(month) : encaisseLe.startsWith(month)
    if (!inMonth) continue
    const o = overrides[s.seanceId] ?? {}
    const base = modeOfPaiement(s.paiement)
    const mode = o.mode ?? base
    lines.push({
      ...s,
      encaisseLe,
      pending,
      included: o.included ?? !pending,
      mode,
      modeChanged: mode !== base,
    })
  }
  return lines.sort((a, b) => (a.encaisseLe ?? a.date).localeCompare(b.encaisseLe ?? b.date))
}

export interface ModeRecap {
  mode: BilanMode
  count: number
  cents: number
}

/** R-27 recap of the ticked lines by means of payment (every mode, even at zero). */
export function recapByMode(lines: BilanLine[]): ModeRecap[] {
  return BILAN_MODES.map((mode) => {
    const of = lines.filter((l) => l.included && l.mode === mode)
    return { mode, count: of.length, cents: of.reduce((n, l) => n + l.montantCents, 0) }
  })
}

export const monthlyCents = (item: Pick<BudgetItem, 'cents' | 'period'>) =>
  item.period === 'annuel' ? Math.round(item.cents / 12) : item.cents

const sum = (items: BudgetItem[], period?: BudgetPeriod) =>
  items.filter((i) => !period || i.period === period).reduce((n, i) => n + monthlyCents(i), 0)

export const percentOf = (cents: number, bp: number) => Math.round((cents * bp) / 10_000)

export interface BudgetResult {
  revenueCents: number
  cotisationsCents: number
  reserveCents: number
  /** Monthly fixed costs: paid from the account during the month. */
  fixedMonthlyCents: number
  /** Twelfth of the annual fixed costs: put aside for the day they are due. */
  fixedAnnualShareCents: number
  provisionsCents: number
  exceptionalCents: number
  /** To leave on the business account this month. */
  toSaveCents: number
  /** Paid out of the account this month. */
  spentCents: number
  /** What can be paid to oneself (never negative). */
  salaryCents: number
  /** Missing amount when the month does not cover everything. */
  deficitCents: number
}

/**
 * R-27 « Épargne & salaire »: salary = revenue − (contributions + reserve + share of the annual
 * costs + provisions) − (monthly costs + exceptional expenses).
 */
export function computeBudget(
  revenueCents: number,
  settings: BudgetSettings,
  exceptional: ExceptionalExpense[],
): BudgetResult {
  const cotisationsCents = percentOf(revenueCents, settings.cotisationsBp)
  const reserveCents = percentOf(revenueCents, settings.reserveBp)
  const fixedMonthlyCents = sum(settings.fixedCosts, 'mensuel')
  const fixedAnnualShareCents = sum(settings.fixedCosts, 'annuel')
  const provisionsCents = sum(settings.provisions)
  const exceptionalCents = exceptional.reduce((n, e) => n + e.cents, 0)
  const toSaveCents = cotisationsCents + reserveCents + fixedAnnualShareCents + provisionsCents
  const spentCents = fixedMonthlyCents + exceptionalCents
  const left = revenueCents - toSaveCents - spentCents
  return {
    revenueCents,
    cotisationsCents,
    reserveCents,
    fixedMonthlyCents,
    fixedAnnualShareCents,
    provisionsCents,
    exceptionalCents,
    toSaveCents,
    spentCents,
    salaryCents: Math.max(0, left),
    deficitCents: Math.max(0, -left),
  }
}

/** `2026-10` → `2026-09`. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const index = y * 12 + (m - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

/** `2026-10` → « octobre 2026 ». */
export function monthLabelFr(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return `${MONTHS_FR[m - 1]} ${y}`
}

/** « 24,5 » → 2450 basis points; null when not a percentage between 0 and 100. */
export function parsePercentBp(value: string): number | null {
  const v = value.trim().replace(',', '.').replace(/\s*%$/, '')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(v)) return null
  const bp = Math.round(Number(v) * 100)
  return bp <= 10_000 ? bp : null
}

export const formatPercentBp = (bp: number) =>
  `${(bp / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`

/** « 1 250,50 € » → 125050; null when not a positive amount below 1 000 000 €. */
export function parseAmountCents(value: string): number | null {
  const v = value.replace(/[\s\u00a0\u202f]/g, '').replace(/€$/, '')
  const m = /^(\d{1,6})(?:[,.](\d{1,2}))?$/.exec(v)
  if (!m) return null
  return Number(m[1]) * 100 + Number((m[2] ?? '0').padEnd(2, '0'))
}
