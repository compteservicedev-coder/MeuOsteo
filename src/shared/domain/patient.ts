/** Patient display rules: age, labels with gender agreement, phone formatting (SPEC §4, §5). */
import { digitsOnly } from './text'

export type Sexe = 'F' | 'M'
export type Situation = 'celibataire' | 'couple' | 'pacse' | 'marie' | 'divorce' | 'veuf'

export const SEXE_LABELS: Record<Sexe, string> = { F: 'Femme', M: 'Homme' }

/** Labels of the list, in the order of the mock-up. */
export const SITUATION_OPTIONS: ReadonlyArray<{ value: Situation; label: string }> = [
  { value: 'celibataire', label: 'Célibataire' },
  { value: 'couple', label: 'En couple' },
  { value: 'pacse', label: 'Pacsé(e)' },
  { value: 'marie', label: 'Marié(e)' },
  { value: 'divorce', label: 'Divorcé(e)' },
  { value: 'veuf', label: 'Veuf(ve)' },
]

const SITUATION_AGREED: Record<Situation, { F: string; M: string }> = {
  celibataire: { F: 'Célibataire', M: 'Célibataire' },
  couple: { F: 'En couple', M: 'En couple' },
  pacse: { F: 'Pacsée', M: 'Pacsé' },
  marie: { F: 'Mariée', M: 'Marié' },
  divorce: { F: 'Divorcée', M: 'Divorcé' },
  veuf: { F: 'Veuve', M: 'Veuf' },
}

/** « Mariée » for a woman, « Marié » for a man, « Marié(e) » when the sex is unknown. */
export function situationLabel(situation: Situation, sexe: Sexe | null): string {
  if (sexe === null) return SITUATION_OPTIONS.find((o) => o.value === situation)!.label
  return SITUATION_AGREED[situation][sexe]
}

/** Completed months between the birth date and `today` (both `YYYY-MM-DD`), or null if after. */
export function ageInMonths(ddn: string, today: string): number | null {
  const [y, m, d] = ddn.split('-').map(Number) as [number, number, number]
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number]
  if (!y || !m || !d) return null
  const months = (ty - y) * 12 + (tm - m) - (td < d ? 1 : 0)
  return months < 0 ? null : months
}

/** « 34 ans », « 1 an », « 8 mois » (in months before 1 year, SPEC §5.1). */
export function ageLabel(ddn: string, today: string): string {
  const months = ageInMonths(ddn, today)
  if (months === null) return ''
  if (months < 12) return `${months} mois`
  const years = Math.floor(months / 12)
  return years === 1 ? '1 an' : `${years} ans`
}

export function childrenLabel(enfants: number): string {
  if (enfants === 0) return 'Sans enfant'
  return enfants === 1 ? '1 enfant' : `${enfants} enfants`
}

/** « 06 12 34 56 78 »: digits shown by pairs (R-15). */
export function formatPhone(value: string): string {
  return digitsOnly(value)
    .slice(0, 10)
    .replace(/(\d{2})(?=\d)/g, '$1 ')
}

export interface PatientIdentity {
  ddn: string
  sexe: Sexe | null
  situation: Situation | null
  enfants: number | null
  profession: string | null
}

/** Banner line: « 34 ans · Femme · Mariée · 2 enfants · Graphiste ». */
export function bannerSubtitle(p: PatientIdentity, today: string): string {
  return [
    ageLabel(p.ddn, today),
    p.sexe ? SEXE_LABELS[p.sexe] : null,
    p.situation ? situationLabel(p.situation, p.sexe) : null,
    p.enfants === null ? null : childrenLabel(p.enfants),
    p.profession,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** « Née le 12/03/1992 » / « Né le … ». */
export function bornLabel(sexe: Sexe | null): string {
  return sexe === 'F' ? 'Née le' : sexe === 'M' ? 'Né le' : 'Né(e) le'
}

export function isAddressComplete(p: {
  adresse: string | null
  cp: string | null
  commune: string | null
}): boolean {
  return Boolean(p.adresse?.trim() && p.cp?.trim() && p.commune?.trim())
}

/** « 8 rue des Lilas, 94300 Vincennes » */
export function formatAddress(p: {
  adresse: string | null
  cp: string | null
  commune: string | null
}): string {
  return [p.adresse, [p.cp, p.commune].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

export function fullName(p: { prenom: string; nom: string }): string {
  return `${p.prenom} ${p.nom}`
}
