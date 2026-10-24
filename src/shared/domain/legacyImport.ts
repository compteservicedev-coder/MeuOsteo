/**
 * Reprise de l'historique (docs/MIGRATION.md): pure transformation of the two tables of
 * MeuOsteo v1.04 (`Tb_patient`, `Tb_seance`) into database rows, with the report shown before
 * anything is written. Reading the workbook is done in main (exceljs).
 */
import { formatIsoDateFr } from './dates'
import { findDuplicatePairs } from './duplicates'
import { digitsOnly, foldForSearch } from './text'

/** A cell as read from the workbook, already unwrapped (formula result, rich text, link). */
export type RawCell = string | number | boolean | Date | null

export interface RawRow {
  /** Row number in the Excel sheet, shown in the report. */
  line: number
  /** Values by column header, as written in the file. */
  cells: Record<string, RawCell>
}

export interface RawTable {
  columns: string[]
  rows: RawRow[]
}

export type Sexe = 'F' | 'M'
export type Situation = 'celibataire' | 'couple' | 'pacse' | 'marie' | 'divorce' | 'veuf'
export type Paiement = 'especes' | 'cheque' | 'virement_attente' | 'virement_recu'

/** Default fee when the file has none (SPEC §5.3: 60 €). */
export const DEFAULT_TARIF_CENTS = 6000
/** Valid session dates: from 1990 to one year after today (MIGRATION.md). */
export const SEANCE_MIN_DATE = '1990-01-01'
/** Valid birth dates (R-15): not before 1900, not in the future. */
export const DDN_MIN_DATE = '1900-01-01'

// ── Columns ────────────────────────────────────────────────────────────────────────────────────

const PATIENT_COLUMNS = {
  id_patient: [],
  nom: [],
  prenom: [],
  ddn: ['date de naissance', 'naissance'],
  sexe: [],
  situation: [],
  enfant: ['enfants'],
  profession: ['metier'],
  adresse: [],
  cdp: ['cp', 'code postal'],
  commune: ['ville'],
  portable: [],
  fixe: [],
  mail: ['email', 'e-mail'],
  commentaire: [],
} as const satisfies Record<string, readonly string[]>

const SEANCE_COLUMNS = {
  date: [],
  motif: [],
  anam: ['anamnese'],
  pratique: [],
  prix: ['tarif'],
  paiement: [],
  praticien: [],
  id_patient: [],
} as const satisfies Record<string, readonly string[]>

type PatientColumn = keyof typeof PATIENT_COLUMNS
type SeanceColumn = keyof typeof SEANCE_COLUMNS

const REQUIRED_PATIENT_COLUMNS: PatientColumn[] = ['id_patient', 'nom', 'prenom', 'ddn']
const REQUIRED_SEANCE_COLUMNS: SeanceColumn[] = ['date', 'id_patient']

/** « id_patient », « ID Patient » and « idpatient » are the same column. */
const columnKey = (header: string) => foldForSearch(header).replace(/ /g, '')

/** Maps each known column to the header used in the file; other headers are reported. */
function resolveColumns<K extends string>(
  table: RawTable,
  known: Record<K, readonly string[]>,
): { headers: Partial<Record<K, string>>; unknown: string[] } {
  const headers: Partial<Record<K, string>> = {}
  const unknown: string[] = []
  for (const header of table.columns) {
    const key = columnKey(header)
    const match = (Object.keys(known) as K[]).find(
      (k) => columnKey(k) === key || known[k].some((alias) => columnKey(alias) === key),
    )
    if (match && headers[match] === undefined) headers[match] = header
    else if (key) unknown.push(header)
  }
  return { headers, unknown }
}

// ── Cell readers ───────────────────────────────────────────────────────────────────────────────

/** Excel serial day of 1970-01-01 (1900 date system). */
const EXCEL_EPOCH_SERIAL = 25569
const EXCEL_MAX_SERIAL = 2958465

