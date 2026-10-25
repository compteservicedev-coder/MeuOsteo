/**
 * Invoicing (SPEC §5.5 – 6, DATA_MODEL.md §factures): R-10 issuing conditions, R-11 numbering
 * in the issuing transaction, R-12 snapshot and PDF archive, R-13 « Supprimer la facture » with a
 * hidden credit note, sending by e-mail and printing. Logs never hold names nor amounts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import { formatIsoDateFr, isoDateInParis, timeInParis } from '@shared/domain/dates'
import {
  CABINET_FIELD_LABELS,
  DEFAULT_EMAIL_TEMPLATE,
  DEFAULT_MENTION_TVA,
  INVOICE_LIBELLE,
  envoiKind,
  formatAvoirNumber,
  formatEurosShort,
  formatInvoiceNumber,
  invoiceBlockers,
  invoiceStatusKey,
  missingCabinetFields,
  modePaiementLabel,
  nextSequence,
  reglementMention,
  reglementOf,
  reglementSummary,
  renderEmailTemplate,
  yearOf,
  type AccountingLine,
  type CabinetIdentity,
} from '@shared/domain/invoice'
import { formatAddress, isAddressComplete } from '@shared/domain/patient'
import type {
  CabinetSnapshotView,
  DeleteInvoiceResult,
  EnvoiView,
  InvoiceActionResult,
  InvoiceDetail,
  InvoiceDocumentData,
  InvoicePreview,
  InvoiceRow,
  InvoiceSettingsInput,
  InvoiceSettingsView,
  IssueResult,
  SendOutcome,
} from '@shared/types/invoices'
import type { AppDatabase, DbOrTx } from '../db/client'
import { addJournalLine } from '../db/repositories/journalRepository'
import { getSetting, setSetting } from '../db/repositories/settingsRepository'
import { avoirs, envois, factures, journal, patients, seances } from '../db/schema'
import { log } from '../logger'
import { renderInvoiceHtml } from './invoiceHtml'
import {
  DEFAULT_CABINET,
  DEFAULT_TARIFS_SETTING,
  cabinetSettingSchema,
  emailTemplateSchema,
  invoiceStartSchema,
  mentionTvaSchema,
  tarifsSettingSchema,
} from './settingsSchemas'

type FactureRow = typeof factures.$inferSelect

/** HTML → PDF and printing, done by Electron in a hidden window (see pdfRenderer.ts). */
export interface PdfRenderer {
  render(html: string): Promise<Buffer>
  print(html: string): Promise<boolean>
}

export interface MailMessage {
  to: string
  subject: string
  text: string
  attachment: { filename: string; content: Buffer }
}

/** Gmail SMTP (see mailer.ts). */
export interface InvoiceMailer {
  isConfigured(): boolean
  send(message: MailMessage): Promise<SendOutcome>
}

export interface InvoiceServiceDeps {
  db: AppDatabase
  /** userData: PDFs go to `factures/AAAA/`, the signature image sits at its root. */
  dataDir: string
  pdf: PdfRenderer
  mailer: InvoiceMailer
  now?: () => Date
}

const SIGNATURE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

export class InvoiceService {
  private readonly db: AppDatabase
  private readonly now: () => Date

  constructor(private readonly deps: InvoiceServiceDeps) {
    this.db = deps.db
    this.now = deps.now ?? (() => new Date())
  }

  private today(): string {
    return isoDateInParis(this.now())
  }

  // --- Settings (Paramètres > Cabinet & factures) ----------------------------------------

  private cabinetSetting() {
    return getSetting(this.db, 'cabinet', cabinetSettingSchema, DEFAULT_CABINET)
  }

  private cabinetIdentity(): CabinetIdentity {
    const { signature: _signature, ...identity } = this.cabinetSetting()
    return identity
  }

  private snapshot(): CabinetSnapshotView {
    return {
      ...this.cabinetIdentity(),
      mentionTva: getSetting(this.db, 'mention_tva', mentionTvaSchema, DEFAULT_MENTION_TVA),
    }
  }

  private missingCabinet(): string[] {
    return missingCabinetFields(this.cabinetIdentity()).map((k) => CABINET_FIELD_LABELS[k])
  }

  /** `data:` URL of the signature image, or `null`. */
  signatureDataUrl(): string | null {
    const file = this.cabinetSetting().signature
    if (!file) return null
    const type = SIGNATURE_TYPES[extname(file).toLowerCase()]
    const path = join(this.deps.dataDir, file)
    if (!type || !existsSync(path)) return null
    return `data:${type};base64,${readFileSync(path).toString('base64')}`
  }

