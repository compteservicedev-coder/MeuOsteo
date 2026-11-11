/**
 * Planning (SPEC §3): weeks shown two by two, blocked periods (R-23) and the free-slot grid of
 * « Nouveau RDV » (R-24). Pure functions on ISO dates (`YYYY-MM-DD`) and times (`HH:mm`).
 */
import { addDays } from './dates'

export type Creneau = 'day' | 'am' | 'pm'

export const CRENEAU_LABELS: Record<Creneau, string> = {
  day: 'Journée',
  am: 'Matin',
  pm: 'Après-midi',
}

/** « Journée bloquée », « Matin bloqué », « Après-midi bloqué ». */
export const BLOCK_CARD_LABELS: Record<Creneau, string> = {
  day: 'Journée bloquée',
  am: 'Matin bloqué',
  pm: 'Après-midi bloqué',
}

export const BLOCK_REASONS = ['Congés', 'Formation', 'Absente', 'Rendez-vous perso'] as const

/** Morning ends at 13:00 (R-23). */
export const AFTERNOON_START = 13 * 60

/** Day keys of Paramètres > Agenda, Monday first. */
export const WEEK_DAYS = ['L', 'Ma', 'Me', 'J', 'V', 'S', 'D'] as const
export type WeekDay = (typeof WEEK_DAYS)[number]

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  L: 'Lun.',
  Ma: 'Mar.',
  Me: 'Mer.',
  J: 'Jeu.',
  V: 'Ven.',
  S: 'Sam.',
  D: 'Dim.',
}

export interface AgendaSettings {
  days: WeekDay[]
  /** `HH:mm` */
  opening: string
  closing: string
  /** Length of a session, minutes (R-24 overlap). */
  durationMinutes: 45 | 60 | 75
  weeks: 1 | 2
  /** R-18 automatic attachment when name and phone or e-mail match. */
}

export const DEFAULT_AGENDA: AgendaSettings = {
  days: ['L', 'Ma', 'Me', 'J', 'V', 'S'],
  opening: '09:00',
  closing: '19:00',
  durationMinutes: 60,
  weeks: 2,
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
export const fromMinutes = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** `9:00` / `09:00` → `09:00`. */
export const normalizeTime = (value: string) => fromMinutes(toMinutes(value))

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

export const weekDayOf = (isoDate: string): WeekDay => WEEK_DAYS[weekdayIndex(isoDate)]!

export const mondayOf = (isoDate: string) => addDays(isoDate, -weekdayIndex(isoDate))

export const isOpenDay = (isoDate: string, agenda: Pick<AgendaSettings, 'days'>) =>
  agenda.days.includes(weekDayOf(isoDate))

/** Days of the week starting at `monday` that the practice is open (« lundi à samedi »). */
export function weekDates(monday: string, agenda: Pick<AgendaSettings, 'days'>): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(monday, i)).filter((d) => isOpenDay(d, agenda))
}

const MONTHS_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]
export const MONTHS_LONG = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

const dayNum = (iso: string) => Number(iso.slice(8))
const monthIdx = (iso: string) => Number(iso.slice(5, 7)) - 1

/** `2026-10-19` → « 19 oct. » */
export const dayMonth = (iso: string) => `${dayNum(iso)} ${MONTHS_SHORT[monthIdx(iso)]}`

/** « Lun. 19 », with the month on the first of the month (« Dim. 1 nov. »). */
export function dayLabel(iso: string): string {
  const base = `${WEEK_DAY_LABELS[weekDayOf(iso)]} ${dayNum(iso)}`
  return dayNum(iso) === 1 ? `${base} ${MONTHS_SHORT[monthIdx(iso)]}` : base
}

/** « Cette semaine », « Semaine prochaine », « Semaine dernière » or « Semaine du 2 nov. ». */
export function weekTitle(monday: string, today: string): string {
  const current = mondayOf(today)
  if (monday === current) return 'Cette semaine'
  if (monday === addDays(current, 7)) return 'Semaine prochaine'
  if (monday === addDays(current, -7)) return 'Semaine dernière'
  return `Semaine du ${dayMonth(monday)}`
}

/** « 19 au 24 oct. » or « 26 oct. au 31 oct. » across months. */
export function weekRange(first: string, last: string): string {
  return `${monthIdx(first) === monthIdx(last) ? dayNum(first) : dayMonth(first)} au ${dayMonth(last)}`
}

/** « 19 oct. → 31 oct. 2026 » for the header. */
export function rangeLabel(first: string, last: string): string {
  return `${dayMonth(first)} → ${dayMonth(last)} ${last.slice(0, 4)}`
}

/** « Octobre 2026 » */
export const monthTitle = (year: number, month0: number) => `${MONTHS_LONG[month0]} ${year}`

