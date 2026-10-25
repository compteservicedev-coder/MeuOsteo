import { describe, expect, it } from 'vitest'
import {
  childAlert,
  contactKey,
  decideMatch,
  normalizePhone,
  prefillFromDisplayName,
  rdvKey,
  splitDisplayName,
  type MatchablePatient,
  type ParsedRdv,
} from './matching'

const julie: MatchablePatient = {
  id: 'julie',
  nom: 'Moreau',
  prenom: 'Julie',
  ddn: '1988-05-12',
  portable: '0622334455',
  fixe: null,
  email: 'julie.moreau@exemple.fr',
}
const jules: MatchablePatient = {
  id: 'jules',
  nom: 'Moreau',
  prenom: 'Jules',
  ddn: '2015-02-03',
  portable: '0622334455',
  fixe: null,
  email: null,
}
const camille: MatchablePatient = {
  id: 'camille',
  nom: 'Roux',
  prenom: 'Camille',
  ddn: '1992-03-12',
  portable: '0601020304',
  fixe: null,
  email: 'camille.roux@exemple.fr',
}

const rdv = (over: Partial<ParsedRdv>): ParsedRdv => ({
  type: 'new',
  date: '2026-10-24',
  heure: '09:00',
  nom: 'Camille Roux',
  telephone: '06 01 02 03 04',
  ...over,
})

describe('R-09 · clé stable du RDV', () => {
  it('R-09 même RDV → même clé, quel que soit le format du téléphone ou des accents', () => {
    const a = rdvKey({
      date: '2026-10-24',
      heure: '09:00',
      nom: 'Élise Martin',
      telephone: '+33 6 01 02 03 04',
    })
    const b = rdvKey({
      date: '2026-10-24',
      heure: '09:00',
      nom: 'elise  martin',
      telephone: '0601020304',
    })
    expect(a).toBe(b)
    expect(a).toMatch(/^rdv_[0-9a-f]{16}$/)
    expect(rdvKey({ date: '2026-10-24', heure: '09:30', nom: 'Élise Martin' })).not.toBe(a)
  })

  it('R-09 normalise téléphone et e-mail pour la mémoire de contact', () => {
    expect(normalizePhone('+33 6 22 33 44 55')).toBe('0622334455')
    expect(normalizePhone('0033622334455')).toBe('0622334455')
    expect(normalizePhone('')).toBeNull()
    expect(contactKey('06 22 33 44 55', ' Julie.Moreau@Exemple.fr ')).toBe(
      '0622334455|julie.moreau@exemple.fr',
    )
    expect(contactKey(null, null)).toBeNull()
  })
})

describe('R-18 · rattachement', () => {
  it('R-18 lit les noms affichés par Doctolib', () => {
    expect(splitDisplayName('Julie Moreau')).toEqual({
      nom: 'moreau',
      prenom: 'julie',
      initiale: 'j',
    })
    expect(splitDisplayName('J. Moreau')).toEqual({ nom: 'moreau', prenom: null, initiale: 'j' })
    expect(splitDisplayName('LE GALL Carine')).toEqual({
      nom: 'le gall',
      prenom: 'carine',
      initiale: 'c',
    })
    expect(prefillFromDisplayName('Inès Garnier')).toEqual({ prenom: 'Inès', nom: 'Garnier' })
    expect(prefillFromDisplayName('J. Moreau')).toEqual({ prenom: '', nom: 'Moreau' })
    expect(prefillFromDisplayName('LE GALL Carine')).toEqual({ prenom: 'Carine', nom: 'Le Gall' })
  })

  it('R-18 automatique : une seule fiche avec le même nom ET le même téléphone ou e-mail', () => {
    expect(
      decideMatch(rdv({}), [julie, jules, camille], { remembered: null, autoAttach: true }),
    ).toEqual({
      kind: 'auto',
      patientId: 'camille',
      via: 'unique',
    })
  })

  it('R-18 l’option désactivée laisse le choix à la praticienne', () => {
    expect(decideMatch(rdv({}), [camille], { remembered: null, autoAttach: false })).toMatchObject({
      kind: 'multi',
      candidates: [{ patientId: 'camille', score: 3 }],
    })
  })

  it('R-18 plusieurs candidats : score sur 4 (nom, initiale, téléphone, e-mail)', () => {
    const decision = decideMatch(
      rdv({
        nom: 'J. Moreau',
        telephone: '06 22 33 44 55',
        email: 'julie.moreau@exemple.fr',
        motif: 'Bilan enfant',
      }),
      [julie, jules, camille],
      { remembered: null, autoAttach: true },
    )
    expect(decision).toMatchObject({
      kind: 'multi',
      candidates: [
        { patientId: 'julie', score: 4 },
        { patientId: 'jules', score: 3, checks: { email: false } },
      ],
    })
  })

  it('R-18 un prénom complet qui ne correspond pas n’est pas rattaché automatiquement', () => {
    const decision = decideMatch(rdv({ nom: 'Jules Moreau', telephone: '0622334455' }), [julie], {
      remembered: null,
      autoAttach: true,
    })
    expect(decision.kind).toBe('multi')
  })

  it('R-18 association mémorisée : rattachée sans question', () => {
    expect(
      decideMatch(rdv({ nom: 'J. Moreau' }), [julie, jules], {
        remembered: 'jules',
        autoAttach: true,
      }),
    ).toEqual({ kind: 'auto', patientId: 'jules', via: 'memory' })
  })

  it('R-18 aucun candidat → « Nouveau patient »', () => {
    expect(
      decideMatch(rdv({ nom: 'Inès Garnier', telephone: '0648127730' }), [julie, camille], {
        remembered: null,
        autoAttach: true,
      }),
    ).toEqual({ kind: 'new' })
  })

  it('R-18 indice d’âge : motif « enfant » sur un candidat adulte', () => {
    expect(childAlert(rdv({ motif: 'Bilan enfant' }), julie)).toContain('enfant')
    expect(childAlert(rdv({ motif: 'Bilan enfant' }), jules)).toBeNull()
    expect(childAlert(rdv({ motif: 'Lombalgie' }), julie)).toBeNull()
  })
})
