/**
 * Planning (SPEC §3): two weeks of appointments built from the sessions and the Doctolib
 * appointments still to reconcile, blocked periods (R-23) and « Nouveau RDV » (R-24).
 */
import { and, asc, between, eq, inArray, isNull, ne } from 'drizzle-orm'
import { ulid } from 'ulid'
import { addDays, isoDateInParis } from '@shared/domain/dates'
import {
  BLOCK_CARD_LABELS,
  DEFAULT_AGENDA,
  blockConflicts,
  blockDates,
  cardKind,
  isOpenDay,
  newRdvErrors,
  normalizeTime,
  slotGrid,
  toMinutes,
  weekDates,
  type AgendaSettings,
  type Creneau,
} from '@shared/domain/planning'
import type {
  BlockInput,
  BlockPreview,
  DaySlots,
  NewRdvInput,
  NewRdvResult,
  PlanningBlock,
  PlanningCard,
  PlanningView,
} from '@shared/types/planning'
import type { AppDatabase } from '../db/client'
import { getSetting, setSetting } from '../db/repositories/settingsRepository'
import { blocages, doctolibRdv, patients, seances } from '../db/schema'
import { addJournalLine } from '../db/repositories/journalRepository'
import { SETTINGS_SUBJECT } from '@shared/domain/journal'
import { DEFAULT_TARIFS_SETTING, agendaSettingSchema, tarifsSettingSchema } from './settingsSchemas'

const byTime = (a: { heure: string | null }, b: { heure: string | null }) =>
  (a.heure ? toMinutes(a.heure) : -1) - (b.heure ? toMinutes(b.heure) : -1)

