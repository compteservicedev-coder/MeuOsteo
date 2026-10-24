import { eq, sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import type { LegacyImportPlan } from '@shared/domain/legacyImport'
import { TRAP_EXPECTATIONS, buildFakeLegacyWorkbook } from '../../../scripts/fakeLegacyWorkbook'
import type { AppDatabase } from '../db/client'
import { getSetting } from '../db/repositories/settingsRepository'
import { journal, patients, seances } from '../db/schema'
import { createTestDatabase } from '../test/db'
import {
  DATES_TO_FIX_SETTING,
  analyzeLegacyFile,
  datesToFixSchema,
  runLegacyImport,
} from './legacyImport'

const TODAY = '2026-10-24'
const FILE = { fileId: '00000000-0000-4000-8000-000000000000', fileName: 'MeuOsteo_fictif.xlsm' }
const count = (db: AppDatabase, table: typeof patients | typeof seances) =>
  db
    .select({ n: sql<number>`count(*)` })
    .from(table)
    .get()?.n ?? 0

describe('reprise de l’historique · .xlsm fictif (MIGRATION.md)', () => {
  let data: Buffer
  beforeAll(async () => {
    data = await buildFakeLegacyWorkbook({ patients: 299, seances: 512 })
  })

  async function analyze(db: AppDatabase) {
    const result = await analyzeLegacyFile(db, data, FILE, TODAY)
    if (!result.ok) throw new Error(`analysis failed: ${result.reason}`)
    return result
  }

  it('le rapport est exact et rien n’est écrit pendant l’analyse', async () => {
    const db = createTestDatabase()
    const { report } = await analyze(db)
    const n = (kind: string) => report.anomalies.filter((a) => a.kind === kind).length
    expect(report).toMatchObject({
      patients: 299,
      seances: 512 - TRAP_EXPECTATIONS.orphans,
      duplicates: TRAP_EXPECTATIONS.duplicates,
      existingPatients: 0,
      notes: ['Champ « praticien » vide partout : ignoré'],
    })
    expect(n('seance_orphan')).toBe(TRAP_EXPECTATIONS.orphans)
    expect(n('seance_date_invalid')).toBe(TRAP_EXPECTATIONS.invalidDates)
    expect(n('seance_date_missing')).toBe(TRAP_EXPECTATIONS.missingDates)
    expect(n('seance_prix_missing')).toBe(TRAP_EXPECTATIONS.missingPrices)
    expect(n('seance_same_day')).toBe(TRAP_EXPECTATIONS.sameDay)
    // Nothing else is reported: the random rows are clean.
    expect(report.anomalies).toHaveLength(9)
    expect(count(db, patients)).toBe(0)
    expect(report.anomalies.some((a) => /Gêne|Mobilisations/.test(a.value))).toBe(false)
  })

  it('importe en une transaction, avec une ligne de journal et les dates à corriger', async () => {
    const db = createTestDatabase()
    const { plan, report } = await analyze(db)
    const invalid = report.anomalies.find((a) => a.kind === 'seance_date_invalid')!
    const result = runLegacyImport(db, plan, { [invalid.correctionKey!]: '2024-05-12' }, TODAY)
    expect(result).toEqual({
      ok: true,
      patients: 299,
      seances: 511,
      duplicates: 2,
      datesToFix: 3,
    })
    expect(count(db, patients)).toBe(299)
    expect(count(db, seances)).toBe(511)

    const anne = db.select().from(patients).where(eq(patients.nom, 'D’Almeida')).get()!
    expect(anne).toMatchObject({
      shortNo: 1,
      prenom: 'Anne-Lise',
      ddn: '1985-04-03',
      sexe: null,
      situation: 'pacse',
      enfants: 2,
      cp: '01000',
      portable: '0612345678',
      email: 'anne-lise.dalmeida@exemple.fr',
      legacyKey: 'D’AlmeidaAnne-Lise03/04/1985',
      searchKey: 'd almeida anne lise',
    })
    const imported = db.select().from(seances).where(eq(seances.patientId, anne.id)).all()
    expect(imported.every((s) => s.status === 'done' && s.source === 'import')).toBe(true)
    expect(imported.map((s) => s.date).sort()).toEqual(['2024-01-08', '2024-05-12'])

    const lines = db.select().from(journal).all()
    expect(lines).toEqual([
      expect.objectContaining({
        type: 'reglage',
        subject: 'Réglages',
        action: 'Historique importé : 299 patients, 511 séances',
      }),
    ])
    const toFix = getSetting(db, DATES_TO_FIX_SETTING, datesToFixSchema, {})
    expect(Object.values(toFix).sort()).toEqual(['', '', '15/03/4444'])
  })

  it('refuse l’import si la base contient déjà des patients', async () => {
    const db = createTestDatabase()
    const { plan } = await analyze(db)
    expect(runLegacyImport(db, plan, {}, TODAY).ok).toBe(true)
    const again = await analyze(db)
    expect(again.report.existingPatients).toBe(299)
    expect(runLegacyImport(db, again.plan, {}, TODAY)).toEqual({
      ok: false,
      reason: 'database_not_empty',
    })
    expect(count(db, patients)).toBe(299)
  })

  it('n’écrit rien si une écriture échoue (transaction unique)', async () => {
    const db = createTestDatabase()
    const { plan } = await analyze(db)
    const broken: LegacyImportPlan = {
      ...plan,
      seances: [...plan.seances, { ...plan.seances[0]!, tarifCents: -1 }],
    }
    expect(() => runLegacyImport(db, broken, {}, TODAY)).toThrow()
    expect(count(db, patients)).toBe(0)
    expect(count(db, seances)).toBe(0)
    expect(db.select().from(journal).all()).toEqual([])
  })

  it('signale un fichier qui n’est pas un classeur', async () => {
    const db = createTestDatabase()
    expect(await analyzeLegacyFile(db, Buffer.from('x'), FILE, TODAY)).toEqual({
      ok: false,
      reason: 'unreadable',
    })
  })
})
