import { describe, expect, it } from 'vitest'
import {
  analyzeLegacyTables,
  cellText,
  finalizeImport,
  normalizeCp,
  normalizeEmail,
  normalizePhone,
  parseFrenchDate,
  parsePaiement,
  parsePrix,
  parseSexe,
  parseSituation,
  readDateCell,
  suggestYearFix,
  seanceDateRange,
  type RawCell,
  type RawTable,
} from './legacyImport'

const TODAY = '2026-10-24'

const PATIENT_HEADERS = [
  'id_patient',
  'nom',
  'prenom',
  'ddn',
  'sexe',
  'situation',
  'enfant',
  'profession',
  'adresse',
  'cdp',
  'commune',
  'portable',
  'fixe',
  'mail',
  'commentaire',
]
const SEANCE_HEADERS = [
  'date',
  'motif',
  'anam',
  'pratique',
  'prix',
  'paiement',
  'praticien',
  'id_patient',
]

const table = (columns: string[], rows: Record<string, RawCell>[], firstLine = 3): RawTable => ({
  columns,
  rows: rows.map((cells, i) => ({ line: firstLine + i, cells })),
})

const patientRow = (
  nom: string,
  prenom: string,
  ddn: string,
  over: Record<string, RawCell> = {},
) => ({
  id_patient: `${nom}${prenom}${ddn}`,
  nom,
  prenom,
  ddn,
  ...over,
})

const seanceRow = (key: string, date: RawCell, over: Record<string, RawCell> = {}) => ({
  date,
  motif: 'Lombalgie',
  anam: 'Notes',
  pratique: 'Techniques',
  prix: 60,
  paiement: 'Chèque',
  praticien: null,
  id_patient: key,
  ...over,
})

