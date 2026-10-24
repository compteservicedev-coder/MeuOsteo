/**
 * Fake « MeuOsteo v1.04 » workbook (docs/MIGRATION.md): same sheets (PARAM, TEMP_BDD, DATA) and
 * the same two tables (`Tb_seance` at B2, `Tb_patient` at L2), filled with French fake data and
 * the trap rows the import must handle. Never real data: the real file stays on the user's PC.
 */
import { fakerFR as faker } from '@faker-js/faker'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

export interface FakeWorkbookOptions {
  /** Rows of `Tb_patient`, traps included. */
  patients?: number
  /** Rows of `Tb_seance`, traps (and the orphan session) included. */
  seances?: number
  seed?: number
}

type Cell = ExcelJS.CellValue

const SEANCE_COLUMNS = [
  'date',
  'motif',
  'anam',
  'pratique',
  'prix',
  'paiement',
  'praticien',
  'id_patient',
]
const PATIENT_COLUMNS = [
  'id_patient',
  'nom',
  'prenom',
  'ddn',
  'sexe',
  'situation',
  'enfant',
  'profession',
  'adresse',
  'cdp',
  'commune',
  'portable',
  'fixe',
  'mail',
  'commentaire',
]

const PRIX = [0, 50, 55, 60, 65, 110]
const PAIEMENTS = ['Espèces', 'Chèque', 'Attente de Virement', 'Virement reçu']
const SITUATIONS = ['Célibataire', 'En couple', 'Pacsé(e)', 'Marié(e)', 'Divorcé(e)', 'Veuf(ve)']
const MOTIFS = ['Lombalgie', 'Cervicalgie', 'Dorsalgie', 'Bilan postural', 'Sciatique', 'Céphalées']
const ANAMNESES = [
  'Douleur apparue après un effort, sans irradiation.',
  'Gêne matinale, améliorée par le mouvement.',
  'Suite de la séance précédente, amélioration nette.',
]
const PRATIQUES = [
  'Techniques fonctionnelles, travail diaphragmatique.',
  'Mobilisations douces du rachis, conseils posturaux.',
  'Libération myofasciale, exercices à domicile.',
]
const COMMUNES: [string, string][] = [
  ['Paris', '75012'],
  ['Vincennes', '94300'],
  ['Montreuil', '93100'],
  ['Saint-Mandé', '94160'],
  ['Bourg-en-Bresse', '01000'],
]

interface FakePatient {
  nom: string
  prenom: string
  ddn: string
  row: Cell[]
}

const key = (nom: string, prenom: string, ddn: string) => `${nom}${prenom}${ddn}`

/** One-line patient row in the column order of `Tb_patient`. */
function patientRow(p: {
  nom: string
  prenom: string
  ddn: string
  ddnCell?: Cell
  sexe?: Cell
  situation?: Cell
  enfant?: Cell
  profession?: Cell
  adresse?: Cell
  cdp?: Cell
  commune?: Cell
  portable?: Cell
  fixe?: Cell
  mail?: Cell
  commentaire?: Cell
}): FakePatient {
  return {
    nom: p.nom,
    prenom: p.prenom,
    ddn: p.ddn,
    row: [
      key(p.nom, p.prenom, p.ddn),
      p.nom,
      p.prenom,
      p.ddnCell ?? p.ddn,
      p.sexe ?? null,
      p.situation ?? null,
      p.enfant ?? null,
      p.profession ?? null,
      p.adresse ?? null,
      p.cdp ?? null,
      p.commune ?? null,
      p.portable ?? null,
      p.fixe ?? null,
      p.mail ?? null,
      p.commentaire ?? null,
    ],
  }
}

/**
 * Trap records (docs/MIGRATION.md « Tests »): apostrophes, empty sex, accented situation,
 * 4-digit postcode, phone stored as a number, e-mail link in capitals, birth date stored as a
 * real Excel date, and two R-19 pairs.
 */
