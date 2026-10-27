/**
 * R-27 · Bilan mensuel: sessions cashed in a month, the practitioner's choices (stored per month in
 * `monthly_statements`, the sessions themselves never change), the recap by means of payment and
 * the « Épargne & salaire » computation from the `budget` setting. Nothing is logged but counts.
 */
import ExcelJS from 'exceljs'
import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import {
  BILAN_MODE_LABELS,
  DEFAULT_BUDGET,
  bilanLines,
  computeBudget,
  monthLabelFr,
  monthlyCents,
  recapByMode,
  type BudgetSettings,
  type ExceptionalExpense,
  type LineOverride,
} from '@shared/domain/bilan'
import { formatIsoDateFr } from '@shared/domain/dates'
import type { Paiement } from '@shared/domain/seance'
import type { BilanLineView, BilanView } from '@shared/types/bilan'
import { budgetSettingsSchema } from '@shared/types/schemas'
import type { AppDatabase } from '../db/client'
import { getSetting, setSetting } from '../db/repositories/settingsRepository'
import { monthlyStatements } from '../db/schema'

interface SourceRow {
  seanceId: string
  patientId: string
  patientNom: string
  date: string
  montantCents: number
  paiement: Paiement | null
  recuLe: string | null
  numero: string | null
}

const eur = (cents: number) => cents / 100

export class BilanService {
  constructor(private readonly db: AppDatabase) {}

  budget(): BudgetSettings {
    return getSetting(
      this.db,
      'budget',
      budgetSettingsSchema as z.ZodType<BudgetSettings>,
      DEFAULT_BUDGET,
    )
  }

  saveBudget(settings: BudgetSettings): BudgetSettings {
    setSetting(this.db, 'budget', settings)
    return this.budget()
  }

  private state(month: string) {
    const row = this.db
      .select()
      .from(monthlyStatements)
      .where(eq(monthlyStatements.month, month))
      .get()
    return { overrides: row?.overrides ?? {}, exceptional: row?.exceptional ?? [] }
  }

  private saveState(
    month: string,
    state: { overrides: Record<string, LineOverride>; exceptional: ExceptionalExpense[] },
  ) {
    this.db
      .insert(monthlyStatements)
      .values({ month, ...state })
      .onConflictDoUpdate({
        target: monthlyStatements.month,
        set: { ...state, updatedAt: new Date().toISOString() },
      })
      .run()
  }

  /** Done, paid sessions of the month, plus transfers received in it for older sessions. */
  private sources(month: string): SourceRow[] {
    const start = `${month}-01`
    const end = `${month}-31`
    return this.db.all<SourceRow>(sql`
      SELECT s.id AS seanceId, s.patient_id AS patientId, p.prenom || ' ' || p.nom AS patientNom,
             s.date AS date, s.tarif_cents AS montantCents, s.paiement AS paiement,
             coalesce(s.paiement_recu_le, f.acquittee_le) AS recuLe, f.numero AS numero
      FROM seances s
      JOIN patients p ON p.id = s.patient_id
      LEFT JOIN factures f ON f.seance_id = s.id AND f.statut = 'emise'
      WHERE s.status = 'done' AND s.tarif_cents > 0 AND (
        s.date BETWEEN ${start} AND ${end}
        OR (s.paiement = 'virement_recu'
            AND coalesce(s.paiement_recu_le, f.acquittee_le) BETWEEN ${start} AND ${end}))
    `)
  }

  view(month: string): BilanView {
    const { overrides, exceptional } = this.state(month)
    const rows = this.sources(month)
    const extra = new Map(rows.map((r) => [r.seanceId, r]))
    const lines: BilanLineView[] = bilanLines(month, rows, overrides).map((l) => {
      const r = extra.get(l.seanceId)!
      return { ...l, patientId: r.patientId, patientNom: r.patientNom, numero: r.numero }
    })
    const included = lines.filter((l) => l.included)
    const revenueCents = included.reduce((n, l) => n + l.montantCents, 0)
    const budget = this.budget()
    return {
      month,
      lines,
      recap: recapByMode(lines),
      includedCount: included.length,
      revenueCents,
      budget,
      exceptional,
      result: computeBudget(revenueCents, budget, exceptional),
    }
  }