describe('Reprise de l’historique · lecture des cellules (MIGRATION.md)', () => {
  it('lit les dates JJ/MM/AAAA de façon stricte', () => {
    expect(parseFrenchDate('22/07/1997')).toBe('1997-07-22')
    expect(parseFrenchDate('2/7/1997')).toBe('1997-07-02')
    expect(parseFrenchDate('31/02/2020')).toBeNull()
    expect(parseFrenchDate('22/07/97')).toBeNull()
    expect(parseFrenchDate('demain')).toBeNull()
    expect(parseFrenchDate('1997-07-22')).toBe('1997-07-22')
  })

  it('accepte aussi une vraie date Excel ou un numéro de série', () => {
    expect(readDateCell(new Date(Date.UTC(2024, 4, 12)))).toEqual({
      kind: 'date',
      iso: '2024-05-12',
      text: '12/05/2024',
    })
    expect(readDateCell(45424)).toMatchObject({ kind: 'date', iso: '2024-05-12' })
    expect(readDateCell(null)).toEqual({ kind: 'empty' })
    expect(readDateCell('  ')).toEqual({ kind: 'empty' })
    expect(readDateCell('12/05/1024')).toMatchObject({ kind: 'date', iso: '1024-05-12' })
    expect(readDateCell('12 mai')).toEqual({ kind: 'invalid', text: '12 mai' })
  })

  it('propose une année corrigée quand elle est manifestement mal tapée', () => {
    const range = seanceDateRange(TODAY)
    expect(range).toEqual({ min: '1990-01-01', max: '2027-10-24' })
    expect(suggestYearFix('1024-05-12', range)).toBe('2024-05-12')
    expect(suggestYearFix('2202-05-12', range)).toBe('2002-05-12')
    expect(suggestYearFix('4444-05-12', range)).toBeNull()
  })

  it('sexe Homme / Femme / vide → M / F / NULL', () => {
    expect(parseSexe('Homme')).toBe('M')
    expect(parseSexe('femme')).toBe('F')
    expect(parseSexe('')).toBeNull()
    expect(parseSexe(null)).toBeNull()
    expect(parseSexe('Autre')).toBeUndefined()
  })

  it('situation : correspondance des libellés, accents compris', () => {
    expect(parseSituation('Célibataire')).toBe('celibataire')
    expect(parseSituation('En couple')).toBe('couple')
    expect(parseSituation('Pacsé(e)')).toBe('pacse')
    expect(parseSituation('Marié(e)')).toBe('marie')
    expect(parseSituation('Mariée')).toBe('marie')
    expect(parseSituation('Divorcé(e)')).toBe('divorce')
    expect(parseSituation('Veuf(ve)')).toBe('veuf')
    expect(parseSituation('Veuve')).toBe('veuf')
    expect(parseSituation(null)).toBeNull()
    expect(parseSituation('Séparé')).toBeUndefined()
  })

  it('paiement : « Attente de Virement » → virement_attente', () => {
    expect(parsePaiement('Espèces')).toBe('especes')
    expect(parsePaiement('Chèque')).toBe('cheque')
    expect(parsePaiement('Attente de Virement')).toBe('virement_attente')
    expect(parsePaiement('Virement reçu')).toBe('virement_recu')
    expect(parsePaiement('')).toBeNull()
    expect(parsePaiement('Carte')).toBeUndefined()
  })

  it('prix en euros → centimes', () => {
    expect(parsePrix(60)).toBe(6000)
    expect(parsePrix(0)).toBe(0)
    expect(parsePrix('55')).toBe(5500)
    expect(parsePrix('62,50 €')).toBe(6250)
    expect(parsePrix('')).toBeNull()
    expect(parsePrix(null)).toBeNull()
    expect(parsePrix('gratuit')).toBeUndefined()
    expect(parsePrix(-5)).toBeUndefined()
  })

  it('téléphones en chiffres seuls, 0 rétabli quand Excel l’a perdu', () => {
    expect(normalizePhone('06 12 34 56 78')).toEqual({ digits: '0612345678', valid: true })
    expect(normalizePhone(612345678)).toEqual({ digits: '0612345678', valid: true })
    expect(normalizePhone('+33 6 12 34 56 78')).toEqual({ digits: '0612345678', valid: true })
    expect(normalizePhone('')).toEqual({ digits: null, valid: true })
    expect(normalizePhone('06 12')).toEqual({ digits: '0612', valid: false })
  })

  it('code postal à 5 chiffres, avec 0 devant si besoin', () => {
    expect(normalizeCp(1000)).toEqual({ cp: '01000', valid: true })
    expect(normalizeCp('75012')).toEqual({ cp: '75012', valid: true })
    expect(normalizeCp(null)).toEqual({ cp: null, valid: true })
    expect(normalizeCp('750')).toEqual({ cp: '750', valid: false })
  })

  it('e-mail en minuscules', () => {
    expect(normalizeEmail(' Sophie.LD@Exemple.FR ')).toEqual({
      email: 'sophie.ld@exemple.fr',
      valid: true,
    })
    expect(normalizeEmail('mailto:a@exemple.fr')).toEqual({ email: 'a@exemple.fr', valid: true })
    expect(normalizeEmail('pas un mail')).toMatchObject({ valid: false })
  })

  it('texte : retours chariot et échappements Excel retirés', () => {
    expect(cellText('  Ligne 1_x000D_\r\nLigne 2  ')).toBe('Ligne 1\nLigne 2')
    expect(cellText(42)).toBe('42')
  })
})

