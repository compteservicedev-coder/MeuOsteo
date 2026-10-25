import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow, safeStorage } from 'electron'
import type { StartupError } from '@shared/types/app'
import { closeDatabase, openDatabase, type AppDatabase } from './db/client'
import { ensureCommunesLoaded } from './db/communes'
import { DatabaseKeyError, loadOrCreateDatabaseKey } from './db/keyStore'
import { addJournalLine } from './db/repositories/journalRepository'
import { log } from './logger'
import { runMaintenance } from './maintenance'
import { appPaths } from './paths'
import { AccessCodeService } from './services/accessCode'
import { RdvPipeline } from './services/doctolib/pipeline'
import { GmailSettingsService, type SecretBox } from './services/gmail'
import { GmailSync } from './services/gmailSync'
import { InvoiceService } from './services/invoices'
import { createGmailMailer } from './services/mailer'
import { PatientService } from './services/patients'
import { createElectronPdfRenderer } from './services/pdfRenderer'
import { PlanningService } from './services/planning'
import { SeanceService } from './services/seances'
import { createSecurityStore } from './services/securityStore'

export interface Runtime {
  db: AppDatabase
  accessCode: AccessCodeService
  patients: PatientService
  seances: SeanceService
  invoices: InvoiceService
  gmail: GmailSettingsService
  mailer: ReturnType<typeof createGmailMailer>
  planning: PlanningService
  pipeline: RdvPipeline
  sync: GmailSync
}

/**
 * safeStorage (DPAPI on Windows) for the Gmail password. Development machines without a keyring
 * fall back to plain base64, like the database key (never in the installed application).
 */
function secretBox(allowUnprotected: boolean): SecretBox {
  const protectedBox = safeStorage.isEncryptionAvailable()
  if (!protectedBox && !allowUnprotected) {
    return {
      encrypt: () => {
        throw new Error('Secret protection unavailable')
      },
      decrypt: () => {
        throw new Error('Secret protection unavailable')
      },
    }
  }
  return protectedBox
    ? {
        encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
        decrypt: (enc) => safeStorage.decryptString(Buffer.from(enc, 'base64')),
      }
    : {
        encrypt: (plain) => `plain:${Buffer.from(plain).toString('base64')}`,
        decrypt: (enc) => Buffer.from(enc.replace(/^plain:/, ''), 'base64').toString(),
      }
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
  const gmail = new GmailSettingsService(db, secretBox(allowUnprotectedKey))
  const mailer = createGmailMailer(() => gmail.credentials())
  const invoices = new InvoiceService({
    db,
    dataDir: appPaths.userData,
    pdf: createElectronPdfRenderer(join(appPaths.userData, 'tmp')),
    mailer,
  })
  const patients = new PatientService(db)
  const pipeline = new RdvPipeline(db, patients)
  const sync = new GmailSync({
    db,
    gmail,
    pipeline,
    onStatus: (status) => {
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send('sync:status', status)
    },
  })
  const runtime: Runtime = {
    db,
    accessCode,
    patients,
    seances: new SeanceService(db, undefined, {
      onInvoiceChanged: (factureId) => void invoices.writePdf(factureId),
    }),
    invoices,
    gmail,
    mailer,
    planning: new PlanningService(db),
    pipeline,
    sync,
  }
  runMaintenance(runtime)
  return { ok: true, runtime }
}

export function stopRuntime(runtime: Runtime): void {
  runtime.sync.stop()
  closeDatabase(runtime.db)
}