  private startOf(annee: number): number | null {
    return getSetting(this.db, 'invoice_start', invoiceStartSchema, {})[String(annee)] ?? null
  }

  private lastSequence(db: DbOrTx, annee: number): number | null {
    return (
      db.get<{ m: number | null }>(
        sql`SELECT max(sequence) AS m FROM factures WHERE annee = ${annee}`,
      )?.m ?? null
    )
  }

  /** R-11: next sequence of the year, never below a configured starting number. */
  private nextSeq(db: DbOrTx, annee: number): number {
    return Math.max(nextSequence(this.lastSequence(db, annee)), this.startOf(annee) ?? 1)
  }

  /** « Prochain numéro » shown in Paramètres (read-only). */
  nextNumber(): string {
    const annee = yearOf(this.today())
    return formatInvoiceNumber(annee, this.nextSeq(this.db, annee))
  }

  settingsView(): InvoiceSettingsView {
    const signature = this.signatureDataUrl()
    return {
      cabinet: this.cabinetIdentity(),
      hasSignature: signature !== null,
      signature,
      tarifs: getSetting(this.db, 'tarifs', tarifsSettingSchema, DEFAULT_TARIFS_SETTING),
      mentionTva: getSetting(this.db, 'mention_tva', mentionTvaSchema, DEFAULT_MENTION_TVA),
      emailTemplate: getSetting(
        this.db,
        'email_template',
        emailTemplateSchema,
        DEFAULT_EMAIL_TEMPLATE,
      ),
      nextNumber: this.nextNumber(),
      canSetStart: this.lastSequence(this.db, yearOf(this.today())) === null,
      missingCabinet: this.missingCabinet(),
    }
  }

  saveSettings(input: InvoiceSettingsInput): InvoiceSettingsView {
    const list = [...new Set([...input.tarifs.list, input.tarifs.defaultCents])].sort(
      (a, b) => a - b,
    )
    this.db.transaction((tx) => {
      setSetting(tx, 'cabinet', {
        ...this.cabinetSetting(),
        ...trimAll(input.cabinet),
      })
      setSetting(tx, 'tarifs', {
        list,
        defaultCents: input.tarifs.defaultCents,
      })
      setSetting(tx, 'mention_tva', input.mentionTva.trim())
      setSetting(tx, 'email_template', input.emailTemplate)
    })
    return this.settingsView()
  }

  /** Stores the signature image (PNG or JPEG) in userData. */
  setSignature(content: Buffer, extension: string): InvoiceSettingsView {
    const ext = extension.toLowerCase()
    if (!SIGNATURE_TYPES[ext]) return this.settingsView()
    const file = `signature${ext === '.jpeg' ? '.jpg' : ext}`
    writeFileSync(join(this.deps.dataDir, file), content)
    setSetting(this.db, 'cabinet', { ...this.cabinetSetting(), signature: file })
    return this.settingsView()
  }

  removeSignature(): InvoiceSettingsView {
    setSetting(this.db, 'cabinet', { ...this.cabinetSetting(), signature: null })
    return this.settingsView()
  }

  /** Continues an existing numbering for the current year, only before its first invoice. */
  setNumberingStart(sequence: number): InvoiceSettingsView {
    const annee = yearOf(this.today())
    if (this.lastSequence(this.db, annee) === null && sequence >= 1 && sequence <= 9999) {
      const starts = getSetting(this.db, 'invoice_start', invoiceStartSchema, {})
      setSetting(this.db, 'invoice_start', { ...starts, [String(annee)]: sequence })
    }
    return this.settingsView()
  }

  // --- R-10 / R-12 · Preview and issue ---------------------------------------------------

  private seanceContext(db: DbOrTx, seanceId: string) {
    const seance = db.select().from(seances).where(eq(seances.id, seanceId)).get()
    if (!seance) return null
    const patient = db.select().from(patients).where(eq(patients.id, seance.patientId)).get()
    if (!patient || patient.deletedAt) return null
    const active = db
      .select({ id: factures.id })
      .from(factures)
      .where(and(eq(factures.seanceId, seanceId), eq(factures.statut, 'emise')))
      .get()
    const blockers = invoiceBlockers(
      { status: seance.status, tarifCents: seance.tarifCents, invoiced: active !== undefined },
      { editing: false, addressComplete: isAddressComplete(patient) },
    )
    return { seance, patient, blockers }
  }

