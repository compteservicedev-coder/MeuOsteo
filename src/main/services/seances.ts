/**
 * Sessions of a record (SPEC §5.2 – 5.3): R-02 validation, R-03 edition, R-06 cancellation,
 * R-07 deletion and R-08 uniqueness. A session is not a journal event (R-20), except its deletion.
 */
import { and, eq, ne, sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import { formatIsoDateFr, isValidIsoDate, isoDateInParis } from '@shared/domain/dates'
import {
  formatEurosShort,
  modePaiementLabel,
  reglementOf,
  UNLOCK_REASONS,
  type UnlockReason,
} from '@shared/domain/invoice'
import { lockJournal, patientJournal } from '@shared/domain/journal'
import {
  CANCEL_REASONS,
  binAction,
  compareSeancesDesc,
  markDoneErrors,
} from '@shared/domain/seance'
import type {
  CreateSeanceResult,
  SeanceChanges,
  SeanceFailure,
  SeanceResult,
  SeanceView,
} from '@shared/types/patients'
import type { AppDatabase, DbOrTx } from '../db/client'
import { addJournalLine } from '../db/repositories/journalRepository'
import { getSetting } from '../db/repositories/settingsRepository'
import { factures, patients, seances } from '../db/schema'
import { DEFAULT_TARIFS_SETTING, tarifsSettingSchema } from './settingsSchemas'

type SeanceRow = typeof seances.$inferSelect

type InvoiceRef = { id: string; numero: string }

function toView(row: SeanceRow, invoice: InvoiceRef | null): SeanceView {
  return {
    id: row.id,
    patientId: row.patientId,
    date: row.date,
    heure: row.heure,
    status: row.status,
    source: row.source,
    motif: row.motif,
    anamnese: row.anamnese,
    pratique: row.pratique,
    tarifCents: row.tarifCents,
    paiement: row.paiement,
    doneAt: row.doneAt,
    cancelReason: row.cancelReason,
    cancelledAt: row.cancelledAt,
    invoice,
  }
}

/** Active invoices (`statut = 'emise'`) of the given sessions. */
function invoicesBySeance(db: DbOrTx, ids: string[]): Map<string, InvoiceRef> {
  if (ids.length === 0) return new Map()
  const rows = db.all<{ seance_id: string; id: string; numero: string }>(
    sql`SELECT seance_id, id, numero FROM factures WHERE statut = 'emise' AND seance_id IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`,
  )
  return new Map(rows.map((r) => [r.seance_id, { id: r.id, numero: r.numero }]))
}

/** Sessions of a patient, most recent first (future ones on top). */
export function listSeances(db: DbOrTx, patientId: string): SeanceView[] {
  const rows = db.select().from(seances).where(eq(seances.patientId, patientId)).all()
  const invoices = invoicesBySeance(
    db,
    rows.map((r) => r.id),
  )
  return rows.sort(compareSeancesDesc).map((r) => toView(r, invoices.get(r.id) ?? null))
}

export interface SeanceServiceOptions {
  /** Called after a save changed the invoice of the session (its PDF must be regenerated). */
  onInvoiceChanged?: (factureId: string) => void
}

export class SeanceService {
  /** R-04: invoiced sessions whose date and tarif were unlocked, with the reason given. */
  private readonly unlocked = new Map<string, UnlockReason>()

  constructor(
    private readonly db: AppDatabase,
    private readonly now: () => Date = () => new Date(),
    private readonly options: SeanceServiceOptions = {},
  ) {}

  private today(): string {
    return isoDateInParis(this.now())
  }

  private load(id: string): { row: SeanceRow; view: SeanceView } | null {
    const row = this.db.select().from(seances).where(eq(seances.id, id)).get()
    if (!row) return null
    return { row, view: toView(row, invoicesBySeance(this.db, [id]).get(id) ?? null) }
  }

  private reload(id: string): SeanceResult {
    const loaded = this.load(id)
    return loaded ? { ok: true, seance: loaded.view } : { ok: false, reason: 'not_found' }
  }

  /** R-08: another non-cancelled session of the patient that day. */
  private sameDay(patientId: string, date: string, exceptId: string): SeanceRow | undefined {
    return this.db
      .select()
      .from(seances)
      .where(
        and(
          eq(seances.patientId, patientId),
          eq(seances.date, date),
          ne(seances.status, 'cancelled'),
          ne(seances.id, exceptId),
        ),
      )
      .get()
  }

  private defaultTarif(): number {
    return getSetting(this.db, 'tarifs', tarifsSettingSchema, DEFAULT_TARIFS_SETTING).defaultCents
  }

  /**
   * « Nouvelle » (R-08): opens today's session if there is one, otherwise creates a `planned`
   * session with the `manual` source (« Hors Doctolib »).
   */
  createToday(patientId: string): CreateSeanceResult {
    const patient = this.db
      .select({ id: patients.id, deletedAt: patients.deletedAt })
      .from(patients)
      .where(eq(patients.id, patientId))
      .get()
    if (!patient || patient.deletedAt) return { ok: false, reason: 'not_found' }
    const today = this.today()
    const existing = this.sameDay(patientId, today, '')
    if (existing) {
      return { ok: true, seance: this.load(existing.id)!.view, existing: true }
    }
    const id = ulid()
    this.db
      .insert(seances)
      .values({
        id,
        patientId,
        date: today,
        status: 'planned',
        source: 'manual',
        tarifCents: this.defaultTarif(),
      })
      .run()
    return { ok: true, seance: this.load(id)!.view, existing: false }
  }

  /** Checks the changes against R-03 / R-04 / R-08 and returns the values to write. */
  private checkChanges(
    row: SeanceRow,
    view: SeanceView,
    changes: SeanceChanges,
  ): SeanceFailure | Partial<SeanceRow> {
    if (row.status === 'cancelled') return { ok: false, reason: 'not_editable' }
    const invoiced = view.invoice !== null
    const date = changes.date ?? row.date
    const tarif = changes.tarifCents ?? row.tarifCents
    // R-04: date and tarif of an invoiced session stay locked unless unlocked with a reason.
    if (invoiced && !this.unlocked.has(row.id) && (date !== row.date || tarif !== row.tarifCents)) {
      return { ok: false, reason: 'locked' }
    }
    if (!isValidIsoDate(date)) return { ok: false, reason: 'invalid_date' }
    if (row.status === 'done' && date > this.today()) return { ok: false, reason: 'invalid_date' }
    if (invoiced && tarif <= 0) return { ok: false, reason: 'locked' }
    if (date !== row.date) {
      const other = this.sameDay(row.patientId, date, row.id)
      if (other) return { ok: false, reason: 'same_day', existingId: other.id }
    }
    const values: Partial<SeanceRow> = { date, tarifCents: tarif }
    if (changes.motif !== undefined) values.motif = changes.motif?.trim() || null
    if (changes.anamnese !== undefined) values.anamnese = changes.anamnese || null
    if (changes.pratique !== undefined) values.pratique = changes.pratique || null
    if (changes.paiement !== undefined) values.paiement = changes.paiement
    return values
  }

  /** « Enregistrer »: a planned session, or a done one in « Modifier » mode (R-03). */
  save(id: string, changes: SeanceChanges): SeanceResult {
    const loaded = this.load(id)
    if (!loaded) return { ok: false, reason: 'not_found' }
    const checked = this.checkChanges(loaded.row, loaded.view, changes)
    if ('ok' in checked) return checked
    const invoice = loaded.view.invoice
    let invoiceChanged = false
    this.db.transaction((tx) => {
      tx.update(seances).set(checked).where(eq(seances.id, id)).run()
      if (invoice)
        invoiceChanged = this.syncInvoice(tx, loaded.row, { ...loaded.row, ...checked }, invoice)
    })
    this.unlocked.delete(id)
    if (invoice && invoiceChanged) this.options.onInvoiceChanged?.(invoice.id)
    return this.reload(id)
  }

  private patientName(db: DbOrTx, patientId: string): string {
    const p = db
      .select({ nom: patients.nom, prenom: patients.prenom })
      .from(patients)
      .where(eq(patients.id, patientId))
      .get()
    return p ? `${p.prenom} ${p.nom}` : 'Patient'
  }

  /**
   * Keeps the invoice of an edited session in step: date and tarif after an R-04 unlock
   * (« modifiée », journal), payment received or expected. Returns true if the invoice changed.
   */
  private syncInvoice(
    tx: DbOrTx,
    before: SeanceRow,
    after: SeanceRow,
    invoice: InvoiceRef,
  ): boolean {
    const reason = this.unlocked.get(before.id)
    const subject = this.patientName(tx, before.patientId)
    const changes: string[] = []
    if (after.tarifCents !== before.tarifCents) {
      changes.push(
        `tarif ${formatEurosShort(before.tarifCents)} → ${formatEurosShort(after.tarifCents)}`,
      )
    }
    if (after.date !== before.date) {
      changes.push(`date ${formatIsoDateFr(before.date)} → ${formatIsoDateFr(after.date)}`)
    }
    const set: Partial<typeof factures.$inferInsert> = {}
    if (changes.length > 0) {
      set.snapDateSeance = after.date
      set.montantCents = after.tarifCents
      set.modifiedAt = this.now().toISOString()
      set.modifiedNote = reason ?? null
      addJournalLine(
        tx,
        {
          type: 'facture',
          subject,
          action: `Facture ${invoice.numero} modifiée : ${changes.join(', ')}`,
          patientId: before.patientId,
        },
        this.now(),
      )
    } else if (reason) {
      addJournalLine(
        tx,
        {
          type: 'verrouillage',
          subject,
          action: lockJournal.relockedUnchanged(formatIsoDateFr(before.date)),
          patientId: before.patientId,
        },
        this.now(),
      )
    }
    if (after.paiement !== before.paiement) {
      const reglement = reglementOf(after.paiement)
      set.reglement = reglement
      set.modePaiement = modePaiementLabel(after.paiement)
      set.acquitteeLe =
        reglement === 'acquittee' && after.paiement === 'virement_recu' ? this.today() : null
    }
    if (Object.keys(set).length === 0) return false
    tx.update(factures).set(set).where(eq(factures.id, invoice.id)).run()
    return true
  }

  /**
   * R-04 « Déverrouiller date et tarif… »: only on an invoiced, done session, with a reason.
   * Journal: « Séance du … déverrouillée (facture N) · motif : … ».
   */
  unlock(id: string, reason: string): { ok: true } | SeanceFailure {
    const loaded = this.load(id)
    if (!loaded) return { ok: false, reason: 'not_found' }
    const { row, view } = loaded
    if (row.status !== 'done' || !view.invoice) return { ok: false, reason: 'not_editable' }
    if (!(UNLOCK_REASONS as readonly string[]).includes(reason)) {
      return { ok: false, reason: 'not_editable' }
    }
    this.unlocked.set(id, reason as UnlockReason)
    addJournalLine(
      this.db,
      {
        type: 'verrouillage',
        subject: this.patientName(this.db, row.patientId),
        action: lockJournal.unlocked(formatIsoDateFr(row.date), view.invoice.numero, reason),
        patientId: row.patientId,
      },
      this.now(),
    )
    return { ok: true }
  }

  /** « Annuler » of an unlocked edit: locked again, the invoice is unchanged. */
  relock(id: string): void {
    if (!this.unlocked.delete(id)) return
    const row = this.db.select().from(seances).where(eq(seances.id, id)).get()
    if (!row) return
    addJournalLine(
      this.db,
      {
        type: 'verrouillage',
        subject: this.patientName(this.db, row.patientId),
        action: lockJournal.relockedUnchanged(formatIsoDateFr(row.date)),
        patientId: row.patientId,
      },
      this.now(),
    )
  }

  isUnlocked(id: string): boolean {
    return this.unlocked.has(id)
  }

  /** R-02 « ✓ Séance réalisée »: saves the changes, then locks the session as `done`. */
  markDone(id: string, changes: SeanceChanges): SeanceResult {
    const loaded = this.load(id)
    if (!loaded) return { ok: false, reason: 'not_found' }
    if (loaded.row.status !== 'planned') return { ok: false, reason: 'not_editable' }
    const checked = this.checkChanges(loaded.row, loaded.view, changes)
    if ('ok' in checked) return checked
    const merged = { ...loaded.row, ...checked }
    const errors = markDoneErrors(merged, this.today())
    if (errors.length > 0) return { ok: false, reason: 'mark_done', errors }
    this.db
      .update(seances)
      .set({ ...checked, status: 'done', doneAt: this.now().toISOString() })
      .where(eq(seances.id, id))
      .run()
    return this.reload(id)
  }

  /** R-06: a reason is mandatory; the session stays visible, struck out, with its notes. */
  cancel(id: string, reason: string): SeanceResult {
    const loaded = this.load(id)
    if (!loaded) return { ok: false, reason: 'not_found' }
    if (
      binAction({ status: loaded.row.status, invoiced: loaded.view.invoice !== null }) !== 'cancel'
    ) {
      return { ok: false, reason: 'not_editable' }
    }
    if (!(CANCEL_REASONS as readonly string[]).includes(reason)) {
      return { ok: false, reason: 'not_editable' }
    }
    this.db
      .update(seances)
      .set({
        status: 'cancelled',
        cancelReason: reason,
        cancelledAt: this.now().toISOString(),
        prevStatus: loaded.row.status,
      })
      .where(eq(seances.id, id))
      .run()
    return this.reload(id)
  }

  /** « Rétablir la séance »: back to its previous status, unless the day is taken (R-08). */
  restore(id: string): SeanceResult {
    const loaded = this.load(id)
    if (!loaded) return { ok: false, reason: 'not_found' }
    const { row } = loaded
    if (row.status !== 'cancelled') return { ok: false, reason: 'not_editable' }
    const other = this.sameDay(row.patientId, row.date, row.id)
    if (other) return { ok: false, reason: 'same_day', existingId: other.id }
    this.db
      .update(seances)
      .set({
        status: row.prevStatus ?? 'planned',
        cancelReason: null,
        cancelledAt: null,
        prevStatus: null,
      })
      .where(eq(seances.id, id))
      .run()
    return this.reload(id)
  }

  /**
   * R-07: a done, non-invoiced session is deleted for good, with a journal line. An invoiced
   * session cannot be deleted: its invoice must be deleted first (R-13).
   */
  delete(id: string): { ok: true } | SeanceFailure {
    const loaded = this.load(id)
    if (!loaded) return { ok: false, reason: 'not_found' }
    if (loaded.view.invoice) return { ok: false, reason: 'invoiced' }
    if (binAction({ status: loaded.row.status, invoiced: false }) !== 'delete') {
      return { ok: false, reason: 'not_editable' }
    }
    const patient = this.db
      .select({ nom: patients.nom, prenom: patients.prenom })
      .from(patients)
      .where(eq(patients.id, loaded.row.patientId))
      .get()
    this.db.transaction((tx) => {
      tx.delete(seances).where(eq(seances.id, id)).run()
      addJournalLine(
        tx,
        {
          type: 'patient',
          subject: patient ? `${patient.prenom} ${patient.nom}` : 'Patient',
          action: patientJournal.seanceDeleted(formatIsoDateFr(loaded.row.date)),
          patientId: loaded.row.patientId,
        },
        this.now(),
      )
    })
    return { ok: true }
  }
}
