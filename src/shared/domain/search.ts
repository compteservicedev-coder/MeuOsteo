/** Patient search (SPEC §4): name, first name, phone (digits), commune and profession. */
import { digitsOnly, foldForSearch } from './text'

export interface SearchQuery {
  /** Folded words: each must be found in the name, the commune or the profession. */
  words: string[]
  /** Set when the query is a phone number (2 digits or more, spaces and dots ignored). */
  phone: string | null
}

export function parseSearchQuery(raw: string): SearchQuery {
  const compact = raw.replace(/[\s.\-/]/g, '')
  if (/^\+?\d{2,}$/.test(compact)) {
    const digits = digitsOnly(compact)
    return { words: [], phone: digits.startsWith('33') && digits.length > 9 ? `0${digits.slice(2)}` : digits }
  }
  const folded = foldForSearch(raw)
  return { words: folded ? folded.split(' ') : [], phone: null }
}

export const isEmptyQuery = (q: SearchQuery) => q.words.length === 0 && q.phone === null

/** True when one of the words was found in the profession (it is then highlighted). */
export function professionMatches(profession: string | null, q: SearchQuery): boolean {
  if (!profession || q.words.length === 0) return false
  const folded = foldForSearch(profession)
  return q.words.some((w) => folded.includes(w))
}

/** « Consultés récemment »: the last opened records first, at most `max`. */
export const RECENT_MAX = 20

export function pushRecent(list: string[], id: string, max = RECENT_MAX): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, max)
}
