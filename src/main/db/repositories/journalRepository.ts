import { lt } from 'drizzle-orm'
import { toJournalLine, type JournalLine } from '@shared/domain/journal'
import type { DbOrTx } from '../client'
import { journal } from '../schema'

export function addJournalLine(db: DbOrTx, line: JournalLine, at = new Date()): void {
  const { type, subject, action, patientId } = toJournalLine(line)
  db.insert(journal)
    .values({ at: at.toISOString(), type, subject, action, patientId: patientId ?? null })
    .run()
}

/** R-20: deletes the lines older than the retention period. Returns the number deleted. */
export function purgeJournal(db: DbOrTx, cutoff: Date): number {
  return db.delete(journal).where(lt(journal.at, cutoff.toISOString())).run().changes
}
