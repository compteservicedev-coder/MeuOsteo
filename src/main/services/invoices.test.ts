import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sequenceGaps } from '@shared/domain/invoice'
import { EMPTY_PATIENT_DRAFT } from '@shared/domain/patientValidation'
import type { SendOutcome } from '@shared/types/invoices'
import { openDatabase, type AppDatabase } from '../db/client'
import { setSetting } from '../db/repositories/settingsRepository'
import { avoirs, envois, factures, journal, patients, seances } from '../db/schema'
import { MIGRATIONS_FOLDER, createTestDatabase } from '../test/db'
import { InvoiceService, type InvoiceMailer, type MailMessage } from './invoices'
import { PatientService } from './patients'
import { SeanceService } from './seances'

const clock = () => new Date('2026-10-24T10:00:00Z')
let db: AppDatabase
let dir: string
let sent: MailMessage[]
let mailResult: SendOutcome
let service: InvoiceService
let patientId: string

const CABINET = {
  nom: 'Anne Martin',
  titre: 'Ostéopathe D.O.',
  adresse: '3 rue du Midi, 94300 Vincennes',
  telephone: '01 43 00 00 00',
  adeli: '940000000',
  siret: '12345678900011',
  signature: null,
}

function mailer(): InvoiceMailer {
  return {
    isConfigured: () => true,
    send: async (m) => {
      sent.push(m)
      return mailResult
    },
  }
}

function makeService(database: AppDatabase) {
  return new InvoiceService({
    db: database,
    dataDir: dir,
    pdf: { render: async (html) => Buffer.from(html), print: async () => true },
    mailer: mailer(),
    now: clock,
  })
}

function addPatient(database: AppDatabase, over: Partial<typeof EMPTY_PATIENT_DRAFT> = {}) {
  const result = new PatientService(database, clock).create({
    ...EMPTY_PATIENT_DRAFT,
    nom: 'Roux',
    prenom: 'Camille',
    ddn: '1990-03-12',
    adresse: '8 rue des Lilas',
    cp: '94300',
    commune: 'Vincennes',
    email: 'camille.roux@exemple.fr',
    ...over,
  })
  if (!result.ok) throw new Error('patient')
  return result.id
}

function addDoneSeance(
  database: AppDatabase,
  pid: string,
  date: string,
  values: Partial<typeof seances.$inferInsert> = {},
) {
  return database
    .insert(seances)
    .values({
      patientId: pid,
      date,
      status: 'done',
      source: 'manual',
      motif: 'Lombalgie',
      tarifCents: 6000,
      paiement: 'cheque',
      ...values,
    })
    .returning({ id: seances.id })
    .get().id
}

