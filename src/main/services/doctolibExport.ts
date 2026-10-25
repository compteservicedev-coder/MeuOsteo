/**
 * Secours: import of the Doctolib « Historique de RDV » export (.xlsx, GMAIL_DOCTOLIB.md §4).
 * Columns are found by their title, not their position; every row goes through the same
 * rapprochement pipeline as the e-mails. Logs hold counts only.
 */
import ExcelJS from 'exceljs'
import type { ParsedRdv } from '@shared/domain/matching'
import { normalizeTime } from '@shared/domain/planning'
import { foldForSearch } from '@shared/domain/text'
import type { ExportImportReport, ExportImportResult } from '@shared/types/planning'
import type { RdvPipeline } from './doctolib/pipeline'

type Column =
  | 'id'
  | 'date'
  | 'heure'
  | 'patient'
  | 'nom'
  | 'prenom'
  | 'telephone'
  | 'email'
  | 'motif'
  | 'statut'

/** Accepted titles (folded), first match wins. */
const TITLES: Record<Column, string[]> = {
  id: ['identifiant rdv', 'id rdv', 'identifiant du rendez vous', 'identifiant', 'id'],
  date: ['date du rdv', 'date du rendez vous', 'date de debut', 'date rdv', 'date'],
  heure: ['heure du rdv', 'heure de debut', 'heure rdv', 'heure', 'debut'],
  patient: ['patient', 'nom du patient', 'nom complet'],
  nom: ['nom de famille', 'nom'],
  prenom: ['prenom'],
  telephone: ['telephone portable', 'portable', 'telephone', 'tel', 'mobile'],
  email: ['e mail', 'email', 'adresse e mail', 'courriel'],
  motif: ['motif du rdv', 'motif de consultation', 'motif', 'type de rdv'],
  statut: ['statut du rdv', 'statut', 'etat'],
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue)
    if ('richText' in value) return value.richText.map((r) => r.text).join('')
  }
  return String(value).trim()
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `24/10/2026`, `2026-10-24`, an Excel date, or `24/10/2026 09:30`. */
export function parseExportDate(value: ExcelJS.CellValue): {
  date: string | null
  heure: string | null
} {
  if (value instanceof Date) {
    // exceljs gives dates in UTC with the wall-clock value of the sheet.
    const date = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
    const h = value.getUTCHours()
    const m = value.getUTCMinutes()
    return { date, heure: h || m ? `${pad(h)}:${pad(m)}` : null }
  }
  const text = cellText(value)
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:h](\d{2}))?/.exec(text)
  if (fr) {
    return {
      date: `${fr[3]}-${pad(Number(fr[2]))}-${pad(Number(fr[1]))}`,
      heure: fr[4] ? `${pad(Number(fr[4]))}:${fr[5]}` : null,
    }
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/.exec(text)
  if (iso)
    return { date: `${iso[1]}-${iso[2]}-${iso[3]}`, heure: iso[4] ? `${iso[4]}:${iso[5]}` : null }
  return { date: null, heure: null }
}

export function parseExportTime(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date) return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`
  if (typeof value === 'number' && value < 1) {
    const minutes = Math.round(value * 24 * 60)
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
  }
  const m = /(\d{1,2})[:h](\d{2})/.exec(cellText(value))
  return m ? normalizeTime(`${m[1]}:${m[2]}`) : null
}

/** Finds the header row (within the first 10) and the column of each field. */
export function locateColumns(
  sheet: ExcelJS.Worksheet,
): { headerRow: number; columns: Partial<Record<Column, number>> } | null {
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    const titles = new Map<number, string>()
    sheet.getRow(r).eachCell((cell, col) => titles.set(col, foldForSearch(cellText(cell.value))))
    const columns: Partial<Record<Column, number>> = {}
    const used = new Set<number>()
    for (const key of Object.keys(TITLES) as Column[]) {
      for (const wanted of TITLES[key]) {
        const hit = [...titles].find(([col, t]) => !used.has(col) && t === wanted)
        if (hit) {
          columns[key] = hit[0]
          used.add(hit[0])
          break
        }
      }
    }
    if (columns.date && (columns.patient || columns.nom)) return { headerRow: r, columns }
  }
  return null
}

const CANCELLED = /annul|excus|absent|lapin/

export async function importDoctolibExport(
  data: Buffer,
  pipeline: RdvPipeline,
  now: Date = new Date(),
): Promise<ExportImportResult> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(data as unknown as ArrayBuffer)
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  const sheet = workbook.worksheets[0]
  const located = sheet ? locateColumns(sheet) : null
  if (!sheet || !located) {
    return { ok: false, reason: 'columns', missing: ['date', 'patient'] }
  }
  const { headerRow, columns } = located
  const report: ExportImportReport = {
    rows: 0,
    created: 0,
    updated: 0,
    cancelled: 0,
    pending: 0,
    ignored: 0,
  }
  const get = (row: ExcelJS.Row, c: Column) => (columns[c] ? row.getCell(columns[c]!).value : null)
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const texts: string[] = []
    row.eachCell((cell) => texts.push(cellText(cell.value)))
    if (texts.every((t) => !t)) continue
    report.rows++
    const when = parseExportDate(get(row, 'date'))
    const heure = parseExportTime(get(row, 'heure')) ?? when.heure
    const nom = columns.patient
      ? cellText(get(row, 'patient'))
      : `${cellText(get(row, 'prenom'))} ${cellText(get(row, 'nom'))}`.trim()
    if (!when.date || !nom) {
      report.ignored++
      continue
    }
    const statut = foldForSearch(cellText(get(row, 'statut')))
    const rdv: ParsedRdv = {
      type: CANCELLED.test(statut) ? 'cancelled' : 'new',
      date: when.date,
      heure,
      nom,
      telephone: cellText(get(row, 'telephone')) || null,
      email: cellText(get(row, 'email')) || null,
      motif: cellText(get(row, 'motif')) || null,
    }
    const id = cellText(get(row, 'id')) || `${rdv.date}-${rdv.heure ?? ''}-${foldForSearch(nom)}`
    const { outcome } = pipeline.ingest(rdv, {
      messageId: `export:${id}:${rdv.type}`,
      receivedAt: now.toISOString(),
    })
    if (outcome === 'attached') report.created++
    else if (outcome === 'moved') report.updated++
    else if (outcome === 'cancelled') report.cancelled++
    else if (outcome === 'pending_new' || outcome === 'pending_multi') report.pending++
    else if (outcome === 'unchanged') report.ignored++
  }
  return { ok: true, report }
}