  private documentFor(row: FactureRow, signature = this.signatureDataUrl()): InvoiceDocumentData {
    return {
      kind: 'facture',
      numero: row.numero,
      provisional: false,
      dateEmission: row.dateEmission,
      cabinet: { ...(row.snapCabinet as CabinetSnapshotView) },
      signature,
      patientNom: row.snapPatientNom,
      patientAdresse: row.snapPatientAdresse,
      dateSeance: row.snapDateSeance,
      libelle: row.snapLibelle,
      montantCents: row.montantCents,
      reglementMention: reglementMention({
        reglement: row.reglement,
        modePaiement: row.modePaiement,
        acquitteeLe: row.acquitteeLe ?? row.snapDateSeance,
      }),
      reference: null,
    }
  }

  /** Data of the « Émettre la facture » window, with the provisional number. */
  preview(seanceId: string): InvoicePreview {
    const ctx = this.seanceContext(this.db, seanceId)
    if (!ctx) return { ok: false, reason: 'not_found' }
    if (ctx.blockers.length > 0) return { ok: false, reason: 'blocked', blockers: ctx.blockers }
    const { seance, patient } = ctx
    const reglement = reglementOf(seance.paiement)
    const mode = modePaiementLabel(seance.paiement)
    return {
      ok: true,
      seanceId,
      patientId: patient.id,
      email: patient.email,
      motif: seance.motif,
      reglement,
      reglementSummary: reglementSummary(reglement, mode),
      missingCabinet: this.missingCabinet(),
      mailConfigured: this.deps.mailer.isConfigured(),
      document: {
        kind: 'facture',
        numero: this.nextNumber(),
        provisional: true,
        dateEmission: this.today(),
        cabinet: this.snapshot(),
        signature: this.signatureDataUrl(),
        patientNom: `${patient.prenom} ${patient.nom}`,
        patientAdresse: formatAddress(patient),
        dateSeance: seance.date,
        libelle: INVOICE_LIBELLE,
        montantCents: seance.tarifCents,
        reglementMention: reglementMention({
          reglement,
          modePaiement: mode,
          acquitteeLe: seance.date,
        }),
        reference: null,
      },
    }
  }

  /**
   * R-11 / R-12: creates the invoice in one immediate transaction (the write lock is taken
   * before the number is read, so two issues can never get the same number and a failure
   * leaves no gap). Synchronous; the PDF and the e-mail come after, see `issue`.
   */
  issueRecord(
    seanceId: string,
  ): Exclude<IssueResult, { ok: true }> | { ok: true; factureId: string; numero: string } {
    const missing = this.missingCabinet()
    if (missing.length > 0) return { ok: false, reason: 'cabinet_incomplete', missing }
    const snapshot = this.snapshot()
    return this.db.transaction(
      (tx) => {
        const ctx = this.seanceContext(tx, seanceId)
        if (!ctx) return { ok: false as const, reason: 'not_found' as const }
        if (ctx.blockers.length > 0) {
          return { ok: false as const, reason: 'blocked' as const, blockers: ctx.blockers }
        }
        const { seance, patient } = ctx
        const today = this.today()
        const annee = yearOf(today)
        const sequence = this.nextSeq(tx, annee)
        const numero = formatInvoiceNumber(annee, sequence)
        const id = ulid()
        tx.insert(factures)
          .values({
            id,
            numero,
            annee,
            sequence,
            seanceId,
            patientId: patient.id,
            statut: 'emise',
            dateEmission: today,
            snapPatientNom: `${patient.prenom} ${patient.nom}`,
            snapPatientAdresse: formatAddress(patient),
            snapDateSeance: seance.date,
            snapLibelle: INVOICE_LIBELLE,
            montantCents: seance.tarifCents,
            reglement: reglementOf(seance.paiement),
            modePaiement: modePaiementLabel(seance.paiement),
            snapCabinet: snapshot,
            pdfPath: relativePdfPath(annee, numero),
          })
          .run()
        addJournalLine(
          tx,
          {
            type: 'facture',
            subject: `${patient.prenom} ${patient.nom}`,
            action: `Facture ${numero} émise (${formatEurosShort(seance.tarifCents)})`,
            patientId: patient.id,
          },
          this.now(),
        )
        return { ok: true as const, factureId: id, numero }
      },
      { behavior: 'immediate' },
    )
  }

