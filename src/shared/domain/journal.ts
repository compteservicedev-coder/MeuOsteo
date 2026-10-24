/** R-20 · Journal: one short line per action, never any medical content. */

export const JOURNAL_SUBJECT_MAX = 60
export const JOURNAL_ACTION_MAX = 140

export type JournalType = 'patient' | 'facture' | 'verrouillage' | 'reglage'

/** Subject used for settings lines (« Réglages » in the mock-up). */
export const SETTINGS_SUBJECT = 'Réglages'

export interface JournalLine {
  type: JournalType
  subject: string
  action: string
  patientId?: string | null
}

function clamp(text: string, max: number): string {
  const single = text.replace(/\s+/g, ' ').trim()
  return single.length <= max ? single : `${single.slice(0, max - 1)}…`
}

/** Normalises a line to the journal limits (60 / 140 characters, single line). */
export function toJournalLine(line: JournalLine): JournalLine {
  return {
    ...line,
    subject: clamp(line.subject, JOURNAL_SUBJECT_MAX),
    action: clamp(line.action, JOURNAL_ACTION_MAX),
  }
}
