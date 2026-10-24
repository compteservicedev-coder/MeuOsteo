import { beforeEach, describe, expect, it } from 'vitest'
import { journal, settings } from '../db/schema'
import { addJournalLine } from '../db/repositories/journalRepository'
import { createTestDatabase } from '../test/db'
import type { AppDatabase } from '../db/client'
import {
  AccessCodeService,
  DEFAULT_SCRYPT,
  hashSecret,
  verifySecret,
  type ScryptParams,
} from './accessCode'
import { createSecurityStore } from './securityStore'

/** Cheap parameters keep the suite fast; production parameters are checked separately. */
const FAST_SCRYPT: ScryptParams = { N: 2 ** 10, r: 8, p: 1, keyLength: 32 }

let db: AppDatabase
let clock: number

function createService() {
  return new AccessCodeService({
    store: createSecurityStore(db),
    journal: (line) => addJournalLine(db, line),
    now: () => clock,
    scryptParams: FAST_SCRYPT,
  })
}

function journalActions() {
  return db
    .select()
    .from(journal)
    .all()
    .map((l) => `${l.type} · ${l.subject} · ${l.action}`)
}

function storedSettings(): string {
  return db
    .select()
    .from(settings)
    .all()
    .map((r) => r.value)
    .join('\n')
}

beforeEach(() => {
  db = createTestDatabase()
  clock = 1_700_000_000_000
})

describe('R-21 · hachage du code', () => {
  it('R-21 le code est stocké en hash scrypt avec sel, jamais en clair', async () => {
    const service = createService()
    const result = await service.enable('482915')
    expect(result.ok).toBe(true)
    const raw = storedSettings()
    expect(raw).not.toContain('482915')
    const security = JSON.parse(raw) as { pin: { algo: string; salt: string; hash: string } }
    expect(security.pin.algo).toBe('scrypt')
    expect(Buffer.from(security.pin.salt, 'base64')).toHaveLength(16)
    expect(Buffer.from(security.pin.hash, 'base64')).toHaveLength(32)
    if (result.ok) expect(raw).not.toContain(result.recoveryKey)
  })

  it('R-21 deux hachages du même code diffèrent grâce au sel', async () => {
    const a = await hashSecret('1234', FAST_SCRYPT)
    const b = await hashSecret('1234', FAST_SCRYPT)
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
    expect(await verifySecret('1234', a)).toBe(true)
    expect(await verifySecret('1234', b)).toBe(true)
    expect(await verifySecret('1235', a)).toBe(false)
  })

  it('R-21 les paramètres scrypt de production sont ceux enregistrés avec le hash', async () => {
    const stored = await hashSecret('1234')
    expect(stored).toMatchObject({ algo: 'scrypt', ...DEFAULT_SCRYPT })
    expect(DEFAULT_SCRYPT.N).toBeGreaterThanOrEqual(2 ** 15)
    expect(await verifySecret('1234', stored)).toBe(true)
  })
})

describe('R-21 · activation, déverrouillage et verrouillage', () => {
  it('R-21 sans code, l’interface n’est jamais verrouillée', () => {
    const service = createService()
    expect(service.getStatus()).toMatchObject({ enabled: false, locked: false, setupDone: false })
    expect(service.lock().locked).toBe(false)
  })

  it('R-21 l’activation refuse un code hors format et donne une clé de secours de 24 caractères', async () => {
    const service = createService()
    expect(await service.enable('12')).toEqual({ ok: false, reason: 'invalid_format' })
    const result = await service.enable('2580')
    expect(result.ok && result.recoveryKey).toMatch(/^[0-9A-HJKMNP-TV-Z]{24}$/)
    expect(await service.enable('1111')).toEqual({ ok: false, reason: 'already_enabled' })
    expect(service.getStatus()).toMatchObject({ enabled: true, pinLength: 4, setupDone: true })
    expect(journalActions()).toEqual(['reglage · Réglages · Code d’accès activé'])
  })

  it('R-21 l’interface démarre verrouillée quand un code existe, et se déverrouille avec le bon code', async () => {
    await createService().enable('2580')
    const service = createService()
    expect(service.isLocked()).toBe(true)
    expect(await service.unlock('0000')).toEqual({
      ok: false,
      reason: 'wrong_code',
      attemptsLeft: 4,
    })
    expect(service.isLocked()).toBe(true)
    expect(await service.unlock('2580')).toEqual({ ok: true })
    expect(service.isLocked()).toBe(false)
    expect(service.lock().locked).toBe(true)
  })

  it('R-21 après 5 erreurs, attente de 30 s, même avec le bon code', async () => {
    await createService().enable('2580')
    const service = createService()
    for (let i = 0; i < 4; i++) await service.unlock('0000')
    expect(await service.unlock('0000')).toEqual({
      ok: false,
      reason: 'locked_out',
      retryInMs: 30_000,
    })
    clock += 10_000
    expect(await service.unlock('2580')).toEqual({
      ok: false,
      reason: 'locked_out',
      retryInMs: 20_000,
    })
    expect(service.getStatus().lockoutRemainingMs).toBe(20_000)
    clock += 20_000
    expect(await service.unlock('2580')).toEqual({ ok: true })
  })
})