  /** « Émettre la facture » / « Émettre et envoyer ». */
  async issue(seanceId: string, options: { send: boolean }): Promise<IssueResult> {
    const record = this.issueRecord(seanceId)
    if (!record.ok) return record
    log.info(`Invoice issued (${record.factureId})`)
    const pdf = await this.writePdf(record.factureId)
    const sent = options.send ? await this.send(record.factureId) : null
    if (sent?.ok) {
      // R-20: « Facture N émise (60 €) · envoyée par e-mail », on the same line.
      this.db
        .update(journal)
        .set({ action: sql`${journal.action} || ' · envoyée par e-mail'` })
        .where(
          and(
            eq(journal.type, 'facture'),
            sql`${journal.action} LIKE ${`Facture ${record.numero} émise%`}`,
          ),
        )
        .run()
    }
    return { ...record, pdf, sent }
  }

  // --- PDF archive ------------------------------------------------------------------------

  private factureRow(id: string): FactureRow | undefined {
    return this.db.select().from(factures).where(eq(factures.id, id)).get()
  }

  /** (Re)generates the archived PDF of an invoice. Returns false if it failed. */
  async writePdf(factureId: string): Promise<boolean> {
    const row = this.factureRow(factureId)
    if (!row) return false
    const rel = row.pdfPath ?? relativePdfPath(row.annee, row.numero)
    try {
      const buffer = await this.deps.pdf.render(renderInvoiceHtml(this.documentFor(row)))
      const abs = join(this.deps.dataDir, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, buffer)
      if (row.pdfPath !== rel) {
        this.db.update(factures).set({ pdfPath: rel }).where(eq(factures.id, factureId)).run()
      }
      return true
    } catch (error) {
      log.error(`Invoice PDF failed (${factureId})`, error)
      return false
    }
  }

  /** Absolute path of the archived PDF, generated again if the file is missing. */
  async pdfFile(factureId: string): Promise<{ path: string; numero: string } | null> {
    const row = this.factureRow(factureId)
    if (!row) return null
    const abs = join(this.deps.dataDir, row.pdfPath ?? relativePdfPath(row.annee, row.numero))
    if (!existsSync(abs) && !(await this.writePdf(factureId))) return null
    return { path: abs, numero: row.numero }
  }

  // --- Sending and printing ---------------------------------------------------------------

  private recordEnvoi(
    factureId: string,
    canal: 'email' | 'print',
    destinataire: string | null,
    ok: boolean,
    error: string | null,
  ) {
    this.db
      .insert(envois)
      .values({ factureId, canal, destinataire, at: this.now().toISOString(), ok, error })
      .run()
  }

  /** Sends the PDF to the patient's current e-mail (« Renvoyer » at any time). */
  async send(factureId: string): Promise<SendOutcome> {
    const row = this.factureRow(factureId)
    if (!row) return { ok: false, error: 'other' }
    const patient = row.patientId
      ? this.db.select().from(patients).where(eq(patients.id, row.patientId)).get()
      : undefined
    const to = patient?.email?.trim()
    if (!to) return { ok: false, error: 'no_email' }
    if (!this.deps.mailer.isConfigured()) return { ok: false, error: 'not_configured' }
    const file = await this.pdfFile(factureId)
    if (!file) return { ok: false, error: 'pdf' }
    const template = getSetting(
      this.db,
      'email_template',
      emailTemplateSchema,
      DEFAULT_EMAIL_TEMPLATE,
    )
    const cabinet = this.cabinetIdentity()
    const message = renderEmailTemplate(template, {
      prenom: patient?.prenom ?? '',
      dateSeance: row.snapDateSeance,
      signature: cabinet.nom || undefined,
    })
    const outcome = await this.deps.mailer.send({
      to,
      subject: message.subject,
      text: message.body,
      attachment: {
        filename: `Note d'honoraires ${row.numero}.pdf`,
        content: readFileSync(file.path),
      },
    })
    this.recordEnvoi(factureId, 'email', to, outcome.ok, outcome.ok ? null : outcome.error)
    if (!outcome.ok) log.warn(`Invoice e-mail failed (${factureId}): ${outcome.error}`)
    return outcome
  }

