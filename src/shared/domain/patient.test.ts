import { describe, expect, it } from 'vitest'
import { suggestCommune, communeAfterCpChange } from './communes'
import { findDuplicates } from './creationDuplicates'
import { ageLabel, bannerSubtitle, formatPhone, situationLabel } from './patient'
import {
  changedFieldNames,
  normalizePatient,
  validatePatient,
  EMPTY_PATIENT_DRAFT,
} from './patientValidation'
import { isPurgeDue, daysBeforePurge } from './patientDeletion'

const TODAY = '2026-10-24'
const valid = { ...EMPTY_PATIENT_DRAFT, nom: 'Roux', prenom: 'Camille', ddn: '1992-03-12' }

describe('patients (R-14 à R-17)', () => {
  it('R-15 nom, prénom et date de naissance obligatoires', () => {
    expect(validatePatient(EMPTY_PATIENT_DRAFT, TODAY)).toEqual({
      nom: 'Le nom est obligatoire',
      prenom: 'Le prénom est obligatoire',
      ddn: 'La date de naissance est obligatoire',
    })
    expect(validatePatient(valid, TODAY)).toEqual({})
  })

  it('R-15 date de naissance ni dans le futur ni avant 1900', () => {
    expect(validatePatient({ ...valid, ddn: '2026-10-25' }, TODAY).ddn).toBe(
      'La date ne peut pas être dans le futur',
    )
    expect(validatePatient({ ...valid, ddn: '1899-12-31' }, TODAY).ddn).toBe(
      'Date de naissance improbable',
    )
    expect(validatePatient({ ...valid, ddn: '2026-02-30' }, TODAY).ddn).toBe(
      'Date de naissance invalide',
    )
    expect(validatePatient({ ...valid, ddn: TODAY }, TODAY)).toEqual({})
  })

  it('R-15 portable 06/07, fixe 01-05/09, e-mail et code postal vérifiés s’ils sont renseignés', () => {
    expect(
      validatePatient({ ...valid, portable: '06 12 34 56 78', fixe: '01 43 28 11 00' }, TODAY),
    ).toEqual({})
    expect(validatePatient({ ...valid, portable: '05 12 34 56 78' }, TODAY).portable).toBeDefined()
    expect(validatePatient({ ...valid, portable: '06 12 34' }, TODAY).portable).toBeDefined()
    expect(validatePatient({ ...valid, fixe: '06 12 34 56 78' }, TODAY).fixe).toBeDefined()
    expect(validatePatient({ ...valid, fixe: '08 12 34 56 78' }, TODAY).fixe).toBeDefined()
    expect(validatePatient({ ...valid, email: 'camille@' }, TODAY).email).toBe(
      'Adresse e-mail invalide',
    )
    expect(validatePatient({ ...valid, cp: '9430' }, TODAY).cp).toBe('5 chiffres attendus')
  })

  it('R-15 téléphones stockés en chiffres seuls et affichés par paires', () => {
    const stored = normalizePatient({
      ...valid,
      portable: '06.12.34.56.78',
      email: ' Camille.Roux@Exemple.FR ',
    })
    expect(stored.portable).toBe('0612345678')
    expect(stored.email).toBe('camille.roux@exemple.fr')
    expect(stored.profession).toBeNull()
    expect(formatPhone('0612345678')).toBe('06 12 34 56 78')
    expect(formatPhone('061')).toBe('06 1')
  })

  it('R-16 une commune : remplie ; plusieurs : liste ; aucune : saisie libre', () => {
    expect(suggestCommune('9430', [])).toEqual({ mode: 'waiting' })
    expect(suggestCommune('94300', ['VINCENNES'])).toEqual({ mode: 'single', commune: 'VINCENNES' })
    expect(suggestCommune('77000', ['VAUX LE PENIL', 'MELUN', 'LA ROCHETTE'])).toEqual({
      mode: 'choice',
      communes: ['LA ROCHETTE', 'MELUN', 'VAUX LE PENIL'],
    })
    expect(suggestCommune('99999', [])).toEqual({ mode: 'free' })
    expect(communeAfterCpChange({ mode: 'single', commune: 'VINCENNES' }, '')).toBe('VINCENNES')
    expect(communeAfterCpChange({ mode: 'choice', communes: ['A', 'B'] }, 'C')).toBe('')
  })

  it('R-17 doublon à la création : même nom (accents et casse ignorés), téléphone, e-mail ou date', () => {
    const existing = [
      {
        id: '1',
        nom: 'Lambert',
        prenom: 'Sophie',
        ddn: '1997-03-30',
        portable: '0712345678',
        fixe: null,
        email: 's.lambert@exemple.fr',
      },
      {
        id: '2',
        nom: 'Morel',
        prenom: 'Julien',
        ddn: '1985-07-08',
        portable: '0621436587',
        fixe: null,
        email: null,
      },
      {
        id: '3',
        nom: 'Roux',
        prenom: 'Lucas',
        ddn: '1990-05-02',
        portable: null,
        fixe: null,
        email: null,
      },
    ]
    const probe = {
      nom: 'LAMBERT',
      prenom: 'sophie',
      ddn: '1997-03-30',
      portable: null,
      fixe: null,
      email: null,
    }
    expect(findDuplicates(probe, existing)).toEqual([
      { patient: existing[0], criteria: ['nom', 'ddn'] },
    ])
    const byPhone = {
      nom: 'Morelle',
      prenom: 'J.',
      ddn: '',
      portable: '0621436587',
      fixe: null,
      email: null,
    }
    expect(findDuplicates(byPhone, existing).map((m) => m.criteria)).toEqual([['telephone']])
    const byMail = {
      nom: 'X',
      prenom: 'Y',
      ddn: '',
      portable: null,
      fixe: null,
      email: 'S.Lambert@exemple.fr',
    }
    expect(findDuplicates(byMail, existing).map((m) => m.patient.id)).toEqual(['1'])
    // Same family name only (relatives) is not a duplicate.
    const relative = {
      nom: 'Roux',
      prenom: 'Emma',
      ddn: '2020-04-14',
      portable: null,
      fixe: null,
      email: null,
    }
    expect(findDuplicates(relative, existing)).toEqual([])
  })

  it('R-14 la fiche supprimée est purgée au bout de 30 jours', () => {
    const deletedAt = new Date('2026-10-01T10:00:00Z')
    expect(isPurgeDue(deletedAt, new Date('2026-10-30T10:00:00Z'))).toBe(false)
    expect(isPurgeDue(deletedAt, new Date('2026-10-31T10:00:00Z'))).toBe(true)
    expect(daysBeforePurge(deletedAt, new Date('2026-10-24T10:00:00Z'))).toBe(7)
  })

  it('R-20 modification : seuls les noms des champs sont gardés, jamais leurs valeurs', () => {
    const before = normalizePatient(valid)
    const after = normalizePatient({ ...valid, portable: '0601020304', email: 'c@exemple.fr' })
    expect(changedFieldNames(before, after)).toEqual(['portable', 'e-mail'])
  })

  it('âge en mois avant 1 an, accords du bandeau', () => {
    expect(ageLabel('2026-02-10', TODAY)).toBe('8 mois')
    expect(ageLabel('2025-10-24', TODAY)).toBe('1 an')
    expect(ageLabel('1992-03-12', TODAY)).toBe('34 ans')
    expect(situationLabel('marie', 'F')).toBe('Mariée')
    expect(situationLabel('veuf', 'M')).toBe('Veuf')
    expect(situationLabel('pacse', null)).toBe('Pacsé(e)')
    expect(
      bannerSubtitle(
        { ddn: '1992-03-12', sexe: 'F', situation: 'marie', enfants: 2, profession: 'Graphiste' },
        TODAY,
      ),
    ).toBe('34 ans · Femme · Mariée · 2 enfants · Graphiste')
    expect(
      bannerSubtitle(
        { ddn: '2020-04-14', sexe: null, situation: null, enfants: 0, profession: null },
        TODAY,
      ),
    ).toBe('6 ans · Sans enfant')
  })
})