beforeEach(() => {
  db = createTestDatabase()
  dir = mkdtempSync(join(tmpdir(), 'meuosteo-invoices-'))
  sent = []
  mailResult = { ok: true, to: 'camille.roux@exemple.fr' }
  setSetting(db, 'cabinet', CABINET)
  service = makeService(db)
  patientId = addPatient(db)
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('R-10 · émission depuis une séance', () => {
  it('R-10 l’aperçu porte le numéro provisoire et l’instantané', () => {
    const seanceId = addDoneSeance(db, patientId, '2026-10-09')
    const preview = service.preview(seanceId)
    expect(preview).toMatchObject({
      ok: true,
      email: 'camille.roux@exemple.fr',
      reglementSummary: 'Acquittée · Chèque',
      document: {
        numero: '2026-0001',
        provisional: true,
        patientNom: 'Camille Roux',
        patientAdresse: '8 rue des Lilas, 94300 Vincennes',
        montantCents: 6000,
        reglementMention: 'Acquittée le 09/10/2026 · règlement : chèque.',
      },
    })
  })

  it('R-10 refuse une séance gratuite, non réalisée, déjà facturée ou sans adresse', async () => {
    const free = addDoneSeance(db, patientId, '2026-10-01', { tarifCents: 0 })
    const planned = addDoneSeance(db, patientId, '2026-10-02', { status: 'planned' })
    expect(service.issueRecord(free)).toMatchObject({ ok: false, blockers: ['free'] })
    expect(service.issueRecord(planned)).toMatchObject({ ok: false, blockers: ['not_done'] })

    const seanceId = addDoneSeance(db, patientId, '2026-10-09')
    expect((await service.issue(seanceId, { send: false })).ok).toBe(true)
    expect(service.issueRecord(seanceId)).toMatchObject({
      ok: false,
      blockers: ['already_invoiced'],
    })

    const noAddress = addPatient(db, { nom: 'Sans', adresse: '', cp: '', commune: '' })
    expect(service.issueRecord(addDoneSeance(db, noAddress, '2026-10-09'))).toMatchObject({
      ok: false,
      blockers: ['address'],
    })
  })

  it('R-10 refuse l’émission tant que les mentions du cabinet manquent', () => {
    setSetting(db, 'cabinet', { ...CABINET, adeli: '', siret: '' })
    const seanceId = addDoneSeance(db, patientId, '2026-10-09')
    expect(service.issueRecord(seanceId)).toEqual({
      ok: false,
      reason: 'cabinet_incomplete',
      missing: ['n° ADELI', 'SIRET'],
    })
  })
})

describe('R-11 · numérotation continue', () => {
  it('R-11 attribue 2026-0001, 0002… sans trou, avec une ligne de journal', async () => {
    for (let i = 1; i <= 25; i++) {
      const s = addDoneSeance(db, patientId, `2026-09-${String(i).padStart(2, '0')}`)
      const r = await service.issue(s, { send: false })
      expect(r).toMatchObject({ ok: true, numero: `2026-${String(i).padStart(4, '0')}`, pdf: true })
    }
    const seqs = db
      .select({ s: factures.sequence })
      .from(factures)
      .all()
      .map((r) => r.s)
    expect(sequenceGaps(seqs)).toEqual([])
    expect(service.nextNumber()).toBe('2026-0026')
    const lines = db.select().from(journal).where(eq(journal.type, 'facture')).all()
    expect(lines).toHaveLength(25)
    expect(lines[0]!.action).toBe('Facture 2026-0001 émise (60 €)')
  })

  it('R-11 une émission qui échoue ne consomme aucun numéro (transaction)', async () => {
    const a = addDoneSeance(db, patientId, '2026-10-01')
    await service.issue(a, { send: false })
    const b = addDoneSeance(db, patientId, '2026-10-02')
    // Same session twice: the second attempt is refused inside the transaction.
    db.$client.exec(`CREATE TRIGGER boom BEFORE INSERT ON factures WHEN NEW.sequence = 2
      BEGIN SELECT RAISE(ABORT, 'boom'); END`)
    expect(() => service.issueRecord(b)).toThrow('boom')
    expect(db.select().from(journal).where(eq(journal.type, 'facture')).all()).toHaveLength(1)
    db.$client.exec('DROP TRIGGER boom')
    expect(service.issueRecord(b)).toMatchObject({ ok: true, numero: '2026-0002' })
  })

  it('R-11 concurrence : deux connexions sur la même base ne prennent jamais le même numéro', () => {
    const file = join(dir, 'concurrent.db')
    const hexKey = randomBytes(32).toString('hex')
    const first = openDatabase({ file, hexKey, migrationsFolder: MIGRATIONS_FOLDER })
    const second = openDatabase({ file, hexKey, migrationsFolder: MIGRATIONS_FOLDER })
    second.$client.pragma('busy_timeout = 0')
    try {
      setSetting(first, 'cabinet', CABINET)
      const pid = addPatient(first)
      const s1 = addDoneSeance(first, pid, '2026-10-01')
      const s2 = addDoneSeance(first, pid, '2026-10-02')
      const s3 = addDoneSeance(first, pid, '2026-10-03')
      const one = makeService(first)
      const two = makeService(second)

      // The first connection holds the write lock: the second one cannot read a number.
      first.$client.exec('BEGIN IMMEDIATE')
      expect(() => two.issueRecord(s2)).toThrow(/locked|busy/i)
      first.$client.exec('COMMIT')

      expect(one.issueRecord(s1)).toMatchObject({ ok: true, numero: '2026-0001' })
      expect(two.issueRecord(s2)).toMatchObject({ ok: true, numero: '2026-0002' })
      expect(one.issueRecord(s3)).toMatchObject({ ok: true, numero: '2026-0003' })
      const seqs = first
        .select({ s: factures.sequence })
        .from(factures)
        .all()
        .map((r) => r.s)
      expect(seqs.sort()).toEqual([1, 2, 3])
    } finally {
      first.$client.close()
      second.$client.close()
    }
  })

  it('R-11 reprise d’une numérotation existante, seulement avant la première facture de l’année', async () => {
    expect(service.setNumberingStart(143).nextNumber).toBe('2026-0143')
    const r = await service.issue(addDoneSeance(db, patientId, '2026-10-09'), { send: false })
    expect(r).toMatchObject({ numero: '2026-0143' })
    expect(service.setNumberingStart(500)).toMatchObject({
      nextNumber: '2026-0144',
      canSetStart: false,
    })
  })
})

describe('R-12 · instantané et archive PDF', () => {
  it('R-12 la facture garde le nom et l’adresse du jour d’émission', async () => {
    const seanceId = addDoneSeance(db, patientId, '2026-10-09')
    const r = await service.issue(seanceId, { send: false })
    if (!r.ok) throw new Error('issue')
    db.update(patients).set({ adresse: '1 place Neuve' }).where(eq(patients.id, patientId)).run()
    const detail = service.detail(r.factureId)!
    expect(detail.document.patientAdresse).toBe('8 rue des Lilas, 94300 Vincennes')
    expect(detail.document.cabinet).toMatchObject({ adeli: '940000000', siret: '12345678900011' })
  })

  it('R-12 le PDF est archivé dans factures/AAAA/ avec les mentions obligatoires', async () => {
    const r = await service.issue(addDoneSeance(db, patientId, '2026-10-09'), { send: false })
    if (!r.ok) throw new Error('issue')
    const path = join(dir, 'factures', '2026', '2026-0001.pdf')
    expect(existsSync(path)).toBe(true)
    const html = readFileSync(path, 'utf8')
    for (const mention of [
      'Anne Martin',
      'Ostéopathe D.O.',
      '3 rue du Midi, 94300 Vincennes',
      'N° ADELI : 940000000',
      'SIRET : 12345678900011',
      'N° 2026-0001',
      'Émise le 24/10/2026',
      'Camille Roux',
      '8 rue des Lilas, 94300 Vincennes',
      '09/10/2026',
      'Séance d’ostéopathie',
      '60,00 €',
      'TVA non applicable, article 261-4-1° du CGI.',
      'Acquittée le 09/10/2026 · règlement : chèque.',
    ]) {
      expect(html).toContain(mention)
    }
    expect(html).not.toContain('Lombalgie')
  })
})

describe('Envoi par e-mail', () => {
  it('envoie le PDF au patient, garde la date et le destinataire', async () => {
    const r = await service.issue(addDoneSeance(db, patientId, '2026-10-09'), { send: true })
    expect(r).toMatchObject({ ok: true, sent: { ok: true } })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      to: 'camille.roux@exemple.fr',
      subject: 'Votre note d’honoraires du 09/10/2026',
      attachment: { filename: "Note d'honoraires 2026-0001.pdf" },
    })
    const rows = db.select().from(envois).all()
    expect(rows).toMatchObject([
      { canal: 'email', destinataire: 'camille.roux@exemple.fr', ok: true },
    ])
    expect(service.list()[0]).toMatchObject({
      envoi: 'E-mail',
      envoiLabel: 'E-mail · 24/10 à 12:00',
    })
  })

  it('un échec d’envoi est enregistré et « Renvoyer » reste possible', async () => {
    mailResult = { ok: false, error: 'network' }
    const r = await service.issue(addDoneSeance(db, patientId, '2026-10-09'), { send: true })
    if (!r.ok) throw new Error('issue')
    expect(r.sent).toEqual({ ok: false, error: 'network' })
    expect(service.list()[0]!.envoi).toBe('Non envoyé')
    mailResult = { ok: true, to: 'camille.roux@exemple.fr' }
    expect(await service.send(r.factureId)).toMatchObject({ ok: true })
    expect(db.select().from(envois).all()).toHaveLength(2)
  })

  it('sans e-mail dans la fiche, l’envoi est refusé', async () => {
    const pid = addPatient(db, { nom: 'Sansmail', email: '' })
    const r = await service.issue(addDoneSeance(db, pid, '2026-10-09'), { send: true })
    expect(r).toMatchObject({ ok: true, sent: { ok: false, error: 'no_email' } })
  })
})