/** Mondays of the weeks touching a month (calendar popover), each with its 7 days. */
export function calendarWeeks(year: number, month0: number): string[][] {
  const first = `${year}-${String(month0 + 1).padStart(2, '0')}-01`
  let monday = mondayOf(first)
  const weeks: string[][] = []
  while (weeks.length === 0 || monthIdx(monday) === month0) {
    weeks.push([0, 1, 2, 3, 4, 5, 6].map((i) => addDays(monday, i)))
    monday = addDays(monday, 7)
    if (Number(monday.slice(0, 4)) > year) break
  }
  return weeks
}

// --- R-23 · Blocages ----------------------------------------------------------------------

export interface Block {
  date: string
  creneau: Creneau
}

/** A time falls in a block: the whole day, the morning (before 13:00) or the afternoon. */
export function blockCovers(creneau: Creneau, time: string | null): boolean {
  if (creneau === 'day') return true
  if (time === null) return false
  const t = toMinutes(time)
  return creneau === 'am' ? t < AFTERNOON_START : t >= AFTERNOON_START
}

/** Open days between two dates (inclusive), where blocks are written. */
export function blockDates(
  from: string,
  to: string,
  agenda: Pick<AgendaSettings, 'days'>,
  maxDays = 366,
): string[] {
  const out: string[] = []
  for (let d = from, n = 0; d <= to && n < maxDays; d = addDays(d, 1), n++) {
    if (isOpenDay(d, agenda)) out.push(d)
  }
  return out
}

/** Appointments already in a period about to be blocked (the window warns about them). */
export function blockConflicts(
  rdv: Array<{ date: string; heure: string | null }>,
  dates: string[],
  creneau: Creneau,
): number {
  const set = new Set(dates)
  return rdv.filter((r) => set.has(r.date) && (creneau === 'day' || blockCovers(creneau, r.heure)))
    .length
}

// --- R-24 · Slot grid ---------------------------------------------------------------------

export interface DayAppointment {
  heure: string | null
  nom: string
}

export interface Slot {
  heure: string
  free: boolean
  /** « Pris · Camille Roux », « Bloqué · Congés ». */
  reason: string | null
}

/**
 * 30-minute slots from opening until the last start that still ends before closing. A slot is
 * free if no non-cancelled appointment starts less than `duration` minutes away and no block
 * covers it (R-24).
 */
export function slotGrid(
  agenda: Pick<AgendaSettings, 'opening' | 'closing' | 'durationMinutes'>,
  appointments: DayAppointment[],
  blocks: Array<{ creneau: Creneau; motif: string | null }>,
): Slot[] {
  const slots: Slot[] = []
  const start = toMinutes(agenda.opening)
  const end = toMinutes(agenda.closing) - agenda.durationMinutes
  for (let m = start; m <= end; m += 30) {
    const heure = fromMinutes(m)
    const busy = appointments.find(
      (a) => a.heure !== null && Math.abs(toMinutes(a.heure) - m) < agenda.durationMinutes,
    )
    const block = blocks.find((b) => blockCovers(b.creneau, heure))
    slots.push({
      heure,
      free: !busy && !block,
      reason: busy
        ? `Pris · ${busy.nom}`
        : block
          ? `Bloqué · ${block.motif ?? 'indisponible'}`
          : null,
    })
  }
  return slots
}

export type NewRdvError = 'patient' | 'date' | 'past' | 'closed' | 'heure' | 'slot' | 'same_day'

/** Checks of « Nouveau rendez-vous » (SPEC §3). */
export function newRdvErrors(input: {
  patientId: string | null
  date: string
  heure: string
  today: string
  agenda: Pick<AgendaSettings, 'days'>
  slots: Slot[]
  patientHasSessionThatDay: boolean
}): NewRdvError[] {
  const errors: NewRdvError[] = []
  if (!input.patientId) errors.push('patient')
  if (!input.date) errors.push('date')
  else if (input.date < input.today) errors.push('past')
  else if (!isOpenDay(input.date, input.agenda)) errors.push('closed')
  if (!input.heure) errors.push('heure')
  else if (!input.slots.find((s) => s.heure === input.heure)?.free) errors.push('slot')
  if (input.patientHasSessionThatDay) errors.push('same_day')
  return errors
}

// --- Cards --------------------------------------------------------------------------------

export type CardKind = 'ok' | 'off' | 'past'

/** Colour of an appointment card: cancelled (struck out), past, or to come. */
export function cardKind(input: {
  status: 'planned' | 'done' | 'cancelled'
  date: string
  today: string
}): CardKind {
  if (input.status === 'cancelled') return 'off'
  if (input.date < input.today) return 'past'
  return 'ok'
}