export const TRAP_PATIENTS: FakePatient[] = [
  patientRow({
    nom: 'D’Almeida',
    prenom: 'Anne-Lise',
    ddn: '03/04/1985',
    sexe: null,
    situation: 'Pacsé(e)',
    enfant: '2',
    profession: 'Infirmière',
    adresse: '4 rue de l’Église',
    cdp: 1000,
    commune: 'Bourg-en-Bresse',
    portable: 612345678,
    mail: {
      text: 'Anne-Lise.DAlmeida@Exemple.FR',
      hyperlink: 'mailto:Anne-Lise.DAlmeida@Exemple.FR',
    },
    commentaire: 'Préfère l’après-midi, aujourd’hui d’accord pour le suivi',
  }),
  patientRow({
    nom: 'Lambert',
    prenom: 'Sophie',
    ddn: '22/07/1997',
    sexe: 'Femme',
    situation: 'Célibataire',
    enfant: '0',
    profession: 'Étudiante',
    adresse: '22 av. Gambetta',
    cdp: '94160',
    commune: 'Saint-Mandé',
    portable: '07 55 44 33 22',
  }),
  patientRow({
    nom: 'Lambert-Durand',
    prenom: 'Sophie',
    ddn: '22/07/1997',
    sexe: 'Femme',
    situation: 'Marié(e)',
    profession: 'Infirmière',
    adresse: '5 rue de Picpus',
    cdp: '75012',
    commune: 'Paris',
    portable: '0755443322',
    mail: 'sophie.ld@exemple.fr',
  }),
  patientRow({
    nom: 'Lefèvre',
    prenom: 'Éloïse',
    ddn: '02/11/1990',
    ddnCell: new Date(Date.UTC(1990, 10, 2)),
    sexe: 'Femme',
    situation: 'Veuf(ve)',
    enfant: '3',
    cdp: '94300',
    commune: 'Vincennes',
    mail: 'ELOISE.LEFEVRE@EXEMPLE.FR',
  }),
  patientRow({
    nom: 'Dupont',
    prenom: 'Marc',
    ddn: '14/02/1972',
    sexe: 'Homme',
    mail: 'marc.d@exemple.org',
  }),
  patientRow({
    nom: 'Dupond',
    prenom: 'Marc',
    ddn: '14/02/1972',
    sexe: 'Homme',
    situation: 'En couple',
    mail: 'Marc.D@exemple.org',
  }),
  patientRow({ nom: 'N’Diaye', prenom: 'Fatou', ddn: '30/06/2015', sexe: 'Femme' }),
]

/** Sessions of the traps: invalid years, missing dates and prices, same day, unknown patient. */
function trapSeances(): Cell[][] {
  const [anne, sophie, , eloise, marc, , fatou] = TRAP_PATIENTS.map((p) =>
    key(p.nom, p.prenom, p.ddn),
  )
  const s = (date: Cell, patient: string, prix: Cell = 60, paiement: Cell = 'Chèque'): Cell[] => [
    date,
    'Lombalgie',
    'Gêne lombaire depuis une semaine.',
    'Mobilisations douces.',
    prix,
    paiement,
    null,
    patient,
  ]
  return [
    s('12/05/1024', anne!),
    s('15/03/4444', sophie!),
    s('', marc!),
    s(null, fatou!, 50),
    s('08/01/2024', anne!, null),
    s('10/02/2024', sophie!, null, 'Attente de Virement'),
    s('11/02/2024', marc!, null, 'Virement reçu'),
    s('20/06/2024', eloise!, '55', 'Espèces'),
    s('20/06/2024', eloise!, 55, 'Espèces'),
    s('01/02/2024', 'FantômeJean01/01/1950'),
  ]
}

/** Expected report for the traps (orphans are not counted as importable sessions). */
export const TRAP_EXPECTATIONS = {
  patients: TRAP_PATIENTS.length,
  seanceRows: 10,
  orphans: 1,
  invalidDates: 2,
  missingDates: 2,
  missingPrices: 3,
  sameDay: 1,
  duplicates: 2,
} as const

