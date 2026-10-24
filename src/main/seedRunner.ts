import { sql } from 'drizzle-orm'
import { isoDateInParis } from '@shared/domain/dates'
import { communes, patients } from './db/schema'
import { clearBusinessData, seedDatabase } from './db/seed'
import { seedDuplicates } from './db/seedDuplicates'
import { appPaths } from './paths'
import { startRuntime, stopRuntime } from './runtime'

const write = (line: string) => process.stdout.write(`${line}\n`)

/**
 * `npm run seed` (development build only): fills %APPDATA%/MeuOsteo-dev with fake data.
 * Refuses a database that already has patients unless `--reset` is given.
 */
export function runSeed(argv: string[]): number {
  const started = startRuntime({ allowUnprotectedKey: true })
  if (!started.ok) {
    process.stderr.write(`Base indisponible : ${started.error}\n`)
    return 1
  }
  const { db } = started.runtime
  try {
    const existing =
      db
        .select({ n: sql<number>`count(*)` })
        .from(patients)
        .get()?.n ?? 0
    if (existing > 0) {
      if (!argv.includes('--reset')) {
        process.stderr.write(
          `La base contient déjà ${existing} patients. Relancez avec « npm run seed -- --reset » pour la remplacer.\n`,
        )
        return 1
      }
      clearBusinessData(db)
    }
    const report = seedDatabase(db, {
      patients: 200,
      seances: 600,
      today: isoDateInParis(new Date()),
      communes: db.select().from(communes).all(),
    })
    const duplicates = seedDuplicates(db)
    write(`Base fictive créée dans ${appPaths.userData}`)
    write(
      `${report.patients} patients, ${report.seances} séances, ${report.links} liens de proches, ${report.doctolibRdv} RDV Doctolib, ${duplicates} doublons possibles`,
    )
    return 0
  } finally {
    stopRuntime(started.runtime)
  }
}
