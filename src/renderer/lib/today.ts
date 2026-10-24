import { isoDateInParis } from '@shared/domain/dates'

/** Today in Europe/Paris (`YYYY-MM-DD`). */
export const todayIso = () => isoDateInParis(new Date())
