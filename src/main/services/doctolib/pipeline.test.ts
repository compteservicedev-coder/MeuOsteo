import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ExcelJS from 'exceljs'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ParsedRdv } from '@shared/domain/matching'
import { EMPTY_PATIENT_DRAFT } from '@shared/domain/patientValidation'
import type { AppDatabase } from '../../db/client'
import { setSetting } from '../../db/repositories/settingsRepository'
import { blocages, contactMemory, doctolibRdv, seances } from '../../db/schema'
import { createTestDatabase } from '../../test/db'
import { importDoctolibExport } from '../doctolibExport'
import { processRawMail } from '../gmailSync'
import { PatientService } from '../patients'
import { DOCTOLIB_CANCEL_REASON, RdvPipeline } from './pipeline'

const clock = () => new Date('2026-10-24T08:00:00Z')
const FIXTURES = resolve(__dirname, '../../../../tests/fixtures/doctolib')
let db: AppDatabase
let patients: PatientService
let pipeline: RdvPipeline
let n = 0

function patient(over: Partial<typeof EMPTY_PATIENT_DRAFT>) {
  const r = patients.create({ ...EMPTY_PATIENT_DRAFT, ddn: '1988-05-12', ...over })
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.id
}

const rdv = (over: Partial<ParsedRdv> = {}): ParsedRdv => ({
  type: 'new',
  date: '2026-10-27',
  heure: '10:30',
  nom: 'Camille Roux',
  telephone: '06 01 02 03 04',
  email: null,
  motif: 'Lombalgie',
  ...over,
})
const source = () => ({ messageId: `<m${++n}@test>`, receivedAt: '2026-10-24T08:00:00.000Z' })
const seancesOf = (pid: string) => db.select().from(seances).where(eq(seances.patientId, pid)).all()

let camille: string
beforeEach(() => {
  db = createTestDatabase()
  patients = new PatientService(db, clock)
  pipeline = new RdvPipeline(db, patients, clock)
  camille = patient({ nom: 'Roux', prenom: 'Camille', portable: '0601020304', ddn: '1992-03-12' })
})

describe('R-09 · RDV Doctolib → séance', () => {
  it('R-09 un RDV rapproché crée sa séance planned/doctolib, retraiter ne change rien', () => {
    const msg = source()
    const first = pipeline.ingest(rdv(), msg)
    expect(first.outcome).toBe('attached')
    expect(seancesOf(camille)).toMatchObject([
      {
        date: '2026-10-27',
        heure: '10:30',
        status: 'planned',
        source: 'doctolib',
        doctolibKey: first.key,
      },
    ])
    expect(pipeline.ingest(rdv(), msg).outcome).toBe('unchanged')
    // The same appointment confirmed by another e-mail: still one session.
    expect(pipeline.ingest(rdv(), source()).outcome).toBe('unchanged')
    expect(seancesOf(camille)).toHaveLength(1)
  })

  it('R-09 une séance manuelle du même jour est réutilisée (pas de doublon)', () => {
    db.insert(seances)
      .values({ patientId: camille, date: '2026-10-27', status: 'planned', source: 'manual' })
      .run()
    pipeline.ingest(rdv(), source())
    expect(seancesOf(camille)).toMatchObject([
      { source: 'manual', heure: '10:30', motif: 'Lombalgie' },
    ])
  })

  it('R-09 modification : la séance suit la nouvelle date et l’heure', () => {
    pipeline.ingest(rdv(), source())
    const moved = pipeline.ingest(
      rdv({
        type: 'modified',
        date: '2026-10-28',
        heure: '14:00',
        ancienneDate: '2026-10-27',
        ancienneHeure: '10:30',
      }),
      source(),
    )
    expect(moved.outcome).toBe('moved')
    expect(seancesOf(camille)).toMatchObject([
      { date: '2026-10-28', heure: '14:00', doctolibKey: moved.key },
    ])
    expect(db.select().from(doctolibRdv).all()).toHaveLength(1)
  })

  it('R-09 annulation : séance annulée « Annulée sur Doctolib »', () => {
    pipeline.ingest(rdv(), source())
    expect(pipeline.ingest(rdv({ type: 'cancelled' }), source()).outcome).toBe('cancelled')
    expect(seancesOf(camille)).toMatchObject([
      { status: 'cancelled', cancelReason: DOCTOLIB_CANCEL_REASON, prevStatus: 'planned' },
    ])
  })

  it('R-09 annulation d’une séance déjà réalisée : conservée, alerte dans « À rapprocher »', () => {
    pipeline.ingest(rdv({ date: '2026-10-23' }), source())
    db.update(seances).set({ status: 'done' }).where(eq(seances.patientId, camille)).run()
    expect(pipeline.ingest(rdv({ type: 'cancelled', date: '2026-10-23' }), source()).outcome).toBe(
      'alert',
    )
    expect(seancesOf(camille)[0]!.status).toBe('done')
    const alerts = pipeline.alerts('2026-10-24')
    expect(alerts).toMatchObject([{ kind: 'done_cancelled' }])
    pipeline.dismissAlert(alerts[0]!.id)
    expect(pipeline.alerts('2026-10-24')).toEqual([])
  })

  it('R-23 un RDV Doctolib arrive même sur une période bloquée, avec une alerte', () => {
    db.insert(blocages).values({ date: '2026-10-27', creneau: 'am', motif: 'Formation' }).run()
    expect(pipeline.ingest(rdv(), source()).outcome).toBe('attached')
    expect(pipeline.alerts('2026-10-24')).toMatchObject([{ kind: 'block_conflict' }])
  })
})

