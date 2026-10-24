/**
 * R-19 · Doublons de fiches: detection (same birth date AND same phone, same e-mail or close
 * names) and the pure part of the merge (chosen values, comments put end to end, relatives).
 */
import { formatIsoDateFr } from './dates'
import { inverseRelation, orderLink, type Relation } from './relatives'
import { digitsOnly, foldForSearch } from './text'

export interface DuplicateCandidate {
  id: string
  nom: string
  prenom: string
  ddn: string
  portable: string | null
  fixe: string | null
  email: string | null
}

/** What the two records have in common, besides the birth date. */
export type DuplicateReason = 'portable' | 'telephone' | 'email' | 'same_name' | 'close_name'

export interface DuplicatePair {
  /** Always `a < b`, as in `duplicate_ignored`. */
  a: string
  b: string
  reasons: DuplicateReason[]
}

/** Edit distance (insertions, deletions, substitutions). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost)
    }
    previous = current
  }
  return previous[b.length]!
}

/** Below this length, « included in the other » would match too easily (« Le » in « Lebrun »). */
const MIN_INCLUDED_LENGTH = 3

/**
 * Compares two family names, accents and case ignored: `same`, `close` (Levenshtein ≤ 2, or one
 * included in the other, as « Lambert » and « Lambert-Durand »), or `null`.
 */
export function compareNames(a: string, b: string): 'same' | 'close' | null {
  const fa = foldForSearch(a)
  const fb = foldForSearch(b)
  if (!fa || !fb) return null
  if (fa === fb) return 'same'
  if (levenshtein(fa, fb) <= 2) return 'close'
  const [short, long] = fa.length <= fb.length ? [fa, fb] : [fb, fa]
  return short.length >= MIN_INCLUDED_LENGTH && long.includes(short) ? 'close' : null
}

const phonesOf = (p: DuplicateCandidate) =>
  [p.portable, p.fixe].map((n) => (n ? digitsOnly(n) : '')).filter(Boolean)

/** R-19: empty when the two records are not potential duplicates. */
export function duplicateReasons(a: DuplicateCandidate, b: DuplicateCandidate): DuplicateReason[] {
  if (!a.ddn || a.ddn !== b.ddn) return []
  const reasons: DuplicateReason[] = []
  const portableA = a.portable ? digitsOnly(a.portable) : ''
  if (portableA && portableA === (b.portable ? digitsOnly(b.portable) : '')) {
    reasons.push('portable')
  } else {
    const phonesB = phonesOf(b)
    if (phonesOf(a).some((n) => phonesB.includes(n))) reasons.push('telephone')
  }
  const emailA = a.email?.trim().toLowerCase()
  if (emailA && emailA === b.email?.trim().toLowerCase()) reasons.push('email')
  const names = compareNames(a.nom, b.nom)
  if (names) reasons.push(names === 'same' ? 'same_name' : 'close_name')
  return reasons
}

/** Key of an unordered pair, used to skip the pairs marked « pas les mêmes personnes ». */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * R-19: every pair of potential duplicates, except the ignored ones. Only records sharing a birth
 * date are compared, so 5 000 records cost a few thousand comparisons at most.
 */
export function findDuplicatePairs(
  patients: readonly DuplicateCandidate[],
  ignored: ReadonlySet<string> = new Set(),
): DuplicatePair[] {
  const byDdn = new Map<string, DuplicateCandidate[]>()
  for (const p of patients) {
    if (!p.ddn) continue
    const group = byDdn.get(p.ddn)
    if (group) group.push(p)
    else byDdn.set(p.ddn, [p])
  }
  const pairs: DuplicatePair[] = []
  for (const group of byDdn.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [x, y] = [group[i]!, group[j]!]
        if (x.id === y.id || ignored.has(pairKey(x.id, y.id))) continue
        const reasons = duplicateReasons(x, y)
        if (reasons.length === 0) continue
        pairs.push(x.id < y.id ? { a: x.id, b: y.id, reasons } : { a: y.id, b: x.id, reasons })
      }
    }
  }
  return pairs
}

const REASON_LABELS: Record<DuplicateReason, string> = {
  portable: 'même portable',
  telephone: 'même téléphone',
  email: 'même e-mail',
  same_name: 'même nom',
  close_name: 'noms proches',
}

/** « Même date de naissance et même portable », « Même date de naissance, même nom et … ». */
export function describeDuplicateReasons(reasons: readonly DuplicateReason[]): string {
  const parts = ['Même date de naissance', ...reasons.map((r) => REASON_LABELS[r])]
  const last = parts.pop()!
  return parts.length ? `${parts.join(', ')} et ${last}` : last
}

// ── Merge ──────────────────────────────────────────────────────────────────────────────────────

/** Fields compared side by side in the merge window. `adresse` covers address, postcode, town. */
export const MERGE_FIELDS = [
  'nom',
  'prenom',
  'ddn',
  'sexe',
  'situation',
  'enfants',
  'profession',
  'adresse',
  'portable',
  'fixe',
  'email',
] as const

export type MergeField = (typeof MERGE_FIELDS)[number]
/** `a` is the record kept, `b` the one that disappears. */
export type MergeSide = 'a' | 'b'
export type MergePicks = Record<MergeField, MergeSide>

