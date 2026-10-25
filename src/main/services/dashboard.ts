/**
 * Tableau de bord (SPEC §7): counters of the month, revenue (done sessions, by session date),
 * payments awaited and the last invoices. Imported history counts in the revenue of its months.
 */
import { and, desc, eq, isNull, lte, sql } from 'drizzle-orm'
import { isoDateInParis } from '@shared/domain/dates'
import { invoiceStatusKey } from '@shared/domain/invoice'
import type { DashboardView, PendingPayment } from '@shared/types/pilotage'
import type { AppDatabase } from '../db/client'
import { factures, patients, seances } from '../db/schema'
import type { InvoiceService } from './invoices'

const monthOf = (iso: string) => iso.slice(0, 7)

function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

export class DashboardService {
  constructor(
    private readonly db: AppDatabase,
    private readonly invoices: InvoiceService,
    private readonly lastBackupAt: () => string | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  pendingPayments(): PendingPayment[] {
    return this.db
      .select({
        seanceId: seances.id,
        patientId: seances.patientId,
        nom: sql<string>`${patients.prenom} || ' ' || ${patients.nom}`,
        date: seances.date,
        montantCents: seances.tarifCents,
        factureId: factures.id,
        numero: factures.numero,
      })
      .from(seances)
      .innerJoin(patients, eq(patients.id, seances.patientId))
      .leftJoin(factures, and(eq(factures.seanceId, seances.id), eq(factures.statut, 'emise')))
      .where(
        and(
          eq(seances.status, 'done'),
          eq(seances.paiement, 'virement_attente'),
          lte(seances.date, isoDateInParis(this.now())),
          isNull(patients.deletedAt),
        ),
      )
      .orderBy(seances.date)
      .all()
  }

  view(): DashboardView {
    const today = isoDateInParis(this.now())
    const month = monthOf(today)
    const prev = previousMonth(month)
    const year = today.slice(0, 4)
    const months: string[] = []
    for (let m = month, i = 0; i < 12; i++, m = previousMonth(m)) months.unshift(m)
    const rows = this.db.all<{ m: string; n: number; cents: number }>(
      sql`SELECT substr(date, 1, 7) AS m, count(*) AS n, coalesce(sum(tarif_cents), 0) AS cents
          FROM seances WHERE status = 'done' AND date >= ${`${months[0]}-01`} AND date <= ${today}
          GROUP BY m`,
    )
    const byMonth = new Map(rows.map((r) => [r.m, r]))
    const yearRevenue = this.db.get<{ cents: number }>(
      sql`SELECT coalesce(sum(tarif_cents), 0) AS cents FROM seances
          WHERE status = 'done' AND date >= ${`${year}-01-01`} AND date <= ${today}`,
    )
    const newPatients = this.db.get<{ n: number }>(
      sql`SELECT count(*) AS n FROM patients WHERE deleted_at IS NULL AND legacy_key IS NULL
          AND created_at >= ${`${month}-01`}`,
    )
    const pending = this.pendingPayments()
    const last = this.db
      .select()
      .from(factures)
      .orderBy(desc(factures.annee), desc(factures.sequence))
      .limit(5)
      .all()
    return {
      month: {
        seances: byMonth.get(month)?.n ?? 0,
        previousSeances: byMonth.get(prev)?.n ?? 0,
        revenueCents: byMonth.get(month)?.cents ?? 0,
        newPatients: newPatients?.n ?? 0,
        totalPatients:
          this.db.get<{ n: number }>(
            sql`SELECT count(*) AS n FROM patients WHERE deleted_at IS NULL`,
          )?.n ?? 0,
      },
      yearRevenueCents: yearRevenue?.cents ?? 0,
      pendingCents: pending.reduce((n, p) => n + p.montantCents, 0),
      revenueByMonth: months.map((m) => ({ month: m, cents: byMonth.get(m)?.cents ?? 0 })),
      pending,
      lastInvoices: last.map((f) => ({
        id: f.id,
        numero: f.numero,
        dateEmission: f.dateEmission,
        patientNom: f.snapPatientNom,
        montantCents: f.montantCents,
        statusKey: invoiceStatusKey(f),
      })),
      lastBackupAt: this.lastBackupAt(),
    }
  }

  /** « Marquer reçu »: the session (and its invoice, if any) becomes paid. */
  async markReceived(seanceId: string): Promise<boolean> {
    const p = this.pendingPayments().find((x) => x.seanceId === seanceId)
    if (!p) return false
    if (p.factureId) return (await this.invoices.markPaid(p.factureId)).ok
    this.db.transaction((tx) => {
      tx.update(seances).set({ paiement: 'virement_recu' }).where(eq(seances.id, seanceId)).run()
    })
    return true
  }
}
