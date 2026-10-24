/** All business dates are computed in the practice's time zone. */
export const APP_TIME_ZONE = 'Europe/Paris'

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** `YYYY-MM-DD` of the given instant, in Europe/Paris. */
export function isoDateInParis(instant: Date): string {
  return isoDateFormatter.format(instant)
}

const longDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: APP_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** « Samedi 24 octobre 2026 » */
export function formatLongDateFr(instant: Date): string {
  const s = longDateFormatter.format(instant)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** `2026-10-24` → `24/10/2026` */
export function formatIsoDateFr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

/** « à l'instant », « il y a 5 min », « il y a 3 h », « il y a 2 jours ». */
export function formatElapsedFr(from: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - from.getTime()) / 60_000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'il y a 1 jour' : `il y a ${days} jours`
}

const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

/** `2026-10-09` → « 9 octobre 2026 » */
export function formatIsoDateLongFr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return `${d} ${MONTHS_FR[m - 1]} ${y}`
}

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`). */
export function daysBetween(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from))
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date((dayNumber(isoDate) + days) * 86_400_000)
  return date.toISOString().slice(0, 10)
}

/** Relative day of a session: « Aujourd’hui », « Demain », « Dans 6 jours », « Il y a 15 jours »… */
export function formatRelativeDayFr(isoDate: string, today: string): string {
  const n = daysBetween(today, isoDate)
  if (n === 0) return 'Aujourd’hui'
  if (n === 1) return 'Demain'
  if (n > 1) return `Dans ${n} jours`
  if (n === -1) return 'Hier'
  if (n > -31) return `Il y a ${-n} jours`
  const months = Math.round(-n / 30.4)
  if (months < 12) return `Il y a ${months} mois`
  const years = Math.floor(months / 12)
  return years === 1 ? 'Il y a 1 an' : `Il y a ${years} ans`
}

/** Strict `YYYY-MM-DD` check (real calendar date). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** `HH:mm` of the given instant, in Europe/Paris. */
export function timeInParis(instant: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(instant)
}

/** « 24/10/2026 14:05 » for journal lines. */
export function formatDateTimeFr(instant: Date): string {
  return `${formatIsoDateFr(isoDateInParis(instant))} ${timeInParis(instant)}`
}
