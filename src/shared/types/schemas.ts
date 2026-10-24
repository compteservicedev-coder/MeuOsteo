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
