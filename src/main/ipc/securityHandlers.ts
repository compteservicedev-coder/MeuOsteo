import { z } from 'zod'
import {
  lockAfterSchema,
  pinAttemptSchema,
  pinChangeInputSchema,
  resetWithRecoveryKeyInputSchema,
} from '@shared/types/schemas'
import type { createRegistrar } from './register'

/** R-21: these calls are allowed while locked, except those that change the settings. */
export function registerSecurityHandlers(register: ReturnType<typeof createRegistrar>): void {
  const open = { requireUnlocked: false }

  register('security:get-status', z.tuple([]), ({ accessCode }) => accessCode.getStatus(), open)
  register('security:lock', z.tuple([]), ({ accessCode }) => accessCode.lock(), open)
  register(
    'security:unlock',
    z.tuple([pinAttemptSchema]),
    ({ accessCode }, pin) => accessCode.unlock(pin),
    open,
  )
  register(
    'security:reset-with-recovery-key',
    z.tuple([resetWithRecoveryKeyInputSchema]),
    ({ accessCode }, input) => accessCode.resetWithRecoveryKey(input),
    open,
  )

  register('security:enable', z.tuple([z.string().max(12)]), ({ accessCode }, pin) =>
    accessCode.enable(pin),
  )
  register('security:disable', z.tuple([pinAttemptSchema]), ({ accessCode }, pin) =>
    accessCode.disable(pin),
  )
  register('security:change-code', z.tuple([pinChangeInputSchema]), ({ accessCode }, input) =>
    accessCode.changeCode(input),
  )
  register('security:regenerate-recovery-key', z.tuple([pinAttemptSchema]), ({ accessCode }, pin) =>
    accessCode.regenerateRecoveryKey(pin),
  )
  register('security:set-lock-after', z.tuple([lockAfterSchema]), ({ accessCode }, minutes) =>
    accessCode.setLockAfter(minutes),
  )
  register('security:skip-setup', z.tuple([]), ({ accessCode }) => accessCode.skipSetup())
}
