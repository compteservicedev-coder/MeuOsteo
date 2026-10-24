/** R-15 · Validation of a patient record, and normalisation before storage. */
import { isValidIsoDate } from './dates'
import type { Sexe, Situation } from './patient'
import { digitsOnly } from './text'

/** What the edit panel sends (phones may still contain spaces). */
export interface PatientDraft {
  nom: string
  prenom: string
  ddn: string
  sexe: Sexe | null
  situation: Situation | null
  enfants: number | null
  profession: string
  adresse: string
  cp: string
  commune: string
  portable: string
  fixe: string
  email: string
}

export type PatientField = keyof PatientDraft

export const EMPTY_PATIENT_DRAFT: PatientDraft = {
  nom: '',
  prenom: '',
  ddn: '',
  sexe: null,
  situation: null,
  enfants: null,
  profession: '',
  adresse: '',
  cp: '',
  commune: '',
  portable: '',
  fixe: '',
  email: '',
}

export type PatientErrors = Partial<Record<PatientField, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Mandatory: nom, prénom, date de naissance (not in the future, not before 1900).
 * If filled in: portable 0[67] + 8 digits, fixe 0[1-59] + 8 digits, valid e-mail, 5-digit CP.
 */
export function validatePatient(draft: PatientDraft, today: string): PatientErrors {
  const e: PatientErrors = {}
  if (!draft.nom.trim()) e.nom = 'Le nom est obligatoire'
  if (!draft.prenom.trim()) e.prenom = 'Le prénom est obligatoire'
  if (!draft.ddn) e.ddn = 'La date de naissance est obligatoire'
  else if (!isValidIsoDate(draft.ddn)) e.ddn = 'Date de naissance invalide'
  else if (draft.ddn > today) e.ddn = 'La date ne peut pas être dans le futur'
  else if (draft.ddn < '1900-01-01') e.ddn = 'Date de naissance improbable'
  const portable = digitsOnly(draft.portable)
  if (portable && !/^0[67]\d{8}$/.test(portable)) {
    e.portable = 'Numéro de portable invalide (06 ou 07, 10 chiffres)'
  }
  const fixe = digitsOnly(draft.fixe)
  if (fixe && !/^0[1-59]\d{8}$/.test(fixe)) e.fixe = 'Numéro de fixe invalide (10 chiffres)'
  if (draft.email.trim() && !EMAIL.test(draft.email.trim())) e.email = 'Adresse e-mail invalide'
  if (draft.cp.trim() && !/^\d{5}$/.test(draft.cp.trim())) e.cp = '5 chiffres attendus'
  if (draft.enfants !== null && (!Number.isInteger(draft.enfants) || draft.enfants < 0)) {
    e.enfants = 'Nombre d’enfants invalide'
  }
  return e
}

export function errorCountLabel(errors: PatientErrors): string {
  const n = Object.keys(errors).length
  return n > 1 ? `${n} champs à corriger` : `${n} champ à corriger`
}

/** Stored form: trimmed text, empty → null, phones in digits only, e-mail in lower case. */
export interface NormalizedPatient {
  nom: string
  prenom: string
  ddn: string
  sexe: Sexe | null
  situation: Situation | null
  enfants: number | null
  profession: string | null
  adresse: string | null
  cp: string | null
  commune: string | null
  portable: string | null
  fixe: string | null
  email: string | null
}

const orNull = (v: string) => (v.trim() === '' ? null : v.trim().replace(/\s+/g, ' '))

export function normalizePatient(draft: PatientDraft): NormalizedPatient {
  return {
    nom: draft.nom.trim().replace(/\s+/g, ' '),
    prenom: draft.prenom.trim().replace(/\s+/g, ' '),
    ddn: draft.ddn,
    sexe: draft.sexe,
    situation: draft.situation,
    enfants: draft.enfants,
    profession: orNull(draft.profession),
    adresse: orNull(draft.adresse),
    cp: orNull(draft.cp),
    commune: orNull(draft.commune),
    portable: orNull(digitsOnly(draft.portable)),
    fixe: orNull(digitsOnly(draft.fixe)),
    email: draft.email.trim() ? draft.email.trim().toLowerCase() : null,
  }
}

/** Journal names of the fields (R-20: names only, never values), in display order. */
export const PATIENT_FIELD_NAMES: Record<keyof NormalizedPatient, string> = {
  nom: 'nom',
  prenom: 'prénom',
  ddn: 'date de naissance',
  sexe: 'sexe',
  situation: 'situation',
  enfants: 'enfants',
  profession: 'profession',
  adresse: 'adresse',
  cp: 'code postal',
  commune: 'commune',
  portable: 'portable',
  fixe: 'fixe',
  email: 'e-mail',
}

/** Names of the fields that differ between two stored versions. */
export function changedFieldNames(before: NormalizedPatient, after: NormalizedPatient): string[] {
  return (Object.keys(PATIENT_FIELD_NAMES) as Array<keyof NormalizedPatient>)
    .filter((k) => before[k] !== after[k])
    .map((k) => PATIENT_FIELD_NAMES[k])
}
