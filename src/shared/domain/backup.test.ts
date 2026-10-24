import { describe, expect, it } from 'vitest'
import { isBackupRecent } from './backup'

describe('R-22 · alerte de sauvegarde', () => {
  const now = new Date('2026-10-24T10:00:00Z')
  it('R-22 alerte si aucune sauvegarde depuis 7 jours', () => {
    expect(isBackupRecent(null, now)).toBe(false)
    expect(isBackupRecent('2026-10-17T10:00:00Z', now)).toBe(false)
    expect(isBackupRecent('2026-10-17T10:00:01Z', now)).toBe(true)
    expect(isBackupRecent('2026-10-24T09:58:00Z', now)).toBe(true)
  })
})