describe('R-13 · « Supprimer la facture »', () => {
  it('R-13 passe la facture en supprimée et crée un avoir négatif dans la même transaction', async () => {
    const seanceId = addDoneSeance(db, patientId, '2026-10-09')
    const r = await service.issue(seanceId, { send: false })
    if (!r.ok) throw new Error('issue')
    expect(await service.delete(r.factureId)).toEqual({ ok: true, avoirNumero: 'AV-2026-0001' })
    expect(db.select().from(avoirs).all()).toMatchObject([
      { numero: 'AV-2026-0001', montantCents: -6000, factureId: r.factureId },
    ])
    expect(service.list()[0]).toMatchObject({ statut: 'deleted', statusKey: 'cancel' })
    expect(existsSync(join(dir, 'factures', '2026', 'AV-2026-0001.pdf'))).toBe(true)
    expect(
      db
        .select()
        .from(journal)
        .all()
        .map((l) => l.action),
    ).toContain('Facture 2026-0001 supprimée (avoir AV-2026-0001)')
    // Deleted twice: refused.
    expect(await service.delete(r.factureId)).toEqual({ ok: false, reason: 'not_allowed' })
  })

  it('R-13 la séance peut être refacturée, avec le numéro suivant', async () => {
    const seanceId = addDoneSeance(db, patientId, '2026-10-09')
    const first = await service.issue(seanceId, { send: false })
    if (!first.ok) throw new Error('issue')
    await service.delete(first.factureId)
    expect(await service.issue(seanceId, { send: false })).toMatchObject({
      ok: true,
      numero: '2026-0002',
    })
  })

  it('R-13 les avoirs ne sont pas dans le registre, seulement dans l’export comptable', async () => {
    const r = await service.issue(addDoneSeance(db, patientId, '2026-10-09'), { send: false })
    if (!r.ok) throw new Error('issue')
    await service.delete(r.factureId)
    expect(service.list().map((f) => f.numero)).toEqual(['2026-0001'])
    expect(service.accountingLines().map((l) => [l.type, l.numero, l.montantCents])).toEqual([
      ['Facture', '2026-0001', 6000],
      ['Avoir', 'AV-2026-0001', -6000],
    ])
  })
})

