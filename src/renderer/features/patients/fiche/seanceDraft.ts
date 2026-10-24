import type { Paiement } from '@shared/domain/seance'
import type { SeanceChanges, SeanceView } from '@shared/types/patients'

/** Working copy of the selected session (R-03, R-05). */
export interface SeanceDraft {
  date: string
  motif: string
  anamnese: string
  pratique: string
  tarifCents: number
  paiement: Paiement | null
}

export function draftOf(s: SeanceView): SeanceDraft {
  return {
    date: s.date,
    motif: s.motif ?? '',
    anamnese: s.anamnese ?? '',
    pratique: s.pratique ?? '',
    tarifCents: s.tarifCents,
    paiement: s.paiement,
  }
}

/** Only the fields that changed, ready for `seances.save` / `seances.markDone`. */
export function changesOf(draft: SeanceDraft, s: SeanceView): SeanceChanges {
  const base = draftOf(s)
  const changes: SeanceChanges = {}
  if (draft.date !== base.date) changes.date = draft.date
  if (draft.motif !== base.motif) changes.motif = draft.motif || null
  if (draft.anamnese !== base.anamnese) changes.anamnese = draft.anamnese || null
  if (draft.pratique !== base.pratique) changes.pratique = draft.pratique || null
  if (draft.tarifCents !== base.tarifCents) changes.tarifCents = draft.tarifCents
  if (draft.paiement !== base.paiement) changes.paiement = draft.paiement
  return changes
}

export const isDirty = (draft: SeanceDraft | null, s: SeanceView | undefined) =>
  Boolean(draft && s && Object.keys(changesOf(draft, s)).length > 0)
