import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_PATIENT_DRAFT } from '@shared/domain/patientValidation'
import { MAX_DOCUMENT_BYTES } from '@shared/domain/documents'
import type { AppDatabase } from '../db/client'
import { getMergeComparison, mergeDuplicatePair } from '../db/repositories/duplicateRepository'
import { documentContents, documents } from '../db/schema'
import { createTestDatabase } from '../test/db'
import { DocumentService } from './documents'
import { PatientService } from './patients'

let db: AppDatabase
let service: DocumentService
let patientsService: PatientService
const clock = () => new Date('2026-10-24T10:00:00Z')

function patient(nom = 'Roux', prenom = 'Camille', ddn = '1992-03-12'): string {
  const r = patientsService.create({ ...EMPTY_PATIENT_DRAFT, nom, prenom, ddn })
  if (!r.ok) throw new Error('patient')
  return r.id
}

const bytes = (text: string) => new TextEncoder().encode(text)

const EML = [
  'From: Dr Lune <lune@example.test>',
  'To: Cabinet <cabinet@example.test>',
  'Subject: Suivi de la patiente',
  'Date: Mon, 20 Oct 2026 09:30:00 +0200',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Bonjour, voici mon retour.',
].join('\r\n')

beforeEach(() => {
  db = createTestDatabase()
  service = new DocumentService(db, clock)
  patientsService = new PatientService(db, clock)
})

describe('documents du patient', () => {
  it('R-26 ajoute plusieurs fichiers en une fois, avec titre, catégorie et date proposés', () => {
    const id = patient()
    const r = service.add(id, [
      { name: 'IRM_lombaire.pdf', bytes: bytes('%PDF-1.4') },
      { name: 'Courrier Dr Lune.docx', bytes: bytes('docx') },
    ])
    expect(r?.refused).toEqual([])
    expect(r?.added.map((d) => [d.titre, d.categorie, d.docDate, d.preview])).toEqual([
      ['IRM lombaire', 'imagerie', '2026-10-24', 'pdf'],
      ['Courrier Dr Lune', 'courrier', '2026-10-24', 'none'],
    ])
    expect(service.count(id)).toBe(2)
    expect(patientsService.get(id)?.documentCount).toBe(2)
  })

  it('R-26 refuse les fichiers vides ou trop lourds sans bloquer les autres', () => {
    const id = patient()
    const r = service.add(id, [
      { name: 'vide.pdf', bytes: new Uint8Array() },
      { name: 'énorme.pdf', bytes: new Uint8Array(MAX_DOCUMENT_BYTES + 1) },
      { name: 'ok.txt', bytes: bytes('ok') },
    ])
    expect(r?.refused).toEqual([
      { name: 'vide.pdf', reason: 'empty' },
      { name: 'énorme.pdf', reason: 'too_large' },
    ])
    expect(r?.added).toHaveLength(1)
  })

  it('R-26 refuse l’ajout sur une fiche supprimée', () => {
    const id = patient()
    patientsService.softDelete(id)
    expect(service.add(id, [{ name: 'a.txt', bytes: bytes('a') }])).toBeNull()
  })

  it('R-26 conserve le contenu à l’identique et le supprime avec le document', () => {
    const id = patient()
    const [doc] = service.add(id, [{ name: 'note.txt', bytes: bytes('Douleur L4') }])!.added
    expect(new TextDecoder().decode(service.content(doc!.id)!.bytes)).toBe('Douleur L4')
    expect(service.delete(doc!.id)).toBe(true)
    expect(db.select().from(documentContents).all()).toHaveLength(0)
  })

  it('R-26 modifie le titre, la catégorie et la date', () => {
    const id = patient()
    const [doc] = service.add(id, [{ name: 'scan.pdf', bytes: bytes('x') }])!.added
    const updated = service.update(doc!.id, {
      titre: '  Radio cervicale  ',
      categorie: 'imagerie',
      docDate: '2025-02-01',
    })
    expect(updated).toMatchObject({ titre: 'Radio cervicale', docDate: '2025-02-01' })
    expect(service.update('inconnu', updated!)).toBeNull()
  })

  it('R-26 lit un e-mail .eml : expéditeur, objet, date et texte', async () => {
    const id = patient()
    const [doc] = service.add(id, [{ name: 'Re suivi.eml', bytes: bytes(EML) }])!.added
    const mail = await service.email(doc!.id)
    expect(mail).toMatchObject({
      from: expect.stringContaining('lune@example.test'),
      subject: 'Suivi de la patiente',
      date: '2026-10-20T07:30:00.000Z',
      text: 'Bonjour, voici mon retour.',
      attachments: [],
    })
  })

  it('R-26 la purge d’une fiche supprime ses documents', () => {
    const id = patient()
    service.add(id, [{ name: 'a.txt', bytes: bytes('a') }])
    patientsService.softDelete(id)
    const later = new PatientService(db, () => new Date('2026-12-30T10:00:00Z'))
    expect(later.purgeDue()).toBe(1)
    expect(db.select().from(documents).all()).toHaveLength(0)
    expect(db.select().from(documentContents).all()).toHaveLength(0)
  })

  it('R-19 la fusion reporte les documents sur la fiche conservée', () => {
    const keep = patient('Roux', 'Camille')
    const remove = patient('Roux', 'Camile')
    service.add(remove, [{ name: 'a.txt', bytes: bytes('a') }])
    const r = mergeDuplicatePair(db, {
      keepId: keep,
      removeId: remove,
      picks: getMergeComparison(db, keep, remove)!.picks,
    })
    expect(r.ok).toBe(true)
    expect(service.count(keep)).toBe(1)
  })
})
