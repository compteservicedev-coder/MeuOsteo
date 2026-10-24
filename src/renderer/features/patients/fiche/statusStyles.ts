import type { DisplayStatus } from '@shared/domain/seance'

/** Badge colours of the mock-up (Fiche.dc.html), each with its text: never colour alone. */
export const STATUS_BADGE: Record<DisplayStatus, string> = {
  upcoming: 'bg-[#EDF0F6] text-ink-600',
  today: 'bg-[#D9F6FA] text-[#0B5F73]',
  to_complete: 'bg-amber-50 text-amber-ink',
  paid: 'bg-aqua-50 text-aqua-ink',
  waiting: 'bg-amber-50 text-amber-ink',
  cancelled: 'bg-[#EDF0F6] text-ink-500',
}
