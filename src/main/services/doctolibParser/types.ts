import type { ParsedRdv } from '@shared/domain/matching'

/** What a parser sees of an e-mail (from mailparser): never logged, never stored. */
export interface MailInput {
  messageId: string
  /** Sender address, lower case. */
  from: string
  subject: string
  text: string
  html: string
  date: Date | null
}

/**
 * One parser per e-mail format (GMAIL_DOCTOLIB.md §3). `canParse` looks at the sender, the
 * subject and patterns of the body; `parse` returns `null` when a field is missing.
 */
export interface DoctolibParser {
  id: string
  canParse(mail: MailInput): boolean
  parse(mail: MailInput): ParsedRdv | null
}
