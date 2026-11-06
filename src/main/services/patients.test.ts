import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_PATIENT_DRAFT, type PatientDraft } from '@shared/domain/patientValidation'
import type { AppDatabase } from '../db/client'
import { parseCommunesCsv } from '../db/communes'
import { factures, journal, patientLinks, patients, seances } from '../db/schema'
import { seedDatabase } from '../db/seed'
import { runMaintenance } from '../maintenance'
import { createTestDatabase } from '../test/db'
import { PatientService } from './patients'
import { PlanningService } from './planning'

let db: AppDatabase
let clock: Date
let service: PatientService

const draft = (overrides: Partial<PatientDraft> = {}): PatientDraft => ({
  ...EMPTY_PATIENT_DRAFT,
  nom: 'Roux',
  prenom: 'Camille',
  ddn: '1992-03-12',
  ...overrides,
})

function create(overrides: Partial<PatientDraft> = {}): string {
  const result = service.create(draft(overrides))
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.id
}

function addSeance(patientId: string, date: string, status: 'planned' | 'done' = 'done') {
  db.insert(seances)
    .values({
      patientId,
      date,
      status,
      source: 'manual',
      paiement: status === 'done' ? 'cheque' : null,
    })
    .run()
}

const actions = (patientId?: string) =>
  db
    .select()
    .from(journal)
    .all()
    .filter((l) => !patientId || l.patientId === patientId)
    .map((l) => `${l.subject} · ${l.action}`)

beforeEach(() => {
  db = createTestDatabase()
  clock = new Date('2026-10-24T10:00:00Z')
  service = new PatientService(db, () => clock)
})

describe('fiche patient : création et modification', () => {
  it('R-15 la création refuse une fiche incomplète et normalise les champs', () => {
    expect(service.create({ ...EMPTY_PATIENT_DRAFT, nom: 'Roux' })).toEqual({
      ok: false,
      errors: { prenom: 'Le prénom est obligatoire', ddn: 'La date de naissance est obligatoire' },
    })
    const id = create({ portable: '06 01 02 03 04', email: 'Camille@Exemple.fr', cp: '94300' })
    const record = service.get(id)!.patient
    expect(record).toMatchObject({
      shortNo: 1,
      portable: '0601020304',
      email: 'camille@exemple.fr',
    })
    expect(create({ nom: 'Morel', prenom: 'Julien' })).not.toBe(id)
    expect(service.get(service.search('morel').items[0]!.id)!.patient.shortNo).toBe(2)
  })

  it('R-20 création et modification journalisées avec les noms des champs, jamais les valeurs', () => {
    const id = create()
    const result = service.update(
      id,
      draft({ portable: '06 01 02 03 04', email: 'c.roux@exemple.fr' }),
    )
    expect(result).toEqual({ ok: true, id, changed: ['portable', 'e-mail'] })
    expect(
      service.update(id, draft({ portable: '0601020304', email: 'c.roux@exemple.fr' })),
    ).toMatchObject({
      changed: [],
    })
    const lines = actions(id)
    expect(lines).toEqual([
      'Camille Roux · Patient créé',
      'Camille Roux · Fiche modifiée : portable, e-mail',
    ])
    expect(lines.join(' ')).not.toContain('0601020304')
  })

  it('R-17 doublons possibles à la création, avec leurs points communs', () => {
    const id = create({ portable: '0612345678' })
    create({ nom: 'Roux', prenom: 'Lucas', ddn: '1990-05-02' })
    expect(
      service.duplicates({
        ...draft(),
        nom: 'ROUX',
        prenom: 'camille',
        ddn: '',
        portable: '',
        fixe: '',
        email: '',
      }),
    ).toEqual([expect.objectContaining({ id, criteria: ['nom'] })])
    expect(
      service.duplicates({
        nom: 'Autre',
        prenom: 'X',
        ddn: '1992-03-12',
        portable: '06 12 34 56 78',
        fixe: '',
        email: '',
      })[0],
    ).toMatchObject({ id, criteria: ['telephone', 'ddn'] })
    expect(
      service.duplicates({ ...draft(), portable: '', fixe: '', email: '', excludeId: id }),
    ).toEqual([])
  })
})

