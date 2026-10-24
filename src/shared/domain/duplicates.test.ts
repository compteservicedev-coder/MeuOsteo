import { describe, expect, it } from 'vitest'
import {
  compareNames,
  defaultMergePicks,
  describeDuplicateReasons,
  duplicateReasons,
  findDuplicatePairs,
  formatMergeValue,
  levenshtein,
  mergeComments,
  mergePatients,
  pairKey,
  relinkAfterMerge,
  sameMergeField,
  type DuplicateCandidate,
  type MergeablePatient,
} from './duplicates'

const person = (over: Partial<DuplicateCandidate> & { id: string }): DuplicateCandidate => ({
  nom: 'Lambert',
  prenom: 'Sophie',
  ddn: '1997-07-22',
  portable: null,
  fixe: null,
  email: null,
  ...over,
})

describe('R-19 · détection des doublons', () => {
  it('R-19 distance de Levenshtein', () => {
    expect(levenshtein('dupont', 'dupond')).toBe(1)
    expect(levenshtein('martin', 'martine')).toBe(1)
    expect(levenshtein('lambert', 'lambret')).toBe(2)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('roux', 'roux')).toBe(0)
  })

  it('R-19 noms proches : distance ≤ 2 ou nom inclus dans l’autre, sans accents ni casse', () => {
    expect(compareNames('Lefèvre', 'LEFEVRE')).toBe('same')
    expect(compareNames('Dupont', 'Dupond')).toBe('close')
    expect(compareNames('Lambert', 'Lambert-Durand')).toBe('close')
    expect(compareNames('Martin', 'Bernard')).toBeNull()
    // Too short to be « included »: « Le » is not « Lebrun ».
    expect(compareNames('Le', 'Lebrunet')).toBeNull()
    expect(compareNames('', 'Martin')).toBeNull()
  })

  it('R-19 même date de naissance ET (même téléphone OU même e-mail OU noms proches)', () => {
    const a = person({ id: 'A', portable: '0755443322' })
    expect(duplicateReasons(a, person({ id: 'B', nom: 'Girard', portable: '0755443322' }))).toEqual(
      ['portable'],
    )
    expect(duplicateReasons(a, person({ id: 'B', nom: 'Girard', fixe: '07 55 44 33 22' }))).toEqual(
      ['telephone'],
    )
    expect(
      duplicateReasons(
        person({ id: 'A', email: 'Sophie@Exemple.fr' }),
        person({ id: 'B', nom: 'Girard', email: 'sophie@exemple.fr' }),
      ),
    ).toEqual(['email'])
    expect(duplicateReasons(a, person({ id: 'B', nom: 'Lambert-Durand' }))).toEqual(['close_name'])
    expect(
      duplicateReasons(a, person({ id: 'B', nom: 'Lambert-Durand', portable: '0755443322' })),
    ).toEqual(['portable', 'close_name'])
  })

  it('R-19 une date de naissance différente exclut le doublon', () => {
    const a = person({ id: 'A', portable: '0755443322', email: 'x@exemple.fr' })
    const b = person({ id: 'B', ddn: '1997-07-23', portable: '0755443322', email: 'x@exemple.fr' })
    expect(duplicateReasons(a, b)).toEqual([])
  })

  it('R-19 même date de naissance seule : pas un doublon', () => {
    expect(duplicateReasons(person({ id: 'A' }), person({ id: 'B', nom: 'Girard' }))).toEqual([])
  })

  it('R-19 les paires « pas les mêmes personnes » ne sont plus jamais proposées', () => {
    const list = [
      person({ id: 'B', portable: '0611111111' }),
      person({ id: 'A', nom: 'Lambert-Durand' }),
      person({ id: 'C', nom: 'Girard', ddn: '1980-01-01' }),
    ]
    expect(findDuplicatePairs(list)).toEqual([{ a: 'A', b: 'B', reasons: ['close_name'] }])
    expect(findDuplicatePairs(list, new Set([pairKey('B', 'A')]))).toEqual([])
  })

  it('R-19 libellé des points communs', () => {
    expect(describeDuplicateReasons(['portable'])).toBe('Même date de naissance et même portable')
    expect(describeDuplicateReasons(['portable', 'email', 'close_name'])).toBe(
      'Même date de naissance, même portable, même e-mail et noms proches',
    )
  })
})

