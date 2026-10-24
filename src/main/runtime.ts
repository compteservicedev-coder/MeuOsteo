import { readFileSync } from 'node:fs'
import { safeStorage } from 'electron'
import type { StartupError } from '@shared/types/app'
import { closeDatabase, openDatabase, type AppDatabase } from './db/client'
import { ensureCommunesLoaded } from './db/communes'
import { DatabaseKeyError, loadOrCreateDatabaseKey } from './db/keyStore'
import { addJournalLine } from './db/repositories/journalRepository'
import { log } from './logger'
import { runMaintenance } from './maintenance'
import { appPaths } from './paths'
import { AccessCodeService } from './services/accessCode'
import { PatientService } from './services/patients'
import { SeanceService } from './services/seances'
import { createSecurityStore } from './services/securityStore'

export interface Runtime {
  db: AppDatabase
  accessCode: AccessCodeService
  patients: PatientService
  seances: SeanceService
}

export type RuntimeResult = { ok: true; runtime: Runtime } | { ok: false; error: StartupError }

/** Opens the encrypted database, applies migrations and loads reference data. */
export function startRuntime({
  allowUnprotectedKey,
}: {
  allowUnprotectedKey: boolean
}): RuntimeResult {
  let hexKey: string
  try {
    hexKey = loadOrCreateDatabaseKey({
      keyFile: appPaths.keyFile,
      databaseFile: appPaths.databaseFile,
      protector: safeStorage,
      allowUnprotected: allowUnprotectedKey,
    })
  } catch (error) {
    const reason = error instanceof DatabaseKeyError ? error.reason : null
    log.error('Database key unavailable', reason ?? error)
    return {
      ok: false,
      error: reason === 'protection_unavailable' ? 'key_protection_unavailable' : 'key_unavailable',
    }
  }

  let db: AppDatabase
  try {
    const started = Date.now()
    db = openDatabase({
      file: appPaths.databaseFile,
      hexKey,
      migrationsFolder: appPaths.migrationsFolder,
    })
    const communes = ensureCommunesLoaded(db, () => readFileSync(appPaths.communesCsv, 'utf8'))
    log.info(
      `Database ready in ${Date.now() - started} ms`,
      communes ? `(${communes} communes loaded)` : '',
    )
  } catch (error) {
    log.error('Database cannot be opened', error)
    return { ok: false, error: 'database_unavailable' }
  }

  const accessCode = new AccessCodeService({
    store: createSecurityStore(db),
    journal: (line) => addJournalLine(db, line),
  })
  const runtime = { db, accessCode, patients: new PatientService(db), seances: new SeanceService(db) }
  runMaintenance(runtime)
  return { ok: true, runtime }
}

export function stopRuntime(runtime: Runtime): void {
  closeDatabase(runtime.db)
}
