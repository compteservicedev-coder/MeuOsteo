/**
 * Reprise de l'historique (docs/MIGRATION.md): analysis without writing, then the import in a
 * single transaction with its journal line. Refused when the database already has patients.
 */
import { isNull, sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import { SETTINGS_SUBJECT } from '@shared/domain/journal'
import {
  analyzeLegacyTables,
  finalizeImport,
  seanceDateRange,
  type ImportCorrections,
  type LegacyImportPlan,
} from '@shared/domain/legacyImport'
import { patientSearchKey } from '@shared/domain/text'
import type { LegacyAnalyzeResult, LegacyImportResult } from '@shared/types/legacyImport'
import { z } from 'zod'
import type { AppDatabase } from '../db/client'
import { countDuplicatePairs } from '../db/repositories/duplicateRepository'
import { addJournalLine } from '../db/repositories/journalRepository'
import { getSetting, setSetting } from '../db/repositories/settingsRepository'
import { patients, seances } from '../db/schema'
import { LegacyWorkbookError, readLegacyWorkbook } from './legacyWorkbook'

/**
 * Sessions imported as « date à corriger »: séance id → date read in the file (empty when it
 * was missing). The record keeps the proposed date until the user corrects it (docs/DATA_MODEL).
 */
export const DATES_TO_FIX_SETTING = 'import_dates_to_fix'
export const datesToFixSchema = z.record(z.string(), z.string())

/** Rows per INSERT, well under SQLite's limit of bound parameters. */
const CHUNK = 200

export function countActivePatients(db: AppDatabase): number {
  return (
    db
      .select({ n: sql<number>`count(*)` })
      .from(patients)
      .where(isNull(patients.deletedAt))
      .get()?.n ?? 0
  )
}

export type LegacyAnalysis =
  | {
      ok: true
      plan: LegacyImportPlan
      report: Extract<LegacyAnalyzeResult, { ok: true }>['report']
    }
  | Exclude<LegacyAnalyzeResult, { ok: true }>

/** Steps 1–2 of MIGRATION.md: reads the file and builds the report. Nothing is written. */
export async function analyzeLegacyFile(
  db: AppDatabase,
  data: Uint8Array,
  file: { fileId: string; fileName: string },
  today: string,
): Promise<LegacyAnalysis> {
  let tables
  try {
    tables = await readLegacyWorkbook(data)
  } catch (error) {
    if (!(error instanceof LegacyWorkbookError)) throw error
    return error.reason === 'unreadable'
      ? { ok: false, reason: 'unreadable' }
      : { ok: false, reason: 'tables_missing', missing: error.missing }
  }
  const analysis = analyzeLegacyTables({ ...tables, today })
  if (!analysis.ok) return { ok: false, reason: 'columns_missing', missing: analysis.missing }
  const { plan } = analysis
  return {
    ok: true,
    plan,
    report: {
      ...file,
      patients: plan.patients.length,
      seances: plan.seances.length,
      anomalies: plan.anomalies,
      duplicates: plan.duplicates,
      notes: plan.notes,
      existingPatients: countActivePatients(db),
      seanceDateRange: seanceDateRange(today),
      today,
    },
  }
}

class DatabaseNotEmpty extends Error {}

/** Step 3: « Importer ». One transaction: records, sessions, dates to fix and journal line. */
export function runLegacyImport(
  db: AppDatabase,
  plan: LegacyImportPlan,
  corrections: ImportCorrections,
  today: string,
  now = new Date(),
): LegacyImportResult {
  const final = finalizeImport(plan, corrections, today)
  if (!final.ok) return final

  const patientIds = final.patients.map(() => ulid())
  const seanceRows = final.seances.map((s) => ({
    id: ulid(),
    patientId: patientIds[s.patient]!,
    date: s.date,
    heure: null,
    status: 'done' as const,
    source: 'import' as const,
    motif: s.motif,
    anamnese: s.anamnese,
    pratique: s.pratique,
    tarifCents: s.tarifCents,
    paiement: s.paiement,
  }))
  const datesToFix = Object.fromEntries(
    final.seances.flatMap((s, i) =>
      s.dateToFix === null ? [] : [[seanceRows[i]!.id, s.dateToFix]],
    ),
  )

  try {
    db.$client.transaction(() => {
      // Checked again inside the transaction: nothing may have been added since the analysis.
      if (countActivePatients(db) > 0) throw new DatabaseNotEmpty()
      const firstNo =
        (db
          .select({ max: sql<number | null>`max(${patients.shortNo})` })
          .from(patients)
          .get()?.max ?? 0) + 1
      const patientRows = final.patients.map((p, i) => ({
        id: patientIds[i]!,
        shortNo: firstNo + i,
        nom: p.nom,
        prenom: p.prenom,
        ddn: p.ddn,
        sexe: p.sexe,
        situation: p.situation,
        enfants: p.enfants,
        profession: p.profession,
        adresse: p.adresse,
        cp: p.cp,
        commune: p.commune,
        portable: p.portable,
        fixe: p.fixe,
        email: p.email,
        commentaire: p.commentaire,
        legacyKey: p.legacyKey,
        searchKey: patientSearchKey(p.nom, p.prenom),
      }))
      for (let i = 0; i < patientRows.length; i += CHUNK) {
        db.insert(patients)
          .values(patientRows.slice(i, i + CHUNK))
          .run()
      }
      for (let i = 0; i < seanceRows.length; i += CHUNK) {
        db.insert(seances)
          .values(seanceRows.slice(i, i + CHUNK))
          .run()
      }
      if (Object.keys(datesToFix).length) {
        const previous = getSetting(db, DATES_TO_FIX_SETTING, datesToFixSchema, {})
        setSetting(db, DATES_TO_FIX_SETTING, { ...previous, ...datesToFix })
      }
      addJournalLine(
        db,
        {
          type: 'reglage',
          subject: SETTINGS_SUBJECT,
          action: `Historique importé : ${patientRows.length} patients, ${seanceRows.length} séances`,
        },
        now,
      )
    })()
  } catch (error) {
    if (error instanceof DatabaseNotEmpty) return { ok: false, reason: 'database_not_empty' }
    throw error
  }

  return {
    ok: true,
    patients: final.patients.length,
    seances: seanceRows.length,
    // R-19 runs right after the import: the pairs found go to « À rapprocher ».
    duplicates: countDuplicatePairs(db),
    datesToFix: Object.keys(datesToFix).length,
  }
}
