/**
 * Doctolib appointments → patient records (GMAIL_DOCTOLIB.md §5): R-18 attachment and the keys
 * that make re-processing idempotent (R-09).
 */
import { digitsOnly, foldForSearch } from './text'

/** What a parser (e-mail or export) extracts from Doctolib (GMAIL_DOCTOLIB.md §3). */
export interface ParsedRdv {
  type: 'new' | 'modified' | 'cancelled'
  /** `YYYY-MM-DD` */
  date: string
  /** `HH:mm` */
  heure: string | null
  ancienneDate?: string | null
  ancienneHeure?: string | null
  /** Name as Doctolib shows it: « Julie Moreau », « J. Moreau », « MOREAU Julie ». */
  nom: string
  telephone?: string | null
  email?: string | null
  motif?: string | null
}

/** French mobile or landline in 10 digits: `+33 6 12 …` and `0033 6…` → `06 12 …`. */
export function normalizePhone(value: string | null | undefined): string | null {
  let d = digitsOnly(value ?? '')
  if (d.startsWith('0033')) d = `0${d.slice(4)}`
  else if (d.startsWith('33') && d.length === 11) d = `0${d.slice(2)}`
  return d.length === 10 && d.startsWith('0') ? d : d || null
}

export const normalizeEmail = (value: string | null | undefined) =>
  value?.trim().toLowerCase() || null

/** `contact_memory.contact_key`: normalised phone + lower-case e-mail (R-18). */
export function contactKey(telephone: string | null | undefined, email: string | null | undefined) {
  const t = normalizePhone(telephone)
  const e = normalizeEmail(email)
  return t || e ? `${t ?? ''}|${e ?? ''}` : null
}

/**
 * Stable key of an appointment: date, time and displayed identity (R-09). A re-sent or
 * re-imported e-mail produces the same key and changes nothing.
 */
