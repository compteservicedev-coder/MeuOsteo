import { and, asc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { isoDateInParis } from '@shared/domain/dates'
import {
  MERGE_FIELDS,
  MERGE_FIELD_LABELS,
  defaultMergePicks,
  duplicateReasons,
  findDuplicatePairs,
  formatMergeValue,
  isMergeFieldEmpty,
  mergePatients,
  pairKey,
  relinkAfterMerge,
  sameMergeField,
  type DuplicatePair,
  type MergeablePatient,
} from '@shared/domain/duplicates'
import { patientSearchKey } from '@shared/domain/text'
import type {
  DuplicateTask,
  MergeComparison,
  MergeRecordSummary,
  MergeRequest,
  MergeResult,
} from '@shared/types/reconcile'
import type { AppDatabase } from '../client'
import {
  contactMemory,
  doctolibRdv,
  duplicateIgnored,
  factures,
  journal,
  patientLinks,
  patients,
  seances,
} from '../schema'
import { addJournalLine } from './journalRepository'

const active = isNull(patients.deletedAt)

/**
 * R-19: computed on demand rather than stored. Only records whose birth date is shared are read,
 * so the list is always current (after an import, a merge or an edit) at a negligible cost.
 */
export function listDuplicatePairs(db: AppDatabase): DuplicatePair[] {
  const sharedDdn = db
    .select({ ddn: patients.ddn })
    .from(patients)
    .where(active)
    .groupBy(patients.ddn)
    .having(sql`count(*) > 1`)
  const candidates = db
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
    .where(and(active, inArray(patients.ddn, sharedDdn)))
    .orderBy(asc(patients.shortNo))
    .all()
  const ignored = new Set(
    db
      .select()
      .from(duplicateIgnored)
      .all()
      .map((r) => pairKey(r.patientA, r.patientB)),
  )
  return findDuplicatePairs(candidates, ignored)
}

export function countDuplicatePairs(db: AppDatabase): number {
  return listDuplicatePairs(db).length
}

/** Tasks of « À rapprocher », the older record (smaller short number) first. */
export function listDuplicateTasks(db: AppDatabase): DuplicateTask[] {
  const pairs = listDuplicatePairs(db)
  if (pairs.length === 0) return []
  const ids = [...new Set(pairs.flatMap((p) => [p.a, p.b]))]
  const rows = db
    .select({
      id: patients.id,
      shortNo: patients.shortNo,
      nom: patients.nom,
      prenom: patients.prenom,
    })
    .from(patients)
    .where(inArray(patients.id, ids))
    .all()
  const byId = new Map(rows.map((r) => [r.id, r]))
  return pairs.map(({ a, b, reasons }) => {
    const [first, second] = [byId.get(a)!, byId.get(b)!].sort((x, y) => x.shortNo - y.shortNo)
    const side = (r: typeof first) => ({ id: r!.id, name: `${r!.prenom} ${r!.nom}`.trim() })
    return { a: side(first), b: side(second), reasons }
  })
}

/** « Ce ne sont pas les mêmes personnes »: the pair is never proposed again. */
export function ignoreDuplicatePair(db: AppDatabase, x: string, y: string, now = new Date()) {
  if (x === y) return { ok: false as const }
  const [patientA, patientB] = x < y ? [x, y] : [y, x]
  db.insert(duplicateIgnored)
    .values({ patientA, patientB, at: now.toISOString() })
    .onConflictDoNothing()
    .run()
  return { ok: true as const }
}

type PatientRow = typeof patients.$inferSelect

function loadActive(db: AppDatabase, id: string): PatientRow | undefined {
  return db
    .select()
    .from(patients)
    .where(and(eq(patients.id, id), active))
    .get()
}

const mergeable = (p: PatientRow): MergeablePatient => ({
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
  antecedentsTags: p.antecedentsTags,
})

function summary(db: AppDatabase, p: PatientRow): MergeRecordSummary {
  const stats = db
    .select({ n: sql<number>`count(*)`, last: sql<string | null>`max(${seances.date})` })
    .from(seances)
    .where(eq(seances.patientId, p.id))
    .get()
  return {
    id: p.id,
    shortNo: p.shortNo,
    imported: p.legacyKey !== null,
    createdAt: p.createdAt,
    seances: stats?.n ?? 0,
    lastSeance: stats?.last ?? null,
  }
}

/** R-08: days on which both records have a non-cancelled session outside the import. */
function conflictDates(db: AppDatabase, keepId: string, removeId: string): string[] {
  const days = (id: string) =>
    db
      .selectDistinct({ date: seances.date })
      .from(seances)
      .where(
        and(
          eq(seances.patientId, id),
          ne(seances.status, 'cancelled'),
          ne(seances.source, 'import'),
        ),
      )
      .all()
      .map((r) => r.date)
  const kept = new Set(days(keepId))
  return days(removeId)
    .filter((d) => kept.has(d))
    .sort()
}

/** Both records side by side (SPEC §3 « Doublon possible »), the older one as « fiche A ». */
export function getMergeComparison(db: AppDatabase, x: string, y: string): MergeComparison | null {
  const [first, second] = [loadActive(db, x), loadActive(db, y)]
  if (!first || !second || first.id === second.id) return null
  const [a, b] = first.shortNo <= second.shortNo ? [first, second] : [second, first]
  const [ma, mb] = [mergeable(a), mergeable(b)]
  return {
    a: summary(db, a),
    b: summary(db, b),
    reasons: duplicateReasons(a, b),
    rows: MERGE_FIELDS.filter((f) => !isMergeFieldEmpty(ma, f) || !isMergeFieldEmpty(mb, f)).map(
      (field) => ({
        field,
        label: MERGE_FIELD_LABELS[field],
        a: formatMergeValue(ma, field),
        b: formatMergeValue(mb, field),
        same: sameMergeField(ma, mb, field),
      }),
    ),
    picks: defaultMergePicks(ma, mb),
    conflictDates: conflictDates(db, a.id, b.id),
  }
}

/**
 * R-19 « Fusionner les fiches »: chosen values on the kept record, sessions, invoices, Doctolib
 * appointments, remembered contacts, relatives and journal lines moved to it, comments end to
 * end, then the other record is deleted. One transaction, one journal line.
 */
export function mergeDuplicatePair(
  db: AppDatabase,
  { keepId, removeId, picks }: MergeRequest,
  now = new Date(),
): MergeResult {
  const keep = loadActive(db, keepId)
  const remove = loadActive(db, removeId)
  if (!keep || !remove || keep.id === remove.id) return { ok: false, reason: 'not_found' }
  const dates = conflictDates(db, keep.id, remove.id)
  if (dates.length) return { ok: false, reason: 'same_day_conflict', dates }

  const merged = mergePatients(mergeable(keep), mergeable(remove), picks, isoDateInParis(now))
  const at = now.toISOString()

  db.$client.transaction(() => {
    db.update(patients)
      .set({
        ...merged,
        legacyKey: keep.legacyKey ?? remove.legacyKey,
        commentaireUpdatedAt:
          merged.commentaire === keep.commentaire ? keep.commentaireUpdatedAt : at,
        searchKey: patientSearchKey(merged.nom, merged.prenom),
        updatedAt: at,
      })
      .where(eq(patients.id, keep.id))
      .run()

    const move = { patientId: keep.id, updatedAt: at }
    db.update(seances).set(move).where(eq(seances.patientId, remove.id)).run()
    db.update(factures).set(move).where(eq(factures.patientId, remove.id)).run()
    db.update(doctolibRdv).set(move).where(eq(doctolibRdv.patientId, remove.id)).run()
    db.update(contactMemory).set(move).where(eq(contactMemory.patientId, remove.id)).run()
    db.update(journal).set(move).where(eq(journal.patientId, remove.id)).run()

    const involved = (id: string) =>
      or(eq(patientLinks.patientA, id), eq(patientLinks.patientB, id))
    const links = db
      .select({
        patientA: patientLinks.patientA,
        patientB: patientLinks.patientB,
        relAToB: patientLinks.relAToB,
      })
      .from(patientLinks)
      .where(or(involved(keep.id), involved(remove.id)))
      .all()
    const relinked = relinkAfterMerge(links, keep.id, remove.id)
    for (const link of relinked.remove) {
      db.delete(patientLinks)
        .where(
          and(eq(patientLinks.patientA, link.patientA), eq(patientLinks.patientB, link.patientB)),
        )
        .run()
    }
    if (relinked.add.length) db.insert(patientLinks).values(relinked.add).run()

    // Cascades remove the « pas les mêmes personnes » pairs of the deleted record.
    db.delete(patients).where(eq(patients.id, remove.id)).run()

    addJournalLine(
      db,
      {
        type: 'patient',
        subject: `${merged.prenom} ${merged.nom}`,
        action: `Fiches fusionnées : fiche n° ${remove.shortNo} réunie à la fiche n° ${keep.shortNo}`,
        patientId: keep.id,
      },
      now,
    )
  })()

  const total =
    db
      .select({ n: sql<number>`count(*)` })
      .from(seances)
      .where(eq(seances.patientId, keep.id))
      .get()?.n ?? 0
  return { ok: true, keptId: keep.id, name: `${merged.prenom} ${merged.nom}`, seances: total }
}

/** Pending Doctolib appointments, for the « À rapprocher » panel (resolved from lot 4). */
export function listPendingRdv(db: AppDatabase) {
  return db
    .select({
      key: doctolibRdv.key,
      nomAffiche: doctolibRdv.nomAffiche,
      date: doctolibRdv.date,
      heure: doctolibRdv.heure,
      match: doctolibRdv.match,
    })
    .from(doctolibRdv)
    .where(inArray(doctolibRdv.match, ['pending_new', 'pending_multi']))
    .orderBy(asc(doctolibRdv.date), asc(doctolibRdv.heure))
    .all()
    .map((r) => ({ ...r, match: r.match as 'pending_new' | 'pending_multi' }))
}