/** Text of a cell: trimmed, Windows line breaks and Excel's `_x000D_` escapes removed. */
export function cellText(cell: RawCell): string {
  if (cell === null) return ''
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? '' : formatUtcDate(cell)
  return String(cell)
    .replace(/_x000D_/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
}

const optionalText = (cell: RawCell) => cellText(cell) || null

/** Names: single spaces, apostrophes and hyphens kept as typed. */
const cleanName = (cell: RawCell) => cellText(cell).replace(/\s+/g, ' ')

function formatUtcDate(date: Date): string {
  return formatIsoDateFr(date.toISOString().slice(0, 10))
}

/** `YYYY-MM-DD` when the day exists in the calendar (any year from 1 to 9999), else null. */
function isoFromParts(year: number, month: number, day: number): string | null {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(2000, month - 1, day))
  date.setUTCFullYear(year)
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const FRENCH_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+Z?)?$/

/** Strict reading of a typed date, `JJ/MM/AAAA` (or ISO): ISO date, or null. */
export function parseFrenchDate(text: string): string | null {
  const value = text.trim()
  const fr = FRENCH_DATE.exec(value)
  if (fr) return isoFromParts(Number(fr[3]), Number(fr[2]), Number(fr[1]))
  const iso = ISO_DATE.exec(value)
  if (iso) return isoFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  return null
}

type DateRead =
  | { kind: 'empty' }
  | { kind: 'invalid'; text: string }
  | { kind: 'date'; iso: string; text: string }

/** Reads a date cell: text `JJ/MM/AAAA`, a real Excel date, or an Excel serial number. */
export function readDateCell(cell: RawCell): DateRead {
  if (cell === null || cell === '') return { kind: 'empty' }
  let date: Date | null = null
  if (cell instanceof Date) date = cell
  else if (typeof cell === 'number' && cell >= 1 && cell <= EXCEL_MAX_SERIAL) {
    date = new Date(Math.round((cell - EXCEL_EPOCH_SERIAL) * 86_400_000))
  }
  if (date) {
    if (Number.isNaN(date.getTime())) return { kind: 'invalid', text: String(cell) }
    const iso = date.toISOString().slice(0, 10)
    return { kind: 'date', iso, text: formatIsoDateFr(iso) }
  }
  const text = cellText(cell)
  if (!text) return { kind: 'empty' }
  const iso = parseFrenchDate(text)
  return iso ? { kind: 'date', iso, text } : { kind: 'invalid', text }
}

export interface DateRange {
  min: string
  max: string
}

