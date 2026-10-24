/**
 * R-21 · Code d'accès: hashing (scrypt + salt), checks and interface lock state.
 *
 * The code only protects the interface: the database key is protected by `safeStorage` and does
 * not depend on it. While the interface is locked, data IPC handlers refuse to answer.
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { z } from 'zod'
import {
  DEFAULT_LOCK_AFTER,
  INITIAL_ATTEMPTS,
  attemptsLeft,
  isValidPin,
  isValidRecoveryKey,
  lockoutRemainingMs,
  normalizeRecoveryKey,
  recoveryKeyFromBytes,
  registerFailure,
  validatePinChange,
  type AttemptState,
  type LockAfterMinutes,
  type PinChangeInput,
} from '@shared/domain/accessCode'
import { SETTINGS_SUBJECT, type JournalLine } from '@shared/domain/journal'
import { lockAfterSchema } from '@shared/types/schemas'
import type {
  AttemptFailure,
  ChangeCodeResult,
  DisableCodeResult,
  EnableCodeResult,
  RegenerateRecoveryKeyResult,
  ResetWithRecoveryKeyInput,
  ResetWithRecoveryKeyResult,
  SecurityStatus,
  UnlockResult,
} from '@shared/types/security'

export interface ScryptParams {
  N: number
  r: number
  p: number
  keyLength: number
}

/** ~50 ms per hash on a laptop; 32 MiB of memory. */
export const DEFAULT_SCRYPT: ScryptParams = { N: 2 ** 15, r: 8, p: 1, keyLength: 32 }

const storedSecretSchema = z.object({
  algo: z.literal('scrypt'),
  N: z.number().int().positive(),
  r: z.number().int().positive(),
  p: z.number().int().positive(),
  keyLength: z.number().int().positive(),
  salt: z.string(),
  hash: z.string(),
})
export type StoredSecret = z.infer<typeof storedSecretSchema>

export const securitySettingsSchema = z.object({
  enabled: z.boolean(),
  setupDone: z.boolean(),
  lockAfterMinutes: lockAfterSchema,
  pin: storedSecretSchema.nullable(),
  pinLength: z.number().int().min(4).max(6).nullable(),
  recovery: storedSecretSchema.nullable(),
})
export type SecuritySettings = z.infer<typeof securitySettingsSchema>

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  enabled: false,
  setupDone: false,
  lockAfterMinutes: DEFAULT_LOCK_AFTER,
  pin: null,
  pinLength: null,
  recovery: null,
}

function scryptAsync(secret: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const options: ScryptOptions = {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: 128 * params.N * params.r * 2,
  }
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, params.keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    )
  })
}

export async function hashSecret(secret: string, params = DEFAULT_SCRYPT): Promise<StoredSecret> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(secret, salt, params)
  return { algo: 'scrypt', ...params, salt: salt.toString('base64'), hash: hash.toString('base64') }
}

