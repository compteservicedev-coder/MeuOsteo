/**
 * Fake data for development (`npm run seed`): French names from @faker-js/faker, deterministic.
 * Never mixed with real data: it runs only on the development data folder (MeuOsteo-dev).
 */
import { fakerFR as faker } from '@faker-js/faker'
import { sql } from 'drizzle-orm'
import { ulid } from 'ulid'
import { orderLink, type Relation } from '@shared/domain/relatives'
import { foldForSearch, patientSearchKey } from '@shared/domain/text'
import type { AppDatabase } from './client'
import type { CommuneRow } from './communes'
import { PAIEMENTS, SITUATIONS, patientLinks, patients, seances } from './schema'

export interface SeedOptions {
  patients: number
  seances: number
  /** `YYYY-MM-DD`: sessions are spread around this day. */
  today: string
  communes: CommuneRow[]
  seed?: number
}

export interface SeedReport {
  patients: number
  seances: number
  links: number
}

type PatientRow = typeof patients.$inferInsert
type SeanceRow = typeof seances.$inferInsert

const PROFESSIONS = [
  'Infirmière',
  'Infirmier libéral',
  'Professeure des écoles',
  'Développeur informatique',
  'Graphiste',
  'Comptable',
  'Boulanger',
  'Aide-soignante',
  'Kinésithérapeute',
  'Architecte',
  'Chauffeur de bus',
  'Commerciale',
  'Juriste',
  'Électricien',
  'Pharmacienne',
  'Coiffeuse',
  'Agent immobilier',
  'Maçon',
  'Ingénieure',
  'Secrétaire médicale',
]

const MOTIFS = [
  'Lombalgie',
  'Lombalgie · suivi',
  'Cervicalgie',
  'Cervicalgie · suivi',
  'Dorsalgie',
  'Bilan postural',
  'Entorse de cheville',
  'Céphalées',
  'Suivi grossesse',
  'Douleur d’épaule',
  'Sciatique',
  'Première consultation',
]
const MOTIFS_ENFANT = [
  'Nourrisson · bilan',
  'Coliques du nourrisson',
  'Plagiocéphalie',
  'Bilan enfant',
]

const ANAMNESES = [
  'Douleur apparue après un effort, sans irradiation.',
  'Gêne matinale, améliorée par le mouvement.',
  'Travail sur écran prolongé, tensions en fin de journée.',
  'Suite de la séance précédente, amélioration nette.',
  'Pas d’antécédent particulier signalé.',
  'Sommeil perturbé depuis deux semaines.',
]
const PRATIQUES = [
  'Techniques fonctionnelles, travail diaphragmatique.',
  'Mobilisations douces du rachis, conseils posturaux.',
  'Travail tissulaire et articulaire, étirements conseillés.',
  'Approche crânienne et viscérale.',
  'Libération myofasciale, exercices à domicile.',
]
const COMMENTAIRES = [
  'Préfère les rendez-vous en fin de journée.',
  'Pratique la course à pied trois fois par semaine.',
  'Revoir dans un mois si la gêne persiste.',
  'Vient sur recommandation de son médecin traitant.',
]
const ANTECEDENTS = ['Asthme', 'Chirurgie du genou', 'Migraines', 'Fracture du poignet', 'Scoliose']
const CANCEL_REASONS = ['Annulée par le patient', 'Patient absent', 'Reportée']
/** Reserved example domains: no real mailbox. */
const MAIL_DOMAINS = ['exemple.fr', 'example.com', 'example.org']

const addDays = (isoDate: string, days: number) => {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const ageOn = (ddn: string, today: string) => {
  const [y, m, d] = ddn.split('-').map(Number) as [number, number, number]
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number]
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0)
}

const digits = (n: number) => faker.string.numeric({ length: n, allowLeadingZeros: true })

