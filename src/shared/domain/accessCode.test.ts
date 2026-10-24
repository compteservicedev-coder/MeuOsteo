import { describe, expect, it } from 'vitest'
import {
  INITIAL_ATTEMPTS,
  LOCKOUT_MS,
  RECOVERY_KEY_ALPHABET,
  attemptsLeft,
  formatRecoveryKey,
  isValidPin,
  isValidRecoveryKey,
  lockoutRemainingMs,
  normalizeRecoveryKey,
  recoveryKeyFromBytes,
  registerFailure,
  validatePinChange,
  type AttemptState,
} from './accessCode'

describe('R-21 · code d’accès (règles pures)', () => {
  it('R-21 accepte un code de 4 à 6 chiffres', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('12345')).toBe(true)
    expect(isValidPin('123456')).toBe(true)
  })

  it('R-21 refuse un code trop court, trop long ou non numérique', () => {
    for (const pin of ['', '123', '1234567', '12a4', ' 1234', '12 34', '１２３４']) {
      expect(isValidPin(pin), pin).toBe(false)
    }
  })

  it('R-21 la modification demande le code actuel', () => {
    expect(validatePinChange({ current: '', next: '5678', confirm: '5678' })).toEqual([
      'current_invalid_format',
    ])
  })

  it('R-21 le nouveau code doit être différent de l’ancien', () => {
    expect(validatePinChange({ current: '1234', next: '1234', confirm: '1234' })).toEqual([
      'same_as_current',
    ])
  })

  it('R-21 le nouveau code fait 4 à 6 chiffres et doit être confirmé', () => {
    expect(validatePinChange({ current: '1234', next: '12', confirm: '12' })).toEqual([
      'next_invalid_format',
    ])
    expect(validatePinChange({ current: '1234', next: '5678', confirm: '5679' })).toEqual([
      'confirm_mismatch',
    ])
    expect(validatePinChange({ current: '1234', next: '567890', confirm: '567890' })).toEqual([])
  })

  it('R-21 clé de secours de 24 caractères sans caractère ambigu', () => {
    const bytes = Uint8Array.from({ length: 24 }, (_, i) => i * 37)
    const key = recoveryKeyFromBytes(bytes)
    expect(key).toHaveLength(24)
    expect([...key].every((c) => RECOVERY_KEY_ALPHABET.includes(c))).toBe(true)
    expect(key).not.toMatch(/[ILOU]/)
    expect(() => recoveryKeyFromBytes(new Uint8Array(10))).toThrow(RangeError)
  })

  it('R-21 la clé de secours se lit par groupes de 4 et se ressaisit sans tirets ni casse', () => {
    const key = 'ABCD0123EFGH4567JKMN89PQ'
    const printed = formatRecoveryKey(key)
    expect(printed).toBe('ABCD-0123-EFGH-4567-JKMN-89PQ')
    expect(normalizeRecoveryKey(printed.toLowerCase())).toBe(key)
    expect(normalizeRecoveryKey(' abcd o123 efgh 4567 jkmn 89pq ')).toBe(key)
    expect(normalizeRecoveryKey('ABCDOI23')).toBe('ABCD0123')
    expect(isValidRecoveryKey(key)).toBe(true)
    expect(isValidRecoveryKey(key.slice(1))).toBe(false)
    expect(isValidRecoveryKey(`${key.slice(1)}U`)).toBe(false)
  })

  it('R-21 après 5 erreurs, attente de 30 s', () => {
    let state: AttemptState = INITIAL_ATTEMPTS
    const t0 = 1_000_000
    for (let i = 1; i <= 4; i++) {
      state = registerFailure(state, t0)
      expect(lockoutRemainingMs(state, t0)).toBe(0)
      expect(attemptsLeft(state)).toBe(5 - i)
    }
    state = registerFailure(state, t0)
    expect(lockoutRemainingMs(state, t0)).toBe(LOCKOUT_MS)
    expect(lockoutRemainingMs(state, t0 + 29_999)).toBe(1)
    expect(lockoutRemainingMs(state, t0 + 30_000)).toBe(0)
    // The count starts again after the wait.
    expect(attemptsLeft(state)).toBe(5)
  })
})