describe('Reprise de l’historique · analyse et rapport (MIGRATION.md)', () => {
  const patients = table(PATIENT_HEADERS, [
    patientRow('D’Almeida', 'Anne-Lise', '03/04/1985', {
      sexe: '',
      situation: 'Pacsé(e)',
      enfant: '2',
      cdp: 1000,
      commune: 'Bourg-en-Bresse',
      portable: 612345678,
      mail: 'Anne.Lise@Exemple.fr',
      commentaire: 'Préfère le matin',
    }),
    patientRow('Martin', 'Paul', '15/09/1979', { sexe: 'Homme', ddn: '' }),
    patientRow('Roux', 'Camille', '01/01/1990', { ddn: '31/02/1990', id_patient: 'RouxCamille' }),
    {},
  ])
  const keys = patients.rows.map((r) => String(r.cells['id_patient'] ?? ''))
  const seances = table(SEANCE_HEADERS, [
    seanceRow(keys[0]!, '12/03/2024'),
    seanceRow(keys[0]!, '12/05/1024', { prix: null }),
    seanceRow(keys[1]!, '', { paiement: 'Attente de Virement' }),
    seanceRow(keys[1]!, '20/06/2024'),
    seanceRow(keys[1]!, '20/06/2024', { prix: '55' }),
    seanceRow('InconnuJean01/01/1950', '01/02/2024'),
    seanceRow(keys[2]!, '4444-01-01'),
  ])

  const result = analyzeLegacyTables({ patients, seances, today: TODAY })
  if (!result.ok) throw new Error('analysis failed')
  const { plan } = result
  const kinds = (kind: string) => plan.anomalies.filter((a) => a.kind === kind)

  it('compte les patients et les séances importables (lignes vides et orphelines exclues)', () => {
    expect(plan.patients).toHaveLength(3)
    expect(plan.seances).toHaveLength(6)
    expect(kinds('seance_orphan')).toEqual([
      { kind: 'seance_orphan', line: 8, who: 'InconnuJean01/01/1950', value: '01/02/2024' },
    ])
  })

  it('transforme chaque champ (nom, sexe vide, situation accentuée, CP à 4 chiffres…)', () => {
    expect(plan.patients[0]).toMatchObject({
      line: 3,
      legacyKey: 'D’AlmeidaAnne-Lise03/04/1985',
      nom: 'D’Almeida',
      prenom: 'Anne-Lise',
      ddn: '1985-04-03',
      sexe: null,
      situation: 'pacse',
      enfants: 2,
      cp: '01000',
      portable: '0612345678',
      email: 'anne.lise@exemple.fr',
      commentaire: 'Préfère le matin',
    })
    expect(plan.seances[0]).toMatchObject({
      patient: 0,
      date: '2024-03-12',
      tarifCents: 6000,
      paiement: 'cheque',
      motif: 'Lombalgie',
      anamnese: 'Notes',
      pratique: 'Techniques',
    })
  })

  it('date de naissance vide : reprise de l’identifiant ; sinon à saisir', () => {
    expect(plan.patients[1]!.ddn).toBe('1979-09-15')
    expect(kinds('patient_ddn_from_key')).toHaveLength(1)
    expect(plan.patients[2]!.ddn).toBeNull()
    expect(kinds('patient_ddn_invalid')).toEqual([
      {
        kind: 'patient_ddn_invalid',
        line: 5,
        who: 'Camille Roux',
        value: '31/02/1990',
        correctionKey: 'ddn:5',
      },
    ])
  })

  it('années invalides et séances sans date : listées, avec une date proposée', () => {
    expect(kinds('seance_date_invalid')).toEqual([
      expect.objectContaining({ line: 4, value: '12/05/1024', suggestion: '2024-05-12' }),
      // No plausible year: the nearest session of the table.
      expect.objectContaining({ line: 9, value: '4444-01-01', suggestion: '2024-06-20' }),
    ])
    expect(kinds('seance_date_missing')).toEqual([
      // Only valid dates are proposed: the previous line (1024) is itself invalid.
      expect.objectContaining({
        line: 5,
        value: '',
        correctionKey: 'date:5',
        suggestion: '2024-03-12',
      }),
    ])
  })

  it('séance sans prix : tarif par défaut avec anomalie', () => {
    expect(kinds('seance_prix_missing')).toEqual([
      { kind: 'seance_prix_missing', line: 4, who: 'Anne-Lise D’Almeida', value: '' },
    ])
    expect(plan.seances[1]!.tarifCents).toBe(6000)
    expect(plan.seances[4]!.tarifCents).toBe(5500)
  })

  it('R-08 import : deux séances le même jour sont conservées et signalées', () => {
    expect(plan.seances.filter((s) => s.date === '2024-06-20')).toHaveLength(2)
    expect(kinds('seance_same_day')).toEqual([
      { kind: 'seance_same_day', line: 7, who: 'Paul Martin', value: '20/06/2024' },
    ])
  })

  it('champ « praticien » vide : ignoré et signalé', () => {
    expect(plan.notes).toEqual(['Champ « praticien » vide partout : ignoré'])
  })

  it('refuse un fichier sans les colonnes indispensables', () => {
    const r = analyzeLegacyTables({
      patients: table(['id_patient', 'nom'], []),
      seances: table(['motif'], []),
      today: TODAY,
    })
    expect(r).toEqual({
      ok: false,
      reason: 'columns_missing',
      missing: ['Tb_patient.prenom', 'Tb_patient.ddn', 'Tb_seance.date', 'Tb_seance.id_patient'],
    })
  })

  it('lit les colonnes par leur nom, quel que soit l’ordre ou la casse', () => {
    const r = analyzeLegacyTables({
      patients: table(
        ['Prénom', 'NOM', 'DDN', 'ID_Patient', 'Divers'],
        [{ Prénom: 'Paul', NOM: 'Martin', DDN: '15/09/1979', ID_Patient: 'k' }],
      ),
      seances: table(['id_patient', 'date'], [{ id_patient: 'k', date: '01/02/2024' }]),
      today: TODAY,
    })
    expect(r.ok && r.plan.patients[0]).toMatchObject({ nom: 'Martin', prenom: 'Paul' })
    expect(r.ok && r.plan.seances).toHaveLength(1)
    expect(r.ok && r.plan.notes).toEqual(['Colonne « Divers » de Tb_patient ignorée'])
  })

  it('R-19 compte les doublons possibles parmi les fiches importées', () => {
    const r = analyzeLegacyTables({
      patients: table(PATIENT_HEADERS, [
        patientRow('Lambert', 'Sophie', '22/07/1997', { portable: '0755443322' }),
        patientRow('Lambert-Durand', 'Sophie', '22/07/1997'),
        patientRow('Girard', 'Alice', '22/07/1997'),
      ]),
      seances: table(SEANCE_HEADERS, []),
      today: TODAY,
    })
    expect(r.ok && r.plan.duplicates).toBe(1)
  })
})

