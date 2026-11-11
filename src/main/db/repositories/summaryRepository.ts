import { and, eq, ne, sql } from 'drizzle-orm'
import type { TodaySummary } from '@shared/types/app'
import type { AppDatabase } from '../client'
import { seances } from '../schema'
import { countDuplicatePairs } from './duplicateRepository'

export function countAppointmentsOn(db: AppDatabase, isoDate: string): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(seances)
    .where(and(eq(seances.date, isoDate), ne(seances.status, 'cancelled')))
    .get()
  return row?.n ?? 0
}

export function getTodaySummary(
  db: AppDatabase,
  todayIso: string,
  lastBackupAt: string | null,
): TodaySummary {
  return {
    appointmentsToday: countAppointmentsOn(db, todayIso),
    toReconcile: countDuplicatePairs(db),
    lastBackupAt,
  }
}