export class PlanningService {
  constructor(
    private readonly db: AppDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private today() {
    return isoDateInParis(this.now())
  }

  agenda(): AgendaSettings {
    return getSetting(this.db, 'agenda', agendaSettingSchema, DEFAULT_AGENDA)
  }

  saveAgenda(value: AgendaSettings): AgendaSettings {
    const clean: AgendaSettings = {
      ...value,
      days: value.days.length > 0 ? value.days : DEFAULT_AGENDA.days,
      opening: normalizeTime(value.opening),
      closing: normalizeTime(value.closing),
    }
    if (toMinutes(clean.closing) <= toMinutes(clean.opening)) clean.closing = DEFAULT_AGENDA.closing
    setSetting(this.db, 'agenda', clean)
    addJournalLine(
      this.db,
      { type: 'reglage', subject: SETTINGS_SUBJECT, action: 'Agenda modifié' },
      this.now(),
    )
    return clean
  }

  private cards(from: string, to: string): Map<string, PlanningCard[]> {
    const today = this.today()
    const rows = this.db
      .select({
        id: seances.id,
        patientId: seances.patientId,
        date: seances.date,
        heure: seances.heure,
        status: seances.status,
        source: seances.source,
        motif: seances.motif,
        nom: patients.nom,
        prenom: patients.prenom,
        doctolibKey: seances.doctolibKey,
      })
      .from(seances)
      .innerJoin(patients, eq(patients.id, seances.patientId))
      .where(and(between(seances.date, from, to), isNull(patients.deletedAt)))
      .all()
    const pending = this.db
      .select()
      .from(doctolibRdv)
      .where(
        and(
          between(doctolibRdv.date, from, to),
          inArray(doctolibRdv.match, ['pending_new', 'pending_multi']),
          ne(doctolibRdv.etat, 'annule'),
        ),
      )
      .all()
    const map = new Map<string, PlanningCard[]>()
    const push = (date: string, card: PlanningCard) =>
      map.set(date, [...(map.get(date) ?? []), card])
    for (const r of rows) {
      // Imported history (no time, done long ago) stays out of the planning.
      if (r.source === 'import') continue
      const cancelledByDoctolib = r.status === 'cancelled'
      push(r.date, {
        id: r.id,
        seanceId: r.id,
        patientId: r.patientId,
        rdvKey: r.doctolibKey,
        heure: r.heure,
        nom: `${r.prenom} ${r.nom}`,
        motif:
          (cancelledByDoctolib ? 'Annulé' : r.motif || 'RDV') +
          (r.source === 'manual' && !cancelledByDoctolib ? ' · hors Doctolib' : ''),
        kind: cardKind({ status: r.status, source: r.source, date: r.date, today }),
      })
    }
    for (const r of pending) {
      push(r.date, {
        id: r.key,
        seanceId: null,
        patientId: null,
        rdvKey: r.key,
        heure: r.heure,
        nom: r.nomAffiche,
        motif: 'À rapprocher',
        kind: 'neu',
      })
    }
    for (const list of map.values()) list.sort(byTime)
    return map
  }

  private blocksBetween(from: string, to: string): PlanningBlock[] {
    return this.db
      .select()
      .from(blocages)
      .where(between(blocages.date, from, to))
      .orderBy(asc(blocages.date))
      .all()
      .map((b) => ({ id: b.id, date: b.date, creneau: b.creneau, motif: b.motif }))
  }

  /** Weeks from the Monday given (1 or 2, Paramètres > Agenda). */
  weeks(monday: string): PlanningView {
    const agenda = this.agenda()
    const last = addDays(monday, 7 * agenda.weeks - 1)
    const cards = this.cards(monday, last)
    const blocks = this.blocksBetween(monday, last)
    const weeks = Array.from({ length: agenda.weeks }, (_, w) => {
      const start = addDays(monday, 7 * w)
      const days = weekDates(start, agenda).map((date) => {
        const list = cards.get(date) ?? []
        return {
          date,
          cards: list,
          blocks: blocks.filter((b) => b.date === date),
          count: list.filter((c) => c.kind !== 'off').length,
        }
      })
      return { monday: start, days, count: days.reduce((n, d) => n + d.count, 0) }
    })
    return { weeks, agenda }
  }

  /** Days with a block between two dates (orange dots of the calendar). */
  blockedDates(from: string, to: string): string[] {
    return [...new Set(this.blocksBetween(from, to).map((b) => b.date))]
  }

  // --- R-23 ---------------------------------------------------------------------------------

  private appointmentsIn(dates: string[]) {
    if (dates.length === 0) return []
    return this.db
      .select({ date: seances.date, heure: seances.heure })
      .from(seances)
      .where(and(inArray(seances.date, dates), ne(seances.status, 'cancelled')))
      .all()
  }

  previewBlock(input: Pick<BlockInput, 'from' | 'to' | 'creneau'>): BlockPreview {
    if (!input.from || !input.to || input.from > input.to) return { days: 0, conflicts: 0 }
    const dates = blockDates(input.from, input.to, this.agenda())
    return {
      days: dates.length,
      conflicts: blockConflicts(this.appointmentsIn(dates), dates, input.creneau),
    }
  }

  /** « Bloquer une période »: one row per open day and slot (unique per day and slot). */
  addBlocks(input: BlockInput): { ok: boolean; days: number } {
    if (!input.from || !input.to || input.from > input.to) return { ok: false, days: 0 }
    const dates = blockDates(input.from, input.to, this.agenda())
    this.db.transaction((tx) => {
      for (const date of dates) {
        if (input.creneau === 'day') {
          // A whole day replaces the half-days already blocked.
          tx.delete(blocages).where(eq(blocages.date, date)).run()
        }
        tx.insert(blocages)
          .values({ id: ulid(), date, creneau: input.creneau, motif: input.motif.trim() || null })
          .onConflictDoUpdate({
            target: [blocages.date, blocages.creneau],
            set: { motif: input.motif.trim() || null },
          })
          .run()
      }
    })
    return { ok: true, days: dates.length }
  }

  removeBlock(id: string): boolean {
    return this.db.delete(blocages).where(eq(blocages.id, id)).run().changes > 0
  }

  // --- R-24 ---------------------------------------------------------------------------------

  daySlots(date: string, patientId: string | null): DaySlots {
    const agenda = this.agenda()
    const appointments = this.db
      .select({
        heure: seances.heure,
        nom: patients.nom,
        prenom: patients.prenom,
        patientId: seances.patientId,
      })
      .from(seances)
      .innerJoin(patients, eq(patients.id, seances.patientId))
      .where(and(eq(seances.date, date), ne(seances.status, 'cancelled')))
      .all()
    const pending = this.db
      .select({ heure: doctolibRdv.heure, nom: doctolibRdv.nomAffiche })
      .from(doctolibRdv)
      .where(
        and(
          eq(doctolibRdv.date, date),
          inArray(doctolibRdv.match, ['pending_new', 'pending_multi']),
          ne(doctolibRdv.etat, 'annule'),
        ),
      )
      .all()
    const blocks = this.blocksBetween(date, date)
    const busy = [
      ...appointments.map((a) => ({ heure: a.heure, nom: `${a.prenom} ${a.nom}` })),
      ...pending,
    ]
    const slots = isOpenDay(date, agenda) ? slotGrid(agenda, busy, blocks) : []
    const parts = [`${busy.length} RDV ce jour-là`]
    for (const b of blocks) parts.push(BLOCK_CARD_LABELS[b.creneau as Creneau].toLowerCase())
    return {
      date,
      slots,
      summary: parts.join(' · '),
      patientHasSession: patientId !== null && appointments.some((a) => a.patientId === patientId),
    }
  }

  /** R-24: a `planned` session, `source = manual`, with date and time. Never written to Doctolib. */
  createRdv(input: NewRdvInput): NewRdvResult {
    const heure = input.heure ? normalizeTime(input.heure) : ''
    const day = this.daySlots(input.date, input.patientId)
    const patient = this.db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, input.patientId), isNull(patients.deletedAt)))
      .get()
    const errors = newRdvErrors({
      patientId: patient ? input.patientId : null,
      date: input.date,
      heure,
      today: this.today(),
      agenda: this.agenda(),
      slots: day.slots,
      patientHasSessionThatDay: day.patientHasSession,
    })
    if (errors.length > 0) return { ok: false, errors }
    const id = ulid()
    this.db
      .insert(seances)
      .values({
        id,
        patientId: input.patientId,
        date: input.date,
        heure,
        status: 'planned',
        source: 'manual',
        motif: input.motif.trim() || null,
        tarifCents: getSetting(this.db, 'tarifs', tarifsSettingSchema, DEFAULT_TARIFS_SETTING)
          .defaultCents,
      })
      .run()
    return { ok: true, seanceId: id, patientId: input.patientId }
  }
}
