import { z } from 'zod'
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
