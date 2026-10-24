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