const record = (over: Partial<MergeablePatient> = {}): MergeablePatient => ({
  nom: 'Lambert',
  prenom: 'Sophie',
  ddn: '1997-07-22',
  sexe: 'F',
  situation: null,
  enfants: null,
  profession: 'Étudiante',
  adresse: '22 av. Gambetta',
  cp: '94160',
  commune: 'Saint-Mandé',
  portable: '0755443322',
  fixe: null,
  email: null,
  commentaire: null,
  antecedentsTags: [],
  ...over,
})

describe('R-19 · fusion de deux fiches', () => {
  it('R-19 la valeur de la fiche conservée est proposée, sauf si elle est vide', () => {
    const a = record()
    const b = record({ nom: 'Lambert-Durand', email: 'sophie.ld@exemple.fr', adresse: null })
    const picks = defaultMergePicks(a, b)
    expect(picks.nom).toBe('a')
    expect(picks.email).toBe('b')
    expect(picks.adresse).toBe('a')
  })

  it('R-19 l’adresse se choisit en bloc (adresse, code postal, commune)', () => {
    const a = record()
    const b = record({ adresse: '5 rue de Picpus', cp: '75012', commune: 'Paris' })
    expect(sameMergeField(a, b, 'adresse')).toBe(false)
    expect(sameMergeField(a, record({ email: null }), 'email')).toBe(true)
    const merged = mergePatients(a, b, { ...defaultMergePicks(a, b), adresse: 'b' }, '2026-10-24')
    expect(merged).toMatchObject({ adresse: '5 rue de Picpus', cp: '75012', commune: 'Paris' })
  })

  it('R-19 les commentaires sont mis bout à bout avec un séparateur daté', () => {
    expect(mergeComments('Course à pied.', 'Migraines.', '2026-10-24')).toBe(
      'Course à pied.\n\n——— Fiche fusionnée le 24/10/2026 ———\nMigraines.',
    )
    expect(mergeComments(null, 'Migraines.', '2026-10-24')).toBe('Migraines.')
    expect(mergeComments('Course à pied.', '  ', '2026-10-24')).toBe('Course à pied.')
    expect(mergeComments(null, null, '2026-10-24')).toBeNull()
  })

  it('R-19 les étiquettes d’antécédents sont réunies sans doublon', () => {
    const merged = mergePatients(
      record({ antecedentsTags: ['Asthme', 'Scoliose'] }),
      record({ antecedentsTags: ['asthme', 'Migraines'] }),
      defaultMergePicks(record(), record()),
      '2026-10-24',
    )
    expect(merged.antecedentsTags).toEqual(['Asthme', 'Scoliose', 'Migraines'])
  })

  it('R-19 R-25 la fusion reporte les proches sur la fiche conservée, sans doublon', () => {
    // K kept, R removed. R is the parent of X (stored R→X: X is « enfant » for R), linked to Y,
    // linked to K itself; K is already linked to Y.
    const links = [
      { patientA: 'K', patientB: 'R', relAToB: 'fratrie' as const },
      { patientA: 'K', patientB: 'Y', relAToB: 'conjoint' as const },
      { patientA: 'R', patientB: 'Y', relAToB: 'conjoint' as const },
      { patientA: 'R', patientB: 'X', relAToB: 'enfant' as const },
    ]
    const { remove, add } = relinkAfterMerge(links, 'K', 'R')
    expect(remove).toHaveLength(3)
    expect(add).toEqual([{ patientA: 'K', patientB: 'X', relAToB: 'enfant' }])
    // Ids in the other order: the inverse relation is stored.
    const swapped = relinkAfterMerge(
      [{ patientA: 'A', patientB: 'R', relAToB: 'parent' }],
      'Z',
      'R',
    )
    // R is « parent » for A, so A is « enfant » for R, hence for Z: stored A→Z as « parent ».
    expect(swapped.add).toEqual([{ patientA: 'A', patientB: 'Z', relAToB: 'parent' }])
  })
})

describe('R-19 · affichage de la comparaison', () => {
  it('R-19 formate chaque champ comme dans la maquette', () => {
    const p = record({ situation: 'marie', enfants: 0 })
    expect(formatMergeValue(p, 'adresse')).toBe('22 av. Gambetta, 94160 Saint-Mandé')
    expect(formatMergeValue(p, 'portable')).toBe('07 55 44 33 22')
    expect(formatMergeValue(p, 'ddn')).toBe('22/07/1997')
    expect(formatMergeValue(p, 'situation')).toBe('Marié(e)')
    expect(formatMergeValue(p, 'enfants')).toBe('0')
    expect(formatMergeValue(p, 'email')).toBe('')
  })
})
