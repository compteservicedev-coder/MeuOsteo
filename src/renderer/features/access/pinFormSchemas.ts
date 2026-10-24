import { z } from 'zod'
import { PIN_CHANGE_MESSAGES, isValidPin } from '@shared/domain/accessCode'

/** « Nouveau code » + « Confirmation », shared by the code forms. */
export const newCodeFields = {
  next: z.string().refine(isValidPin, PIN_CHANGE_MESSAGES.next_invalid_format),
  confirm: z.string(),
}

export const newCodeSchema = z.object(newCodeFields).refine((v) => v.next === v.confirm, {
  path: ['confirm'],
  message: PIN_CHANGE_MESSAGES.confirm_mismatch,
})

/** « Modifier le code… » (Paramètres > Sécurité), same messages as the mock-up. */
export const changeCodeSchema = z
  .object({
    current: z.string().refine(isValidPin, PIN_CHANGE_MESSAGES.current_invalid_format),
    ...newCodeFields,
  })
  .refine((v) => !isValidPin(v.next) || v.next !== v.current, {
    path: ['next'],
    message: PIN_CHANGE_MESSAGES.same_as_current,
  })
  .refine((v) => v.next === v.confirm, {
    path: ['confirm'],
    message: PIN_CHANGE_MESSAGES.confirm_mismatch,
  })

export const currentCodeSchema = z.object({
  current: z.string().refine(isValidPin, PIN_CHANGE_MESSAGES.current_invalid_format),
})
