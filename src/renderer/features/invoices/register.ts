/**
 * Register columns (SPEC §6): the value displayed, filtered and grouped on, and how it sorts.
 * Pure helpers, shared by the table and « Exporter la sélection ».
 */
import { formatIsoDateFr } from '@shared/domain/dates'
import { INVOICE_STATUS_LABELS, formatEuros } from '@shared/domain/invoice'
import type { InvoiceRow } from '@shared/types/invoices'

export type ColumnKey = 'numero' | 'date' | 'patient' | 'montant' | 'statut' | 'envoi'

export interface RegisterColumn {
  key: ColumnKey
  label: string
  /** Labels of the two sort pills: ascending, descending. */
  sorts: [string, string]
  canGroup: boolean
  canFilter: boolean
  right?: boolean
}

export const REGISTER_COLUMNS: RegisterColumn[] = [
  {
    key: 'numero',
    label: 'N°',
    sorts: ['Croissant', 'Décroissant'],
    canGroup: false,
    canFilter: false,
  },
  {
    key: 'date',
    label: 'Émise le',
    sorts: ['Plus anciennes', 'Plus récentes'],
    canGroup: true,
    canFilter: true,
  },
  { key: 'patient', label: 'Patient', sorts: ['A → Z', 'Z → A'], canGroup: true, canFilter: true },
  {
    key: 'montant',
    label: 'Montant',
    sorts: ['Croissant', 'Décroissant'],
    canGroup: true,
    canFilter: true,
    right: true,
  },
  { key: 'statut', label: 'Statut', sorts: ['A → Z', 'Z → A'], canGroup: true, canFilter: true },
  { key: 'envoi', label: 'Envoi', sorts: ['A → Z', 'Z → A'], canGroup: true, canFilter: true },
]

const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

/** `2026-10-23` → « Octobre 2026 » (filter and group value of « Émise le »). */
export function monthLabel(isoDate: string): string {
  return `${MONTHS[Number(isoDate.slice(5, 7)) - 1]} ${isoDate.slice(0, 4)}`
}

/** Value shown in filters, chips and group headers. */
export function displayValue(row: InvoiceRow, key: ColumnKey): string {
  switch (key) {
    case 'numero':
      return row.numero
    case 'date':
      return monthLabel(row.dateEmission)
    case 'patient':
      return row.patientNom
    case 'montant':
      return formatEuros(row.montantCents)
    case 'statut':
      return INVOICE_STATUS_LABELS[row.statusKey]
    case 'envoi':
      return row.envoi
  }
}

/** Value the column sorts on (raw date and amount, labels otherwise). */
export function sortValue(row: InvoiceRow, key: ColumnKey): string | number {
  if (key === 'date') return row.dateEmission
  if (key === 'montant') return row.montantCents
  if (key === 'numero') return row.numero
  return displayValue(row, key).toLocaleLowerCase('fr')
}

/** Search box: patient or number, accents and case ignored. */
export function matchesSearch(row: InvoiceRow, query: string): boolean {
  const fold = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
  const q = fold(query.trim())
  return !q || fold(row.patientNom).includes(q) || row.numero.toLowerCase().includes(q)
}

export const yearsOf = (rows: InvoiceRow[]) =>
  [...new Set(rows.map((r) => r.dateEmission.slice(0, 4)))].sort().reverse()

/** Rows of « Exporter la sélection », as displayed. */
export function exportRows(rows: InvoiceRow[]): string[][] {
  return [
    ['N°', 'Émise le', 'Patient', 'Montant', 'Statut', 'Envoi', 'Date de séance'],
    ...rows.map((r) => [
      r.numero,
      formatIsoDateFr(r.dateEmission),
      r.patientNom,
      formatEuros(r.montantCents).replace(/\s€$/, '').replace('−', '-'),
      INVOICE_STATUS_LABELS[r.statusKey],
      r.envoiLabel,
      formatIsoDateFr(r.dateSeance),
    ]),
  ]
}