describe('R-21 · modification du code', () => {
  it('R-21 la modification demande le code actuel', async () => {
    const service = createService()
    await service.enable('2580')
    expect(await service.changeCode({ current: '1111', next: '4321', confirm: '4321' })).toEqual({
      ok: false,
      reason: 'wrong_code',
      attemptsLeft: 4,
    })
    expect(
      await service.changeCode({ current: '2580', next: '654321', confirm: '654321' }),
    ).toEqual({ ok: true })
    expect(service.getStatus().pinLength).toBe(6)
    service.lock()
    expect((await service.unlock('2580')).ok).toBe(false)
    expect(await service.unlock('654321')).toEqual({ ok: true })
    expect(journalActions()).toContain('reglage · Réglages · Code d’accès modifié')
  })

  it('R-21 le nouveau code doit être différent de l’ancien', async () => {
    const service = createService()
    await service.enable('2580')
    expect(await service.changeCode({ current: '2580', next: '2580', confirm: '2580' })).toEqual({
      ok: false,
      reason: 'invalid_input',
      errors: ['same_as_current'],
    })
  })

  it('R-21 la désactivation demande le code actuel et efface les hachages', async () => {
    const service = createService()
    await service.enable('2580')
    expect((await service.disable('0000')).ok).toBe(false)
    expect(await service.disable('2580')).toEqual({ ok: true })
    expect(service.getStatus()).toMatchObject({ enabled: false, pinLength: null, locked: false })
    expect(JSON.parse(storedSettings())).toMatchObject({ pin: null, recovery: null })
    expect(journalActions()).toEqual([
      'reglage · Réglages · Code d’accès activé',
      'reglage · Réglages · Code d’accès désactivé',
    ])
  })
})

describe('R-21 · clé de secours', () => {
  it('R-21 la clé de secours réinitialise le code et déverrouille', async () => {
    const enabled = await createService().enable('2580')
    if (!enabled.ok) throw new Error('enable failed')
    const service = createService()
    const typed = enabled.recoveryKey.toLowerCase().replace(/(.{4})/g, '$1 ')
    expect(
      await service.resetWithRecoveryKey({ recoveryKey: typed, next: '1357', confirm: '1357' }),
    ).toEqual({ ok: true })
    expect(service.isLocked()).toBe(false)
    service.lock()
    expect(await service.unlock('1357')).toEqual({ ok: true })
    expect(journalActions()).toContain(
      'reglage · Réglages · Code d’accès modifié avec la clé de secours',
    )
  })

  it('R-21 une mauvaise clé de secours compte comme une erreur', async () => {
    await createService().enable('2580')
    const service = createService()
    const wrong = { recoveryKey: '0'.repeat(24), next: '1357', confirm: '1357' }
    expect(await service.resetWithRecoveryKey(wrong)).toEqual({
      ok: false,
      reason: 'wrong_code',
      attemptsLeft: 4,
    })
    expect(await service.resetWithRecoveryKey({ ...wrong, recoveryKey: 'trop-court' })).toEqual({
      ok: false,
      reason: 'invalid_input',
    })
    expect(service.isLocked()).toBe(true)
  })

  it('R-21 une nouvelle clé de secours remplace l’ancienne', async () => {
    const service = createService()
    const first = await service.enable('2580')
    const second = await service.regenerateRecoveryKey('2580')
    if (!first.ok || !second.ok) throw new Error('setup failed')
    expect(second.recoveryKey).not.toBe(first.recoveryKey)
    service.lock()
    const reset = (recoveryKey: string) =>
      service.resetWithRecoveryKey({ recoveryKey, next: '9753', confirm: '9753' })
    expect((await reset(first.recoveryKey)).ok).toBe(false)
    expect((await reset(second.recoveryKey)).ok).toBe(true)
  })
})

describe('R-21 · premier lancement et délai de verrouillage', () => {
  it('R-21 « Plus tard » termine le premier lancement sans code', () => {
    const service = createService()
    expect(service.skipSetup()).toMatchObject({ setupDone: true, enabled: false, locked: false })
    expect(journalActions()).toEqual([])
  })

  it('R-21 le délai de verrouillage est réglable (5 / 15 / 30 min / jamais)', () => {
    const service = createService()
    expect(service.getStatus().lockAfterMinutes).toBe(15)
    expect(service.setLockAfter(5).lockAfterMinutes).toBe(5)
    expect(service.setLockAfter(null).lockAfterMinutes).toBeNull()
    expect(createService().getStatus().lockAfterMinutes).toBeNull()
  })
})