function fakePatient(shortNo: number, options: SeedOptions, communes: CommuneRow[]): PatientRow {
  const sexe = faker.helpers.weightedArrayElement([
    { value: 'F' as const, weight: 60 },
    { value: 'M' as const, weight: 37 },
    { value: null, weight: 3 },
  ])
  const prenom = faker.person.firstName(sexe === 'M' ? 'male' : 'female')
  const nom = faker.person.lastName()
  const ageBand = faker.helpers.weightedArrayElement([
    { value: [0, 1], weight: 8 },
    { value: [2, 17], weight: 14 },
    { value: [18, 66], weight: 63 },
    { value: [67, 92], weight: 15 },
  ])
  const ddn = faker.date
    .birthdate({
      mode: 'age',
      min: ageBand[0]!,
      max: ageBand[1]!,
      refDate: `${options.today}T12:00:00Z`,
    })
    .toISOString()
    .slice(0, 10)
  const age = ageOn(ddn, options.today)
  const adult = age >= 18
  const commune = faker.helpers.arrayElement(communes)
  const email = faker.helpers.maybe(
    () =>
      faker.internet
        .email({
          firstName: foldForSearch(prenom).replace(/ /g, '-'),
          lastName: foldForSearch(nom).replace(/ /g, '-'),
          provider: faker.helpers.arrayElement(MAIL_DOMAINS),
        })
        .toLowerCase(),
    { probability: 0.8 },
  )

  return {
    id: ulid(),
    shortNo,
    nom,
    prenom,
    ddn,
    sexe,
    situation: adult
      ? faker.helpers.maybe(() => faker.helpers.arrayElement(SITUATIONS), { probability: 0.85 })
      : null,
    enfants: adult
      ? faker.helpers.maybe(() => faker.number.int({ min: 0, max: 4 }), { probability: 0.8 })
      : null,
    profession:
      age >= 67
        ? 'Retraité(e)'
        : adult
          ? faker.helpers.arrayElement(PROFESSIONS)
          : age >= 6
            ? 'Élève'
            : null,
    adresse: faker.location.streetAddress(),
    cp: commune.codePostal,
    commune: commune.commune,
    portable: faker.helpers.maybe(() => `0${faker.helpers.arrayElement(['6', '7'])}${digits(8)}`, {
      probability: 0.92,
    }),
    fixe: faker.helpers.maybe(
      () => `0${faker.helpers.arrayElement(['1', '2', '3', '4', '5', '9'])}${digits(8)}`,
      { probability: 0.25 },
    ),
    email,
    commentaire: faker.helpers.maybe(() => faker.helpers.arrayElement(COMMENTAIRES), {
      probability: 0.3,
    }),
    antecedentsTags:
      faker.helpers.maybe(() => faker.helpers.arrayElements(ANTECEDENTS, { min: 1, max: 2 }), {
        probability: 0.3,
      }) ?? [],
    searchKey: patientSearchKey(nom, prenom),
  }
}

/** A random slot between 08:30 and 19:00, every 30 minutes. */
function fakeHeure(): string {
  const slot = faker.number.int({ min: 17, max: 38 })
  return `${String(Math.floor(slot / 2)).padStart(2, '0')}:${slot % 2 ? '30' : '00'}`
}

