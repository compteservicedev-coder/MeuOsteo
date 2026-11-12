import { beforeEach, describe, expect, it } from 'vitest'
import { RELEASES_URL } from '@shared/domain/updates'
import type { AppDatabase } from '../db/client'
import { createTestDatabase } from '../test/db'
import { UpdateChecker, type FetchLike } from './updateCheck'

let db: AppDatabase
let clock: Date
let calls: string[]
let answer: { status: number; body: unknown } | Error

const fetchStub: FetchLike = async (url) => {
  calls.push(url)
  if (answer instanceof Error) throw answer
  const { status, body } = answer
  return { ok: status < 300, status, json: async () => body }
}

const checker = (currentVersion = '0.2.0') =>
  new UpdateChecker({ db, currentVersion, fetch: fetchStub, now: () => clock })

beforeEach(() => {
  db = createTestDatabase()
  clock = new Date('2026-11-06T12:00:00Z')
  calls = []
  answer = {
    status: 200,
    body: { tag_name: 'v0.3.0', html_url: `${RELEASES_URL}/tag/v0.3.0` },
  }
})

describe('R-28 · nouvelle version', () => {
  it('R-28 signale une version plus récente publiée sur GitHub', async () => {
    const status = await checker().check()
    expect(status.available).toEqual({ version: '0.3.0', url: `${RELEASES_URL}/tag/v0.3.0` })
    expect(calls).toEqual([
      'https://api.github.com/repos/compteservicedev-coder/MeuOsteo/releases/latest',
    ])
  })

  it('R-28 ne signale rien quand la version installée est à jour', async () => {
    expect((await checker('0.3.0').check()).available).toBeNull()
  })

  it('R-28 interroge GitHub au plus une fois par jour', async () => {
    const c = checker()
    await c.check()
    await c.check()
    clock = new Date('2026-11-07T12:00:01Z')
    await c.check()
    expect(calls).toHaveLength(2)
    await c.check(true)
    expect(calls).toHaveLength(3)
  })

  it('R-28 ne contacte rien quand la vérification est désactivée', async () => {
    const c = checker()
    c.setEnabled(false)
    expect((await c.check(true)).available).toBeNull()
    expect(calls).toEqual([])
  })

  it('R-28 reste silencieux hors ligne et ignore une page qui n’est pas celle du projet', async () => {
    answer = new Error('offline')
    expect((await checker().check()).available).toBeNull()
    answer = { status: 200, body: { tag_name: 'v9.0.0', html_url: 'https://exemple.fr/piege' } }
    expect((await checker().check(true)).available).toBeNull()
    answer = { status: 404, body: {} }
    expect((await checker().check(true)).available).toBeNull()
  })
})
