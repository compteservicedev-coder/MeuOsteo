import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { EMPTY_PATIENT_DRAFT } from '@shared/domain/patientValidation'
import { seances } from '../db/schema'
import { createTestDatabase } from '../test/db'
import { DashboardService } from './dashboard'
import { InvoiceService } from './invoices'
import { PatientService } from './patients'

const clock = () => new Date('2026-10-24T10:00:00Z')

describe('Tableau de bord (SPEC §7)', () => {
  it('compteurs du mois, CA sur 12 mois, paiements en attente et « Marquer reçu »', async () => {
    const db = createTestDatabase()
    const p = new PatientService(db, clock).create({
      ...EMPTY_PATIENT_DRAFT,
      nom: 'Roux',
      prenom: 'Camille',
      ddn: '1990-03-12',
    })
    if (!p.ok) throw new Error('patient')
    const add = (date: string, paiement: 'cheque' | 'virement_attente', tarifCents = 6000) =>
      db
        .insert(seances)
        .values({ patientId: p.id, date, status: 'done', source: 'manual', paiement, tarifCents })
        .returning({ id: seances.id })
        .get().id
    add('2026-10-02', 'cheque')
    const pending = add('2026-10-20', 'virement_attente', 5500)
    add('2026-09-15', 'cheque')
    add('2026-11-02', 'virement_attente') // not yet: never counted
    const invoices = new InvoiceService({
      db,
      dataDir: mkdtempSync(join(tmpdir(), 'meuosteo-dash-')),
      pdf: { render: async () => Buffer.alloc(0), print: async () => true },
      mailer: {
        isConfigured: () => false,
        send: async () => ({ ok: false, error: 'not_configured' }),
      },
      now: clock,
    })
    const dashboard = new DashboardService(db, invoices, () => null, clock)
    const v = dashboard.view()
    expect(v.month).toMatchObject({
      seances: 2,
      previousSeances: 1,
      revenueCents: 11500,
      newPatients: 1,
    })
    expect(v.revenueByMonth).toHaveLength(12)
    expect(v.revenueByMonth.at(-1)).toEqual({ month: '2026-10', cents: 11500 })
    expect(v.pending.map((x) => x.seanceId)).toEqual([pending])
    expect(v.pendingCents).toBe(5500)
    expect(v.monthPendingCents).toBe(5500)
    expect(v.years.year).toBe(2026)
    expect(v.years.months[9]).toEqual({ month: 10, cents: 11500, previousCents: 0 })
    expect(v.years.months[8]!.cents).toBe(6000)
    expect(v.years.months[10]!.cents).toBe(0) // November not reached yet
    expect(dashboard.year(2027).months[9]!.previousCents).toBe(11500)
    expect(await dashboard.markReceived(pending)).toBe(true)
    expect(db.select().from(seances).where(eq(seances.id, pending)).get()!.paiement).toBe(
      'virement_recu',
    )
    expect(dashboard.view().pending).toEqual([])
  })
})
