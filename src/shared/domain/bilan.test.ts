import { describe, expect, it } from 'vitest'
import {
  bilanLines,
  computeBudget,
  encaissementDate,
  monthLabelFr,
  monthlyCents,
  parseAmountCents,
  parsePercentBp,
  recapByMode,
  shiftMonth,
  type BilanSource,
  type BudgetSettings,
} from './bilan'

const src = (o: Partial<BilanSource> & Pick<BilanSource, 'seanceId'>): BilanSource => ({
  date: '2026-10-10',
  montantCents: 6000,
  paiement: 'cheque',
  recuLe: null,
  ...o,
})

describe('R-27 · bilan mensuel', () => {
  it('R-27 date d’encaissement : jour de séance, jour du virement reçu, rien si en attente', () => {
    expect(encaissementDate({ date: '2026-10-10', paiement: 'especes', recuLe: null })).toBe(
      '2026-10-10',
    )
    expect(
      encaissementDate({ date: '2026-09-28', paiement: 'virement_recu', recuLe: '2026-10-02' }),
    ).toBe('2026-10-02')
    expect(encaissementDate({ date: '2026-09-28', paiement: 'virement_recu', recuLe: null })).toBe(
      '2026-09-28',
    )
    expect(
      encaissementDate({ date: '2026-10-10', paiement: 'virement_attente', recuLe: null }),
    ).toBeNull()
    expect(encaissementDate({ date: '2026-10-10', paiement: null, recuLe: null })).toBe(
      '2026-10-10',
    )
  })

  it('R-27 retient le mois d’encaissement ; les virements attendus du mois sont décochés', () => {
    const lines = bilanLines(
      '2026-10',
      [
        src({ seanceId: 'a' }),
        src({ seanceId: 'b', date: '2026-09-28', paiement: 'virement_recu', recuLe: '2026-10-02' }),
        src({ seanceId: 'c', date: '2026-10-30', paiement: 'virement_recu', recuLe: '2026-11-03' }),
        src({ seanceId: 'd', date: '2026-10-20', paiement: 'virement_attente' }),
        src({ seanceId: 'e', date: '2026-09-15', paiement: 'virement_attente' }),
      ],
      {},
    )
    expect(lines.map((l) => [l.seanceId, l.included, l.pending])).toEqual([
      ['b', true, false],
      ['a', true, false],
      ['d', false, true],
    ])
  })

  it('R-27 les choix du bilan (cocher, moyen de paiement) priment, sans toucher la séance', () => {
    const lines = bilanLines(
      '2026-10',
      [src({ seanceId: 'a' }), src({ seanceId: 'd', paiement: 'virement_attente' })],
      { a: { included: false }, d: { included: true, mode: 'especes' } },
    )
    expect(lines.map((l) => [l.seanceId, l.included, l.mode, l.modeChanged, l.paiement])).toEqual([
      ['a', false, 'cheque', false, 'cheque'],
      ['d', true, 'especes', true, 'virement_attente'],
    ])
    expect(recapByMode(lines)).toEqual([
      { mode: 'especes', count: 1, cents: 6000 },
      { mode: 'cheque', count: 0, cents: 0 },
      { mode: 'virement', count: 0, cents: 0 },
      { mode: 'autre', count: 0, cents: 0 },
    ])
  })

  it('R-27 épargne et salaire : cotisations, réserve, frais, provisions et dépenses', () => {
    const settings: BudgetSettings = {
      cotisationsBp: 2500,
      reserveBp: 500,
      fixedCosts: [
        { id: '1', label: 'Loyer', cents: 50_000, period: 'mensuel' },
        { id: '2', label: 'Assurance RCP', cents: 24_000, period: 'annuel' },
      ],
      provisions: [{ id: '3', label: 'CFE', cents: 60_000, period: 'annuel' }],
    }
    const r = computeBudget(400_000, settings, [{ id: 'x', label: 'Table', cents: 30_000 }])
    expect(r).toEqual({
      revenueCents: 400_000,
      cotisationsCents: 100_000,
      reserveCents: 20_000,
      fixedMonthlyCents: 50_000,
      fixedAnnualShareCents: 2_000,
      provisionsCents: 5_000,
      exceptionalCents: 30_000,
      toSaveCents: 127_000,
      spentCents: 80_000,
      salaryCents: 193_000,
      deficitCents: 0,
    })
  })

  it('R-27 un mois insuffisant donne un salaire nul et le montant manquant', () => {
    const r = computeBudget(
      10_000,
      {
        cotisationsBp: 2000,
        reserveBp: 0,
        fixedCosts: [{ id: '1', label: 'Loyer', cents: 50_000, period: 'mensuel' }],
        provisions: [],
      },
      [],
    )
    expect(r.salaryCents).toBe(0)
    expect(r.deficitCents).toBe(42_000)
  })

  it('ramène les montants annuels au mois et lit les saisies françaises', () => {
    expect(monthlyCents({ cents: 100_000, period: 'annuel' })).toBe(8333)
    expect(monthlyCents({ cents: 100_000, period: 'mensuel' })).toBe(100_000)
    expect(parsePercentBp('24,6')).toBe(2460)
    expect(parsePercentBp('24.55 %')).toBe(2455)
    expect(parsePercentBp('120')).toBeNull()
    expect(parsePercentBp('abc')).toBeNull()
    expect(parseAmountCents('1 250,5 €')).toBe(125_050)
    expect(parseAmountCents('60')).toBe(6000)
    expect(parseAmountCents('-3')).toBeNull()
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(monthLabelFr('2026-08')).toBe('août 2026')
  })
})
