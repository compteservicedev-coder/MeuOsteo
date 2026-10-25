/**
 * TEST parser only. It reads the fictitious format of tests/fixtures/doctolib/*.eml, sent by
 * `rdv-test@meuosteo.invalid`, to exercise the whole chain (IMAP → parser → rapprochement).
 *
 * ⚠️ The real Doctolib parsers need real anonymised `.eml` samples (docs/GMAIL_DOCTOLIB.md §3):
 * the format of Doctolib's e-mails must not be guessed. Add them next to this file, in the
 * registry, with their fixtures.
 */
import type { ParsedRdv } from '@shared/domain/matching'
import type { DoctolibParser, MailInput } from './types'

export const TEST_SENDER = 'rdv-test@meuosteo.invalid'

const field = (text: string, label: string) =>
  new RegExp(`^\\s*${label}\\s*:\\s*(.+?)\\s*$`, 'mi').exec(text)?.[1] ?? null

const TYPES: Record<string, ParsedRdv['type']> = {
  nouveau: 'new',
  modification: 'modified',
  annulation: 'cancelled',
}

export const testParser: DoctolibParser = {
  id: 'test',
  canParse: (mail: MailInput) =>
    mail.from === TEST_SENDER && /^\[MeuOsteo test\]/.test(mail.subject),
  parse: (mail: MailInput) => {
    const type = TYPES[(field(mail.text, 'Type') ?? '').toLowerCase()]
    const date = field(mail.text, 'Date')
    const nom = field(mail.text, 'Patient')
    if (!type || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !nom) return null
    return {
      type,
      date,
      heure: field(mail.text, 'Heure'),
      ancienneDate: field(mail.text, 'Ancienne date'),
      ancienneHeure: field(mail.text, 'Ancienne heure'),
      nom,
      telephone: field(mail.text, 'Téléphone'),
      email: field(mail.text, 'E-mail'),
      motif: field(mail.text, 'Motif'),
    }
  },
}