export async function verifySecret(secret: string, stored: StoredSecret): Promise<boolean> {
  const expected = Buffer.from(stored.hash, 'base64')
  const actual = await scryptAsync(secret, Buffer.from(stored.salt, 'base64'), stored)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export interface SecurityStore {
  load(): SecuritySettings
  save(settings: SecuritySettings): void
}

export interface AccessCodeDeps {
  store: SecurityStore
  journal: (line: JournalLine) => void
  now?: () => number
  random?: (size: number) => Uint8Array
  scryptParams?: ScryptParams
}

const settingsLine = (action: string): JournalLine => ({
  type: 'reglage',
  subject: SETTINGS_SUBJECT,
  action,
})

export class AccessCodeService {
  private attempts: AttemptState = INITIAL_ATTEMPTS
  private locked: boolean
  private readonly now: () => number
  private readonly random: (size: number) => Uint8Array
  private readonly params: ScryptParams

  constructor(private readonly deps: AccessCodeDeps) {
    this.now = deps.now ?? Date.now
    this.random = deps.random ?? ((size) => randomBytes(size))
    this.params = deps.scryptParams ?? DEFAULT_SCRYPT
    // The interface starts locked whenever a code is set.
    this.locked = this.settings().enabled
  }

  private settings(): SecuritySettings {
    return this.deps.store.load()
  }

  isLocked(): boolean {
    return this.locked
  }

  getStatus(): SecurityStatus {
    const s = this.settings()
    return {
      enabled: s.enabled,
      pinLength: s.enabled ? s.pinLength : null,
      lockAfterMinutes: s.lockAfterMinutes,
      setupDone: s.setupDone,
      locked: this.locked,
      lockoutRemainingMs: lockoutRemainingMs(this.attempts, this.now()),
    }
  }

  /** Locks the interface (inactivity, system sleep). No effect when no code is set. */
  lock(): SecurityStatus {
    if (this.settings().enabled) this.locked = true
    return this.getStatus()
  }

  unlock(pin: string): Promise<UnlockResult> {
    return this.checkCode(pin, () => {
      this.locked = false
    })
  }

  /** Creates the code (first launch or Paramètres) and returns the recovery key, shown once. */
  async enable(pin: string): Promise<EnableCodeResult> {
    const s = this.settings()
    if (s.enabled) return { ok: false, reason: 'already_enabled' }
    if (!isValidPin(pin)) return { ok: false, reason: 'invalid_format' }
    const recoveryKey = recoveryKeyFromBytes(this.random(24))
    this.deps.store.save({
      ...s,
      enabled: true,
      setupDone: true,
      pin: await hashSecret(pin, this.params),
      pinLength: pin.length,
      recovery: await hashSecret(recoveryKey, this.params),
    })
    this.locked = false
    this.deps.journal(settingsLine('Code d’accès activé'))
    return { ok: true, recoveryKey }
  }

  disable(currentPin: string): Promise<DisableCodeResult> {
    if (!this.settings().enabled) return Promise.resolve({ ok: false, reason: 'not_enabled' })
    return this.checkCode(currentPin, () => {
      const s = this.settings()
      this.deps.store.save({ ...s, enabled: false, pin: null, pinLength: null, recovery: null })
      this.locked = false
      this.deps.journal(settingsLine('Code d’accès désactivé'))
    })
  }

  async changeCode(input: PinChangeInput): Promise<ChangeCodeResult> {
    if (!this.settings().enabled) return { ok: false, reason: 'not_enabled' }
    const errors = validatePinChange(input)
    if (errors.length > 0) return { ok: false, reason: 'invalid_input', errors }
    return this.checkCode(input.current, async () => {
      const s = this.settings()
      this.deps.store.save({
        ...s,
        pin: await hashSecret(input.next, this.params),
        pinLength: input.next.length,
      })
      this.deps.journal(settingsLine('Code d’accès modifié'))
    })
  }

  /** « Code oublié » : the recovery key sets a new code and unlocks the interface. */
  async resetWithRecoveryKey(
    input: ResetWithRecoveryKeyInput,
  ): Promise<ResetWithRecoveryKeyResult> {
    const s = this.settings()
    if (!s.enabled || !s.recovery) return { ok: false, reason: 'not_enabled' }
    const key = normalizeRecoveryKey(input.recoveryKey)
    if (!isValidRecoveryKey(key) || !isValidPin(input.next) || input.next !== input.confirm) {
      return { ok: false, reason: 'invalid_input' }
    }
    const blocked = this.lockoutFailure()
    if (blocked) return blocked
    if (!(await verifySecret(key, s.recovery))) return this.failure()
    this.attempts = INITIAL_ATTEMPTS
    this.deps.store.save({
      ...this.settings(),
      pin: await hashSecret(input.next, this.params),
      pinLength: input.next.length,
    })
    this.locked = false
    this.deps.journal(settingsLine('Code d’accès modifié avec la clé de secours'))
    return { ok: true }
  }

  async regenerateRecoveryKey(currentPin: string): Promise<RegenerateRecoveryKeyResult> {
    if (!this.settings().enabled) return { ok: false, reason: 'not_enabled' }
    let recoveryKey = ''
    const result = await this.checkCode(currentPin, async () => {
      recoveryKey = recoveryKeyFromBytes(this.random(24))
      this.deps.store.save({
        ...this.settings(),
        recovery: await hashSecret(recoveryKey, this.params),
      })
    })
    return result.ok ? { ok: true, recoveryKey } : result
  }

  setLockAfter(minutes: LockAfterMinutes): SecurityStatus {
    this.deps.store.save({ ...this.settings(), lockAfterMinutes: minutes })
    return this.getStatus()
  }

  /** « Plus tard » on first launch: no code for now, it can be enabled in Paramètres. */
  skipSetup(): SecurityStatus {
    this.deps.store.save({ ...this.settings(), setupDone: true })
    return this.getStatus()
  }

  private lockoutFailure(): AttemptFailure | null {
    const retryInMs = lockoutRemainingMs(this.attempts, this.now())
    return retryInMs > 0 ? { ok: false, reason: 'locked_out', retryInMs } : null
  }

  private failure(): AttemptFailure {
    this.attempts = registerFailure(this.attempts, this.now())
    const retryInMs = lockoutRemainingMs(this.attempts, this.now())
    if (retryInMs > 0) return { ok: false, reason: 'locked_out', retryInMs }
    return { ok: false, reason: 'wrong_code', attemptsLeft: attemptsLeft(this.attempts) }
  }

  /** Verifies the current code (with the 5 errors / 30 s rule), then runs `onSuccess`. */
  private async checkCode(
    pin: string,
    onSuccess: () => void | Promise<void>,
  ): Promise<{ ok: true } | AttemptFailure> {
    const blocked = this.lockoutFailure()
    if (blocked) return blocked
    const stored = this.settings().pin
    if (!stored || !(await verifySecret(pin, stored))) return this.failure()
    this.attempts = INITIAL_ATTEMPTS
    await onSuccess()
    return { ok: true }
  }
}
