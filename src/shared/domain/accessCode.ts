/**
 * R-21 · Code d'accès — pure rules shared by main (enforcement) and renderer (forms).
 * Hashing lives in main/services/accessCode.ts: this module never sees a hash.
 */

export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 6
export const MAX_FAILED_ATTEMPTS = 5
export const LOCKOUT_MS = 30_000

export const RECOVERY_KEY_LENGTH = 24
/** Crockford base32: no I, L, O, U, so the printed key cannot be misread. */
export const RECOVERY_KEY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const LOCK_AFTER_CHOICES = [5, 15, 30, null] as const
export type LockAfterMinutes = (typeof LOCK_AFTER_CHOICES)[number]
export const DEFAULT_LOCK_AFTER: LockAfterMinutes = 15

const PIN_PATTERN = new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`)

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin)
}

export type PinChangeError =
  'current_invalid_format' | 'next_invalid_format' | 'same_as_current' | 'confirm_mismatch'

export interface PinChangeInput {
  current: string
  next: string
  confirm: string
}

/**
 * Checks a code change before it reaches the hash: the current code is required, the new one must
 * have 4 to 6 digits, differ from the current one and match its confirmation. Whether `current`
 * matches the stored hash is checked by main.
 */
export function validatePinChange({ current, next, confirm }: PinChangeInput): PinChangeError[] {
  const errors: PinChangeError[] = []
  if (!isValidPin(current)) errors.push('current_invalid_format')
  if (!isValidPin(next)) errors.push('next_invalid_format')
  else if (next === current) errors.push('same_as_current')
  if (isValidPin(next) && confirm !== next) errors.push('confirm_mismatch')
  return errors
}

export const PIN_CHANGE_MESSAGES: Record<PinChangeError | 'current_wrong', string> = {
  current_invalid_format: 'Saisissez votre code actuel',
  current_wrong: 'Code actuel incorrect',
  next_invalid_format: 'Le nouveau code doit faire 4 à 6 chiffres',
  same_as_current: 'Le nouveau code doit être différent de l’actuel',
  confirm_mismatch: 'La confirmation ne correspond pas',
}

/**
 * Builds a recovery key from random bytes (one byte per character). 256 is a multiple of the
 * 32-letter alphabet, so `byte % 32` keeps every character equally likely.
 */
export function recoveryKeyFromBytes(bytes: Uint8Array): string {
  if (bytes.length < RECOVERY_KEY_LENGTH) {
    throw new RangeError(`A recovery key needs ${RECOVERY_KEY_LENGTH} random bytes`)
  }
  let key = ''
  for (let i = 0; i < RECOVERY_KEY_LENGTH; i++) {
    key += RECOVERY_KEY_ALPHABET[bytes[i]! % RECOVERY_KEY_ALPHABET.length]
  }
  return key
}

/** Displays the key in groups of four: `ABCD-EFGH-…`. */
export function formatRecoveryKey(key: string): string {
  return (key.match(/.{1,4}/g) ?? []).join('-')
}

/**
 * Reads a key typed by the user: case, spaces and dashes are ignored, and the letters that
 * Crockford base32 excludes are read as the digits they look like (O → 0, I and L → 1).
 */
export function normalizeRecoveryKey(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
}

export function isValidRecoveryKey(normalized: string): boolean {
  if (normalized.length !== RECOVERY_KEY_LENGTH) return false
  return [...normalized].every((c) => RECOVERY_KEY_ALPHABET.includes(c))
}

/** Failed attempts, counted across the PIN pad and the recovery key form. */
export interface AttemptState {
  failures: number
  lockedUntil: number | null
}

export const INITIAL_ATTEMPTS: AttemptState = { failures: 0, lockedUntil: null }

export function lockoutRemainingMs(state: AttemptState, now: number): number {
  return state.lockedUntil === null ? 0 : Math.max(0, state.lockedUntil - now)
}

/**
 * After 5 errors, the next attempt is possible 30 s later and the count starts again.
 * Callers must refuse attempts while `lockoutRemainingMs` is positive.
 */
export function registerFailure(state: AttemptState, now: number): AttemptState {
  const failures = state.failures + 1
  if (failures >= MAX_FAILED_ATTEMPTS) return { failures: 0, lockedUntil: now + LOCKOUT_MS }
  return { failures, lockedUntil: null }
}

export function attemptsLeft(state: AttemptState): number {
  return MAX_FAILED_ATTEMPTS - state.failures
}
