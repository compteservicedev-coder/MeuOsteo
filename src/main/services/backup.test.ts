import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_PATIENT_DRAFT } from '@shared/domain/patientValidation'
import { openDatabase, type AppDatabase } from '../db/client'
import { MIGRATIONS_FOLDER } from '../test/db'
import { BackupService, applyPendingRestore, backupFileName, checkBackupFile } from './backup'
import { PatientService } from './patients'

let dir: string
let db: AppDatabase
let key: string
let minute = 0
const clock = () => new Date(Date.UTC(2026, 9, 25, 8, minute))

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'meuosteo-backup-'))
  key = randomBytes(32).toString('hex')
  db = openDatabase({
    file: join(dir, 'meuosteo.db'),
    hexKey: key,
    migrationsFolder: MIGRATIONS_FOLDER,
  })
  new PatientService(db).create({
    ...EMPTY_PATIENT_DRAFT,
    nom: 'Roux',
    prenom: 'Camille',
    ddn: '1990-03-12',
  })
  minute = 0
})
afterEach(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

const service = () =>
  new BackupService({
    db,
    databaseFile: join(dir, 'meuosteo.db'),
    defaultFolder: join(dir, 'sauvegardes'),
    now: clock,
  })

describe('R-22 · sauvegarde', () => {
  it('R-22 nom daté MeuOsteo_AAAA-MM-JJ_HHmm.mosave (heure de Paris)', () => {
    expect(backupFileName(new Date('2026-10-25T08:41:00Z'))).toBe('MeuOsteo_2026-10-25_0941.mosave')
  })

  it('R-22 copie chiffrée et cohérente, vérifiable avec la clé seulement', () => {
    const r = service().backupNow()
    if (!r.ok) throw new Error('backup')
    expect(readFileSync(r.file.path).subarray(0, 15).toString()).not.toBe('SQLite format 3')
    expect(checkBackupFile(r.file.path, key)).toEqual({
      ok: true,
      patients: 1,
      seances: 0,
      factures: 0,
    })
    expect(checkBackupFile(r.file.path, randomBytes(32).toString('hex'))).toEqual({
      ok: false,
      reason: 'wrong_key',
    })
    expect(service().setting().lastAt).toBe(clock().toISOString())
  })

  it('R-22 ne garde que les N dernières copies', () => {
    const s = service()
    s.setKeep(3)
    for (let i = 0; i < 5; i++) {
      minute = i
      expect(s.backupNow().ok).toBe(true)
    }
    expect(s.list().map((f) => f.name)).toEqual([
      'MeuOsteo_2026-10-25_0904.mosave',
      'MeuOsteo_2026-10-25_0903.mosave',
      'MeuOsteo_2026-10-25_0902.mosave',
    ])
  })

  it('R-22 un fichier corrompu est refusé', () => {
    const bad = join(dir, 'bad.mosave')
    writeFileSync(bad, randomBytes(8192))
    expect(checkBackupFile(bad, key).ok).toBe(false)
  })

  it('R-22 restauration : copie de sécurité, puis remplacement au redémarrage', () => {
    const s = service()
    const first = s.backupNow()
    if (!first.ok) throw new Error('backup')
    new PatientService(db).create({
      ...EMPTY_PATIENT_DRAFT,
      nom: 'Martin',
      prenom: 'Élise',
      ddn: '1985-01-01',
    })
    minute = 5
    expect(s.prepareRestore(first.file.path, key)).toMatchObject({ ok: true, patients: 1 })
    expect(s.list()).toHaveLength(2)
    db.$client.close()
    expect(applyPendingRestore(join(dir, 'meuosteo.db'), join(dir, 'meuosteo.key'))).toBe(true)
    db = openDatabase({
      file: join(dir, 'meuosteo.db'),
      hexKey: key,
      migrationsFolder: MIGRATIONS_FOLDER,
    })
    expect(new PatientService(db).activeCount()).toBe(1)
    expect(existsSync(join(dir, 'meuosteo.db.restore'))).toBe(false)
  })
})
