import type { DocumentCategory, DocumentFileError, PreviewKind } from '../domain/documents'

export interface DocumentView {
  id: string
  titre: string
  categorie: DocumentCategory
  fileName: string
  sizeBytes: number
  /** YYYY-MM-DD. */
  docDate: string
  createdAt: string
  preview: PreviewKind
}

/** A file dropped on the window, read by the renderer. */
export interface DocumentUpload {
  name: string
  bytes: Uint8Array
}

export interface DocumentChanges {
  titre: string
  categorie: DocumentCategory
  docDate: string
}

export interface AddDocumentsResult {
  added: DocumentView[]
  refused: Array<{ name: string; reason: DocumentFileError | 'unreadable' }>
}

export type DocumentContent = { mime: string; bytes: Uint8Array } | null

export interface EmailPreview {
  from: string
  to: string
  cc: string
  subject: string
  /** ISO date-time, or null when the message has none. */
  date: string | null
  text: string
  attachments: Array<{ name: string; sizeBytes: number }>
}

export type DocumentActionResult = { ok: true } | { ok: false; reason: 'not_found' | 'error' }
