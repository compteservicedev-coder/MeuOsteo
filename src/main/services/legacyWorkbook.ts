/**
 * Reads the MeuOsteo v1.04 workbook (docs/MIGRATION.md) with exceljs: the `Tb_patient` and
 * `Tb_seance` tables are found by name, never by a fixed range. If the tables cannot be found
 * (renamed, or not understood by exceljs), the header row of each table is searched instead.
 */
import type { Workbook, Worksheet } from 'exceljs'
import type { RawCell, RawTable } from '@shared/domain/legacyImport'
import { foldForSearch } from '@shared/domain/text'

export type LegacyWorkbookFailure = 'unreadable' | 'tables_missing'

export class LegacyWorkbookError extends Error {
  constructor(
    readonly reason: LegacyWorkbookFailure,
    readonly missing: string[] = [],
  ) {
    super(`Legacy workbook ${reason}`)
  }
}

export interface LegacyTables {
  patients: RawTable
  seances: RawTable
}

/** The columns that identify each table when its header row has to be searched. */
const TABLES = {
  Tb_patient: ['id_patient', 'nom', 'prenom', 'ddn'],
  Tb_seance: ['date', 'id_patient'],
} as const

type TableName = keyof typeof TABLES

/** Model of a table as exceljs reads it (`Table.table`, not in its type definitions). */
interface TableModel {
  name?: string
  displayName?: string
  tableRef?: string
  ref?: string
  totalsRow?: boolean
  columns?: { name?: string }[]
}

const fold = (text: string) => foldForSearch(text).replace(/ /g, '')

/** Unwraps exceljs cell values: formula results, rich text, hyperlinks; errors become empty. */
export function unwrapCell(value: unknown): RawCell {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Date) return value
  if (typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (Array.isArray(v['richText'])) {
    return (v['richText'] as { text?: unknown }[]).map((part) => String(part.text ?? '')).join('')
  }
  if ('formula' in v || 'sharedFormula' in v || 'result' in v) return unwrapCell(v['result'])
  if ('text' in v) return unwrapCell(v['text'])
  return null
}

function cellString(ws: Worksheet, row: number, col: number): string {
  const value = unwrapCell(ws.getRow(row).getCell(col).value)
  return value === null || value instanceof Date ? '' : String(value).trim()
}

function columnNumber(letters: string): number {
  return [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)
}

function decodeRange(ref: string) {
  const m = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(ref.toUpperCase())
  if (!m) return null
  return {
    top: Number(m[2]),
    left: columnNumber(m[1]!),
    bottom: Number(m[4]),
    right: columnNumber(m[3]!),
  }
}

function readRows(
  ws: Worksheet,
  columns: string[],
  left: number,
  firstRow: number,
  lastRow: number | null,
): RawTable {
  const rows: RawTable['rows'] = []
  const last = lastRow ?? ws.rowCount
  for (let r = firstRow; r <= last; r++) {
    const row = ws.getRow(r)
    const cells: Record<string, RawCell> = {}
    columns.forEach((name, i) => {
      cells[name] = unwrapCell(row.getCell(left + i).value)
    })
    const empty = Object.values(cells).every((c) => c === null || String(c).trim() === '')
    // Without a table range, the first empty row ends the table.
    if (empty && lastRow === null) break
    if (!empty) rows.push({ line: r, cells })
  }
  return { columns, rows }
}

function findTable(workbook: Workbook, name: TableName): RawTable | null {
  for (const ws of workbook.worksheets) {
    for (const table of ws.getTables() as unknown as { table?: TableModel }[]) {
      const model = table.table
      if (!model || ![model.name, model.displayName].some((n) => n && fold(n) === fold(name))) {
        continue
      }
      const range = decodeRange(model.tableRef ?? model.ref ?? '')
      if (!range) continue
      const columns = (model.columns ?? []).map(
        (c, i) => c.name ?? cellString(ws, range.top, range.left + i),
      )
      // Excel omits `headerRowCount` when there is a header row: compare the first row instead.
      const hasHeader = columns.every(
        (c, i) => fold(cellString(ws, range.top, range.left + i)) === fold(c),
      )
      const bottom = range.bottom - (model.totalsRow ? 1 : 0)
      return readRows(ws, columns, range.left, range.top + (hasHeader ? 1 : 0), bottom)
    }
  }
  return null
}

/** Fallback: a row of contiguous headers that contains the identifying columns of the table. */
function findHeaderBlock(workbook: Workbook, name: TableName): RawTable | null {
  const required = TABLES[name].map(fold)
  for (const ws of workbook.worksheets) {
    for (let r = 1; r <= Math.min(ws.rowCount, 30); r++) {
      const width = ws.getRow(r).cellCount
      let c = 1
      while (c <= width) {
        if (!cellString(ws, r, c)) {
          c++
          continue
        }
        const left = c
        const columns: string[] = []
        while (c <= width && cellString(ws, r, c)) columns.push(cellString(ws, r, c++))
        const folded = columns.map(fold)
        if (required.every((h) => folded.includes(h))) {
          return readRows(ws, columns, left, r + 1, null)
        }
      }
    }
  }
  return null
}

/** Loads the workbook and returns the two tables. Throws `LegacyWorkbookError`. */
export async function readLegacyWorkbook(data: Uint8Array): Promise<LegacyTables> {
  // Loaded on demand: exceljs is only needed for the import, not at start-up.
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(data as unknown as ArrayBuffer)
  } catch {
    throw new LegacyWorkbookError('unreadable')
  }
  const patients = findTable(workbook, 'Tb_patient') ?? findHeaderBlock(workbook, 'Tb_patient')
  const seances = findTable(workbook, 'Tb_seance') ?? findHeaderBlock(workbook, 'Tb_seance')
  if (!patients || !seances) {
    const missing = [!patients && 'Tb_patient', !seances && 'Tb_seance'].filter((n): n is string =>
      Boolean(n),
    )
    throw new LegacyWorkbookError('tables_missing', missing)
  }
  return { patients, seances }
}
