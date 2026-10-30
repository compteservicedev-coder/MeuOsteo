/**
 * R-26 · Documents du patient: files attached to a record (imaging, reports, letters, e-mails…),
 * stored inside the encrypted database so that they are encrypted, backed up and restored with it.
 */
import { foldForSearch } from './text'

export const DOCUMENT_CATEGORIES = [
  'imagerie',
  'compte_rendu',
  'courrier',
  'ordonnance',
  'administratif',
  'photo',
  'autre',
] as const
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  imagerie: 'Imagerie',
  compte_rendu: 'Compte-rendu',
  courrier: 'Courrier / e-mail',
  ordonnance: 'Ordonnance',
  administratif: 'Administratif',
  photo: 'Photo',
  autre: 'Autre',
}

/** 25 Mo per file: a scanned report or an X-ray export, without bloating every backup. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024
export const MAX_DOCUMENT_TITLE = 120

export type PreviewKind = 'image' | 'pdf' | 'email' | 'text' | 'none'

const extensionOf = (fileName: string) => {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : ''
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  heic: 'image/heic',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  dcm: 'application/dicom',
  eml: 'message/rfc822',
  msg: 'application/vnd.ms-outlook',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/** Media type from the extension (the renderer's guess is never trusted). */
export function mimeOf(fileName: string): string {
  return MIME_BY_EXTENSION[extensionOf(fileName)] ?? 'application/octet-stream'
}

/** R-26 what the application can show by itself; anything else opens with the PC's software. */
export function previewKindOf(fileName: string): PreviewKind {
  const ext = extensionOf(fileName)
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'eml') return 'email'
  if (ext === 'txt') return 'text'
  return 'none'
}

/** R-26 category proposed on import, from the file name; the practitioner can change it. */
export function guessCategory(fileName: string): DocumentCategory {
  const ext = extensionOf(fileName)
  const name = foldForSearch(fileName)
  if (/\b(radio|irm|scanner|echo|echographie|imagerie|rx|ct|scan)\b/.test(name)) return 'imagerie'
  if (['dcm', 'tif', 'tiff'].includes(ext)) return 'imagerie'
  if (/(ordonnance|prescription)/.test(name)) return 'ordonnance'
  if (/(compte ?rendu|\bcr\b|bilan)/.test(name)) return 'compte_rendu'
  if (/(attestation|consentement|mutuelle|facture|devis)/.test(name)) return 'administratif'
  if (['eml', 'msg', 'doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'courrier'
  if (/(courrier|lettre)/.test(name)) return 'courrier'
  if (['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif', 'bmp'].includes(ext)) return 'photo'
  return 'autre'
}

/** Title proposed on import: the file name without its extension, tidied. */
export function titleFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  const base = dot > 0 ? fileName.slice(0, dot) : fileName
  const title = base.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return (title || 'Document').slice(0, MAX_DOCUMENT_TITLE)
}

/** Safe name for a copy written to disk (« Ouvrir », « Enregistrer sous… »). */
export function safeFileName(title: string, originalName: string): string {
  const ext = extensionOf(originalName)
  const base =
    title
      // eslint-disable-next-line no-control-regex -- Windows forbids control characters.
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/, '')
      .trim()
      .slice(0, 80) || 'Document'
  return ext ? `${base}.${ext}` : base
}

/** « 18 Ko », « 2,4 Mo ». */
export function formatBytesFr(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  const mo = bytes / (1024 * 1024)
  return `${mo.toFixed(mo < 10 ? 1 : 0).replace('.', ',')} Mo`
}

export type DocumentFileError = 'empty' | 'too_large' | 'executable'

/**
 * Programs, scripts, shortcuts and disk images: Windows would run them on « Ouvrir avec le
 * logiciel du PC ». A medical record never needs one, an e-mail attachment may be a trap.
 */
const EXECUTABLE_EXTENSIONS = new Set([
  'exe',
  'com',
  'scr',
  'pif',
  'cpl',
  'msi',
  'msp',
  'mst',
  'bat',
  'cmd',
  'ps1',
  'psm1',
  'psd1',
  'vbs',
  'vbe',
  'js',
  'jse',
  'wsf',
  'wsh',
  'hta',
  'jar',
  'lnk',
  'url',
  'scf',
  'reg',
  'inf',
  'msc',
  'appref-ms',
  'application',
  'gadget',
  'xll',
  'iso',
  'img',
  'vhd',
  'vhdx',
  'dll',
  'sys',
  'chm',
  'library-ms',
  'search-ms',
  'settingcontent-ms',
  'appx',
  'msix',
  'appxbundle',
])

/** R-26 files that the application refuses to store or open. */
export function isExecutableFile(fileName: string): boolean {
  return EXECUTABLE_EXTENSIONS.has(extensionOf(fileName.trim().replace(/[. ]+$/, '')))
}

/** R-26 a file is refused when it is empty, above 25 Mo, or a program. */
export function checkDocumentFile(fileName: string, sizeBytes: number): DocumentFileError | null {
  if (isExecutableFile(fileName)) return 'executable'
  if (sizeBytes <= 0) return 'empty'
  if (sizeBytes > MAX_DOCUMENT_BYTES) return 'too_large'
  return null
}
