import { asc, isNotNull, sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import { patientSearchKey } from '@shared/domain/text'
import type { AppDatabase } from './client'
import { patients, seances } from './schema'

/**
 * `npm run seed`: copies a few fake records as near-duplicates (same birth date and portable,
 * hyphenated name, other address), so that « À rapprocher » shows R-19 pairs in development.
 */
export function seedDuplicates(db: AppDatabase, count = 2): number {
  const sources = db
    .select()
    .from(patients)
    .where(isNotNull(patients.portable))
    .orderBy(asc(patients.shortNo))
    .limit(count)
    .all()
  let shortNo =
    (db
      .select({ max: sql<number | null>`max(${patients.shortNo})` })
      .from(patients)
      .get()?.max ?? 0) + 1
  db.$client.transaction(() => {
    for (const p of sources) {
      const id = ulid()
      const nom = `${p.nom}-Durand`
      db.insert(patients)
        .values({
          id,
          shortNo: shortNo++,
          nom,
          prenom: p.prenom,
          ddn: p.ddn,
          sexe: p.sexe,
          portable: p.portable,
          email: null,
          adresse: '5 rue de Picpus',
          cp: '75012',
          commune: 'Paris',
          commentaire: 'Fiche créée en double (données fictives).',
          searchKey: patientSearchKey(nom, p.prenom),
        })
        .run()
      db.insert(seances)
        .values({
          id: ulid(),
          patientId: id,
          date: '2019-03-12',
          status: 'done',
          source: 'import',
          motif: 'Lombalgie',
          tarifCents: 6000,
          paiement: 'cheque',
        })
        .run()
    }
  })()
  return sources.length
}
