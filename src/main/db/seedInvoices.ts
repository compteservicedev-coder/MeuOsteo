/**
 * Fake practitioner details and invoices for `npm run seed` (development only). Invoices are
 * issued through the real service, one session at a time in chronological order, so the
 * numbering is exactly what the application produces. No PDF is written: it is generated on
 * first opening.
 */
import { fakerFR as faker } from '@faker-js/faker'
import { and, asc, eq, gt } from 'drizzle-orm'
import { addDays } from '@shared/domain/dates'
import { InvoiceService } from '../services/invoices'
import type { AppDatabase } from './client'
import { getSetting, setSetting } from './repositories/settingsRepository'
import { seances } from './schema'
import { DEFAULT_CABINET, cabinetSettingSchema } from '../services/settingsSchemas'

export function seedInvoices(db: AppDatabase, today: string, dataDir: string): number {
  faker.seed(3)
  const cabinet = getSetting(db, 'cabinet', cabinetSettingSchema, DEFAULT_CABINET)
  if (!cabinet.nom) {
    setSetting(db, 'cabinet', {
      ...cabinet,
      nom: `${faker.person.firstName('female')} ${faker.person.lastName()} (fictif)`,
      adresse: `${faker.location.streetAddress()}, 94300 Vincennes`,
      telephone: '01 23 45 67 89',
      adeli: '000000000',
      siret: '00000000000000',
    })
  }
  const done = db
    .select({ id: seances.id, date: seances.date })
    .from(seances)
    .where(
      and(
        eq(seances.status, 'done'),
        gt(seances.tarifCents, 0),
        gt(seances.date, addDays(today, -200)),
      ),
    )
    .orderBy(asc(seances.date))
    .all()
  let issued = 0
  for (const s of done) {
    if (!faker.datatype.boolean(0.7)) continue
    const service = new InvoiceService({
      db,
      dataDir,
      pdf: { render: async () => Buffer.alloc(0), print: async () => false },
      mailer: {
        isConfigured: () => false,
        send: async () => ({ ok: false, error: 'not_configured' }),
      },
      now: () => new Date(`${s.date}T17:30:00Z`),
    })
    if (service.issueRecord(s.id).ok) issued++
  }
  return issued
}
