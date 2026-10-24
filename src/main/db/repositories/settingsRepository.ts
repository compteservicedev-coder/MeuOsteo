import { eq } from 'drizzle-orm'
import type { z } from 'zod'
import type { DbOrTx } from '../client'
import { settings } from '../schema'

/** Reads a JSON setting; returns `fallback` when it is missing or no longer matches `schema`. */
export function getSetting<T>(db: DbOrTx, key: string, schema: z.ZodType<T>, fallback: T): T {
  const row = db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get()
  if (!row) return fallback
  const parsed = schema.safeParse(JSON.parse(row.value))
  return parsed.success ? parsed.data : fallback
}

export function setSetting(db: DbOrTx, key: string, value: unknown): void {
  const json = JSON.stringify(value)
  db.insert(settings)
    .values({ key, value: json })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: json, updatedAt: new Date().toISOString() },
    })
    .run()
}