/** One year after `today`, as an ISO date (29 February becomes 28 February). */
function oneYearAfter(today: string): string {
  const next = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`
  return next.endsWith('-02-29') ? next.replace(/29$/, '28') : next
}

export function seanceDateRange(today: string): DateRange {
  return { min: SEANCE_MIN_DATE, max: oneYearAfter(today) }
}

export function ddnRange(today: string): DateRange {
  return { min: DDN_MIN_DATE, max: today }
}

export const inRange = (iso: string, { min, max }: DateRange) => iso >= min && iso <= max

/**
 * For a year typed wrong (« 1024 », « 2202 »): the same day with the year read as 2xxx, 20xx or
 * 19xx, if one of them is in the range. Only a suggestion: the user confirms it in the report.
 */
export function suggestYearFix(iso: string, range: DateRange): string | null {
  const year = iso.slice(0, 4)
  const rest = iso.slice(4)
  for (const candidate of [`2${year.slice(1)}`, `20${year.slice(2)}`, `19${year.slice(2)}`]) {
    const fixed = isoFromParts(Number(candidate), Number(rest.slice(1, 3)), Number(rest.slice(4)))
    if (fixed && inRange(fixed, range)) return fixed
  }
  return null
}

const LABEL_KEY = (cell: RawCell) => foldForSearch(cellText(cell))

export function parseSexe(cell: RawCell): Sexe | null | undefined {
  const key = LABEL_KEY(cell)
  if (!key) return null
  if (['homme', 'h', 'm', 'masculin'].includes(key)) return 'M'
  if (['femme', 'f', 'feminin'].includes(key)) return 'F'
  return undefined
}

/** Labels of the PARAM sheet: Célibataire, En couple, Pacsé(e), Marié(e), Divorcé(e), Veuf(ve). */
export function parseSituation(cell: RawCell): Situation | null | undefined {
  const key = LABEL_KEY(cell)
  if (!key) return null
  if (key.startsWith('celib')) return 'celibataire'
  if (key.includes('couple') || key.startsWith('concubin')) return 'couple'
  if (key.startsWith('pacs')) return 'pacse'
  if (key.startsWith('mari')) return 'marie'
  if (key.startsWith('divor')) return 'divorce'
  if (key.startsWith('veu')) return 'veuf'
  return undefined
}

/** Espèces, Chèque, Attente de Virement, Virement reçu. */
export function parsePaiement(cell: RawCell): Paiement | null | undefined {
  const key = LABEL_KEY(cell)
  if (!key) return null
  if (key.startsWith('espece')) return 'especes'
  if (key.startsWith('cheque')) return 'cheque'
  if (key.includes('virement') && key.includes('attente')) return 'virement_attente'
  if (key.includes('virement') && key.includes('recu')) return 'virement_recu'
  return undefined
}

/** `enfant`: « 2 » → 2, empty → null, anything else → undefined (anomaly). */
export function parseEnfants(cell: RawCell): number | null | undefined {
  const text = cellText(cell)
  if (!text) return null
  return /^\d{1,2}$/.test(text) ? Number(text) : undefined
}

/** `prix` in euros → cents. `null` when empty, `undefined` when unreadable. */
export function parsePrix(cell: RawCell): number | null | undefined {
  if (typeof cell === 'number')
    return cell >= 0 && cell < 10_000 ? Math.round(cell * 100) : undefined
  const text = cellText(cell)
    .replace(/[€\s  ]/g, '')
    .replace(',', '.')
  if (!text) return null
  return /^\d{1,4}(\.\d{1,2})?$/.test(text) ? Math.round(Number(text) * 100) : undefined
}

/**
 * Phone → digits only. Restores the leading 0 lost when Excel stored the number as a number
 * (612345678) and turns +33 / 0033 into 0. `valid` is false unless 10 digits starting with 0.
 */
export function normalizePhone(cell: RawCell): { digits: string | null; valid: boolean } {
  let digits = digitsOnly(cellText(cell))
  if (!digits) return { digits: null, valid: true }
  if (/^0033\d{9}$/.test(digits)) digits = `0${digits.slice(4)}`
  else if (/^33\d{9}$/.test(digits)) digits = `0${digits.slice(2)}`
  else if (/^[1-9]\d{8}$/.test(digits)) digits = `0${digits}`
  return { digits, valid: /^0\d{9}$/.test(digits) }
}

/** Postcode: 5 digits, with the leading 0 restored (« 1000 » → « 01000 »). */
export function normalizeCp(cell: RawCell): { cp: string | null; valid: boolean } {
  const digits = digitsOnly(cellText(cell))
  if (!digits) return { cp: null, valid: true }
  const cp = digits.length === 4 ? `0${digits}` : digits
  return { cp, valid: cp.length === 5 }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(cell: RawCell): { email: string | null; valid: boolean } {
  const email = cellText(cell)
    .replace(/^mailto:/i, '')
    .toLowerCase()
  if (!email) return { email: null, valid: true }
  return { email, valid: EMAIL.test(email) }
}

// ── Plan and report ────────────────────────────────────────────────────────────────────────────

export type ImportAnomalyKind =
  | 'patient_ddn_invalid'
  | 'patient_ddn_from_key'
  | 'patient_name_missing'
  | 'patient_key_missing'
  | 'patient_key_duplicate'
  | 'patient_sexe_unknown'
  | 'patient_situation_unknown'
  | 'patient_enfants_invalid'
  | 'patient_cp_invalid'
  | 'patient_phone_invalid'
  | 'patient_email_invalid'
  | 'seance_date_invalid'
  | 'seance_date_missing'
  | 'seance_prix_missing'
  | 'seance_prix_invalid'
  | 'seance_paiement_unknown'
  | 'seance_orphan'
  | 'seance_same_day'

export interface ImportAnomaly {
  kind: ImportAnomalyKind
  line: number
  /** « Prénom Nom » (or the old identifier): never any medical content. */
  who: string
  /** Value read in the file, as displayed; empty when the cell is empty. */
  value: string
  /** Key of the correction typed in the report (`ddn:12`, `date:34`). */
  correctionKey?: string
  /** Date used if nothing is typed (sessions only, imported as « date à corriger »). */
  suggestion?: string | null
}

/** Order and wording of the groups of the report. */
export const ANOMALY_LABELS: Record<ImportAnomalyKind, { title: string; help: string }> = {
  patient_ddn_invalid: {
    title: 'Dates de naissance à saisir',
    help: 'Date absente ou invalide : à saisir avant l’import.',
  },
  patient_ddn_from_key: {
    title: 'Dates de naissance reprises de l’identifiant',
    help: 'La colonne « ddn » était vide ou invalide : date lue dans l’identifiant du patient.',
  },
  patient_name_missing: {
    title: 'Nom ou prénom manquant',
    help: 'Fiche importée telle quelle, à compléter.',
  },
  patient_key_missing: {
    title: 'Patients sans identifiant',
    help: 'Fiche importée, mais aucune séance ne peut lui être rattachée.',
  },
  patient_key_duplicate: {
    title: 'Identifiants en double',
    help: 'Les séances vont à la première fiche ; la seconde est importée et proposée dans « À rapprocher ».',
  },
  patient_sexe_unknown: { title: 'Sexe non reconnu', help: 'Laissé vide.' },
  patient_situation_unknown: { title: 'Situation non reconnue', help: 'Laissée vide.' },
  patient_enfants_invalid: { title: 'Nombre d’enfants illisible', help: 'Laissé vide.' },
  patient_cp_invalid: {
    title: 'Codes postaux non conformes',
    help: 'Importés tels quels, à vérifier.',
  },
  patient_phone_invalid: {
    title: 'Téléphones non conformes',
    help: 'Importés tels quels (chiffres seuls), à vérifier.',
  },
  patient_email_invalid: {
    title: 'E-mails non conformes',
    help: 'Importés tels quels, à vérifier.',
  },
  seance_date_invalid: {
    title: 'Dates de séance invalides',
    help: 'Corrigez la date, sinon la séance est importée à la date proposée et marquée « date à corriger ».',
  },
  seance_date_missing: {
    title: 'Séances sans date',
    help: 'Saisissez la date, sinon la séance est importée à la date proposée et marquée « date à corriger ».',
  },
  seance_prix_missing: {
    title: 'Séances sans prix',
    help: 'Importées au tarif par défaut.',
  },
  seance_prix_invalid: {
    title: 'Prix illisibles',
    help: 'Importées au tarif par défaut.',
  },
  seance_paiement_unknown: {
    title: 'Modes de paiement non reconnus',
    help: 'Laissés vides.',
  },
  seance_orphan: {
    title: 'Séances orphelines',
    help: 'Aucun patient ne porte cet identifiant : séance non importée.',
  },
  seance_same_day: {
    title: 'Deux séances le même jour',
    help: 'Les deux séances sont conservées.',
  },
}

export interface PlannedPatient {
  line: number
  legacyKey: string | null
  nom: string
  prenom: string
  /** ISO date, or null while it still has to be typed. */
  ddn: string | null
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
  commentaire: string | null
}

export interface PlannedSeance {
  line: number
  /** Index in `LegacyImportPlan.patients`. */
  patient: number
  /** ISO date when valid; null when it has to be corrected. */
  date: string | null
  /** Value read in the file (empty when missing). */
  dateRaw: string
  /** Date used when no correction is typed. */
  dateSuggestion: string | null
  motif: string | null
  anamnese: string | null
  pratique: string | null
  tarifCents: number
  paiement: Paiement | null
}

export interface LegacyImportPlan {
  patients: PlannedPatient[]
  seances: PlannedSeance[]
  anomalies: ImportAnomaly[]
  /** Ignored fields and columns. */
  notes: string[]
  /** R-19 pairs among the imported records. */
  duplicates: number
}

export type AnalyzeResult =
  { ok: true; plan: LegacyImportPlan } | { ok: false; reason: 'columns_missing'; missing: string[] }

export interface AnalyzeInput {
  patients: RawTable
  seances: RawTable
  /** `YYYY-MM-DD` in Europe/Paris. */
  today: string
  defaultTarifCents?: number
}

const isEmptyRow = (row: RawRow) => Object.values(row.cells).every((c) => cellText(c) === '')

/** Folded key used when the exact identifier does not match (case, accents, spaces). */
const looseKey = (key: string) => foldForSearch(key).replace(/ /g, '')

/** Analyses the two tables without writing anything (MIGRATION.md « Déroulé », step 1–2). */
export function analyzeLegacyTables({
  patients: patientTable,
  seances: seanceTable,
  today,
  defaultTarifCents = DEFAULT_TARIF_CENTS,
}: AnalyzeInput): AnalyzeResult {
  const pCols = resolveColumns(patientTable, PATIENT_COLUMNS)
  const sCols = resolveColumns(seanceTable, SEANCE_COLUMNS)
  const missing = [
    ...REQUIRED_PATIENT_COLUMNS.filter((c) => !pCols.headers[c]).map((c) => `Tb_patient.${c}`),
    ...REQUIRED_SEANCE_COLUMNS.filter((c) => !sCols.headers[c]).map((c) => `Tb_seance.${c}`),
  ]
  if (missing.length) return { ok: false, reason: 'columns_missing', missing }

  const anomalies: ImportAnomaly[] = []
  const notes: string[] = []
  const report = (anomaly: ImportAnomaly) => anomalies.push(anomaly)
  const pCell = (row: RawRow, c: PatientColumn): RawCell => {
    const header = pCols.headers[c]
    return header === undefined ? null : (row.cells[header] ?? null)
  }
  const sCell = (row: RawRow, c: SeanceColumn): RawCell => {
    const header = sCols.headers[c]
    return header === undefined ? null : (row.cells[header] ?? null)
  }

  // Patients
  const ddnLimits = ddnRange(today)
  const patients: PlannedPatient[] = []
  const names: string[] = []
  const byKey = new Map<string, number>()
  const byLooseKey = new Map<string, number | null>()

  for (const row of patientTable.rows) {
    if (isEmptyRow(row)) continue
    const { line } = row
    const legacyKey = cellText(pCell(row, 'id_patient')) || null
    const nom = cleanName(pCell(row, 'nom'))
    const prenom = cleanName(pCell(row, 'prenom'))
    const who = `${prenom} ${nom}`.trim() || legacyKey || `Ligne ${line}`
    const at = (kind: ImportAnomalyKind, value: string, extra: Partial<ImportAnomaly> = {}) =>
      report({ kind, line, who, value, ...extra })

    if (!nom || !prenom) at('patient_name_missing', legacyKey ?? '')
    if (!legacyKey) at('patient_key_missing', '')

    const ddnRead = readDateCell(pCell(row, 'ddn'))
    let ddn = ddnRead.kind === 'date' && inRange(ddnRead.iso, ddnLimits) ? ddnRead.iso : null
    if (!ddn) {
      const shown = ddnRead.kind === 'empty' ? '' : ddnRead.text
      const fromKey = legacyKey?.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*$/)?.[1]
      const keyIso = fromKey ? parseFrenchDate(fromKey) : null
      if (keyIso && inRange(keyIso, ddnLimits)) {
        ddn = keyIso
        at('patient_ddn_from_key', shown)
      } else {
        at('patient_ddn_invalid', shown, { correctionKey: `ddn:${line}` })
      }
    }

    const sexe = parseSexe(pCell(row, 'sexe'))
    if (sexe === undefined) at('patient_sexe_unknown', cellText(pCell(row, 'sexe')))
    const situation = parseSituation(pCell(row, 'situation'))
    if (situation === undefined) at('patient_situation_unknown', cellText(pCell(row, 'situation')))
    const enfants = parseEnfants(pCell(row, 'enfant'))
    if (enfants === undefined) at('patient_enfants_invalid', cellText(pCell(row, 'enfant')))
    const { cp, valid: cpValid } = normalizeCp(pCell(row, 'cdp'))
    if (!cpValid) at('patient_cp_invalid', cellText(pCell(row, 'cdp')))
    const portable = normalizePhone(pCell(row, 'portable'))
    if (!portable.valid) at('patient_phone_invalid', cellText(pCell(row, 'portable')))
    const fixe = normalizePhone(pCell(row, 'fixe'))
    if (!fixe.valid) at('patient_phone_invalid', cellText(pCell(row, 'fixe')))
    const { email, valid: emailValid } = normalizeEmail(pCell(row, 'mail'))
    if (!emailValid) at('patient_email_invalid', cellText(pCell(row, 'mail')))

    const index = patients.length
    if (legacyKey) {
      if (byKey.has(legacyKey)) {
        at('patient_key_duplicate', legacyKey)
      } else {
        byKey.set(legacyKey, index)
        const loose = looseKey(legacyKey)
        byLooseKey.set(loose, byLooseKey.has(loose) ? null : index)
      }
    }
    names.push(who)
    patients.push({
      line,
      legacyKey,
      nom,
      prenom,
      ddn,
      sexe: sexe ?? null,
      situation: situation ?? null,
      enfants: enfants ?? null,
      profession: optionalText(pCell(row, 'profession')),
      adresse: optionalText(pCell(row, 'adresse')),
      cp,
      commune: cleanName(pCell(row, 'commune')) || null,
      portable: portable.digits,
      fixe: fixe.digits,
      email,
      commentaire: optionalText(pCell(row, 'commentaire')),
    })
  }

  // Sessions
  const dateLimits = seanceDateRange(today)
  const seances: PlannedSeance[] = []
  let praticienFilled = 0
  const pendingDates: { seance: PlannedSeance; kind: ImportAnomalyKind; who: string }[] = []

  for (const row of seanceTable.rows) {
    if (isEmptyRow(row)) continue
    const { line } = row
    const key = cellText(sCell(row, 'id_patient'))
    const patient = byKey.get(key) ?? byLooseKey.get(looseKey(key)) ?? null
    const dateRead = readDateCell(sCell(row, 'date'))
    const dateText = dateRead.kind === 'empty' ? '' : dateRead.text
    if (patient === null) {
      report({ kind: 'seance_orphan', line, who: key, value: dateText })
      continue
    }
    const who = names[patient]!
    if (cellText(sCell(row, 'praticien'))) praticienFilled++

    let tarifCents = parsePrix(sCell(row, 'prix'))
    if (tarifCents === null) report({ kind: 'seance_prix_missing', line, who, value: '' })
    if (tarifCents === undefined) {
      report({ kind: 'seance_prix_invalid', line, who, value: cellText(sCell(row, 'prix')) })
    }
    tarifCents ??= defaultTarifCents
    const paiement = parsePaiement(sCell(row, 'paiement'))
    if (paiement === undefined) {
      report({
        kind: 'seance_paiement_unknown',
        line,
        who,
        value: cellText(sCell(row, 'paiement')),
      })
    }

    const valid = dateRead.kind === 'date' && inRange(dateRead.iso, dateLimits)
    const seance: PlannedSeance = {
      line,
      patient,
      date: valid ? dateRead.iso : null,
      dateRaw: dateText,
      dateSuggestion:
        dateRead.kind === 'date' && !valid ? suggestYearFix(dateRead.iso, dateLimits) : null,
      motif: optionalText(sCell(row, 'motif')),
      anamnese: optionalText(sCell(row, 'anam')),
      pratique: optionalText(sCell(row, 'pratique')),
      tarifCents,
      paiement: paiement ?? null,
    }
    if (!valid) {
      pendingDates.push({
        seance,
        kind: dateRead.kind === 'empty' ? 'seance_date_missing' : 'seance_date_invalid',
        who,
      })
    }
    seances.push(seance)
  }

  // Invalid dates without an obvious fix: the date of the nearest session in the table, which
  // the old tool filled in chronological order.
  for (const { seance, kind, who } of pendingDates) {
    if (!seance.dateSuggestion) seance.dateSuggestion = nearestDate(seances, seance)
    report({
      kind,
      line: seance.line,
      who,
      value: seance.dateRaw,
      correctionKey: `date:${seance.line}`,
      suggestion: seance.dateSuggestion,
    })
  }

  // MIGRATION.md: two sessions of a patient on the same day are both kept, and reported.
  const days = new Set<string>()
  for (const s of seances) {
    if (!s.date) continue
    const day = `${s.patient}|${s.date}`
    if (days.has(day)) {
      report({ kind: 'seance_same_day', line: s.line, who: names[s.patient]!, value: s.dateRaw })
    }
    days.add(day)
  }

  if (sCols.headers.praticien !== undefined) {
    notes.push(
      praticienFilled === 0
        ? 'Champ « praticien » vide partout : ignoré'
        : `Champ « praticien » ignoré (renseigné sur ${praticienFilled} séance${praticienFilled > 1 ? 's' : ''})`,
    )
  }
  for (const header of pCols.unknown) notes.push(`Colonne « ${header} » de Tb_patient ignorée`)
  for (const header of sCols.unknown) notes.push(`Colonne « ${header} » de Tb_seance ignorée`)

  const duplicates = findDuplicatePairs(
    patients.flatMap((p, i) => (p.ddn ? [{ ...p, id: String(i), ddn: p.ddn }] : [])),
  ).length

  return { ok: true, plan: { patients, seances, anomalies, notes, duplicates } }
}

function nearestDate(seances: readonly PlannedSeance[], target: PlannedSeance): string | null {
  const index = seances.indexOf(target)
  for (let i = index - 1; i >= 0; i--) if (seances[i]!.date) return seances[i]!.date
  for (let i = index + 1; i < seances.length; i++) if (seances[i]!.date) return seances[i]!.date
  return null
}

// ── Corrections ────────────────────────────────────────────────────────────────────────────────

export type ImportCorrections = Record<string, string>

export interface FinalPatient extends PlannedPatient {
  ddn: string
}

export interface FinalSeance extends PlannedSeance {
  date: string
  /** Value read in the file when the session is imported as « date à corriger », else null. */
  dateToFix: string | null
}

export type FinalizeResult =
  | { ok: true; patients: FinalPatient[]; seances: FinalSeance[] }
  | { ok: false; reason: 'invalid_corrections'; keys: string[] }
  | { ok: false; reason: 'corrections_required'; keys: string[] }

/** Checks a typed correction (ISO date) for its field: birth date or session date. */
export function isValidCorrection(key: string, iso: string, today: string): boolean {
  if (parseFrenchDate(iso) !== iso) return false
  return inRange(iso, key.startsWith('ddn:') ? ddnRange(today) : seanceDateRange(today))
}

/**
 * Applies the dates typed in the report. Birth dates are required (R-15); a session date left
 * empty takes the suggested date and is marked « date à corriger ».
 */
export function finalizeImport(
  plan: LegacyImportPlan,
  corrections: ImportCorrections,
  today: string,
): FinalizeResult {
  const allowed = new Set(plan.anomalies.flatMap((a) => (a.correctionKey ? [a.correctionKey] : [])))
  const wrong = Object.entries(corrections)
    .filter(([key, iso]) => !allowed.has(key) || !isValidCorrection(key, iso, today))
    .map(([key]) => key)
  if (wrong.length) return { ok: false, reason: 'invalid_corrections', keys: wrong }

  const required: string[] = []
  const patients = plan.patients.flatMap((p): FinalPatient[] => {
    const ddn = p.ddn ?? corrections[`ddn:${p.line}`]
    if (ddn) return [{ ...p, ddn }]
    required.push(`ddn:${p.line}`)
    return []
  })
  const seances = plan.seances.flatMap((s): FinalSeance[] => {
    if (s.date) return [{ ...s, date: s.date, dateToFix: null }]
    const corrected = corrections[`date:${s.line}`]
    if (corrected) return [{ ...s, date: corrected, dateToFix: null }]
    if (s.dateSuggestion) return [{ ...s, date: s.dateSuggestion, dateToFix: s.dateRaw }]
    required.push(`date:${s.line}`)
    return []
  })
  if (required.length) return { ok: false, reason: 'corrections_required', keys: required }
  return { ok: true, patients, seances }
}
