import { describe, expect, it } from 'vitest'
import {
  MAX_DOCUMENT_BYTES,
  checkDocumentFile,
  formatBytesFr,
  guessCategory,
  isExecutableFile,
  mimeOf,
  previewKindOf,
  safeFileName,
  titleFromFileName,
} from './documents'

describe('documents du patient', () => {
  it('R-26 propose une catégorie à partir du nom du fichier', () => {
    expect(guessCategory('IRM_lombaire_2025.pdf')).toBe('imagerie')
    expect(guessCategory('Radio genou.jpg')).toBe('imagerie')
    expect(guessCategory('Échographie.pdf')).toBe('imagerie')
    expect(guessCategory('scan.dcm')).toBe('imagerie')
    expect(guessCategory('Ordonnance kiné.pdf')).toBe('ordonnance')
    expect(guessCategory('Compte-rendu opératoire.pdf')).toBe('compte_rendu')
    expect(guessCategory('Attestation mutuelle.pdf')).toBe('administratif')
    expect(guessCategory('Courrier Dr Martin.docx')).toBe('courrier')
    expect(guessCategory('Re- suivi patiente.eml')).toBe('courrier')
    expect(guessCategory('IMG_2041.jpeg')).toBe('photo')
    expect(guessCategory('notes.xlsx')).toBe('autre')
  })

  it('R-26 refuse un fichier vide ou de plus de 25 Mo', () => {
    expect(checkDocumentFile('a.pdf', 0)).toBe('empty')
    expect(checkDocumentFile('a.pdf', 1)).toBeNull()
    expect(checkDocumentFile('a.pdf', MAX_DOCUMENT_BYTES)).toBeNull()
    expect(checkDocumentFile('a.pdf', MAX_DOCUMENT_BYTES + 1)).toBe('too_large')
  })

  it('R-26 refuse les programmes, scripts et raccourcis, même déguisés', () => {
    for (const name of [
      'setup.exe',
      'Facture.PDF.exe',
      'run.bat',
      'x.ps1',
      'lien.lnk',
      'a.hta',
      'b.js',
      'c.iso',
      'd.exe. ',
      'e.scr',
    ]) {
      expect(isExecutableFile(name), name).toBe(true)
      expect(checkDocumentFile(name, 10)).toBe('executable')
    }
    for (const name of ['Radio.pdf', 'courrier.docx', 'mail.eml', 'exe', 'notes.json']) {
      expect(isExecutableFile(name), name).toBe(false)
    }
  })

  it('R-26 affiche dans l’application les images, PDF, e-mails et textes seulement', () => {
    expect(previewKindOf('a.PNG')).toBe('image')
    expect(previewKindOf('a.pdf')).toBe('pdf')
    expect(previewKindOf('a.eml')).toBe('email')
    expect(previewKindOf('a.txt')).toBe('text')
    expect(previewKindOf('a.docx')).toBe('none')
    expect(previewKindOf('sans-extension')).toBe('none')
  })

  it('R-26 déduit le type du fichier de son extension', () => {
    expect(mimeOf('x.JPG')).toBe('image/jpeg')
    expect(mimeOf('x.docx')).toContain('wordprocessingml')
    expect(mimeOf('x.inconnu')).toBe('application/octet-stream')
  })

  it('R-26 propose un titre et un nom de copie sûr', () => {
    expect(titleFromFileName('IRM_lombaire__2025.pdf')).toBe('IRM lombaire 2025')
    expect(titleFromFileName('.pdf')).toBe('.pdf')
    expect(safeFileName('IRM : L4/L5?', 'scan.PDF')).toBe('IRM L4 L5.pdf')
    expect(safeFileName('   ', 'x')).toBe('Document')
  })

  it('formate les tailles en français', () => {
    expect(formatBytesFr(300)).toBe('1 Ko')
    expect(formatBytesFr(18 * 1024)).toBe('18 Ko')
    expect(formatBytesFr(2.4 * 1024 * 1024)).toBe('2,4 Mo')
    expect(formatBytesFr(14 * 1024 * 1024)).toBe('14 Mo')
  })
})
