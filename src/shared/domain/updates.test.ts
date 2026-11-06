import { describe, expect, it } from 'vitest'
import { RELEASES_URL, isCheckDue, isNewerVersion, isOwnReleaseUrl, parseVersion } from './updates'

describe('R-28 · nouvelle version', () => {
  it('R-28 compare les numéros de version', () => {
    expect(isNewerVersion('v0.3.0', '0.2.0')).toBe(true)
    expect(isNewerVersion('0.2.1', '0.2.0')).toBe(true)
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true)
    expect(isNewerVersion('0.10.0', '0.9.0')).toBe(true)
    expect(isNewerVersion('v0.2.0', '0.2.0')).toBe(false)
    expect(isNewerVersion('0.1.9', '0.2.0')).toBe(false)
    expect(isNewerVersion('v1.0.0-beta.1', '0.2.0')).toBe(false)
    expect(isNewerVersion('n’importe quoi', '0.2.0')).toBe(false)
    expect(parseVersion(' v12.3.45 ')).toEqual([12, 3, 45])
  })

  it('R-28 n’ouvre que les pages de version du projet', () => {
    expect(isOwnReleaseUrl(`${RELEASES_URL}/tag/v0.3.0`)).toBe(true)
    expect(isOwnReleaseUrl(RELEASES_URL)).toBe(true)
    expect(isOwnReleaseUrl('https://exemple.fr/releases/tag/v0.3.0')).toBe(false)
    expect(isOwnReleaseUrl(`${RELEASES_URL}.evil.example/x`)).toBe(false)
  })

  it('R-28 vérifie au plus une fois par jour', () => {
    const now = new Date('2026-11-06T12:00:00Z')
    expect(isCheckDue(null, now)).toBe(true)
    expect(isCheckDue('2026-11-06T08:00:00Z', now)).toBe(false)
    expect(isCheckDue('2026-11-05T11:59:00Z', now)).toBe(true)
    expect(isCheckDue('pas une date', now)).toBe(true)
  })
})
