/**
 * « Exporter toutes les données (Excel) » (SPEC §8.7, RGPD): every record, session, invoice,
 * credit note and journal line in one workbook, written where the practitioner chooses. Nothing
 * is logged but counts.
 */
import ExcelJS from 'exceljs'
import { asc } from 'drizzle-orm'
import type { AppDatabase } from '../db/client'
import { avoirs, documents, factures, journal, patients, seances } from '../db/schema'

const eur = (cents: number) => cents / 100

export async function buildFullExport(db: AppDatabase): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'MeuOsteo'
  const sheet = (name: string, columns: Array<[string, string, number?]>) => {
    const ws = wb.addWorksheet(name)
    ws.columns = columns.map(([header, key, width]) => ({ header, key, width: width ?? 16 }))
    ws.getRow(1).font = { bold: true }
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    return ws
  }

  const p = sheet('Patients', [
    ['N°', 'shortNo', 8],
    ['Nom', 'nom', 18],
    ['Prénom', 'prenom', 16],
    ['Date de naissance', 'ddn', 14],
    ['Sexe', 'sexe', 6],
    ['Situation', 'situation'],
    ['Enfants', 'enfants', 8],
    ['Profession', 'profession', 22],
    ['Adresse', 'adresse', 30],
    ['Code postal', 'cp', 10],
    ['Commune', 'commune', 20],
    ['Portable', 'portable', 14],
    ['Fixe', 'fixe', 14],
    ['E-mail', 'email', 28],
    ['Commentaire', 'commentaire', 50],
    ['Antécédents', 'antecedents', 30],
    ['Supprimée le', 'deletedAt'],
  ])
  for (const r of db.select().from(patients).orderBy(asc(patients.shortNo)).all()) {
    p.addRow({ ...r, antecedents: (r.antecedentsTags ?? []).join(', ') })
  }

  const byPatient = new Map(
    db
      .select({ id: patients.id, n: patients.shortNo })
      .from(patients)
      .all()
      .map((r) => [r.id, r.n]),
  )
  const s = sheet('Séances', [
    ['Patient n°', 'patient', 10],
    ['Date', 'date', 12],
    ['Heure', 'heure', 8],
    ['Statut', 'status', 10],
    ['Source', 'source', 10],
    ['Motif', 'motif', 26],
    ['Anamnèse', 'anamnese', 50],
    ['Pratique', 'pratique', 50],
    ['Tarif (€)', 'tarif', 10],
    ['Paiement', 'paiement', 16],
    ['Motif d’annulation', 'cancelReason', 22],
  ])
  for (const r of db.select().from(seances).orderBy(asc(seances.date)).all()) {
    s.addRow({ ...r, patient: byPatient.get(r.patientId) ?? '', tarif: eur(r.tarifCents) })
  }

  const f = sheet('Factures', [
    ['Numéro', 'numero', 12],
    ['Émise le', 'dateEmission', 12],
    ['Statut', 'statut', 10],
    ['Patient', 'snapPatientNom', 24],
    ['Adresse', 'snapPatientAdresse', 36],
    ['Date de séance', 'snapDateSeance', 12],
    ['Montant (€)', 'montant', 12],
    ['Règlement', 'reglement', 12],
    ['Mode', 'modePaiement', 12],
    ['Modifiée le', 'modifiedAt', 20],
    ['Supprimée le', 'deletedAt', 20],
  ])
  for (const r of db
    .select()
    .from(factures)
    .orderBy(asc(factures.annee), asc(factures.sequence))
    .all()) {
    f.addRow({ ...r, montant: eur(r.montantCents) })
  }

  const a = sheet('Avoirs', [
    ['Numéro', 'numero', 14],
    ['Date', 'date', 12],
    ['Montant (€)', 'montant', 12],
    ['Facture', 'facture', 12],
  ])
  const numeros = new Map(
    db
      .select({ id: factures.id, n: factures.numero })
      .from(factures)
      .all()
      .map((r) => [r.id, r.n]),
  )
  for (const r of db.select().from(avoirs).orderBy(asc(avoirs.annee), asc(avoirs.sequence)).all()) {
    a.addRow({ ...r, montant: eur(r.montantCents), facture: numeros.get(r.factureId) ?? '' })
  }

  // R-26: the list of documents; the files themselves are saved one by one from the record.
  const d = sheet('Documents', [
    ['Patient n°', 'patient', 10],
    ['Titre', 'titre', 40],
    ['Catégorie', 'categorie', 14],
    ['Date', 'docDate', 12],
    ['Fichier', 'fileName', 36],
    ['Taille (octets)', 'sizeBytes', 14],
    ['Ajouté le', 'createdAt', 22],
  ])
  for (const r of db.select().from(documents).orderBy(asc(documents.docDate)).all()) {
    d.addRow({ ...r, patient: byPatient.get(r.patientId) ?? '' })
  }

  const j = sheet('Journal', [
    ['Date', 'at', 22],
    ['Type', 'type', 12],
    ['Sujet', 'subject', 28],
    ['Action', 'action', 70],
  ])
  for (const r of db.select().from(journal).orderBy(asc(journal.at)).all()) j.addRow(r)

  return Buffer.from(await wb.xlsx.writeBuffer())
}
