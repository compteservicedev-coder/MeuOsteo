/**
 * R-26 · Documents du patient. The files are stored in the encrypted database (`document_contents`),
 * so they are encrypted on disk and travel with every backup and restore. Titles may be medical:
 * only counts and sizes are logged, never a title or a file name.
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { simpleParser, type AddressObject } from 'mailparser'
import {
  checkDocumentFile,
  guessCategory,
  mimeOf,
  previewKindOf,
  titleFromFileName,
} from '@shared/domain/documents'
import { isoDateInParis } from '@shared/domain/dates'
import type {
  AddDocumentsResult,
  DocumentChanges,
  DocumentContent,
  DocumentUpload,
  DocumentView,
  EmailPreview,
} from '@shared/types/documents'
import type { AppDatabase } from '../db/client'
import { documentContents, documents, patients } from '../db/schema'
import { log } from '../logger'

type DocumentRow = typeof documents.$inferSelect

const toView = (r: DocumentRow): DocumentView => ({
  id: r.id,
  titre: r.titre,
  categorie: r.categorie,
  fileName: r.fileName,
  sizeBytes: r.sizeBytes,
  docDate: r.docDate,
  createdAt: r.createdAt,
  preview: previewKindOf(r.fileName),
})

const addresses = (a: AddressObject | AddressObject[] | undefined) =>
  (Array.isArray(a) ? a : a ? [a] : []).map((x) => x.text).join(', ')

export class DocumentService {
  constructor(
    private readonly db: AppDatabase,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private activePatient(id: string): boolean {
    return Boolean(
      this.db
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.id, id), isNull(patients.deletedAt)))
        .get(),
    )
  }

  private row(id: string): DocumentRow | undefined {
    return this.db.select().from(documents).where(eq(documents.id, id)).get()
  }

  /** Newest document first (its own date, then the import). */
  list(patientId: string): DocumentView[] {
    return this.db
      .select()
      .from(documents)
      .where(eq(documents.patientId, patientId))
      .orderBy(desc(documents.docDate), desc(documents.createdAt))
      .all()
      .map(toView)
  }

  count(patientId: string): number {
    return (
      this.db
        .select({ n: sql<number>`count(*)` })
        .from(documents)
        .where(eq(documents.patientId, patientId))
        .get()?.n ?? 0
    )
  }

  /** R-26 every accepted file in one transaction; refused ones are listed, not fatal. */
  add(patientId: string, uploads: DocumentUpload[]): AddDocumentsResult | null {
    if (!this.activePatient(patientId)) return null
    const today = isoDateInParis(this.clock())
    const refused: AddDocumentsResult['refused'] = []
    const accepted = uploads.filter((u) => {
      const error = checkDocumentFile(u.name, u.bytes.byteLength)
      if (error) refused.push({ name: u.name, reason: error })
      return !error
    })
    const ids: string[] = []
    this.db.transaction((tx) => {
      for (const u of accepted) {
        const row = tx
          .insert(documents)
          .values({
            patientId,
            titre: titleFromFileName(u.name),
            categorie: guessCategory(u.name),
            fileName: u.name,
            mime: mimeOf(u.name),
            sizeBytes: u.bytes.byteLength,
            docDate: today,
          })
          .returning({ id: documents.id })
          .get()
        tx.insert(documentContents)
          .values({ documentId: row.id, bytes: Buffer.from(u.bytes) })
          .run()
        ids.push(row.id)
      }
    })
    if (ids.length || refused.length) {
      log.info(`Documents: ${ids.length} added, ${refused.length} refused`)
    }
    const added = ids.map((id) => toView(this.row(id)!))
    return { added, refused }
  }

  update(id: string, changes: DocumentChanges): DocumentView | null {
    const row = this.row(id)
    if (!row) return null
    this.db
      .update(documents)
      .set({ titre: changes.titre.trim(), categorie: changes.categorie, docDate: changes.docDate })
      .where(eq(documents.id, id))
      .run()
    return toView(this.row(id)!)
  }

  delete(id: string): boolean {
    // The content follows by cascade.
    return this.db.delete(documents).where(eq(documents.id, id)).run().changes > 0
  }

  file(id: string): { fileName: string; titre: string; mime: string; bytes: Buffer } | null {
    const r = this.db
      .select({
        fileName: documents.fileName,
        titre: documents.titre,
        mime: documents.mime,
        bytes: documentContents.bytes,
      })
      .from(documents)
      .innerJoin(documentContents, eq(documentContents.documentId, documents.id))
      .where(eq(documents.id, id))
      .get()
    return r ?? null
  }

  /** Bytes for the preview of an image, a PDF or a text file. */
  content(id: string): DocumentContent {
    const f = this.file(id)
    if (!f || previewKindOf(f.fileName) === 'none') return null
    return { mime: f.mime, bytes: new Uint8Array(f.bytes) }
  }

  /** An `.eml` shown as a message: headers, plain text and the names of its attachments. */
  async email(id: string): Promise<EmailPreview | null> {
    const f = this.file(id)
    if (!f || previewKindOf(f.fileName) !== 'email') return null
    try {
      const m = await simpleParser(f.bytes, { skipImageLinks: true })
      return {
        from: addresses(m.from),
        to: addresses(m.to),
        cc: addresses(m.cc),
        subject: m.subject ?? '',
        date: m.date ? m.date.toISOString() : null,
        text: (m.text ?? '').trim(),
        attachments: m.attachments.map((a) => ({
          name: a.filename ?? 'Pièce jointe',
          sizeBytes: a.size,
        })),
      }
    } catch (error) {
      log.warn('E-mail document cannot be read', error instanceof Error ? error.name : '')
      return null
    }
  }
}
