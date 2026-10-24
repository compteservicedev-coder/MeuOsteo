import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_PATIENT_DRAFT } from '@shared/domain/patientValidation'
import type { AppDatabase } from '../db/client'
import { factures, journal, seances } from '../db/schema'
import { createTestDatabase } from '../test/db'
import { PatientService } from './patients'
import { SeanceService } from './seances'

let db: AppDatabase
let patientId: string
let service: SeanceService
const clock = () => new Date('2026-10-24T10:00:00Z')

function insertSeance(values: Partial<typeof seances.$inferInsert> = {}): string {
  return db
    .insert(seances)
    .values({ patientId, date: '2026-10-16', status: 'planned', source: 'doctolib', heure: '18:00', ...values })
    .returning({ id: seances.id })
    .get().id
}

function invoice(seanceId: string) {
  db.insert(factures)
    .values({
      numero: '2026-0131', annee: 2026, sequence: 131, seanceId, patientId, statut: 'emise',
      dateEmission: '2026-10-09', snapPatientNom: 'Camille Roux', snapPatientAdresse: '8 rue des Lilas',
      snapDateSeance: '2026-10-09', snapLibelle: 'Séance d’ostéopathie', montantCents: 6000, reglement: 'acquittee',
      snapCabinet: { nom: '', titre: '', adresse: '', telephone: '', adeli: '', siret: '', mentionTva: '' },
    })
    .run()
}

beforeEach(() => {
  db = createTestDatabase()
  const patients = new PatientService(db, clock)
  const created = patients.create({ ...EMPTY_PATIENT_DRAFT, nom: 'Roux', prenom: 'Camille', ddn: '1992-03-12' })
  if (!created.ok) throw new Error('setup')
  patientId = created.id
  service = new SeanceService(db, clock)
})

describe('séances de la fiche', () => {
  it('R-08 « Nouvelle » crée une séance hors Doctolib du jour, au tarif par défaut', () => {
    const result = service.createToday(patientId)
    expect(result).toMatchObject({
      ok: true,
      existing: false,
      seance: { date: '2026-10-24', status: 'planned', source: 'manual', tarifCents: 6000, invoice: null },
    })
  })

  it('R-08 « Nouvelle » ouvre la séance existante du jour au lieu d’en créer une seconde', () => {
    const id = insertSeance({ date: '2026-10-24', heure: '11:30' })
    expect(service.createToday(patientId)).toMatchObject({ ok: true, existing: true, seance: { id } })
    expect(db.select().from(seances).all()).toHaveLength(1)
    // A cancelled session does not count.
    service.cancel(id, 'Reportée')
    expect(service.createToday(patientId)).toMatchObject({ ok: true, existing: false })
  })

  it('R-08 changer la date vers un jour déjà pris est refusé', () => {
    const taken = insertSeance({ date: '2026-10-30' })
    const id = insertSeance({ date: '2026-10-16' })
    expect(service.save(id, { date: '2026-10-30' })).toEqual({ ok: false, reason: 'same_day', existingId: taken })
    expect(service.save(id, { date: '2026-10-31', motif: ' Suivi ' })).toMatchObject({
      ok: true,
      seance: { date: '2026-10-31', motif: 'Suivi' },
    })
  })

  it('R-02 « Séance réalisée » refusée sans motif ni paiement, ou pour une date future', () => {
    const id = insertSeance()
    expect(service.markDone(id, {})).toEqual({
      ok: false,
      reason: 'mark_done',
      errors: ['motif_missing', 'payment_missing'],
    })
    const future = insertSeance({ date: '2026-10-30' })
    expect(service.markDone(future, { motif: 'Suivi', paiement: 'cheque' })).toEqual({
      ok: false,
      reason: 'mark_done',
      errors: ['future'],
    })
  })

  it('R-02 validée, la séance passe en « done » avec les notes saisies', () => {
    const id = insertSeance()
    const result = service.markDone(id, { motif: 'Lombalgie', anamnese: 'Gêne matinale.', paiement: 'cheque' })
    expect(result).toMatchObject({
      ok: true,
      seance: { status: 'done', motif: 'Lombalgie', anamnese: 'Gêne matinale.', paiement: 'cheque' },
    })
    expect(result.ok && result.seance.doneAt).toBe('2026-10-24T10:00:00.000Z')
    expect(service.markDone(id, {})).toEqual({ ok: false, reason: 'not_editable' })
  })

  it('R-03 une séance réalisée modifiée reste réalisée et sa date ne peut pas passer dans le futur', () => {
    const id = insertSeance({ status: 'done', motif: 'Suivi', paiement: 'cheque' })
    expect(service.save(id, { pratique: 'Techniques douces.' })).toMatchObject({
      ok: true,
      seance: { status: 'done', pratique: 'Techniques douces.' },
    })
    expect(service.save(id, { date: '2026-10-25' })).toEqual({ ok: false, reason: 'invalid_date' })
    expect(db.select().from(journal).all().map((l) => l.action)).toEqual(['Patient créé'])
  })

  it('R-04 séance facturée : date et tarif bloqués, étiquette « Facturée »', () => {
    const id = insertSeance({ status: 'done', motif: 'Suivi', paiement: 'cheque', date: '2026-10-09' })
    invoice(id)
    expect(service.save(id, { tarifCents: 5500 })).toEqual({ ok: false, reason: 'locked' })
    expect(service.save(id, { date: '2026-10-08' })).toEqual({ ok: false, reason: 'locked' })
    expect(service.save(id, { pratique: 'Ajout.' })).toMatchObject({ ok: true, seance: { invoice: { numero: '2026-0131' } } })
  })

  it('R-06 annuler exige un motif ; la séance reste visible et peut être rétablie', () => {
    const id = insertSeance({ anamnese: 'Notes conservées.' })
    expect(service.cancel(id, 'Parce que')).toEqual({ ok: false, reason: 'not_editable' })
    expect(service.cancel(id, 'Patient absent')).toMatchObject({
      ok: true,
      seance: { status: 'cancelled', cancelReason: 'Patient absent', anamnese: 'Notes conservées.' },
    })
    expect(service.restore(id)).toMatchObject({ ok: true, seance: { status: 'planned', cancelReason: null } })
  })

  it('R-06 rétablir est refusé si une autre séance occupe déjà ce jour (R-08)', () => {
    const id = insertSeance({ date: '2026-10-24' })
    service.cancel(id, 'Reportée')
    const other = service.createToday(patientId)
    expect(service.restore(id)).toEqual({ ok: false, reason: 'same_day', existingId: other.ok && other.seance.id })
  })

  it('R-07 supprimer une séance réalisée non facturée, avec une ligne de journal', () => {
    const planned = insertSeance()
    expect(service.delete(planned)).toEqual({ ok: false, reason: 'not_editable' })
    const done = insertSeance({ status: 'done', date: '2026-10-09', motif: 'Suivi', paiement: 'cheque' })
    expect(service.delete(done)).toEqual({ ok: true })
    expect(db.select().from(journal).all().at(-1)).toMatchObject({
      subject: 'Camille Roux',
      action: 'Séance du 09/10/2026 supprimée',
      patientId,
    })
  })

  it('R-07 une séance facturée ne peut pas être supprimée', () => {
    const id = insertSeance({ status: 'done', date: '2026-10-09', motif: 'Suivi', paiement: 'cheque' })
    invoice(id)
    expect(service.delete(id)).toEqual({ ok: false, reason: 'invoiced' })
    expect(service.cancel(id, 'Reportée')).toEqual({ ok: false, reason: 'not_editable' })
  })
})
