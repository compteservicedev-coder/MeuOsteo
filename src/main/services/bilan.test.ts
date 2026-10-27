import ExcelJS from 'exceljs'
import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_PATIENT_DRAFT } from '@shared/domain/patientValidation'
import type { AppDatabase } from '../db/client'
import { seances } from '../db/schema'
import { createTestDatabase } from '../test/db'
import { BilanService } from './bilan'
import { PatientService } from './patients'
import { SeanceService } from './seances'

let db: AppDatabase
let service: BilanService
let patientId: string

type Paid = 'especes' | 'cheque' | 'virement_attente' | 'virement_recu'
function addSeance(date: string, paiement: Paid, extra: { recu?: string; tarif?: number } = {}) {
  return db
    .insert(seances)
    .values({
      patientId,
      date,
      status: 'done',
      source: 'manual',
      paiement,
      tarifCents: extra.tarif ?? 6000,
      paiementRecuLe: extra.recu ?? null,
    })
    .returning({ id: seances.id })
    .get().id
}

beforeEach(() => {
  db = createTestDatabase()
  service = new BilanService(db)
  const r = new PatientService(db).create({
    ...EMPTY_PATIENT_DRAFT,
    nom: 'Roux',
    prenom: 'Camille',
    ddn: '1992-03-12',
  })
  if (!r.ok) throw new Error('patient')
  patientId = r.id
})

describe('R-27 · bilan mensuel (base)', () => {
  it('R-27 retient les séances encaissées dans le mois, virements reçus compris', () => {
    addSeance('2026-10-05', 'especes')
    addSeance('2026-09-29', 'virement_recu', { recu: '2026-10-03' })
    addSeance('2026-10-30', 'virement_recu', { recu: '2026-11-02' })
    addSeance('2026-10-12', 'virement_attente')
    addSeance('2026-09-10', 'cheque')
    addSeance('2026-10-14', 'cheque', { tarif: 0 })
    const v = service.view('2026-10')
    expect(v.lines.map((l) => [l.date, l.included, l.patientNom])).toEqual([
      ['2026-09-29', true, 'Camille Roux'],
      ['2026-10-05', true, 'Camille Roux'],
      ['2026-10-12', false, 'Camille Roux'],
    ])
    expect(v.revenueCents).toBe(12_000)
    expect(v.includedCount).toBe(2)
  })

  it('R-27 mémorise les choix du mois sans modifier la séance', () => {
    const id = addSeance('2026-10-05', 'cheque')
    const pending = addSeance('2026-10-06', 'virement_attente')
    service.setLine('2026-10', id, { mode: 'especes' })
    const v = service.setLine('2026-10', pending, { included: true })
    expect(v.revenueCents).toBe(12_000)
    expect(v.recap.find((r) => r.mode === 'especes')).toEqual({
      mode: 'especes',
      count: 1,
      cents: 6000,
    })
    expect(
      db
        .select()
        .from(seances)
        .all()
        .find((s) => s.id === id)?.paiement,
    ).toBe('cheque')
    expect(service.setAll('2026-10', false).revenueCents).toBe(0)
    expect(service.view('2026-11').lines).toEqual([])
  })

  it('R-27 calcule épargne et salaire avec les réglages et les dépenses du mois', () => {
    for (let d = 1; d <= 10; d++) addSeance(`2026-10-${String(d).padStart(2, '0')}`, 'cheque')
    service.saveBudget({
      cotisationsBp: 2500,
      reserveBp: 0,
      fixedCosts: [{ id: 'l', label: 'Loyer', cents: 20_000, period: 'mensuel' }],
      provisions: [{ id: 'c', label: 'CFE', cents: 12_000, period: 'annuel' }],
    })
    const v = service.setExceptional('2026-10', [{ id: 'x', label: 'Table', cents: 5_000 }])
    expect(v.result).toMatchObject({
      revenueCents: 60_000,
      cotisationsCents: 15_000,
      toSaveCents: 16_000,
      spentCents: 25_000,
      salaryCents: 19_000,
    })
  })

  it('R-27 « Marquer le virement reçu » date l’encaissement du jour', () => {
    const seanceService = new SeanceService(db, () => new Date('2026-11-04T10:00:00Z'))
    const id = addSeance('2026-10-28', 'virement_attente')
    const r = seanceService.save(id, { paiement: 'virement_recu' })
    expect(r.ok).toBe(true)
    expect(service.view('2026-10').lines).toEqual([])
    expect(service.view('2026-11').lines.map((l) => l.encaisseLe)).toEqual(['2026-11-04'])
  })

  it('R-27 exporte les encaissements, le récapitulatif et le calcul en Excel', async () => {
    addSeance('2026-10-05', 'especes')
    const wb = new ExcelJS.Workbook()
    const buffer = await service.exportWorkbook('2026-10')
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Encaissements',
      'Récapitulatif',
      'Épargne et salaire',
    ])
    expect(wb.getWorksheet('Encaissements')!.getRow(2).getCell(4).value).toBe('Camille Roux')
  })
})
