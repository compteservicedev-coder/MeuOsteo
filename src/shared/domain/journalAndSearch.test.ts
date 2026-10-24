import { describe, expect, it } from 'vitest'
import { deletedPatientSubject, journalCutoff, patientJournal, toJournalLine } from './journal'
import { linkError, reciprocitySentence, relationSeenFrom } from './relatives'
import { parseSearchQuery, professionMatches, pushRecent } from './search'

describe('journal R-20, proches R-25, recherche', () => {
  it('R-20 une ligne courte par action : sujet ≤ 60 et action ≤ 140 caractères', () => {
    const line = toJournalLine({
      type: 'patient',
      subject: 'N'.repeat(80),
      action: 'A'.repeat(200),
    })
    expect(line.subject).toHaveLength(60)
    expect(line.action).toHaveLength(140)
    expect(patientJournal.modified(['portable', 'e-mail'])).toBe(
      'Fiche modifiée : portable, e-mail',
    )
    expect(patientJournal.deleted(2)).toBe('Patient supprimé (2 séances) · factures conservées')
    expect(deletedPatientSubject(148)).toBe('Patient n° 148')
  })

  it('R-20 conservation de 24 mois par défaut', () => {
    expect(journalCutoff(new Date('2026-10-24T10:00:00Z'), 24).toISOString()).toBe(
      '2024-10-24T10:00:00.000Z',
    )
  })

  it('R-25 relation vue depuis chaque fiche, journal « Proche lié »', () => {
    const link = { patientA: 'A', patientB: 'B', relAToB: 'enfant' as const }
    expect(relationSeenFrom('A', link)).toBe('enfant')
    expect(relationSeenFrom('B', link)).toBe('parent')
    expect(patientJournal.relativeLinked('Paul Roux', 'Enfant')).toBe(
      'Proche lié : Paul Roux (enfant)',
    )
    expect(patientJournal.relativeUnlinked('Paul Roux')).toBe('Lien de proche retiré : Paul Roux')
  })

  it('R-25 pas de lien vers soi-même ni deux fois vers le même proche', () => {
    expect(linkError('A', 'A', [])).toBe('self')
    expect(linkError('A', 'B', ['B'])).toBe('already_linked')
    expect(linkError('A', 'C', ['B'])).toBeNull()
    expect(reciprocitySentence('Camille Roux', 'Paul Roux', 'enfant')).toBe(
      'Paul Roux apparaîtra ici comme « enfant », et Camille Roux apparaîtra sur la fiche de Paul Roux comme « parent ».',
    )
  })

  it('recherche : mots sans accents ni casse, ou numéro de téléphone', () => {
    expect(parseSearchQuery('Infirmière  Vincennes')).toEqual({
      words: ['infirmiere', 'vincennes'],
      phone: null,
    })
    expect(parseSearchQuery('06 12 34')).toEqual({ words: [], phone: '061234' })
    expect(parseSearchQuery('+33 6 12 34 56 78')).toEqual({ words: [], phone: '0612345678' })
    expect(professionMatches('Infirmière libérale', parseSearchQuery('infirmiere'))).toBe(true)
    expect(professionMatches('Graphiste', parseSearchQuery('roux'))).toBe(false)
    expect(pushRecent(['a', 'b', 'c'], 'b', 3)).toEqual(['b', 'a', 'c'])
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b'])
  })
})
