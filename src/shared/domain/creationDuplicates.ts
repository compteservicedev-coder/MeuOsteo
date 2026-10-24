/** R-17 · Possible duplicates while creating a patient. */
import { foldForSearch } from './text'

export type DuplicateCriterion = 'nom' | 'telephone' | 'email' | 'ddn'

export const DUPLICATE_CRITERION_LABELS: Record<DuplicateCriterion, string> = {
  nom: 'même nom et prénom',
  telephone: 'même téléphone',
  email: 'même e-mail',
  ddn: 'même date de naissance',
}

export interface DuplicateProbe {
  nom: string
  prenom: string
  ddn: string
  portable: string | null
  fixe: string | null
  email: string | null
}

export interface DuplicateCandidate extends DuplicateProbe {
  id: string
}

export interface DuplicateMatch<T extends DuplicateCandidate> {
  patient: T
  criteria: DuplicateCriterion[]
}

const phones = (p: DuplicateProbe) => [p.portable, p.fixe].filter((v): v is string => Boolean(v))

/**
 * Patients sharing the same name (accents and case ignored), phone, e-mail or birth date with the
 * record being created, with their common points; the most similar first.
 *
 * « Même nom » compares nom and prénom together: a family name alone would list every relative
 * (and every « Martin »), which hides the real duplicates.
 */
export function findDuplicates<T extends DuplicateCandidate>(
  probe: DuplicateProbe,
  patients: T[],
): DuplicateMatch<T>[] {
  const name = (p: DuplicateProbe) => foldForSearch(`${p.nom} ${p.prenom}`)
  const probeName = probe.nom.trim() && probe.prenom.trim() ? name(probe) : ''
  const probePhones = phones(probe)
  const email = probe.email?.trim().toLowerCase() || null
  const matches: DuplicateMatch<T>[] = []
  for (const patient of patients) {
    const criteria: DuplicateCriterion[] = []
    if (probeName && name(patient) === probeName) criteria.push('nom')
    if (probePhones.some((tel) => phones(patient).includes(tel))) criteria.push('telephone')
    if (email && patient.email?.toLowerCase() === email) criteria.push('email')
    if (probe.ddn && patient.ddn === probe.ddn) criteria.push('ddn')
    if (criteria.length > 0) matches.push({ patient, criteria })
  }
  return matches.sort((a, b) => b.criteria.length - a.criteria.length)
}
