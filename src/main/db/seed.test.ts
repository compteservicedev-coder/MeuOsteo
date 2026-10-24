import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createTestDatabase } from '../test/db'
import { parseCommunesCsv } from './communes'
import { countToReconcile } from './repositories/summaryRepository'
import { patientLinks, patients, seances } from './schema'
import { clearBusinessData, seedDatabase } from './seed'
import { seedDuplicates } from './seedDuplicates'
import { countDuplicatePairs } from './repositories/duplicateRepository'

const communes = parseCommunesCsv(
  readFileSync(resolve(__dirname, '../../../resources/communes.csv'), 'utf8'),
)

describe('npm run seed (données fictives)', () => {
  it('génère 200 patients et 600 séances qui respectent les contraintes du schéma', () => {
    const db = createTestDatabase()
    const report = seedDatabase(db, { patients: 200, seances: 600, today: '2026-10-24', communes })
    expect(report).toMatchObject({ patients: 200, seances: 600 })
    expect(
      db
        .select({ n: sql<number>`count(*)` })
        .from(patients)
        .get()?.n,
    ).toBe(200)
    expect(
      db
        .select({ n: sql<number>`count(*)` })
        .from(seances)
        .get()?.n,
    ).toBe(600)
    expect(countToReconcile(db)).toBe(2)

    const all = db.select().from(patients).all()
    expect(new Set(all.map((p) => p.shortNo)).size).toBe(200)
    for (const p of all) {
      expect(p.searchKey).toMatch(/^[a-z0-9 ]+$/)
      if (p.portable) expect(p.portable).toMatch(/^0[67]\d{8}$/)
      if (p.email) expect(p.email).toMatch(/@(exemple\.fr|example\.com|example\.org)$/)
    }
    for (const link of db.select().from(patientLinks).all()) {
      expect(link.patientA < link.patientB).toBe(true)
    }
  })

  it('est reproductible et peut repartir d’une base vide', () => {
    const db = createTestDatabase()
    const options = { patients: 20, seances: 50, today: '2026-10-24', communes }
    seedDatabase(db, options)
    const first = db.select({ nom: patients.nom }).from(patients).all()
    clearBusinessData(db)
    expect(
      db
        .select({ n: sql<number>`count(*)` })
        .from(patients)
        .get()?.n,
    ).toBe(0)
    seedDatabase(db, options)
    expect(db.select({ nom: patients.nom }).from(patients).all()).toEqual(first)
  })
})

describe('npm run seed · doublons fictifs (R-19)', () => {
  it('R-19 ajoute des paires visibles dans « À rapprocher »', () => {
    const db = createTestDatabase()
    seedDatabase(db, { patients: 40, seances: 60, today: '2026-10-24', communes })
    const before = countDuplicatePairs(db)
    expect(seedDuplicates(db)).toBe(2)
    expect(countDuplicatePairs(db)).toBe(before + 2)
  })
})