function formatFr(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${date.getUTCFullYear()}`
}

function randomPatient(): FakePatient {
  const sexe = faker.helpers.arrayElement(['Homme', 'Femme'] as const)
  const prenom = faker.person.firstName(sexe === 'Homme' ? 'male' : 'female')
  const nom = faker.person.lastName()
  const ddn = formatFr(
    faker.date.birthdate({ mode: 'age', min: 1, max: 90, refDate: '2026-01-01' }),
  )
  const [commune, cp] = faker.helpers.arrayElement(COMMUNES)
  return patientRow({
    nom,
    prenom,
    ddn,
    sexe,
    situation: faker.helpers.arrayElement(SITUATIONS),
    enfant: String(faker.number.int({ min: 0, max: 4 })),
    profession: faker.person.jobTitle(),
    adresse: faker.location.streetAddress(),
    cdp: cp,
    commune,
    portable: `0${faker.helpers.arrayElement(['6', '7'])}${faker.string.numeric(8)}`,
    mail: `${faker.string.alpha({ length: 8, casing: 'lower' })}@exemple.fr`,
  })
}

/** Builds the workbook and returns the bytes of a macro-enabled `.xlsm` file. */
export async function buildFakeLegacyWorkbook({
  patients = 60,
  seances = 150,
  seed = 20_261_024,
}: FakeWorkbookOptions = {}): Promise<Buffer> {
  faker.seed(seed)
  const trapSeanceRows = trapSeances()
  if (patients < TRAP_PATIENTS.length || seances < trapSeanceRows.length) {
    throw new RangeError('Not enough rows for the trap records')
  }

  const people = [
    ...TRAP_PATIENTS,
    ...Array.from({ length: patients - TRAP_PATIENTS.length }, randomPatient),
  ]
  const random = people.slice(TRAP_PATIENTS.length)
  const taken = new Set<string>()
  const seanceRows: Cell[][] = [...trapSeanceRows]
  while (seanceRows.length < seances) {
    const p = faker.helpers.arrayElement(random)
    const date = formatFr(faker.date.between({ from: '2016-01-01', to: '2026-09-30' }))
    if (taken.has(`${p.row[0]}|${date}`)) continue
    taken.add(`${p.row[0]}|${date}`)
    seanceRows.push([
      date,
      faker.helpers.arrayElement(MOTIFS),
      faker.helpers.arrayElement(ANAMNESES),
      faker.helpers.arrayElement(PRATIQUES),
      faker.helpers.arrayElement(PRIX.slice(1, 5)),
      faker.helpers.arrayElement(PAIEMENTS),
      null,
      p.row[0]!,
    ])
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'MeuOsteo (données fictives)'

  const param = workbook.addWorksheet('PARAM')
  param.addRow(['Prix', 'Paiement', 'Situation', 'Sexe'])
  for (let i = 0; i < SITUATIONS.length; i++) {
    param.addRow([
      PRIX[i] ?? null,
      PAIEMENTS[i] ?? null,
      SITUATIONS[i],
      ['Homme', 'Femme'][i] ?? null,
    ])
  }

  const temp = workbook.addWorksheet('TEMP_BDD')
  temp.addTable({
    name: 'Tb_seance',
    ref: 'B2',
    headerRow: true,
    columns: SEANCE_COLUMNS.map((name) => ({ name })),
    rows: seanceRows,
  })
  temp.addTable({
    name: 'Tb_patient',
    ref: 'L2',
    headerRow: true,
    columns: PATIENT_COLUMNS.map((name) => ({ name })),
    rows: people.map((p) => p.row),
  })

  const data = workbook.addWorksheet('DATA')
  data.addRow(['commune', 'code_postal'])
  for (const [commune, cp] of COMMUNES) data.addRow([commune, cp])

  // exceljs writes an .xlsx: declare the workbook macro-enabled so that Excel opens it as .xlsm.
  const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer())
  const types = await zip.file('[Content_Types].xml')!.async('string')
  zip.file(
    '[Content_Types].xml',
    types.replace(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
      'application/vnd.ms-excel.sheet.macroEnabled.main+xml',
    ),
  )
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