export const MERGE_FIELD_LABELS: Record<MergeField, string> = {
  nom: 'Nom',
  prenom: 'Prénom',
  ddn: 'Naissance',
  sexe: 'Sexe',
  situation: 'Situation',
  enfants: 'Enfants',
  profession: 'Profession',
  adresse: 'Adresse',
  portable: 'Portable',
  fixe: 'Fixe',
  email: 'E-mail',
}

export interface MergeablePatient {
  nom: string
  prenom: string
  ddn: string
  sexe: 'F' | 'M' | null
  situation: 'celibataire' | 'couple' | 'pacse' | 'marie' | 'divorce' | 'veuf' | null
  enfants: number | null
  profession: string | null
  adresse: string | null
  cp: string | null
  commune: string | null
  portable: string | null
  fixe: string | null
  email: string | null
  commentaire: string | null
  antecedentsTags: string[]
}

/** Columns written by a field (the address block writes three). */
const FIELD_COLUMNS: Record<MergeField, readonly (keyof MergeablePatient)[]> = {
  nom: ['nom'],
  prenom: ['prenom'],
  ddn: ['ddn'],
  sexe: ['sexe'],
  situation: ['situation'],
  enfants: ['enfants'],
  profession: ['profession'],
  adresse: ['adresse', 'cp', 'commune'],
  portable: ['portable'],
  fixe: ['fixe'],
  email: ['email'],
}

function comparable(p: MergeablePatient, field: MergeField): string {
  return FIELD_COLUMNS[field]
    .map((column) => {
      const value = p[column]
      if (value === null || value === undefined) return ''
      const text = String(value).trim().replace(/\s+/g, ' ')
      return field === 'email' ? text.toLowerCase() : text
    })
    .join('|')
    .replace(/^\|+$/, '')
}

export function isMergeFieldEmpty(p: MergeablePatient, field: MergeField): boolean {
  return comparable(p, field) === ''
}

export function sameMergeField(a: MergeablePatient, b: MergeablePatient, field: MergeField) {
  return comparable(a, field) === comparable(b, field)
}

/** Kept record's value by default, unless it is empty and the other one is filled in. */
export function defaultMergePicks(a: MergeablePatient, b: MergeablePatient): MergePicks {
  return Object.fromEntries(
    MERGE_FIELDS.map((f) => [f, isMergeFieldEmpty(a, f) && !isMergeFieldEmpty(b, f) ? 'b' : 'a']),
  ) as MergePicks
}

/** R-19: comments end to end, with a dated separator. */
export function mergeComments(a: string | null, b: string | null, isoDate: string): string | null {
  const ta = a?.trim()
  const tb = b?.trim()
  if (!tb) return ta ? a : null
  if (!ta) return b
  return `${ta}\n\n——— Fiche fusionnée le ${formatIsoDateFr(isoDate)} ———\n${tb}`
}

/** Union of the tags, case ignored, in their order of appearance. */
export function mergeTags(a: readonly string[], b: readonly string[]): string[] {
  const seen = new Set<string>()
  return [...a, ...b].filter((tag) => {
    const key = foldForSearch(tag)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Values of the kept record after the merge (R-19). `isoDate` dates the comment separator. */
export function mergePatients(
  a: MergeablePatient,
  b: MergeablePatient,
  picks: MergePicks,
  isoDate: string,
): MergeablePatient {
  const merged: MergeablePatient = { ...a, antecedentsTags: [...a.antecedentsTags] }
  for (const field of MERGE_FIELDS) {
    if (picks[field] !== 'b') continue
    for (const column of FIELD_COLUMNS[field]) Object.assign(merged, { [column]: b[column] })
  }
  merged.commentaire = mergeComments(a.commentaire, b.commentaire, isoDate)
  merged.antecedentsTags = mergeTags(a.antecedentsTags, b.antecedentsTags)
  return merged
}

export interface StoredLink {
  patientA: string
  patientB: string
  relAToB: Relation
}

/**
 * R-19 and R-25: the relatives of the removed record move to the kept one. The link between the
 * two records disappears, and a relative already linked to the kept record keeps its link.
 */
export function relinkAfterMerge(
  links: readonly StoredLink[],
  keepId: string,
  removeId: string,
): { remove: StoredLink[]; add: StoredLink[] } {
  const otherOf = (l: StoredLink, id: string) => (l.patientA === id ? l.patientB : l.patientA)
  const keepRelatives = new Set(
    links
      .filter((l) => l.patientA === keepId || l.patientB === keepId)
      .map((l) => otherOf(l, keepId)),
  )
  const remove: StoredLink[] = []
  const add: StoredLink[] = []
  for (const link of links) {
    if (link.patientA !== removeId && link.patientB !== removeId) continue
    remove.push(link)
    const other = otherOf(link, removeId)
    if (other === keepId || keepRelatives.has(other)) continue
    // What `other` is to the removed record, hence to the kept one.
    const relation = link.patientA === removeId ? link.relAToB : inverseRelation(link.relAToB)
    add.push(orderLink(keepId, other, relation))
    keepRelatives.add(other)
  }
  return { remove, add }
}
