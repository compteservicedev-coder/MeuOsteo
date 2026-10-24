/** R-16 · Commune proposed from the postal code (resources/communes.csv). */

export type CommuneSuggestion =
  | { mode: 'waiting' }
  | { mode: 'single'; commune: string }
  | { mode: 'choice'; communes: string[] }
  | { mode: 'free' }

/**
 * One commune: filled in automatically. Several: a list. None: free entry.
 * Before 5 digits nothing is proposed.
 */
export function suggestCommune(cp: string, communes: string[]): CommuneSuggestion {
  if (!/^\d{5}$/.test(cp)) return { mode: 'waiting' }
  const unique = [...new Set(communes)]
  if (unique.length === 0) return { mode: 'free' }
  if (unique.length === 1) return { mode: 'single', commune: unique[0]! }
  return { mode: 'choice', communes: unique.sort((a, b) => a.localeCompare(b, 'fr')) }
}

/** Commune to keep after a postal code change. */
export function communeAfterCpChange(suggestion: CommuneSuggestion, current: string): string {
  switch (suggestion.mode) {
    case 'single':
      return suggestion.commune
    case 'choice':
      return suggestion.communes.includes(current) ? current : ''
    default:
      return current
  }
}
