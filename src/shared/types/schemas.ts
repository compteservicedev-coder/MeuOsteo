import { z } from 'zod'
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '../domain/accessCode'

/** Runtime validation of IPC arguments: main never trusts what the renderer sends. */
export const pinSchema = z.string().regex(new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`))
/** Any short digit string: a wrong code is still a valid attempt. */
export const pinAttemptSchema = z.string().regex(/^\d{1,12}$/)

export const pinChangeInputSchema = z.object({
  current: z.string().max(12),
  next: z.string().max(12),
  confirm: z.string().max(12),
})

export const resetWithRecoveryKeyInputSchema = z.object({
  recoveryKey: z.string().max(64),
  next: z.string().max(12),
  confirm: z.string().max(12),
})

/** Mirrors `LOCK_AFTER_CHOICES`: 5, 15 or 30 minutes, or never (`null`). */
export const lockAfterSchema = z.union([z.literal(5), z.literal(15), z.literal(30), z.null()])

export const idSchema = z.string().min(1).max(40)

const text = (max: number) => z.string().max(max)

export const patientDraftSchema = z.object({
  nom: text(80),
  prenom: text(80),
  ddn: text(10),
  sexe: z.enum(['F', 'M']).nullable(),
  situation: z.enum(['celibataire', 'couple', 'pacse', 'marie', 'divorce', 'veuf']).nullable(),
  enfants: z.number().int().min(0).max(30).nullable(),
  profession: text(120),
  adresse: text(200),
  cp: text(10),
  commune: text(80),
  portable: text(20),
  fixe: text(20),
  email: text(120),
})

export const duplicateQuerySchema = z.object({
  nom: text(80),
  prenom: text(80),
  ddn: text(10),
  portable: text(20),
  fixe: text(20),
  email: text(120),
  excludeId: idSchema.optional(),
})

export const searchQuerySchema = text(100)
export const commentSchema = text(20_000)
export const tagsSchema = z.array(text(60)).max(30)
export const relationSchema = z.enum([
  'conjoint',
  'enfant',
  'parent',
  'fratrie',
  'grand_parent',
  'petit_enfant',
  'autre',
])

export const seanceChangesSchema = z
  .object({
    date: text(10),
    motif: text(200).nullable(),
    anamnese: text(20_000).nullable(),
    pratique: text(20_000).nullable(),
    tarifCents: z.number().int().min(0).max(1_000_000),
    paiement: z.enum(['especes', 'cheque', 'virement_attente', 'virement_recu']).nullable(),
  })
  .partial()

export const cancelReasonSchema = text(60)

// --- Invoicing (lot 3) ---------------------------------------------------------------------

export const unlockReasonSchema = z.enum([
  'Erreur de saisie',
  'Erreur de date',
  'Changement de tarif',
  'Autre',
])

export const issueOptionsSchema = z.object({ send: z.boolean() })

const cents = z.number().int().min(0).max(100_000)

export const invoiceSettingsInputSchema = z.object({
  cabinet: z.object({
    nom: text(80),
    titre: text(80),
    adresse: text(200),
    telephone: text(30),
    adeli: text(20),
    siret: text(20),
  }),
  tarifs: z.object({ list: z.array(cents).max(12), defaultCents: cents }),
  mentionTva: text(200),
  emailTemplate: z.object({ subject: text(200), body: text(2000) }),
})

export const numberingStartSchema = z.number().int().min(1).max(9999)

/** « Exporter la sélection »: rows of text cells, built by the renderer. */
export const csvRowsSchema = z.array(z.array(text(300)).max(20)).max(50_000)
export const fileNameSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[^\\/:*?"<>|]+$/)

export const gmailSettingsInputSchema = z.object({
  address: z.string().trim().max(120),
  password: z.string().max(64).nullable(),
  label: text(60),
  frequency: z.union([z.literal(5), z.literal(15), z.literal(0)]),
})
