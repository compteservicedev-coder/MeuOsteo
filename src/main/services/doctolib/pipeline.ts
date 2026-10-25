/**
 * Rapprochement pipeline (GMAIL_DOCTOLIB.md §5, R-09, R-18): every Doctolib appointment, from an
 * e-mail or from the export, goes through `ingest`. Re-processing the same message changes
 * nothing (idempotence on the appointment key and the Message-ID).
 */
import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import { formatIsoDateFr } from '@shared/domain/dates'
import {
  childAlert,
  contactKey,
  decideMatch,
  normalizeEmail,
  normalizePhone,
  prefillFromDisplayName,
  rdvKey,
  type MatchablePatient,
  type ParsedRdv,
} from '@shared/domain/matching'
import { DEFAULT_AGENDA, blockCovers } from '@shared/domain/planning'
import type { PatientDraft } from '@shared/domain/patientValidation'
import type {
  AlertTask,
  AttachResult,
  CreateAndAttachResult,
  RdvCandidates,
  RdvView,
} from '@shared/types/planning'
import type { PendingRdvTask } from '@shared/types/reconcile'
import type { AppDatabase, DbOrTx } from '../../db/client'
import { getSetting, setSetting } from '../../db/repositories/settingsRepository'
import { blocages, contactMemory, doctolibRdv, patients, seances } from '../../db/schema'
import type { PatientService } from '../patients'
import {
  DEFAULT_TARIFS_SETTING,
  agendaSettingSchema,
  dismissedAlertsSchema,
  tarifsSettingSchema,
} from '../settingsSchemas'

type RdvRow = typeof doctolibRdv.$inferSelect

export const DOCTOLIB_CANCEL_REASON = 'Annulée sur Doctolib'

export type IngestOutcome =
  'attached' | 'pending_new' | 'pending_multi' | 'moved' | 'cancelled' | 'unchanged' | 'alert'

export interface IngestSource {
  /** Message-ID of the e-mail, or `export:<id>` for the Doctolib export. */
  messageId: string
  receivedAt: string
}

