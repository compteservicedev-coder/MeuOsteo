import { describe, expect, it } from 'vitest'
import { inverseRelation, orderLink } from './relatives'

describe('R-25 · proches (stockage)', () => {
  it('R-25 relation inverse : enfant ↔ parent, grand-parent ↔ petit-enfant, les autres symétriques', () => {
    expect(inverseRelation('enfant')).toBe('parent')
    expect(inverseRelation('parent')).toBe('enfant')
    expect(inverseRelation('grand_parent')).toBe('petit_enfant')
    expect(inverseRelation('petit_enfant')).toBe('grand_parent')
    for (const r of ['conjoint', 'fratrie', 'autre'] as const) expect(inverseRelation(r)).toBe(r)
  })

  it('R-25 si l’ordre des ids inverse la saisie, on stocke l’inverse', () => {
    expect(orderLink('A', 'B', 'enfant')).toEqual({
      patientA: 'A',
      patientB: 'B',
      relAToB: 'enfant',
    })
    expect(orderLink('B', 'A', 'enfant')).toEqual({
      patientA: 'A',
      patientB: 'B',
      relAToB: 'parent',
    })
    expect(() => orderLink('A', 'A', 'autre')).toThrow()
  })
})
