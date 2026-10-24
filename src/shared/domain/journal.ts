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

/** R-20 · Retention: 24 months by default, then automatic purge. */
export const DEFAULT_JOURNAL_RETENTION_MONTHS = 24
export const JOURNAL_RETENTION_CHOICES = [12, 24, 36] as const

/** Lines older than this instant are purged. */
export function journalCutoff(now: Date, retentionMonths: number): Date {
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - retentionMonths)
  return cutoff
}

/** Subject of a patient's lines once the record is deleted (R-14, R-20). */
export const deletedPatientSubject = (shortNo: number) => `Patient n° ${shortNo}`

/** Patient actions allowed in the journal (R-20). Names of fields only, never their values. */
export const patientJournal = {
  created: () => 'Patient créé',
  modified: (fieldNames: string[]) => `Fiche modifiée : ${fieldNames.join(', ')}`,
  deleted: (seances: number) =>
    `Patient supprimé (${seances} séance${seances > 1 ? 's' : ''}) · factures conservées`,
  deletionCancelled: () => 'Suppression annulée',
  seanceDeleted: (dateFr: string) => `Séance du ${dateFr} supprimée`,
  relativeLinked: (name: string, relationLabel: string) =>
    `Proche lié : ${name} (${relationLabel.toLowerCase()})`,
  relativeUnlinked: (name: string) => `Lien de proche retiré : ${name}`,
  merged: () => 'Fiches fusionnées',
}

/** Lock actions on an invoiced session (R-04, lot 3). */
export const lockJournal = {
  unlocked: (dateFr: string, invoice: string, reason: string) =>
    `Séance du ${dateFr} déverrouillée (facture ${invoice}) · motif : ${reason.toLowerCase()}`,
  relockedUnchanged: (dateFr: string) => `Séance du ${dateFr} reverrouillée, facture inchangée`,
}

export const JOURNAL_TYPE_LABELS: Record<JournalType, string> = {
  patient: 'Patient',
  facture: 'Facture',
  verrouillage: 'Verrouillage',
  reglage: 'Réglage',
}
