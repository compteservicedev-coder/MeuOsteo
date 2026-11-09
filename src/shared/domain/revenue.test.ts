import { describe, expect, it } from 'vitest'
import { compareYears, evolutionLabel } from './revenue'

describe('Tableau de bord · année comparée à la précédente', () => {
  const monthly = [
    { month: '2025-01', cents: 100_00 },
    { month: '2025-10', cents: 300_00 },
    { month: '2025-12', cents: 50_00 },
    { month: '2026-01', cents: 150_00 },
    { month: '2026-10', cents: 200_00 },
  ]

  it('douze mois, janvier d’abord, avec l’année précédente en regard', () => {
    const c = compareYears(2026, monthly, '2026-10-24', 320_00)
    expect(c.months).toHaveLength(12)
    expect(c.months[0]).toEqual({ month: 1, cents: 150_00, previousCents: 100_00 })
    expect(c.months[9]).toEqual({ month: 10, cents: 200_00, previousCents: 300_00 })
    expect(c.totalCents).toBe(350_00)
    expect(c.previousTotalCents).toBe(450_00)
    expect(c.toDate).toEqual({ cents: 350_00, previousCents: 320_00, until: '10-24' })
  })

  it('une année passée se compare sur l’année entière', () => {
    expect(compareYears(2025, monthly, '2026-10-24', 0).toDate).toBeNull()
  })

  it('évolution en pourcentage, sans comparaison possible avec zéro', () => {
    expect(evolutionLabel(113_00, 100_00)).toBe('+13 %')
    expect(evolutionLabel(96_00, 100_00)).toBe('−4 %')
    expect(evolutionLabel(10_00, 0)).toBeNull()
  })
})