describe('écran Patients (SPEC §4)', () => {
  it('recherche dans le nom, le prénom, le téléphone, la commune et le métier, sans accents ni casse', () => {
    const camille = create({
      profession: 'Graphiste',
      commune: 'VINCENNES',
      cp: '94300',
      portable: '0601020304',
    })
    const sophie = create({
      nom: 'Lambert',
      prenom: 'Sophie',
      profession: 'Infirmière',
      commune: 'SAINT MANDE',
    })
    const ids = (q: string) => service.search(q).items.map((p) => p.id)
    expect(ids('infirmiere')).toEqual([sophie])
    expect(ids('ROUX')).toEqual([camille])
    expect(ids('vincennes graph')).toEqual([camille])
    expect(ids('06 01 02')).toEqual([camille])
    expect(ids('saint-mandé')).toEqual([sophie])
    expect(ids('%')).toEqual([])
    expect(ids('   ')).toEqual([])
  })

  it('« Consultés récemment » : dernières fiches ouvertes en premier, sans les fiches supprimées', () => {
    const a = create()
    const b = create({ nom: 'Morel', prenom: 'Julien' })
    service.markOpened(a)
    service.markOpened(b)
    service.markOpened(a)
    expect(service.recent().map((p) => p.id)).toEqual([a, b])
    service.softDelete(b)
    expect(service.recent().map((p) => p.id)).toEqual([a])
  })

  it('panneau « Aujourd’hui » : RDV du jour par heure, nouveaux patients signalés', () => {
    const regular = create()
    const fresh = create({ nom: 'Garnier', prenom: 'Inès' })
    addSeance(regular, '2026-10-09')
    db.insert(seances)
      .values({
        patientId: regular,
        date: '2026-10-24',
        heure: '17:30',
        status: 'planned',
        source: 'doctolib',
      })
      .run()
    db.insert(seances)
      .values({
        patientId: fresh,
        date: '2026-10-24',
        heure: '10:30',
        status: 'planned',
        source: 'doctolib',
      })
      .run()
    expect(service.todayAppointments().map((a) => [a.heure, a.prenom, a.isNew])).toEqual([
      ['10:30', 'Inès', true],
      ['17:30', 'Camille', false],
    ])
  })

  it('SPEC §4 filtrage en moins de 100 ms pour 5 000 patients', () => {
    const communes = parseCommunesCsv(
      readFileSync(resolve(__dirname, '../../../resources/communes.csv'), 'utf8'),
    )
    seedDatabase(db, { patients: 5000, seances: 5000, today: '2026-10-24', communes })
    for (const q of ['infirmiere', 'lam', 'vincennes', '06 1', 'marie paris']) service.search(q)
    for (const q of ['infirmiere', 'lam', 'vincennes', '06 1', 'marie paris', 'e']) {
      const started = performance.now()
      service.search(q)
      expect(performance.now() - started, q).toBeLessThan(100)
    }
    // Generous timeout: inserting the 5 000 fake records is slow on CI runners, not the search.
  }, 30_000)
})

describe('R-14 suppression d’un patient', () => {
  it('R-14 la fiche est masquée tout de suite, le journal ne garde que « Patient n° X »', () => {
    const id = create()
    addSeance(id, '2026-10-09')
    addSeance(id, '2026-06-11')
    expect(service.softDelete(id)).toBe(true)
    expect(service.search('roux').items).toEqual([])
    expect(service.activeCount()).toBe(0)
    expect(actions(id).at(-1)).toBe(
      'Patient n° 1 · Patient supprimé (2 séances) · factures conservées',
    )
    expect(service.listDeleted()).toEqual([
      expect.objectContaining({ id, seances: 2, daysLeft: 30 }),
    ])
  })

  it('R-14 « Annuler la suppression » rétablit la fiche', () => {
    const id = create()
    service.softDelete(id)
    expect(service.restore(id)).toBe(true)
    expect(service.search('roux').items.map((p) => p.id)).toEqual([id])
    expect(actions(id).at(-1)).toBe('Camille Roux · Suppression annulée')
  })

  it('R-14 purge à J+30 : fiche, séances et liens supprimés, factures conservées, journal anonymisé', () => {
    const id = create()
    const other = create({ nom: 'Roux', prenom: 'Lucas', ddn: '1990-05-02' })
    addSeance(id, '2026-10-09')
    service.addLink(id, other, 'conjoint')
    const seanceId = db.select().from(seances).get()!.id
    db.insert(factures)
      .values({
        numero: '2026-0001',
        annee: 2026,
        sequence: 1,
        seanceId,
        patientId: id,
        statut: 'emise',
        dateEmission: '2026-10-09',
        snapPatientNom: 'Camille Roux',
        snapPatientAdresse: '8 rue des Lilas',
        snapDateSeance: '2026-10-09',
        snapLibelle: 'Séance d’ostéopathie',
        montantCents: 6000,
        reglement: 'acquittee',
        snapCabinet: {
          nom: '',
          titre: '',
          adresse: '',
          telephone: '',
          adeli: '',
          siret: '',
          mentionTva: '',
        },
      })
      .run()
    service.softDelete(id)
    expect(service.relatives(other)).toEqual([]) // hidden while deleted
    clock = new Date('2026-11-22T10:00:00Z')
    expect(service.purgeDue()).toBe(0)
    clock = new Date('2026-11-23T10:00:01Z')
    runMaintenance({ db, patients: service }, clock)
    expect(db.select().from(patients).where(eq(patients.id, id)).get()).toBeUndefined()
    expect(db.select().from(seances).all()).toEqual([])
    expect(db.select().from(patientLinks).all()).toEqual([])
    expect(db.select().from(factures).get()).toMatchObject({
      patientId: null,
      seanceId: null,
      snapPatientNom: 'Camille Roux',
    })
    const lines = db
      .select()
      .from(journal)
      .all()
      .filter((l) => l.subject.startsWith('Patient n° 1'))
    expect(lines.map((l) => l.action)).toEqual([
      'Patient créé',
      'Proche lié : Lucas Roux (conjoint)',
      'Patient supprimé (1 séance) · factures conservées',
    ])
  })

  it('R-20 purge du journal au-delà de la durée de conservation (24 mois)', () => {
    clock = new Date('2024-01-10T10:00:00Z')
    create()
    clock = new Date('2026-10-24T10:00:00Z')
    create({ nom: 'Morel', prenom: 'Julien' })
    runMaintenance({ db, patients: service }, clock)
    expect(actions()).toEqual(['Julien Morel · Patient créé'])
  })
})

