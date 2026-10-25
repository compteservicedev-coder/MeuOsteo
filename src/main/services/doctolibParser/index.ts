import type { ParsedRdv } from '@shared/domain/matching'
import { testParser } from './testParser'
import type { DoctolibParser, MailInput } from './types'

export type { DoctolibParser, MailInput } from './types'

/**
 * Registry of the e-mail parsers, tried in order. Only the test parser for now: the real
 * Doctolib formats are added once real anonymised samples are available.
 */
export const PARSERS: DoctolibParser[] = [testParser]

export type ParseOutcome =
  | { ok: true; parser: string; rdv: ParsedRdv }
  | { ok: false; reason: 'unrecognized' | 'incomplete' }

export function parseDoctolibMail(mail: MailInput, parsers = PARSERS): ParseOutcome {
  const parser = parsers.find((p) => p.canParse(mail))
  if (!parser) return { ok: false, reason: 'unrecognized' }
  const rdv = parser.parse(mail)
  return rdv ? { ok: true, parser: parser.id, rdv } : { ok: false, reason: 'incomplete' }
}
