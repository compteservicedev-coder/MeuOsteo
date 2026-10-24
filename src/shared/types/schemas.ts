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