export function seedDatabase(db: AppDatabase, options: SeedOptions): SeedReport {
  faker.seed(options.seed ?? 20_261_024)
  // Paris and its eastern suburbs, as in the mock-ups; the whole list if they are missing.
  const nearby = options.communes.filter((c) => /^(75|93|94)/.test(c.codePostal))
  const communes = nearby.length > 0 ? nearby : options.communes
  if (communes.length === 0) throw new Error('The communes table must be loaded before seeding')

  const shortNoStart =
    (db
      .select({ max: sql<number | null>`max(${patients.shortNo})` })
      .from(patients)
      .get()?.max ?? 0) + 1
  const patientRows = Array.from({ length: options.patients }, (_, i) =>
    fakePatient(shortNoStart + i, options, communes),
  )

  const seanceRows: SeanceRow[] = []
  const takenDays = new Set<string>()

  while (seanceRows.length < options.seances) {
    const patient = faker.helpers.arrayElement(patientRows)
    const offset = faker.helpers.weightedArrayElement([
      { value: () => -faker.number.int({ min: 1, max: 730 }), weight: 88 },
      { value: () => 0, weight: 1 },
      { value: () => faker.number.int({ min: 1, max: 14 }), weight: 11 },
    ])()
    const date = addDays(options.today, offset)
    if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) continue // closed on Sunday
    const dayKey = `${patient.id}|${date}`
    if (takenDays.has(dayKey)) continue
    takenDays.add(dayKey)

    const past = offset < 0
    const source = offset < -365 ? ('import' as const) : ('manual' as const)
    const status = past
      ? faker.helpers.weightedArrayElement([
          { value: 'done' as const, weight: 94 },
          { value: 'cancelled' as const, weight: 4 },
          { value: 'planned' as const, weight: 2 },
        ])
      : faker.helpers.weightedArrayElement([
          { value: 'planned' as const, weight: 93 },
          { value: 'cancelled' as const, weight: 7 },
        ])
    const heure = source === 'import' ? null : fakeHeure()
    const isChild = ageOn(patient.ddn, date) < 6
    const id = ulid()

    seanceRows.push({
      id,
      patientId: patient.id!,
      date,
      heure,
      status,
      source,
      motif: faker.helpers.arrayElement(isChild ? MOTIFS_ENFANT : MOTIFS),
      anamnese: status === 'done' ? faker.helpers.arrayElement(ANAMNESES) : null,
      pratique: status === 'done' ? faker.helpers.arrayElement(PRATIQUES) : null,
      tarifCents: faker.helpers.weightedArrayElement([
        { value: 6000, weight: 70 },
        { value: 5500, weight: 10 },
        { value: 5000, weight: 10 },
        { value: 6500, weight: 8 },
        { value: 0, weight: 2 },
      ]),
      paiement: status === 'done' ? faker.helpers.arrayElement(PAIEMENTS) : null,
      doneAt: status === 'done' ? `${date}T${heure ?? '12:00'}:00.000Z` : null,
      cancelReason: status === 'cancelled' ? faker.helpers.arrayElement(CANCEL_REASONS) : null,
      cancelledAt: status === 'cancelled' ? `${date}T08:00:00.000Z` : null,
      prevStatus: status === 'cancelled' ? 'planned' : null,
    })
  }

  const links = new Map<string, ReturnType<typeof orderLink>>()
  const linkCount = Math.min(15, Math.floor(patientRows.length / 2))
  while (links.size < linkCount) {
    const [self, other] = faker.helpers.arrayElements(patientRows, 2) as [PatientRow, PatientRow]
    const relation = faker.helpers.arrayElement<Relation>([
      'conjoint',
      'enfant',
      'parent',
      'fratrie',
      'grand_parent',
    ])
    const link = orderLink(self.id!, other.id!, relation)
    links.set(`${link.patientA}|${link.patientB}`, link)
  }

  db.transaction((tx) => {
    for (const row of patientRows) tx.insert(patients).values(row).run()
    for (const row of seanceRows) tx.insert(seances).values(row).run()
    for (const row of links.values()) tx.insert(patientLinks).values(row).run()
  })

  return {
    patients: patientRows.length,
    seances: seanceRows.length,
    links: links.size,
  }
}

/** Deletes every business row (keeps settings and communes). Development only. */
export function clearBusinessData(db: AppDatabase): void {
  db.$client.exec(`
    DELETE FROM envois; DELETE FROM avoirs; DELETE FROM factures; DELETE FROM doctolib_rdv;
    DELETE FROM contact_memory; DELETE FROM duplicate_ignored; DELETE FROM patient_links;
    DELETE FROM blocages; DELETE FROM journal; DELETE FROM seances; DELETE FROM patients;
  `)
}
