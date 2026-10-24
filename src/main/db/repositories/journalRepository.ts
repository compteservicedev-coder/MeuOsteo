import { toJournalLine, type JournalLine } from '@shared/domain/journal'
import type { AppDatabase } from '../client'
import { journal } from '../schema'

export function addJournalLine(db: AppDatabase, line: JournalLine, at = new Date()): void {
  const { type, subject, action, patientId } = toJournalLine(line)
  db.insert(journal)
    .values({ at: at.toISOString(), type, subject, action, patientId: patientId ?? null })
    .run()
}
