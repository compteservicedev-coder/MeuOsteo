/**
 * Patients: search (SPEC §4), record (§5), creation and edition (R-15, R-17), deletion (R-14),
 * relatives (R-25) and their journal lines (R-20). Linked writes go through one transaction.
 */
import { and, eq, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import { isoDateInParis } from '@shared/domain/dates'
import { findDuplicates } from '@shared/domain/creationDuplicates'
import { deletedPatientSubject, patientJournal, type JournalLine } from '@shared/domain/journal'
import { daysBeforePurge, isPurgeDue } from '@shared/domain/patientDeletion'
import {
  changedFieldNames,
  normalizePatient,
  validatePatient,
  type NormalizedPatient,
  type PatientDraft,
} from '@shared/domain/patientValidation'
import {
  inverseRelation,
  linkError,
  orderLink,
  relationLabel,
  relationSeenFrom,
  type Relation,
} from '@shared/domain/relatives'
import { isEmptyQuery, parseSearchQuery, pushRecent } from '@shared/domain/search'
import { patientSearchKey } from '@shared/domain/text'
import type {
  DeletedPatientView,
  DuplicateQuery,
  DuplicateView,
  JournalLineView,
  LinkCandidate,
  LinkResult,
  PatientDetail,
  PatientListItem,
  PatientRecord,
  PatientSearchResult,
  RelativeView,
  SavePatientResult,
  TodayAppointment,
} from '@shared/types/patients'
import { z } from 'zod'
import type { AppDatabase } from '../db/client'
import { addJournalLine } from '../db/repositories/journalRepository'
import { getSetting, setSetting } from '../db/repositories/settingsRepository'
import { journal, patientLinks, patients, seances } from '../db/schema'
import { listSeances } from './seances'
import { DEFAULT_TARIFS_SETTING, tarifsSettingSchema } from './settingsSchemas'

const SEARCH_LIMIT = 50
const RECENT_KEY = 'recent_patients'
const recentSchema = z.array(z.string())

type PatientRow = typeof patients.$inferSelect

const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`)

function toRecord(row: PatientRow): PatientRecord {
  return {
    id: row.id,
    shortNo: row.shortNo,
    nom: row.nom,
    prenom: row.prenom,
    ddn: row.ddn,
    sexe: row.sexe,
    situation: row.situation,
    enfants: row.enfants,
    profession: row.profession,
    adresse: row.adresse,
    cp: row.cp,
    commune: row.commune,
    portable: row.portable,
    fixe: row.fixe,
    email: row.email,
    commentaire: row.commentaire,
    commentaireUpdatedAt: row.commentaireUpdatedAt,
    antecedentsTags: row.antecedentsTags,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
  }
}

function normalizedOf(row: PatientRow): NormalizedPatient {
  const { nom, prenom, ddn, sexe, situation, enfants, profession, adresse, cp, commune } = row
  return {
    nom,
    prenom,
    ddn,
    sexe,
    situation,
    enfants,
    profession,
    adresse,
    cp,
    commune,
    portable: row.portable,
    fixe: row.fixe,
    email: row.email,
  }
}

const LIST_COLUMNS = `p.id, p.nom, p.prenom, p.profession, p.ddn, p.commune, p.portable,
  (SELECT max(s.date) FROM seances s WHERE s.patient_id = p.id AND s.status = 'done') AS lastSeance`

export class PatientService {
  constructor(
    private readonly db: AppDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private today(): string {
    return isoDateInParis(this.now())
  }

  private row(id: string): PatientRow | undefined {
    return this.db.select().from(patients).where(eq(patients.id, id)).get()
  }

  private activeRow(id: string): PatientRow | undefined {
    return this.db
      .select()
      .from(patients)
      .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
      .get()
  }

  // ── Patients screen ──────────────────────────────────────────────────────

  /** Name, first name, phone (digits), commune and profession; accents and case ignored. */
  search(raw: string): PatientSearchResult {
    const query = parseSearchQuery(raw)
    if (isEmptyQuery(query)) return { items: [], truncated: false }
    const conditions: string[] = []
    const params: string[] = []
    if (query.phone) {
      conditions.push(`(p.portable LIKE ? ESCAPE '\\' OR p.fixe LIKE ? ESCAPE '\\')`)
      params.push(`%${query.phone}%`, `%${query.phone}%`)
    }
    for (const word of query.words) {
      const like = `%${escapeLike(word)}%`
      conditions.push(
        `(p.search_key LIKE ? ESCAPE '\\' OR fold(p.profession) LIKE ? ESCAPE '\\' OR fold(p.commune) LIKE ? ESCAPE '\\')`,
      )
      params.push(like, like, like)
    }
    const rows = this.db.$client
      .prepare(
        `SELECT ${LIST_COLUMNS} FROM patients p
         WHERE p.deleted_at IS NULL AND ${conditions.join(' AND ')}
         ORDER BY p.search_key LIMIT ${SEARCH_LIMIT + 1}`,
      )
      .all(...params) as PatientListItem[]
    return { items: rows.slice(0, SEARCH_LIMIT), truncated: rows.length > SEARCH_LIMIT }
  }

  /** « Consultés récemment »: last opened records, most recent first. */
  recent(): PatientListItem[] {
    const ids = getSetting(this.db, RECENT_KEY, recentSchema, [])
    if (ids.length === 0) return []
    const rows = this.db.$client
      .prepare(
        `SELECT ${LIST_COLUMNS} FROM patients p
         WHERE p.deleted_at IS NULL AND p.id IN (${ids.map(() => '?').join(', ')})`,
      )
      .all(...ids) as PatientListItem[]
    const byId = new Map(rows.map((r) => [r.id, r]))
    return ids.map((id) => byId.get(id)).filter((r): r is PatientListItem => Boolean(r))
  }

  markOpened(id: string): void {
    const ids = getSetting(this.db, RECENT_KEY, recentSchema, [])
    setSetting(this.db, RECENT_KEY, pushRecent(ids, id))
  }

  private forgetRecent(id: string): void {
    const ids = getSetting(this.db, RECENT_KEY, recentSchema, [])
    if (ids.includes(id))
      setSetting(
        this.db,
        RECENT_KEY,
        ids.filter((x) => x !== id),
      )
  }

  /** Sessions of the day (« Aujourd’hui »), by hour. */
  todayAppointments(): TodayAppointment[] {
    return this.db.$client
      .prepare(
        `SELECT s.id AS seanceId, p.id AS patientId, p.nom, p.prenom, s.heure, s.motif,
           NOT EXISTS (SELECT 1 FROM seances o WHERE o.patient_id = p.id AND o.status = 'done'
             AND o.date < s.date) AS isNew
         FROM seances s JOIN patients p ON p.id = s.patient_id
         WHERE s.date = ? AND s.status <> 'cancelled' AND p.deleted_at IS NULL
         ORDER BY s.heure IS NULL, s.heure, p.search_key`,
      )
      .all(this.today())
      .map((r) => ({ ...(r as TodayAppointment), isNew: Boolean((r as { isNew: number }).isNew) }))
  }

  activeCount(): number {
    return (
      this.db
        .select({ n: sql<number>`count(*)` })
        .from(patients)
        .where(isNull(patients.deletedAt))
        .get()?.n ?? 0
    )
  }

  // ── Record ──────────────────────────────────────────────────────────────

  get(id: string): PatientDetail | null {
    const row = this.row(id)
    if (!row) return null
    const tarifs = getSetting(this.db, 'tarifs', tarifsSettingSchema, DEFAULT_TARIFS_SETTING)
    const seanceViews = listSeances(this.db, id)
    return {
      patient: toRecord(row),
      seances: seanceViews,
      relatives: this.relatives(id),
      invoiceCount: (
        this.db.$client
          .prepare(`SELECT count(*) AS n FROM factures WHERE patient_id = ?`)
          .get(id) as { n: number }
      ).n,
      tarifsCents: tarifs.list,
    }
  }

  create(draft: PatientDraft): SavePatientResult {
    const errors = validatePatient(draft, this.today())
    if (Object.keys(errors).length > 0) return { ok: false, errors }
    const data = normalizePatient(draft)
    const id = ulid()
    this.db.transaction((tx) => {
      const max = tx
        .select({ max: sql<number | null>`max(${patients.shortNo})` })
        .from(patients)
        .get()
      tx.insert(patients)
        .values({
          id,
          ...data,
          shortNo: (max?.max ?? 0) + 1,
          searchKey: patientSearchKey(data.nom, data.prenom),
        })
        .run()
      addJournalLine(
        tx,
        {
          type: 'patient',
          subject: `${data.prenom} ${data.nom}`,
          action: patientJournal.created(),
          patientId: id,
        },
        this.now(),
      )
    })
    return { ok: true, id, changed: [] }
  }

  update(id: string, draft: PatientDraft): SavePatientResult {
    const row = this.activeRow(id)
    if (!row) return { ok: false, errors: { nom: 'Fiche introuvable' } }
    const errors = validatePatient(draft, this.today())
    if (Object.keys(errors).length > 0) return { ok: false, errors }
    const data = normalizePatient(draft)
    const changed = changedFieldNames(normalizedOf(row), data)
    if (changed.length === 0) return { ok: true, id, changed }
    this.db.transaction((tx) => {
      tx.update(patients)
        .set({ ...data, searchKey: patientSearchKey(data.nom, data.prenom) })
        .where(eq(patients.id, id))
        .run()
      addJournalLine(
        tx,
        {
          type: 'patient',
          subject: `${data.prenom} ${data.nom}`,
          action: patientJournal.modified(changed),
          patientId: id,
        },
        this.now(),
      )
    })
    return { ok: true, id, changed }
  }

  /** R-17: candidates sharing a name, phone, e-mail or birth date with the draft. */
  duplicates(q: DuplicateQuery): DuplicateView[] {
    const probe = normalizePatient({
      nom: q.nom,
      prenom: q.prenom,
      ddn: q.ddn,
      portable: q.portable,
      fixe: q.fixe,
      email: q.email,
      sexe: null,
      situation: null,
      enfants: null,
      profession: '',
      adresse: '',
      cp: '',
      commune: '',
    })
    const ors = []
    if (probe.nom && probe.prenom)
      ors.push(eq(patients.searchKey, patientSearchKey(probe.nom, probe.prenom)))
    for (const tel of [probe.portable, probe.fixe].filter((t): t is string => Boolean(t))) {
      ors.push(eq(patients.portable, tel), eq(patients.fixe, tel))
    }
    if (probe.email) ors.push(eq(patients.email, probe.email))
    if (/^\d{4}-\d{2}-\d{2}$/.test(probe.ddn)) ors.push(eq(patients.ddn, probe.ddn))
    if (ors.length === 0) return []
    const candidates = this.db
      .select()
      .from(patients)
      .where(
        and(
          isNull(patients.deletedAt),
          q.excludeId ? ne(patients.id, q.excludeId) : undefined,
          or(...ors),
        ),
      )
      .limit(50)
      .all()
    return findDuplicates(probe, candidates)
      .slice(0, 5)
      .map(({ patient, criteria }) => ({
        id: patient.id,
        nom: patient.nom,
        prenom: patient.prenom,
        ddn: patient.ddn,
        commune: patient.commune,
        criteria,
      }))
  }

  setComment(id: string, commentaire: string): { updatedAt: string } | null {
    const updatedAt = this.now().toISOString()
    const result = this.db
      .update(patients)
      .set({
        commentaire: commentaire === '' ? null : commentaire,
        commentaireUpdatedAt: updatedAt,
      })
      .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
      .run()
    return result.changes > 0 ? { updatedAt } : null
  }

  setAntecedents(id: string, tags: string[]): string[] {
    const clean = [...new Set(tags.map((t) => t.trim().replace(/\s+/g, ' ')).filter(Boolean))]
    this.db
      .update(patients)
      .set({ antecedentsTags: clean })
      .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
      .run()
    return clean
  }

  // ── Deletion (R-14) ─────────────────────────────────────────────────────

  /** Hides the record now; it is purged 30 days later. Invoices keep their snapshot. */
  softDelete(id: string): boolean {
    const row = this.activeRow(id)
    if (!row) return false
    const seanceCount =
      this.db
        .select({ n: sql<number>`count(*)` })
        .from(seances)
        .where(eq(seances.patientId, id))
        .get()?.n ?? 0
    this.db.transaction((tx) => {
      tx.update(patients)
        .set({ deletedAt: this.now().toISOString() })
        .where(eq(patients.id, id))
        .run()
      addJournalLine(
        tx,
        {
          type: 'patient',
          subject: deletedPatientSubject(row.shortNo),
          action: patientJournal.deleted(seanceCount),
          patientId: id,
        },
        this.now(),
      )
    })
    this.forgetRecent(id)
    return true
  }

  restore(id: string): boolean {
    const row = this.row(id)
    if (!row?.deletedAt) return false
    this.db.transaction((tx) => {
      tx.update(patients).set({ deletedAt: null }).where(eq(patients.id, id)).run()
      addJournalLine(
        tx,
        {
          type: 'patient',
          subject: `${row.prenom} ${row.nom}`,
          action: patientJournal.deletionCancelled(),
          patientId: id,
        },
        this.now(),
      )
    })
    return true
  }

  listDeleted(): DeletedPatientView[] {
    const now = this.now()
    return this.db
      .select({
        id: patients.id,
        shortNo: patients.shortNo,
        nom: patients.nom,
        prenom: patients.prenom,
        deletedAt: patients.deletedAt,
        // Qualified on purpose: inside the sub-query an unqualified "id" would be the session's.
        seances: sql<number>`(SELECT count(*) FROM seances s WHERE s.patient_id = "patients"."id")`,
      })
      .from(patients)
      .where(isNotNull(patients.deletedAt))
      .orderBy(sql`${patients.deletedAt} DESC`)
      .all()
      .map((r) => ({
        ...r,
        deletedAt: r.deletedAt!,
        daysLeft: daysBeforePurge(new Date(r.deletedAt!), now),
      }))
  }

  /**
   * Purges the records deleted more than 30 days ago: record, sessions, comment and links
   * (cascade). Their journal lines keep only « Patient n° X ». Returns the number purged.
   */
  purgeDue(): number {
    const now = this.now()
    const due = this.db
      .select({ id: patients.id, shortNo: patients.shortNo, deletedAt: patients.deletedAt })
      .from(patients)
      .where(isNotNull(patients.deletedAt))
      .all()
      .filter((r) => isPurgeDue(new Date(r.deletedAt!), now))
    for (const row of due) {
      this.db.transaction((tx) => {
        tx.update(journal)
          .set({ subject: deletedPatientSubject(row.shortNo) })
          .where(eq(journal.patientId, row.id))
          .run()
        tx.delete(patients).where(eq(patients.id, row.id)).run()
      })
      this.forgetRecent(row.id)
    }
    return due.length
  }

  // ── Relatives (R-25) ────────────────────────────────────────────────────

  relatives(id: string): RelativeView[] {
    const links = this.db
      .select()
      .from(patientLinks)
      .where(or(eq(patientLinks.patientA, id), eq(patientLinks.patientB, id)))
      .all()
    const result: RelativeView[] = []
    for (const link of links) {
      const otherId = link.patientA === id ? link.patientB : link.patientA
      // A deleted relative's link is hidden until the purge removes it (R-14).
      const other = this.activeRow(otherId)
      if (!other) continue
      result.push({
        patientId: other.id,
        nom: other.nom,
        prenom: other.prenom,
        relation: relationSeenFrom(id, link),
      })
    }
    return result.sort((a, b) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr'))
  }

  /** Existing records only, without the patient and the relatives already linked. */
  linkCandidates(id: string, raw: string): LinkCandidate[] {
    const linked = new Set([id, ...this.relatives(id).map((r) => r.patientId)])
    const source = raw.trim() ? this.search(raw).items : this.recent()
    return source
      .filter((p) => !linked.has(p.id))
      .slice(0, 20)
      .map((p) => ({ id: p.id, nom: p.nom, prenom: p.prenom, ddn: p.ddn, commune: p.commune }))
  }

  /** Saved at once on both records (independently of the edit panel). */
  addLink(id: string, otherId: string, relation: Relation): LinkResult {
    const self = this.activeRow(id)
    const other = this.activeRow(otherId)
    if (!self || !other) return { ok: false, reason: 'not_found' }
    const existing = this.relatives(id).map((r) => r.patientId)
    const error = linkError(id, otherId, existing)
    if (error) return { ok: false, reason: error }
    this.db.transaction((tx) => {
      tx.insert(patientLinks)
        .values(orderLink(id, otherId, relation))
        .run()
      const selfName = `${self.prenom} ${self.nom}`
      const otherName = `${other.prenom} ${other.nom}`
      addJournalLine(
        tx,
        this.linkLine(self, patientJournal.relativeLinked(otherName, relationLabel(relation))),
        this.now(),
      )
      addJournalLine(
        tx,
        this.linkLine(
          other,
          patientJournal.relativeLinked(selfName, relationLabel(inverseRelation(relation))),
        ),
        this.now(),
      )
    })
    return { ok: true }
  }

  removeLink(id: string, otherId: string): LinkResult {
    const self = this.row(id)
    const other = this.row(otherId)
    if (!self || !other) return { ok: false, reason: 'not_found' }
    const { patientA, patientB } = orderLink(id, otherId, 'autre')
    this.db.transaction((tx) => {
      const removed = tx
        .delete(patientLinks)
        .where(and(eq(patientLinks.patientA, patientA), eq(patientLinks.patientB, patientB)))
        .run()
      if (removed.changes === 0) return
      addJournalLine(
        tx,
        this.linkLine(self, patientJournal.relativeUnlinked(`${other.prenom} ${other.nom}`)),
        this.now(),
      )
      addJournalLine(
        tx,
        this.linkLine(other, patientJournal.relativeUnlinked(`${self.prenom} ${self.nom}`)),
        this.now(),
      )
    })
    return { ok: true }
  }

  private linkLine(subject: PatientRow, action: string): JournalLine {
    return {
      type: 'patient',
      subject: `${subject.prenom} ${subject.nom}`,
      action,
      patientId: subject.id,
    }
  }

  // ── Journal of the record (R-20) ────────────────────────────────────────

  journalFor(id: string): JournalLineView[] {
    return this.db
      .select({
        id: journal.id,
        at: journal.at,
        type: journal.type,
        subject: journal.subject,
        action: journal.action,
      })
      .from(journal)
      .where(eq(journal.patientId, id))
      .orderBy(sql`${journal.at} DESC`)
      .limit(200)
      .all()
  }

  /** Name used by other services for journal subjects. */
  subjectFor(id: string): string | null {
    const row = this.row(id)
    if (!row) return null
    return row.deletedAt ? deletedPatientSubject(row.shortNo) : `${row.prenom} ${row.nom}`
  }
}