export function rdvKey(rdv: {
  date: string
  heure: string | null
  nom: string
  telephone?: string | null
}): string {
  const raw = [
    rdv.date,
    rdv.heure ?? '',
    foldForSearch(rdv.nom),
    normalizePhone(rdv.telephone) ?? '',
  ].join('|')
  // FNV-1a 64 bits, hex: short, deterministic, no dependency.
  let h = 0xcbf29ce484222325n
  for (const ch of new TextEncoder().encode(raw)) {
    h ^= BigInt(ch)
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return `rdv_${h.toString(16).padStart(16, '0')}`
}

export interface DisplayName {
  /** Folded last name: « moreau ». */
  nom: string
  /** Folded first name if given in full, else null. */
  prenom: string | null
  /** First-name initial, folded: « j ». */
  initiale: string | null
}

/**
 * Splits a displayed name. Handles « Julie Moreau », « J. Moreau », « MOREAU Julie » (upper-case
 * word = last name) and compound last names (« Le Gall », « Lambert-Durand »).
 */
export function splitDisplayName(display: string): DisplayName {
  const words = display.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (words.length === 0) return { nom: '', prenom: null, initiale: null }
  if (words.length === 1) return { nom: foldForSearch(words[0]!), prenom: null, initiale: null }
  const isUpper = (w: string) => w === w.toUpperCase() && /\p{L}{2,}/u.test(w)
  let first: string
  let last: string[]
  if (isUpper(words[0]!) && !isUpper(words[words.length - 1]!)) {
    // « MOREAU Julie » / « LE GALL Carine »
    const upper = words.filter(isUpper)
    last = upper
    first = words.filter((w) => !isUpper(w)).join(' ')
  } else {
    // « Anne de la Tour »: everything after the first name is the last name.
    first = words[0]!
    last = words.slice(1)
  }
  const firstFolded = foldForSearch(first.replace(/\.$/, ''))
  const isInitial = /^\p{L}\.?$/u.test(first)
  return {
    nom: foldForSearch(last.join(' ')),
    prenom: isInitial ? null : firstFolded,
    initiale: firstFolded.charAt(0) || null,
  }
}

export interface MatchablePatient {
  id: string
  nom: string
  prenom: string
  ddn: string
  portable: string | null
  fixe: string | null
  email: string | null
}

export interface CriterionCheck {
  nom: boolean
  initiale: boolean
  telephone: boolean
  email: boolean
}

export interface Candidate {
  patientId: string
  checks: CriterionCheck
  /** Concordant criteria out of 4 (R-18). */
  score: number
}

const sameName = (a: string, b: string) =>
  a === b || a.replace(/[\s-]/g, '') === b.replace(/[\s-]/g, '')

/** R-18 criteria for one record: name, first-name initial, phone, e-mail. */
export function checkCandidate(rdv: ParsedRdv, p: MatchablePatient): CriterionCheck {
  const name = splitDisplayName(rdv.nom)
  const tel = normalizePhone(rdv.telephone)
  const mail = normalizeEmail(rdv.email)
  const nom = foldForSearch(p.nom)
  const prenom = foldForSearch(p.prenom)
  return {
    nom: sameName(nom, name.nom) || (name.prenom !== null && sameName(nom, name.prenom)),
    initiale: name.initiale !== null && prenom.startsWith(name.initiale),
    telephone: tel !== null && (p.portable === tel || p.fixe === tel),
    email: mail !== null && normalizeEmail(p.email) === mail,
  }
}

export const scoreOf = (c: CriterionCheck) =>
  Number(c.nom) + Number(c.initiale) + Number(c.telephone) + Number(c.email)

export type MatchDecision =
  | { kind: 'auto'; patientId: string; via: 'memory' | 'unique' }
  | { kind: 'multi'; candidates: Candidate[] }
  | { kind: 'new' }

/**
 * R-18 (GMAIL_DOCTOLIB.md §5):
 * - a remembered contact → that record;
 * - candidates = same last name AND (same phone OR same e-mail);
 * - exactly one → automatic (if the option is on), several → « Plusieurs fiches possibles »,
 *   none → « Nouveau patient ». Weaker resemblances (name only) are also offered as candidates
 *   so that the practitioner can still choose.
 */
export function decideMatch(
  rdv: ParsedRdv,
  patients: MatchablePatient[],
  options: { remembered: string | null; autoAttach: boolean },
): MatchDecision {
  if (options.remembered && patients.some((p) => p.id === options.remembered)) {
    return { kind: 'auto', patientId: options.remembered, via: 'memory' }
  }
  const scored = patients
    .map((p) => ({ patientId: p.id, checks: checkCandidate(rdv, p) }))
    .map((c) => ({ ...c, score: scoreOf(c.checks) }))
  const strong = scored.filter((c) => c.checks.nom && (c.checks.telephone || c.checks.email))
  // Same contact and first name, but the record carries another (e.g. married) name.
  const contact = scored.filter(
    (c) => !c.checks.nom && c.checks.initiale && c.checks.telephone && c.checks.email,
  )
  if (strong.length === 1 && options.autoAttach) {
    const only = strong[0]!
    // A first name given in full must agree with the record (Julie ≠ Jules Moreau).
    const name = splitDisplayName(rdv.nom)
    const record = patients.find((p) => p.id === only.patientId)!
    if (name.prenom === null || foldForSearch(record.prenom) === name.prenom) {
      return { kind: 'auto', patientId: only.patientId, via: 'unique' }
    }
  }
  const weak = scored.filter(
    (c) => c.checks.nom || c.checks.telephone || c.checks.email || contact.includes(c),
  )
  const candidates = [...new Set([...strong, ...contact, ...weak])]
    .filter((c) => c.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  return candidates.length > 0 ? { kind: 'multi', candidates } : { kind: 'new' }
}

/** « Bilan enfant », « bébé », « nourrisson » (GMAIL_DOCTOLIB.md §5, indice d'âge). */
export function motifSuggestsChild(motif: string | null | undefined): boolean {
  return /\b(enfant|bebe|nourrisson|nouveau-ne|naissance|pediatr)/.test(foldForSearch(motif ?? ''))
}

/** Age in whole years at a date. */
export function ageAt(ddn: string, date: string): number {
  const [y1, m1, d1] = ddn.split('-').map(Number) as [number, number, number]
  const [y2, m2, d2] = date.split('-').map(Number) as [number, number, number]
  return y2 - y1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0)
}

/** Alert shown on an adult candidate when the reason suggests a child (« J. Moreau »). */
export function childAlert(rdv: ParsedRdv, p: Pick<MatchablePatient, 'ddn'>): string | null {
  if (!motifSuggestsChild(rdv.motif) || ageAt(p.ddn, rdv.date) < 16) return null
  return `Motif « ${rdv.motif} » : le RDV concerne peut-être un enfant de cette personne`
}

/** First name and last name to prefill « Nouveau patient » from the displayed name. */
export function prefillFromDisplayName(display: string): { nom: string; prenom: string } {
  const words = display.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (words.length <= 1) return { nom: words[0] ?? '', prenom: '' }
  const isUpper = (w: string) => w === w.toUpperCase() && /\p{L}{2,}/u.test(w)
  const cap = (w: string) =>
    w
      .toLowerCase()
      .replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase())
  if (isUpper(words[0]!) && !isUpper(words.at(-1)!)) {
    return {
      nom: cap(words.filter(isUpper).join(' ')),
      prenom: words.filter((w) => !isUpper(w)).join(' '),
    }
  }
  const first = words[0]!
  return { prenom: /^\p{L}\.?$/u.test(first) ? '' : first, nom: words.slice(1).join(' ') }
}
