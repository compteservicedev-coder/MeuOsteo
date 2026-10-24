/** R-25 · Proches: a link is stored once and read from both records with the inverse relation. */

export type Relation =
  'conjoint' | 'enfant' | 'parent' | 'fratrie' | 'grand_parent' | 'petit_enfant' | 'autre'

const INVERSE: Record<Relation, Relation> = {
  conjoint: 'conjoint',
  enfant: 'parent',
  parent: 'enfant',
  fratrie: 'fratrie',
  grand_parent: 'petit_enfant',
  petit_enfant: 'grand_parent',
  autre: 'autre',
}

/** Labels of the « Lien » choice, in the order of the mock-up. */
export const RELATION_OPTIONS: ReadonlyArray<{ value: Relation; label: string }> = [
  { value: 'conjoint', label: 'Conjoint' },
  { value: 'enfant', label: 'Enfant' },
  { value: 'parent', label: 'Parent' },
  { value: 'fratrie', label: 'Frère / sœur' },
  { value: 'grand_parent', label: 'Grand-parent' },
  { value: 'petit_enfant', label: 'Petit-enfant' },
  { value: 'autre', label: 'Autre' },
]

export const relationLabel = (r: Relation) => RELATION_OPTIONS.find((o) => o.value === r)!.label

export function inverseRelation(relation: Relation): Relation {
  return INVERSE[relation]
}

/**
 * Orders a link for storage (`patient_a < patient_b`). `relation` is what `other` is to `self`;
 * when the ids are swapped, the inverse relation is stored.
 */
export function orderLink(
  self: string,
  other: string,
  relation: Relation,
): { patientA: string; patientB: string; relAToB: Relation } {
  if (self === other) throw new Error('A patient cannot be linked to themself')
  return self < other
    ? { patientA: self, patientB: other, relAToB: relation }
    : { patientA: other, patientB: self, relAToB: inverseRelation(relation) }
}

/** What `other` is to `self`, for a stored link. */
export function relationSeenFrom(
  self: string,
  link: { patientA: string; patientB: string; relAToB: Relation },
): Relation {
  return link.patientA === self ? link.relAToB : inverseRelation(link.relAToB)
}

export type LinkError = 'self' | 'already_linked'

/** R-25 · A patient cannot be linked to themself nor twice to the same relative. */
export function linkError(self: string, other: string, existing: string[]): LinkError | null {
  if (self === other) return 'self'
  if (existing.includes(other)) return 'already_linked'
  return null
}

/**
 * Explains the reciprocity: « Paul Roux apparaîtra ici comme « enfant », et Camille Roux apparaîtra
 * sur la fiche de Paul Roux comme « parent ». »
 */
export function reciprocitySentence(selfName: string, otherName: string, relation: Relation): string {
  const here = relationLabel(relation).toLowerCase()
  const there = relationLabel(inverseRelation(relation)).toLowerCase()
  return `${otherName} apparaîtra ici comme « ${here} », et ${selfName} apparaîtra sur la fiche de ${otherName} comme « ${there} ».`
}