  /** Opens the system print dialog on the invoice; a completed print is recorded. */
  async print(factureId: string): Promise<InvoiceActionResult> {
    const row = this.factureRow(factureId)
    if (!row) return { ok: false, reason: 'not_found' }
    try {
      const printed = await this.deps.pdf.print(renderInvoiceHtml(this.documentFor(row)))
      if (printed) this.recordEnvoi(factureId, 'print', null, true, null)
      return { ok: true }
    } catch (error) {
      log.error(`Invoice print failed (${factureId})`, error)
      return { ok: false, reason: 'pdf' }
    }
  }

  // --- Register (SPEC §6) -----------------------------------------------------------------

  private envoisBy(ids: string[] | null): Map<string, EnvoiView[]> {
    const rows = this.db
      .select()
      .from(envois)
      .where(ids ? inArray(envois.factureId, ids) : undefined)
      .orderBy(asc(envois.at))
      .all()
    const map = new Map<string, EnvoiView[]>()
    for (const e of rows) {
      const list = map.get(e.factureId) ?? []
      list.push({
        canal: e.canal,
        destinataire: e.destinataire,
        at: e.at,
        ok: e.ok,
        error: e.error,
      })
      map.set(e.factureId, list)
    }
    return map
  }

  private toRow(f: FactureRow, sent: EnvoiView[]): InvoiceRow {
    const kind = envoiKind(sent)
    const last = [...sent].reverse().find((e) => e.ok)
    const envoiLabel =
      kind === 'E-mail' && last
        ? `E-mail · ${formatIsoDateFr(isoDateInParis(new Date(last.at))).slice(0, 5)} à ${timeInParis(new Date(last.at))}`
        : kind
    return {
      id: f.id,
      numero: f.numero,
      dateEmission: f.dateEmission,
      patientId: f.patientId,
      patientNom: f.snapPatientNom,
      montantCents: f.montantCents,
      statut: f.statut,
      reglement: f.reglement,
      modePaiement: f.modePaiement,
      statusKey: invoiceStatusKey(f),
      envoi: kind,
      envoiLabel,
      seanceId: f.seanceId,
      dateSeance: f.snapDateSeance,
      deletedAt: f.deletedAt,
      modifiedAt: f.modifiedAt,
    }
  }

  /** Every invoice, most recent first. Credit notes are never listed (R-13). */
  list(): InvoiceRow[] {
    const rows = this.db
      .select()
      .from(factures)
      .orderBy(desc(factures.annee), desc(factures.sequence))
      .all()
    const sent = this.envoisBy(null)
    return rows.map((f) => this.toRow(f, sent.get(f.id) ?? []))
  }

  detail(id: string): InvoiceDetail | null {
    const f = this.factureRow(id)
    if (!f) return null
    const sent = this.envoisBy([id]).get(id) ?? []
    const patient = f.patientId
      ? this.db
          .select({ email: patients.email, deletedAt: patients.deletedAt })
          .from(patients)
          .where(eq(patients.id, f.patientId))
          .get()
      : undefined
    const seanceExists =
      f.seanceId !== null &&
      this.db.select({ id: seances.id }).from(seances).where(eq(seances.id, f.seanceId)).get() !==
        undefined
    const avoir = this.db
      .select({ numero: avoirs.numero })
      .from(avoirs)
      .where(eq(avoirs.factureId, id))
      .get()
    return {
      row: this.toRow(f, sent),
      document: this.documentFor(f),
      envois: sent,
      email: patient && !patient.deletedAt ? patient.email : null,
      seanceExists: seanceExists && Boolean(patient && !patient.deletedAt),
      modifiedNote: f.modifiedNote,
      avoirNumero: avoir?.numero ?? null,
      mailConfigured: this.deps.mailer.isConfigured(),
    }
  }

  /** « Marquer le virement comme reçu »: the invoice becomes « acquittée », PDF regenerated. */
  async markPaid(id: string): Promise<InvoiceActionResult> {
    const f = this.factureRow(id)
    if (!f) return { ok: false, reason: 'not_found' }
    if (f.statut !== 'emise' || f.reglement !== 'attente')
      return { ok: false, reason: 'not_allowed' }
    this.db.transaction((tx) => {
      tx.update(factures)
        .set({ reglement: 'acquittee', modePaiement: 'virement', acquitteeLe: this.today() })
        .where(eq(factures.id, id))
        .run()
      if (f.seanceId) {
        tx.update(seances)
          .set({ paiement: 'virement_recu' })
          .where(eq(seances.id, f.seanceId))
          .run()
      }
    })
    await this.writePdf(id)
    return { ok: true }
  }

