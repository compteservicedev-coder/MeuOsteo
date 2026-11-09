import type {
  BilanLine,
  BudgetResult,
  BudgetSettings,
  ExceptionalExpense,
  ModeRecap,
  RealisedBridge,
} from '../domain/bilan'

/** R-27 · Bilan mensuel. Amounts in cents. */
export interface BilanLineView extends BilanLine {
  patientId: string
  patientNom: string
  /** Active invoice of the session, if any. */
  numero: string | null
}

export interface BilanView {
  month: string
  lines: BilanLineView[]
  recap: ModeRecap[]
  includedCount: number
  revenueCents: number
  /** From the dashboard figure (achieved) to this statement (cashed). */
  realised: RealisedBridge
  budget: BudgetSettings
  exceptional: ExceptionalExpense[]
  result: BudgetResult
}