describe('Règlement', () => {
  it('« Marquer le virement comme reçu » acquitte la facture et la séance', async () => {
    const seanceId = addDoneSeance(db, patientId, '2026-10-09', { paiement: 'virement_attente' })
    const r = await service.issue(seanceId, { send: false })
    if (!r.ok) throw new Error('issue')
    expect(service.list()[0]!.statusKey).toBe('wait')
    expect(await service.markPaid(r.factureId)).toEqual({ ok: true })
    expect(service.detail(r.factureId)!.document.reglementMention).toBe(
      'Acquittée le 24/10/2026 · règlement : virement.',
    )
    expect(db.select().from(seances).where(eq(seances.id, seanceId)).get()!.paiement).toBe(
      'virement_recu',
    )
    expect(await service.markPaid(r.factureId)).toEqual({ ok: false, reason: 'not_allowed' })
  })
})

describe('R-04 · déverrouillage d’une séance facturée', () => {
  async function invoiced() {
    const changed: string[] = []
    const seancesService = new SeanceService(db, clock, {
      onInvoiceChanged: (id) => changed.push(id),
    })
    const seanceId = addDoneSeance(db, patientId, '2026-10-22', { tarifCents: 5500 })
    const r = await service.issue(seanceId, { send: false })
    if (!r.ok) throw new Error('issue')
    return { seancesService, seanceId, factureId: r.factureId, changed }
  }

  it('R-04 date et tarif restent bloqués sans motif', async () => {
    const { seancesService, seanceId } = await invoiced()
    expect(seancesService.save(seanceId, { tarifCents: 6000 })).toEqual({
      ok: false,
      reason: 'locked',
    })
    expect(seancesService.unlock(seanceId, 'Pas un motif')).toMatchObject({ ok: false })
  })

  it('R-04 déverrouillé avec un motif : journal, facture « modifiée », PDF régénéré', async () => {
    const { seancesService, seanceId, factureId, changed } = await invoiced()
    expect(seancesService.unlock(seanceId, 'Changement de tarif')).toEqual({ ok: true })
    expect(seancesService.save(seanceId, { tarifCents: 6000 })).toMatchObject({ ok: true })
    const f = db.select().from(factures).where(eq(factures.id, factureId)).get()!
    expect(f).toMatchObject({ montantCents: 6000, modifiedNote: 'Changement de tarif' })
    expect(f.modifiedAt).not.toBeNull()
    expect(changed).toEqual([factureId])
    const actions = db
      .select()
      .from(journal)
      .all()
      .map((l) => l.action)
    expect(actions).toContain(
      'Séance du 22/10/2026 déverrouillée (facture 2026-0001) · motif : changement de tarif',
    )
    expect(actions).toContain('Facture 2026-0001 modifiée : tarif 55 € → 60 €')
    // Locked again after the save.
    expect(seancesService.save(seanceId, { tarifCents: 6500 })).toMatchObject({ reason: 'locked' })
  })

  it('R-04 « Annuler » après déverrouillage : reverrouillée, facture inchangée', async () => {
    const { seancesService, seanceId } = await invoiced()
    seancesService.unlock(seanceId, 'Erreur de date')
    seancesService.relock(seanceId)
    expect(
      db
        .select()
        .from(journal)
        .all()
        .map((l) => l.action),
    ).toContain('Séance du 22/10/2026 reverrouillée, facture inchangée')
  })
})