describe('R-18 · tâches « À rapprocher »', () => {
  it('R-18 aucun candidat → « Nouveau patient », puis « Créer la fiche et rattacher le RDV »', () => {
    const { key } = pipeline.ingest(rdv({ nom: 'Inès Garnier', telephone: '0648127730' }), source())
    expect(pipeline.pendingTasks()).toMatchObject([{ key, match: 'pending_new' }])
    expect(pipeline.candidates(key)!.prefill).toEqual({
      prenom: 'Inès',
      nom: 'Garnier',
      portable: '0648127730',
      email: '',
    })
    const refused = pipeline.createAndAttach(key, {
      ...EMPTY_PATIENT_DRAFT,
      nom: 'Garnier',
      prenom: 'Inès',
    })
    expect(refused).toMatchObject({ ok: false, reason: 'invalid' })
    const done = pipeline.createAndAttach(key, {
      ...EMPTY_PATIENT_DRAFT,
      nom: 'Garnier',
      prenom: 'Inès',
      ddn: '1995-06-01',
      portable: '06 48 12 77 30',
    })
    if (!done.ok) throw new Error('create')
    expect(seancesOf(done.patientId)).toHaveLength(1)
    expect(pipeline.pendingTasks()).toEqual([])
  })

  it('R-18 plusieurs fiches : « Rattacher à X » et « Mémoriser ce choix »', () => {
    const julie = patient({
      nom: 'Moreau',
      prenom: 'Julie',
      portable: '0622334455',
      email: 'julie.moreau@exemple.fr',
    })
    const jules = patient({
      nom: 'Moreau',
      prenom: 'Jules',
      portable: '0622334455',
      ddn: '2015-02-03',
    })
    const input = rdv({
      nom: 'J. Moreau',
      telephone: '06 22 33 44 55',
      email: 'julie.moreau@exemple.fr',
      motif: 'Bilan enfant',
    })
    const { key } = pipeline.ingest(input, source())
    const c = pipeline.candidates(key)!
    expect(c.candidates.map((x) => x.patientId)).toEqual([julie, jules])
    expect(c.candidates[0]!.note).toContain('enfant')
    expect(pipeline.attach(key, jules, true)).toMatchObject({ ok: true, patientId: jules })
    expect(db.select().from(contactMemory).all()).toMatchObject([{ patientId: jules }])
    // The next appointment of the same Doctolib contact goes straight to Jules.
    expect(pipeline.ingest({ ...input, date: '2026-11-03' }, source()).outcome).toBe('attached')
    expect(seancesOf(jules)).toHaveLength(2)
  })

  it('R-18 l’option « rattacher automatiquement » désactivée envoie tout dans les tâches', () => {
    setSetting(db, 'agenda', {
      days: ['L', 'Ma', 'Me', 'J', 'V', 'S'],
      opening: '09:00',
      closing: '19:00',
      durationMinutes: 60,
      weeks: 2,
      autoAttach: false,
    })
    expect(pipeline.ingest(rdv(), source()).outcome).toBe('pending_multi')
  })
})

