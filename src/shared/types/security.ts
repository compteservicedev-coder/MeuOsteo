import type { LockAfterMinutes, PinChangeError } from '../domain/accessCode'

export interface SecurityStatus {
  /** The access code is asked at start-up and after inactivity. */
  enabled: boolean
  /** Number of digits of the current code: the PIN pad shows as many dots. */
  pinLength: number | null
  lockAfterMinutes: LockAfterMinutes
  /** The first-launch choice (create a code, or « Plus tard ») has been made. */
  setupDone: boolean
  /** The interface is locked: data requests are refused until `unlock`. */
  locked: boolean
  lockoutRemainingMs: number
}

/** Shape shared by every call that checks a code or the recovery key. */
export type AttemptFailure =
  | { ok: false; reason: 'wrong_code'; attemptsLeft: number }
  | { ok: false; reason: 'locked_out'; retryInMs: number }

export type UnlockResult = { ok: true } | AttemptFailure

export type EnableCodeResult =
  { ok: true; recoveryKey: string } | { ok: false; reason: 'invalid_format' | 'already_enabled' }

export type DisableCodeResult = { ok: true } | AttemptFailure | { ok: false; reason: 'not_enabled' }

export type ChangeCodeResult =
  | { ok: true }
  | AttemptFailure
  | { ok: false; reason: 'invalid_input'; errors: PinChangeError[] }
  | { ok: false; reason: 'not_enabled' }

export interface ResetWithRecoveryKeyInput {
  recoveryKey: string
  next: string
  confirm: string
}

export type ResetWithRecoveryKeyResult =
  { ok: true } | AttemptFailure | { ok: false; reason: 'invalid_input' | 'not_enabled' }

export type RegenerateRecoveryKeyResult =
  { ok: true; recoveryKey: string } | AttemptFailure | { ok: false; reason: 'not_enabled' }
