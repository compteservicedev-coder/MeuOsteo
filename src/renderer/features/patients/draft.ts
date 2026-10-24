import { formatPhone } from '@shared/domain/patient'
import type { PatientDraft, PatientField } from '@shared/domain/patientValidation'
import type { PatientRecord } from '@shared/types/patients'

/** Edit form values from a stored record (phones shown by pairs). */
export function draftFromRecord(p: PatientRecord): PatientDraft {
  return {
    nom: p.nom,
    prenom: p.prenom,
    ddn: p.ddn,
    sexe: p.sexe,
    situation: p.situation,
    enfants: p.enfants,
    profession: p.profession ?? '',
    adresse: p.adresse ?? '',
    cp: p.cp ?? '',
    commune: p.commune ?? '',
    portable: p.portable ? formatPhone(p.portable) : '',
    fixe: p.fixe ? formatPhone(p.fixe) : '',
    email: p.email ?? '',
  }
}

export const sameDraft = (a: PatientDraft, b: PatientDraft) => JSON.stringify(a) === JSON.stringify(b)

/** Fields highlighted when the panel opens to complete the address (SPEC §5.1). */
export const ADDRESS_FIELDS: PatientField[] = ['adresse', 'cp', 'commune']