export class RdvPipeline {
  constructor(
    private readonly db: AppDatabase,
    private readonly patientService: PatientService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private agenda() {
    return getSetting(this.db, 'agenda', agendaSettingSchema, DEFAULT_AGENDA)
  }

  private matchable(db: DbOrTx): MatchablePatient[] {
    return db
      .select({
        id: patients.id,
        nom: patients.nom,
        prenom: patients.prenom,
        ddn: patients.ddn,
        portable: patients.portable,
        fixe: patients.fixe,
        email: patients.email,
      })
      .from(patients)
      .where(isNull(patients.deletedAt))
      .all()
  }

  private remembered(db: DbOrTx, rdv: { telephone: string | null; email: string | null }) {
    const key = contactKey(rdv.telephone, rdv.email)
    if (!key) return null
    return (
      db
        .select({ patientId: contactMemory.patientId })
        .from(contactMemory)
        .where(eq(contactMemory.contactKey, key))
        .get()?.patientId ?? null
    )
  }

  private row(db: DbOrTx, key: string): RdvRow | undefined {
    return db.select().from(doctolibRdv).where(eq(doctolibRdv.key, key)).get()
  }

  private tarifDefault(db: DbOrTx) {
    return getSetting(db, 'tarifs', tarifsSettingSchema, DEFAULT_TARIFS_SETTING).defaultCents
  }

  /**
   * R-09: a matched appointment creates or updates *its* session. A non-cancelled session of
   * the patient that day (e.g. created by hand, R-24) is reused instead of creating a second one.
   */
  private attachToPatient(
    db: DbOrTx,
    row: RdvRow,
    patientId: string,
    match: 'auto' | 'manual',
  ): string | null {
    let seanceId: string | null = null
    if (row.etat !== 'annule') {
      const linked = row.seanceId
        ? db.select().from(seances).where(eq(seances.id, row.seanceId)).get()
        : undefined
      const sameDay =
        linked && linked.patientId === patientId && linked.status !== 'cancelled'
          ? linked
          : db
              .select()
              .from(seances)
              .where(
                and(
                  eq(seances.patientId, patientId),
                  eq(seances.date, row.date),
                  ne(seances.status, 'cancelled'),
                ),
              )
              .get()
      if (sameDay) {
        seanceId = sameDay.id
        const set: Partial<typeof seances.$inferInsert> = {}
        if (!sameDay.doctolibKey) set.doctolibKey = row.key
        if (sameDay.status === 'planned' && row.heure) set.heure = row.heure
        if (sameDay.status === 'planned' && !sameDay.motif && row.motif) set.motif = row.motif
        if (Object.keys(set).length > 0) {
          db.update(seances).set(set).where(eq(seances.id, sameDay.id)).run()
        }
      } else {
        seanceId = ulid()
        db.insert(seances)
          .values({
            id: seanceId,
            patientId,
            date: row.date,
            heure: row.heure,
            status: 'planned',
            source: 'doctolib',
            doctolibKey: row.key,
            motif: row.motif,
            tarifCents: this.tarifDefault(db),
          })
          .run()
      }
    }
    db.update(doctolibRdv)
      .set({ match, patientId, seanceId })
      .where(eq(doctolibRdv.key, row.key))
      .run()
    return seanceId
  }

  /** Runs the R-18 decision on a stored appointment and applies it. */
  private reconcile(db: DbOrTx, row: RdvRow): IngestOutcome {
    const parsed: ParsedRdv = {
      type: 'new',
      date: row.date,
      heure: row.heure,
      nom: row.nomAffiche,
      telephone: row.telephone,
      email: row.email,
      motif: row.motif,
    }
    const decision = decideMatch(parsed, this.matchable(db), {
      remembered: this.remembered(db, row),
      autoAttach: this.agenda().autoAttach,
    })
    if (decision.kind === 'auto') {
      this.attachToPatient(db, row, decision.patientId, 'auto')
      return 'attached'
    }
    const match = decision.kind === 'multi' ? 'pending_multi' : 'pending_new'
    db.update(doctolibRdv).set({ match }).where(eq(doctolibRdv.key, row.key)).run()
    return match
  }

  private addMessage(db: DbOrTx, row: RdvRow, messageId: string) {
    if (row.messageIds.includes(messageId)) return
    db.update(doctolibRdv)
      .set({ messageIds: [...row.messageIds, messageId] })
      .where(eq(doctolibRdv.key, row.key))
      .run()
  }

  /** One appointment from a parser (e-mail) or the export. Idempotent. */
  ingest(rdv: ParsedRdv, source: IngestSource): { key: string; outcome: IngestOutcome } {
    return this.db.transaction(
      (tx) => {
        const telephone = normalizePhone(rdv.telephone)
        const email = normalizeEmail(rdv.email)
        const key = rdvKey({ ...rdv, telephone })
        // Idempotence: a message already processed, even if its appointment moved since.
        const seen = tx.get<{ key: string }>(
          sql`SELECT key FROM doctolib_rdv WHERE EXISTS (SELECT 1 FROM json_each(message_ids) WHERE value = ${source.messageId})`,
        )
        if (seen) return { key: seen.key, outcome: 'unchanged' }
        const existing = this.row(tx, key)

        if (rdv.type === 'cancelled') return { key, outcome: this.cancel(tx, rdv, key, source) }

        if (rdv.type === 'modified' && rdv.ancienneDate) {
          const oldKey = rdvKey({
            date: rdv.ancienneDate,
            heure: rdv.ancienneHeure ?? null,
            nom: rdv.nom,
            telephone,
          })
          const old = oldKey !== key ? this.row(tx, oldKey) : undefined
          if (old && !existing) return { key, outcome: this.move(tx, old, rdv, key, source) }
        }

        if (existing) {
          this.addMessage(tx, existing, source.messageId)
          if (existing.etat === 'annule') {
            tx.update(doctolibRdv).set({ etat: 'confirme' }).where(eq(doctolibRdv.key, key)).run()
            return { key, outcome: this.reconcile(tx, { ...existing, etat: 'confirme' }) }
          }
          return { key, outcome: 'unchanged' }
        }

        tx.insert(doctolibRdv)
          .values({
            key,
            date: rdv.date,
            heure: rdv.heure,
            nomAffiche: rdv.nom.trim(),
            telephone,
            email,
            motif: rdv.motif?.trim() || null,
            etat: rdv.type === 'modified' ? 'modifie' : 'confirme',
            match: 'pending_new',
            messageIds: [source.messageId],
            receivedAt: source.receivedAt,
          })
          .run()
        return { key, outcome: this.reconcile(tx, this.row(tx, key)!) }
      },
      { behavior: 'immediate' },
    )
  }

  /** « Modification »: the appointment moves; its session follows unless already done. */
  private move(
    tx: DbOrTx,
    old: RdvRow,
    rdv: ParsedRdv,
    key: string,
    source: IngestSource,
  ): IngestOutcome {
    tx.update(doctolibRdv)
      .set({
        key,
        date: rdv.date,
        heure: rdv.heure,
        motif: rdv.motif?.trim() || old.motif,
        etat: 'modifie',
        messageIds: [...old.messageIds, source.messageId],
      })
      .where(eq(doctolibRdv.key, old.key))
      .run()
    const seance = old.seanceId
      ? tx.select().from(seances).where(eq(seances.id, old.seanceId)).get()
      : undefined
    if (!seance) {
      return old.patientId ? 'moved' : this.reconcile(tx, this.row(tx, key)!)
    }
    if (seance.status === 'done') return 'alert'
    const other = tx
      .select()
      .from(seances)
      .where(
        and(
          eq(seances.patientId, seance.patientId),
          eq(seances.date, rdv.date),
          ne(seances.status, 'cancelled'),
          ne(seances.id, seance.id),
        ),
      )
      .get()
    if (other) {
      // The patient already has a session on the new day (R-08): the appointment joins it.
      tx.update(seances)
        .set({
          status: 'cancelled',
          cancelReason: 'Reportée',
          cancelledAt: this.now().toISOString(),
          prevStatus: seance.status,
          doctolibKey: null,
        })
        .where(eq(seances.id, seance.id))
        .run()
      tx.update(doctolibRdv).set({ seanceId: null }).where(eq(doctolibRdv.key, key)).run()
      const match = old.match === 'manual' ? 'manual' : 'auto'
      this.attachToPatient(tx, this.row(tx, key)!, seance.patientId, match)
      return 'moved'
    }
    tx.update(seances)
      .set({
        date: rdv.date,
        heure: rdv.heure,
        doctolibKey: key,
        status: 'planned',
        cancelReason: null,
        cancelledAt: null,
      })
      .where(eq(seances.id, seance.id))
      .run()
    return 'moved'
  }

  /** « Annulation »: the session is cancelled, unless it is already done (alert). */
  private cancel(tx: DbOrTx, rdv: ParsedRdv, key: string, source: IngestSource): IngestOutcome {
    const existing = this.row(tx, key)
    if (!existing) {
      tx.insert(doctolibRdv)
        .values({
          key,
          date: rdv.date,
          heure: rdv.heure,
          nomAffiche: rdv.nom.trim(),
          telephone: normalizePhone(rdv.telephone),
          email: normalizeEmail(rdv.email),
          motif: rdv.motif?.trim() || null,
          etat: 'annule',
          // Nothing to cancel: the appointment is only kept for idempotence.
          match: 'auto',
          messageIds: [source.messageId],
          receivedAt: source.receivedAt,
        })
        .run()
      return 'cancelled'
    }
    tx.update(doctolibRdv)
      .set({ etat: 'annule', messageIds: [...existing.messageIds, source.messageId] })
      .where(eq(doctolibRdv.key, key))
      .run()
    const seance = existing.seanceId
      ? tx.select().from(seances).where(eq(seances.id, existing.seanceId)).get()
      : undefined
    if (seance?.status === 'done') return 'alert'
    if (seance && seance.status === 'planned') {
      tx.update(seances)
        .set({
          status: 'cancelled',
          cancelReason: DOCTOLIB_CANCEL_REASON,
          cancelledAt: this.now().toISOString(),
          prevStatus: 'planned',
        })
        .where(eq(seances.id, seance.id))
        .run()
    }
    return 'cancelled'
  }

  // --- « À rapprocher » --------------------------------------------------------------------

  private view(row: RdvRow): RdvView {
    return {
      key: row.key,
      date: row.date,
      heure: row.heure,
      nomAffiche: row.nomAffiche,
      telephone: row.telephone,
      email: row.email,
      motif: row.motif,
      receivedAt: row.receivedAt,
    }
  }

  pendingTasks(): PendingRdvTask[] {
    return this.db
      .select()
      .from(doctolibRdv)
      .where(
        and(
          inArray(doctolibRdv.match, ['pending_new', 'pending_multi']),
          ne(doctolibRdv.etat, 'annule'),
        ),
      )
      .orderBy(asc(doctolibRdv.date), asc(doctolibRdv.heure))
      .all()
      .map((r) => ({
        key: r.key,
        nomAffiche: r.nomAffiche,
        date: r.date,
        heure: r.heure,
        match: r.match as 'pending_new' | 'pending_multi',
        motif: r.motif,
      }))
  }

  candidates(key: string): RdvCandidates | null {
    const row = this.row(this.db, key)
    if (!row) return null
    const parsed: ParsedRdv = {
      type: 'new',
      date: row.date,
      heure: row.heure,
      nom: row.nomAffiche,
      telephone: row.telephone,
      email: row.email,
      motif: row.motif,
    }
    const all = this.matchable(this.db)
    const decision = decideMatch(parsed, all, { remembered: null, autoAttach: false })
    const list = decision.kind === 'multi' ? decision.candidates : []
    const byId = new Map(all.map((p) => [p.id, p]))
    const last = new Map(
      this.db
        .all<{ patient_id: string; d: string }>(
          sql`SELECT patient_id, max(date) AS d FROM seances WHERE status != 'cancelled' GROUP BY patient_id`,
        )
        .map((r) => [r.patient_id, r.d]),
    )
    const prefill = prefillFromDisplayName(row.nomAffiche)
    return {
      rdv: this.view(row),
      candidates: list.map((c) => {
        const p = byId.get(c.patientId)!
        return {
          patientId: p.id,
          nom: p.nom,
          prenom: p.prenom,
          ddn: p.ddn,
          lastSeance: last.get(p.id) ?? null,
          checks: c.checks,
          score: c.score,
          note: childAlert(parsed, p),
        }
      }),
      prefill: {
        ...prefill,
        portable: row.telephone ?? '',
        email: row.email ?? '',
      },
    }
  }

  /** « Rattacher à X » / « C'est cette personne : rattacher » (R-18, « Mémoriser ce choix »). */
  attach(key: string, patientId: string, remember: boolean): AttachResult {
    return this.db.transaction(
      (tx) => {
        const row = this.row(tx, key)
        const patient = tx
          .select({ id: patients.id })
          .from(patients)
          .where(and(eq(patients.id, patientId), isNull(patients.deletedAt)))
          .get()
        if (!row || !patient) return { ok: false as const, reason: 'not_found' as const }
        const seanceId = this.attachToPatient(tx, row, patientId, 'manual')
        const ck = contactKey(row.telephone, row.email)
        if (remember && ck) {
          tx.insert(contactMemory)
            .values({ contactKey: ck, patientId })
            .onConflictDoUpdate({ target: contactMemory.contactKey, set: { patientId } })
            .run()
        }
        return { ok: true as const, patientId, seanceId }
      },
      { behavior: 'immediate' },
    )
  }

  /** « Créer la fiche et rattacher le RDV »: one transaction (R-15 checks on the record). */
  createAndAttach(key: string, draft: PatientDraft): CreateAndAttachResult {
    return this.db.transaction(
      (tx) => {
        const row = this.row(tx, key)
        if (!row) return { ok: false as const, reason: 'not_found' as const }
        const created = this.patientService.create(draft, tx)
        if (!created.ok) {
          return { ok: false as const, reason: 'invalid' as const, errors: created.errors }
        }
        const seanceId = this.attachToPatient(tx, row, created.id, 'manual')
        return { ok: true as const, patientId: created.id, seanceId }
      },
      { behavior: 'immediate' },
    )
  }

  /** Done sessions touched by Doctolib, and appointments inside a blocked period (R-23). */
  alerts(today: string): AlertTask[] {
    const dismissed = new Set(getSetting(this.db, 'dismissed_alerts', dismissedAlertsSchema, []))
    const out: AlertTask[] = []
    const rows = this.db
      .select({
        key: doctolibRdv.key,
        date: doctolibRdv.date,
        heure: doctolibRdv.heure,
        nom: doctolibRdv.nomAffiche,
        etat: doctolibRdv.etat,
        patientId: doctolibRdv.patientId,
        seanceId: doctolibRdv.seanceId,
        status: seances.status,
        seanceDate: seances.date,
      })
      .from(doctolibRdv)
      .leftJoin(seances, eq(seances.id, doctolibRdv.seanceId))
      .all()
    for (const r of rows) {
      if (r.status === 'done' && r.etat === 'annule') {
        out.push({
          id: `done_cancelled:${r.key}`,
          kind: 'done_cancelled',
          title: `${r.nom} · RDV annulé sur Doctolib`,
          sub: `La séance du ${formatIsoDateFr(r.seanceDate!)} est déjà réalisée : elle est conservée.`,
          patientId: r.patientId,
          seanceId: r.seanceId,
        })
      } else if (r.status === 'done' && r.seanceDate !== r.date) {
        out.push({
          id: `done_moved:${r.key}:${r.date}`,
          kind: 'done_moved',
          title: `${r.nom} · RDV déplacé sur Doctolib`,
          sub: `Déplacé au ${formatIsoDateFr(r.date)}, mais la séance du ${formatIsoDateFr(r.seanceDate!)} est déjà réalisée.`,
          patientId: r.patientId,
          seanceId: r.seanceId,
        })
      }
    }
    const blocks = this.db
      .select()
      .from(blocages)
      .where(sql`${blocages.date} >= ${today}`)
      .all()
    if (blocks.length > 0) {
      const byDate = new Map<string, typeof blocks>()
      for (const b of blocks) byDate.set(b.date, [...(byDate.get(b.date) ?? []), b])
      for (const r of rows) {
        if (r.etat === 'annule' || r.date < today) continue
        const b = byDate.get(r.date)?.find((x) => blockCovers(x.creneau, r.heure))
        if (!b) continue
        out.push({
          id: `block_conflict:${r.key}:${b.id}`,
          kind: 'block_conflict',
          title: `${r.nom} · RDV Doctolib sur une période bloquée`,
          sub: `${formatIsoDateFr(r.date)}${r.heure ? ` à ${r.heure}` : ''} · ${b.motif ?? 'bloqué'}. Vérifiez dans Doctolib.`,
          patientId: r.patientId,
          seanceId: r.seanceId,
        })
      }
    }
    return out.filter((a) => !dismissed.has(a.id))
  }

  dismissAlert(id: string): void {
    const list = getSetting(this.db, 'dismissed_alerts', dismissedAlertsSchema, [])
    if (!list.includes(id)) setSetting(this.db, 'dismissed_alerts', [...list, id].slice(-500))
  }
}