  setLine(month: string, seanceId: string, change: LineOverride): BilanView {
    const state = this.state(month)
    state.overrides[seanceId] = { ...state.overrides[seanceId], ...change }
    this.saveState(month, state)
    return this.view(month)
  }

  setAll(month: string, included: boolean): BilanView {
    const state = this.state(month)
    for (const l of this.view(month).lines) {
      state.overrides[l.seanceId] = { ...state.overrides[l.seanceId], included }
    }
    this.saveState(month, state)
    return this.view(month)
  }

  setExceptional(month: string, exceptional: ExceptionalExpense[]): BilanView {
    this.saveState(month, { ...this.state(month), exceptional })
    return this.view(month)
  }

  /** « Exporter (Excel) »: lines, recap by means of payment and the computation. */
  async exportWorkbook(month: string): Promise<Buffer> {
    const v = this.view(month)
    const wb = new ExcelJS.Workbook()
    wb.creator = 'MeuOsteo'
    const money = '#,##0.00 €'

    const lines = wb.addWorksheet('Encaissements')
    lines.columns = [
      { header: 'Retenue', key: 'included', width: 9 },
      { header: 'Encaissée le', key: 'encaisse', width: 13 },
      { header: 'Séance du', key: 'date', width: 12 },
      { header: 'Patient', key: 'patient', width: 28 },
      { header: 'Moyen de paiement', key: 'mode', width: 22 },
      { header: 'Facture', key: 'numero', width: 12 },
      { header: 'Montant', key: 'montant', width: 12, style: { numFmt: money } },
    ]
    for (const l of v.lines) {
      lines.addRow({
        included: l.included ? 'oui' : 'non',
        encaisse: l.encaisseLe ? formatIsoDateFr(l.encaisseLe) : 'en attente',
        date: formatIsoDateFr(l.date),
        patient: l.patientNom,
        mode: BILAN_MODE_LABELS[l.mode] + (l.modeChanged ? ' (corrigé)' : ''),
        numero: l.numero ?? '',
        montant: eur(l.montantCents),
      })
    }

    const recap = wb.addWorksheet('Récapitulatif')
    recap.columns = [
      { header: 'Moyen de paiement', key: 'mode', width: 24 },
      { header: 'Séances', key: 'count', width: 10 },
      { header: 'Montant', key: 'montant', width: 14, style: { numFmt: money } },
    ]
    for (const r of v.recap) {
      recap.addRow({ mode: BILAN_MODE_LABELS[r.mode], count: r.count, montant: eur(r.cents) })
    }
    recap.addRow({ mode: 'Total retenu', count: v.includedCount, montant: eur(v.revenueCents) })

    const calc = wb.addWorksheet('Épargne et salaire')
    calc.columns = [
      { header: `Bilan de ${monthLabelFr(month)}`, key: 'label', width: 44 },
      { header: 'Montant', key: 'montant', width: 14, style: { numFmt: money } },
    ]
    const r = v.result
    const pct = (bp: number) => `${(bp / 100).toLocaleString('fr-FR')} %`
    const rows: Array<[string, number]> = [
      ['Chiffre d’affaires retenu', r.revenueCents],
      [`Cotisations (${pct(v.budget.cotisationsBp)} du CA)`, -r.cotisationsCents],
      [`Réserve de sécurité (${pct(v.budget.reserveBp)} du CA)`, -r.reserveCents],
      ...v.budget.fixedCosts.map((i): [string, number] => [
        `Frais fixe ${i.period === 'annuel' ? 'annuel (1/12)' : 'mensuel'} : ${i.label}`,
        -monthlyCents(i),
      ]),
      ...v.budget.provisions.map((i): [string, number] => [
        `Provision${i.period === 'annuel' ? ' annuelle (1/12)' : ''} : ${i.label}`,
        -monthlyCents(i),
      ]),
      ...v.exceptional.map((e): [string, number] => [
        `Dépense exceptionnelle : ${e.label}`,
        -e.cents,
      ]),
      ['À garder sur le compte pro', r.toSaveCents],
      ['Salaire possible', r.salaryCents],
    ]
    if (r.deficitCents) rows.push(['Montant manquant', -r.deficitCents])
    for (const [label, cents] of rows) calc.addRow({ label, montant: eur(cents) })
    for (const ws of [lines, recap, calc]) ws.getRow(1).font = { bold: true }
    return Buffer.from(await wb.xlsx.writeBuffer())
  }
}