describe('Reprise de l’historique · corrections avant import', () => {
  const r = analyzeLegacyTables({
    patients: table(PATIENT_HEADERS, [
      patientRow('Roux', 'Camille', '', { id_patient: 'RouxCamille' }),
      patientRow('Martin', 'Paul', '15/09/1979'),
    ]),
    seances: table(SEANCE_HEADERS, [
      seanceRow('MartinPaul15/09/1979', '01/02/2024'),
      seanceRow('MartinPaul15/09/1979', '12/05/1024'),
      seanceRow('MartinPaul15/09/1979', ''),
    ]),
    today: TODAY,
  })
  if (!r.ok) throw new Error('analysis failed')

  it('la date de naissance manquante doit être saisie (R-15)', () => {
    expect(finalizeImport(r.plan, {}, TODAY)).toEqual({
      ok: false,
      reason: 'corrections_required',
      keys: ['ddn:3'],
    })
  })

  it('refuse une correction hors période ou sur une ligne sans anomalie', () => {
    expect(
      finalizeImport(r.plan, { 'ddn:3': '2030-01-01', 'date:3': '2024-01-01' }, TODAY),
    ).toEqual({ ok: false, reason: 'invalid_corrections', keys: ['ddn:3', 'date:3'] })
  })

  it('date corrigée ligne par ligne, ou import en « date à corriger » à la date proposée', () => {
    const done = finalizeImport(r.plan, { 'ddn:3': '1988-05-12', 'date:4': '2024-05-13' }, TODAY)
    if (!done.ok) throw new Error('finalize failed')
    expect(done.patients[0]!.ddn).toBe('1988-05-12')
    expect(done.seances.map((s) => [s.date, s.dateToFix])).toEqual([
      ['2024-02-01', null],
      ['2024-05-13', null],
      ['2024-02-01', ''],
    ])
  })
})
