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
