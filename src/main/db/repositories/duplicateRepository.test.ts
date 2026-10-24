import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { defaultMergePicks, type MergePicks } from '@shared/domain/duplicates'
import { patientSearchKey } from '@shared/domain/text'
import { createTestDatabase } from '../../test/db'
import type { AppDatabase } from '../client'
import { factures, journal, patientLinks, patients, seances } from '../schema'
import {
  countDuplicatePairs,
  getMergeComparison,
  ignoreDuplicatePair,
  listDuplicateTasks,
  mergeDuplicatePair,
} from './duplicateRepository'

let shortNo = 1
function addPatient(db: AppDatabase, over: Partial<typeof patients.$inferInsert> & { id: string }) {
  const row = {
    shortNo: shortNo++,
    nom: 'Lambert',
    prenom: 'Sophie',
    ddn: '1997-07-22',
    ...over,
  }
  db.insert(patients)
    .values({ ...row, searchKey: patientSearchKey(row.nom, row.prenom) })
    .run()
}

function addSeance(
  db: AppDatabase,
  patientId: string,
  date: string,
  source: 'manual' | 'import' = 'manual',
) {
  const id = `S-${patientId}-${date}-${source}`
  db.insert(seances).values({ id, patientId, date, status: 'done', source }).run()
  return id
}

function setup() {
  const db = createTestDatabase()
  shortNo = 1
  addPatient(db, {
    id: 'A',
    portable: '0755443322',
    profession: 'Étudiante',
    commentaire: 'Course à pied.',
    antecedentsTags: ['Asthme'],
  })
  addPatient(db, {
    id: 'B',
    nom: 'Lambert-Durand',
    portable: '0755443322',
    email: 'sophie.ld@exemple.fr',
    profession: 'Infirmière',
    commentaire: 'Migraines.',
  })
  addPatient(db, { id: 'C', nom: 'Girard', prenom: 'Alice', ddn: '1980-01-01' })
  return db
}

const picks = (db: AppDatabase): MergePicks => getMergeComparison(db, 'A', 'B')!.picks

describe('R-19 · doublons dans la base', () => {
  it('R-19 liste les doublons possibles, la fiche la plus ancienne d’abord', () => {
    const db = setup()
    expect(listDuplicateTasks(db)).toEqual([
      {
        a: { id: 'A', name: 'Sophie Lambert' },
        b: { id: 'B', name: 'Sophie Lambert-Durand' },
        reasons: ['portable', 'close_name'],
      },
    ])
  })

  it('R-19 « Pas les mêmes personnes » : la paire est mémorisée et n’est plus proposée', () => {
    const db = setup()
    ignoreDuplicatePair(db, 'B', 'A')
    ignoreDuplicatePair(db, 'A', 'B')
    expect(countDuplicatePairs(db)).toBe(0)
  })

  it('R-19 compare les deux fiches champ par champ', () => {
    const db = setup()
    addSeance(db, 'A', '2026-10-20')
    const comparison = getMergeComparison(db, 'B', 'A')!
    expect(comparison.a).toMatchObject({ id: 'A', seances: 1, lastSeance: '2026-10-20' })
    expect(comparison.b).toMatchObject({ id: 'B', seances: 0, lastSeance: null })
    expect(comparison.rows.map((r) => [r.field, r.same])).toEqual([
      ['nom', false],
      ['prenom', true],
      ['ddn', true],
      ['profession', false],
      ['portable', true],
      ['email', false],
    ])
    expect(comparison.picks).toMatchObject({ nom: 'a', email: 'b' })
  })

  it('R-19 fusion : séances et factures réunies, commentaires bout à bout, journal, une transaction', () => {
    const db = setup()
    addSeance(db, 'A', '2026-10-20')
    const seanceB = addSeance(db, 'B', '2026-09-03', 'manual')
    addSeance(db, 'B', '2019-01-01', 'import')
    db.insert(factures)
      .values({
        id: 'F1',
        numero: '2026-0001',
        annee: 2026,
        sequence: 1,
        seanceId: seanceB,
        patientId: 'B',
        statut: 'emise',
        dateEmission: '2026-09-03',
        snapPatientNom: 'Sophie Lambert-Durand',
        snapPatientAdresse: '5 rue de Picpus, 75012 Paris',
        snapDateSeance: '2026-09-03',
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
    db.insert(patientLinks).values({ patientA: 'B', patientB: 'C', relAToB: 'parent' }).run()
    db.insert(journal)
      .values({
        at: '2026-09-03T10:00:00Z',
        type: 'patient',
        subject: 'x',
        action: 'créé',
        patientId: 'B',
      })
      .run()

    const result = mergeDuplicatePair(
      db,
      { keepId: 'A', removeId: 'B', picks: { ...picks(db), nom: 'b', profession: 'b' } },
      new Date('2026-10-24T09:00:00Z'),
    )
    expect(result).toEqual({ ok: true, keptId: 'A', name: 'Sophie Lambert-Durand', seances: 3 })

    const kept = db.select().from(patients).where(eq(patients.id, 'A')).get()!
    expect(kept).toMatchObject({
      nom: 'Lambert-Durand',
      profession: 'Infirmière',
      email: 'sophie.ld@exemple.fr',
      searchKey: 'lambert durand sophie',
      commentaire: 'Course à pied.\n\n——— Fiche fusionnée le 24/10/2026 ———\nMigraines.',
    })
    expect(db.select().from(patients).where(eq(patients.id, 'B')).get()).toBeUndefined()
    expect(db.select().from(seances).where(eq(seances.patientId, 'A')).all()).toHaveLength(3)
    // The invoice keeps its snapshot and follows the kept record.
    expect(db.select().from(factures).get()).toMatchObject({
      patientId: 'A',
      snapPatientNom: 'Sophie Lambert-Durand',
    })
    // R-25: the relative moves to the kept record.
    expect(db.select().from(patientLinks).all()).toEqual([
      expect.objectContaining({ patientA: 'A', patientB: 'C', relAToB: 'parent' }),
    ])
    const lines = db.select().from(journal).where(eq(journal.patientId, 'A')).all()
    expect(lines.map((l) => l.action)).toEqual([
      'créé',
      'Fiches fusionnées : fiche n° 2 réunie à la fiche n° 1',
    ])
    expect(countDuplicatePairs(db)).toBe(0)
  })

  it('R-19 R-08 refuse la fusion si les deux fiches ont une séance le même jour', () => {
    const db = setup()
    addSeance(db, 'A', '2026-10-20')
    addSeance(db, 'B', '2026-10-20')
    expect(getMergeComparison(db, 'A', 'B')!.conflictDates).toEqual(['2026-10-20'])
    const result = mergeDuplicatePair(db, {
      keepId: 'A',
      removeId: 'B',
      picks: defaultMergePicks(
        { ...db.select().from(patients).where(eq(patients.id, 'A')).get()! },
        { ...db.select().from(patients).where(eq(patients.id, 'B')).get()! },
      ),
    })
    expect(result).toEqual({ ok: false, reason: 'same_day_conflict', dates: ['2026-10-20'] })
    expect(db.select().from(patients).all()).toHaveLength(3)
  })

  it('R-19 refuse une fiche inconnue ou supprimée', () => {
    const db = setup()
    expect(mergeDuplicatePair(db, { keepId: 'A', removeId: 'Z', picks: picks(db) })).toEqual({
      ok: false,
      reason: 'not_found',
    })
    expect(getMergeComparison(db, 'A', 'A')).toBeNull()
  })
})
