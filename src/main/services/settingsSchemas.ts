import { z } from 'zod'
import { DEFAULT_TITRE } from '@shared/domain/invoice'
import { DEFAULT_JOURNAL_RETENTION_MONTHS } from '@shared/domain/journal'
import { DEFAULT_TARIF_CENTS, DEFAULT_TARIFS_CENTS } from '@shared/domain/seance'

/** `tarifs` setting (DATA_MODEL.md): list in cents and default value. Edited in lot 3. */
export const tarifsSettingSchema = z.object({
  list: z.array(z.number().int().nonnegative()),
  defaultCents: z.number().int().nonnegative(),
})
export const DEFAULT_TARIFS_SETTING: z.infer<typeof tarifsSettingSchema> = {
  list: [...DEFAULT_TARIFS_CENTS],
  defaultCents: DEFAULT_TARIF_CENTS,
}

/** `journal_retention_months` setting (R-20), edited in lot 5. */
export const journalRetentionSchema = z.union([z.literal(12), z.literal(24), z.literal(36)])
export const DEFAULT_JOURNAL_RETENTION = DEFAULT_JOURNAL_RETENTION_MONTHS

/** `cabinet` setting (Paramètres > Cabinet & factures). `signature`: file name in userData. */
export const cabinetSettingSchema = z.object({
  nom: z.string(),
  titre: z.string(),
  adresse: z.string(),
  telephone: z.string(),
  adeli: z.string(),
  siret: z.string(),
  signature: z.string().nullable(),
})
export type CabinetSetting = z.infer<typeof cabinetSettingSchema>
export const DEFAULT_CABINET: CabinetSetting = {
  nom: '',
  titre: DEFAULT_TITRE,
  adresse: '',
  telephone: '',
  adeli: '',
  siret: '',
  signature: null,
}

export const mentionTvaSchema = z.string()

export const emailTemplateSchema = z.object({ subject: z.string(), body: z.string() })

/**
 * `invoice_start`: first sequence of a year when the numbering continues an existing one (other
 * tool, paper). Only settable while no invoice exists for that year (R-11).
 */
export const invoiceStartSchema = z.record(z.string(), z.number().int().positive())

/** `gmail` setting. The application password is encrypted by safeStorage (base64). */
export const gmailSettingSchema = z.object({
  address: z.string(),
  passwordEnc: z.string().nullable(),
  label: z.string(),
  frequency: z.union([z.literal(5), z.literal(15), z.literal(0)]),
  connected: z.boolean(),
  /** Last IMAP UID read, per mailbox UIDVALIDITY (lot 4). */
  lastUid: z.record(z.string(), z.number().int()),
})
export type GmailSetting = z.infer<typeof gmailSettingSchema>
export const DEFAULT_GMAIL: GmailSetting = {
  address: '',
  passwordEnc: null,
  label: 'Doctolib',
  frequency: 15,
  connected: false,
  lastUid: {},
}

/** `agenda` setting (Paramètres > Agenda, SPEC §8.4). */
export const agendaSettingSchema = z.object({
  days: z.array(z.enum(['L', 'Ma', 'Me', 'J', 'V', 'S', 'D'])),
  opening: z.string().regex(/^\d{2}:\d{2}$/),
  closing: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.union([z.literal(45), z.literal(60), z.literal(75)]),
  weeks: z.union([z.literal(1), z.literal(2)]),
  autoAttach: z.boolean(),
})

/** `dismissed_alerts`: « À rapprocher » alerts the practitioner has acknowledged. */
export const dismissedAlertsSchema = z.array(z.string())
