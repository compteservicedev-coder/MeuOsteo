import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createTestDatabase } from '../test/db'
import { ensureCommunesLoaded, parseCommunesCsv } from './communes'
import { communes } from './schema'

const CSV_PATH = resolve(__dirname, '../../../resources/communes.csv')

describe('communes (resources/communes.csv)', () => {
  it('lit le fichier séparé par des points-virgules, avec retours Windows', () => {
    expect(
      parseCommunesCsv('commune;code_postal\r\nVINCENNES;94300\r\nBOURG EN BRESSE;1000\r\n\r\n'),
    ).toEqual([
      { commune: 'VINCENNES', codePostal: '94300' },
      { commune: 'BOURG EN BRESSE', codePostal: '01000' },
    ])
  })

  it('charge les 35 576 couples au premier lancement, une seule fois', () => {
    const db = createTestDatabase()
    const read = () => readFileSync(CSV_PATH, 'utf8')
    expect(ensureCommunesLoaded(db, read)).toBe(35_576)
    expect(ensureCommunesLoaded(db, read)).toBe(0)
    const vincennes = db.select().from(communes).where(eq(communes.codePostal, '94300')).all()
    expect(vincennes.map((c) => c.commune)).toContain('VINCENNES')
  })
})
