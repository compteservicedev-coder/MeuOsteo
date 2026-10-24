import { eq, sql } from 'drizzle-orm'
import type { AppDatabase } from './client'
import { communes } from './schema'

export interface CommuneRow {
  commune: string
  codePostal: string
}

/** Parses resources/communes.csv (`commune;code_postal`, CRLF, header on the first line). */
export function parseCommunesCsv(content: string): CommuneRow[] {
  const rows: CommuneRow[] = []
  const lines = content.split(/\r?\n/)
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const [commune, codePostal] = line.split(';')
    if (!commune || !codePostal) continue
    rows.push({ commune: commune.trim(), codePostal: codePostal.trim().padStart(5, '0') })
  }
  return rows
}

/** Loads the list on first launch (empty table). Returns the number of rows inserted. */
export function ensureCommunesLoaded(db: AppDatabase, readCsv: () => string): number {
  const [{ count } = { count: 0 }] = db
    .select({ count: sql<number>`count(*)` })
    .from(communes)
    .all()
  if (count > 0) return 0
  const rows = parseCommunesCsv(readCsv())
  const insert = db.$client.prepare('INSERT INTO communes (commune, code_postal) VALUES (?, ?)')
  db.$client.transaction(() => {
    for (const row of rows) insert.run(row.commune, row.codePostal)
  })()
  return rows.length
}

/** Communes of a postal code (R-16). */
export function communesForCp(db: AppDatabase, cp: string): string[] {
  if (!/^\d{5}$/.test(cp)) return []
  return db
    .select({ commune: communes.commune })
    .from(communes)
    .where(eq(communes.codePostal, cp))
    .all()
    .map((r) => r.commune)
}