describe('R-25 proches', () => {
  it('R-25 lien stocké une fois, affiché sur les deux fiches avec la relation inverse', () => {
    const camille = create()
    const paul = create({ prenom: 'Paul', ddn: '2018-01-20' })
    expect(service.addLink(camille, paul, 'enfant')).toEqual({ ok: true })
    expect(db.select().from(patientLinks).all()).toHaveLength(1)
    expect(service.relatives(camille)).toEqual([
      expect.objectContaining({ patientId: paul, relation: 'enfant' }),
    ])
    expect(service.relatives(paul)).toEqual([
      expect.objectContaining({ patientId: camille, relation: 'parent' }),
    ])
    expect(actions(camille).at(-1)).toBe('Camille Roux · Proche lié : Paul Roux (enfant)')
    expect(actions(paul).at(-1)).toBe('Paul Roux · Proche lié : Camille Roux (parent)')
  })

  it('R-25 ni lien vers soi-même, ni deuxième lien vers le même proche', () => {
    const camille = create()
    const lucas = create({ prenom: 'Lucas', ddn: '1990-05-02' })
    expect(service.addLink(camille, camille, 'autre')).toEqual({ ok: false, reason: 'self' })
    service.addLink(camille, lucas, 'conjoint')
    expect(service.addLink(lucas, camille, 'fratrie')).toEqual({
      ok: false,
      reason: 'already_linked',
    })
    expect(service.linkCandidates(camille, 'roux').map((c) => c.id)).toEqual([])
  })

  it('R-25 retirer le lien le supprime des deux fiches', () => {
    const camille = create()
    const lucas = create({ prenom: 'Lucas', ddn: '1990-05-02' })
    service.addLink(camille, lucas, 'conjoint')
    expect(service.removeLink(lucas, camille)).toEqual({ ok: true })
    expect(service.relatives(camille)).toEqual([])
    expect(service.relatives(lucas)).toEqual([])
    expect(actions(camille).at(-1)).toBe('Camille Roux · Lien de proche retiré : Lucas Roux')
    expect(actions(lucas).at(-1)).toBe('Lucas Roux · Lien de proche retiré : Camille Roux')
  })
})

describe('commentaire inter-séances', () => {
  it('enregistré avec sa date de modification, sans ligne de journal', () => {
    const id = create()
    expect(service.setComment(id, 'Préfère les techniques douces.')).toEqual({
      updatedAt: clock.toISOString(),
    })
    expect(service.setAntecedents(id, [' Asthme ', 'Asthme', '', 'Lunettes'])).toEqual([
      'Asthme',
      'Lunettes',
    ])
    expect(service.get(id)!.patient).toMatchObject({
      commentaire: 'Préfère les techniques douces.',
      antecedentsTags: ['Asthme', 'Lunettes'],
    })
    expect(actions(id)).toEqual(['Camille Roux · Patient créé'])
  })
})

describe('après la reprise de l’historique', () => {
  it('« Tous les patients » liste chaque fiche active par nom, sans attendre qu’elle soit ouverte', () => {
    const roux = create()
    const abel = create({ nom: 'Abel', prenom: 'Zoé' })
    const gone = create({ nom: 'Martin', prenom: 'Léa' })
    service.softDelete(gone)
    expect(service.recent()).toEqual([])
    expect(service.all().map((p) => p.id)).toEqual([abel, roux])
  })

  it('le planning montre les séances importées, sans heure, marquées « historique »', () => {
    const id = create()
    db.insert(seances)
      .values({
        patientId: id,
        date: '2026-10-13',
        status: 'done',
        source: 'import',
        paiement: 'cheque',
      })
      .run()
    const view = new PlanningService(db, () => clock).weeks('2026-10-12')
    const cards = view.weeks.flatMap((w) => w.days).flatMap((d) => d.cards)
    expect(cards).toMatchObject([
      { patientId: id, heure: null, kind: 'past', motif: 'RDV · historique' },
    ])
  })
})
