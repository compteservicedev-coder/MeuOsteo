/** R-14 · Patient deletion: hidden first (soft delete), purged for good 30 days later. */
import { daysBetween, isoDateInParis } from './dates'

export const PURGE_AFTER_DAYS = 30

export function purgeDate(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + PURGE_AFTER_DAYS * 86_400_000)
}

export function isPurgeDue(deletedAt: Date, now: Date): boolean {
  return now.getTime() >= purgeDate(deletedAt).getTime()
}

/** Days left before the purge, for « Restaurer » in Paramètres (at least 0). */
export function daysBeforePurge(deletedAt: Date, now: Date): number {
  return Math.max(0, daysBetween(isoDateInParis(now), isoDateInParis(purgeDate(deletedAt))))
}