  /**
   * R-13 « Supprimer la facture »: the invoice becomes `deleted` and a credit note
   * `AV-AAAA-NNNN` of the opposite amount is created in the same transaction. The session can
   * then be invoiced again.
   */
  deleteRecord(id: string): DeleteInvoiceResult & { avoirId?: string } {
    return this.db.transaction(
      (tx) => {
        const f = tx.select().from(factures).where(eq(factures.id, id)).get()
        if (!f) return { ok: false as const, reason: 'not_found' as const }
        if (f.statut !== 'emise') return { ok: false as const, reason: 'not_allowed' as const }
        const today = this.today()
        const annee = yearOf(today)
        const last = tx.get<{ m: number | null }>(
          sql`SELECT max(sequence) AS m FROM avoirs WHERE annee = ${annee}`,
        )
        const sequence = nextSequence(last?.m ?? null)
        const numero = formatAvoirNumber(annee, sequence)
        const avoirId = ulid()
        tx.insert(avoirs)
          .values({
            id: avoirId,
            numero,
            annee,
            sequence,
            factureId: id,
            date: today,
            montantCents: -f.montantCents,
            pdfPath: relativePdfPath(annee, numero),
          })
          .run()
        tx.update(factures)
          .set({ statut: 'deleted', deletedAt: this.now().toISOString() })
          .where(eq(factures.id, id))
          .run()
        addJournalLine(
          tx,
          {
            type: 'facture',
            subject: f.snapPatientNom,
            action: `Facture ${f.numero} supprimée (avoir ${numero})`,
            patientId: f.patientId,
          },
          this.now(),
        )
        return { ok: true as const, avoirNumero: numero, avoirId }
      },
      { behavior: 'immediate' },
    )
  }

  async delete(id: string): Promise<DeleteInvoiceResult> {
    const result = this.deleteRecord(id)
    if (!result.ok) return result
    log.info(`Invoice deleted (${id}), credit note created`)
    await this.writeAvoirPdf(result.avoirId!)
    return { ok: true, avoirNumero: result.avoirNumero }
  }

  private async writeAvoirPdf(avoirId: string): Promise<boolean> {
    const a = this.db.select().from(avoirs).where(eq(avoirs.id, avoirId)).get()
    const f = a && this.factureRow(a.factureId)
    if (!a || !f) return false
    const document: InvoiceDocumentData = {
      ...this.documentFor(f),
      kind: 'avoir',
      numero: a.numero,
      dateEmission: a.date,
      montantCents: a.montantCents,
      reglementMention: '',
      reference: `Annule la facture N° ${f.numero} du ${formatIsoDateFr(f.dateEmission)}.`,
    }
    try {
      const buffer = await this.deps.pdf.render(renderInvoiceHtml(document))
      const abs = join(this.deps.dataDir, a.pdfPath ?? relativePdfPath(a.annee, a.numero))
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, buffer)
      return true
    } catch (error) {
      log.error(`Credit note PDF failed (${avoirId})`, error)
      return false
    }
  }

  // --- Accounting export ------------------------------------------------------------------

  /** Invoices (deleted ones included) and credit notes, for the accountant. */
  accountingLines(): AccountingLine[] {
    const all = this.db.select().from(factures).all()
    const byId = new Map(all.map((f) => [f.id, f]))
    const credit = this.db.select().from(avoirs).all()
    const creditBy = new Map(credit.map((a) => [a.factureId, a]))
    const lines: AccountingLine[] = all.map((f) => ({
      type: 'Facture',
      numero: f.numero,
      date: f.dateEmission,
      patient: f.snapPatientNom,
      montantCents: f.montantCents,
      reglement: f.reglement === 'acquittee' ? 'Acquittée' : 'En attente',
      modePaiement: f.modePaiement ?? '',
      reference: creditBy.has(f.id) ? `Annulée par ${creditBy.get(f.id)!.numero}` : '',
    }))
    for (const a of credit) {
      const f = byId.get(a.factureId)
      lines.push({
        type: 'Avoir',
        numero: a.numero,
        date: a.date,
        patient: f?.snapPatientNom ?? '',
        montantCents: a.montantCents,
        reglement: '',
        modePaiement: '',
        reference: f ? `Annule ${f.numero}` : '',
      })
    }
    return lines
  }
}

/** `factures/2026/2026-0001.pdf`, relative to userData (survives a restore elsewhere). */
export function relativePdfPath(annee: number, numero: string): string {
  return join('factures', String(annee), `${numero}.pdf`)
}

function trimAll<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v).trim()])) as T
}