describe('Synchronisation Gmail · fixtures', () => {
  const raw = (name: string) => readFileSync(resolve(FIXTURES, name))

  it('chaque type d’e-mail produit la bonne séance, retraiter est idempotent', async () => {
    const ines = patient({
      nom: 'Garnier',
      prenom: 'Inès',
      portable: '0648127730',
      ddn: '1995-06-01',
    })
    expect(await processRawMail(raw('test-nouveau.eml'), pipeline)).toBe('ingested')
    expect(seancesOf(ines)).toMatchObject([
      { date: '2026-10-27', heure: '10:30', status: 'planned' },
    ])
    expect(await processRawMail(raw('test-modification.eml'), pipeline)).toBe('ingested')
    expect(seancesOf(ines)).toMatchObject([{ date: '2026-10-28', heure: '14:00' }])
    expect(await processRawMail(raw('test-annulation.eml'), pipeline)).toBe('ingested')
    expect(seancesOf(ines)).toMatchObject([
      { status: 'cancelled', cancelReason: DOCTOLIB_CANCEL_REASON },
    ])
    for (const f of ['test-nouveau.eml', 'test-modification.eml', 'test-annulation.eml']) {
      expect(await processRawMail(raw(f), pipeline)).toBe('unchanged')
    }
    expect(seancesOf(ines)).toHaveLength(1)
  })

  it('un e-mail non reconnu ne bloque rien', async () => {
    expect(await processRawMail(raw('autre-expediteur.eml'), pipeline)).toBe('unrecognized')
  })
})

describe('Import de l’export Doctolib (secours)', () => {
  async function xlsx(rows: unknown[][]) {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Historique')
    ws.addRow(['Export fictif'])
    for (const r of rows) ws.addRow(r)
    return Buffer.from(await wb.xlsx.writeBuffer())
  }

  it('repère les colonnes par leur titre et passe par le même rapprochement', async () => {
    const data = await xlsx([
      ['Identifiant RDV', 'Patient', 'Date', 'Heure', 'Motif', 'Statut', 'Téléphone'],
      ['A1', 'Camille Roux', '27/10/2026', '10:30', 'Lombalgie', 'Confirmé', '06 01 02 03 04'],
      ['A2', 'Inès Garnier', '28/10/2026', '14:00', 'Bilan', 'Confirmé', '06 48 12 77 30'],
      ['A3', 'Camille Roux', '29/10/2026', '09:00', 'Suivi', 'Annulé', '06 01 02 03 04'],
      ['', '', '', '', '', '', ''],
    ])
    const r = await importDoctolibExport(data, pipeline)
    expect(r).toEqual({
      ok: true,
      report: { rows: 3, created: 1, updated: 0, cancelled: 1, pending: 1, ignored: 0 },
    })
    // Same file again: nothing changes.
    expect(await importDoctolibExport(data, pipeline)).toMatchObject({ report: { ignored: 3 } })
    expect(seancesOf(camille)).toHaveLength(1)
  })

  it('refuse un fichier sans colonnes reconnaissables', async () => {
    const data = await xlsx([
      ['Colonne A', 'Colonne B'],
      ['x', 'y'],
    ])
    expect(await importDoctolibExport(data, pipeline)).toMatchObject({
      ok: false,
      reason: 'columns',
    })
  })
})
