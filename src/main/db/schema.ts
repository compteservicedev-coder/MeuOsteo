/**
 * SQLite schema (docs/DATA_MODEL.md). Run `npm run db:generate` after any change to produce the
 * migration in ./migrations.
 *
 * Conventions: ULID text ids, ISO dates (`YYYY-MM-DD`, `HH:mm`), amounts in integer cents,
 * `created_at` / `updated_at` on every table but the `communes` reference list.
 */
import { sql } from 'drizzle-orm'
import {
  blob,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { ulid } from 'ulid'
import { DOCUMENT_CATEGORIES } from '../../shared/domain/documents'

const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

const timestamps = () => ({
  createdAt: text('created_at').notNull().default(nowIso),
  updatedAt: text('updated_at')
    .notNull()
    .default(nowIso)
    .$onUpdateFn(() => new Date().toISOString()),
})

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => ulid())

/** `column IN ('a', 'b')` for check constraints (values are constants of this file). */
const oneOf = (column: string, values: readonly string[]) =>
  sql.raw(`"${column}" IN (${values.map((v) => `'${v}'`).join(', ')})`)

export const SEXES = ['F', 'M'] as const
export const SITUATIONS = ['celibataire', 'couple', 'pacse', 'marie', 'divorce', 'veuf'] as const
export const SEANCE_STATUSES = ['planned', 'done', 'cancelled'] as const
export const SEANCE_SOURCES = ['doctolib', 'manual', 'import'] as const
export const PAIEMENTS = ['especes', 'cheque', 'virement_attente', 'virement_recu'] as const
export const FACTURE_STATUTS = ['emise', 'deleted'] as const
export const REGLEMENTS = ['acquittee', 'attente'] as const
export const ENVOI_CANAUX = ['email', 'print'] as const
export const RDV_ETATS = ['confirme', 'modifie', 'annule'] as const
export const RDV_MATCHES = ['auto', 'manual', 'pending_new', 'pending_multi'] as const
export const RELATIONS = [
  'conjoint',
  'enfant',
  'parent',
  'fratrie',
  'grand_parent',
  'petit_enfant',
  'autre',
] as const
export const CRENEAUX = ['day', 'am', 'pm'] as const
export const JOURNAL_TYPES = ['patient', 'facture', 'verrouillage', 'reglage'] as const

export const patients = sqliteTable(
  'patients',
  {
    id: id(),
    /** Short number shown in the journal (« Patient n° 148 »). */
    shortNo: integer('short_no').notNull().unique(),
    nom: text('nom').notNull(),
    prenom: text('prenom').notNull(),
    ddn: text('ddn').notNull(),
    sexe: text('sexe', { enum: SEXES }),
    situation: text('situation', { enum: SITUATIONS }),
    /** NULL = not filled in. */
    enfants: integer('enfants'),
    profession: text('profession'),
    adresse: text('adresse'),
    cp: text('cp'),
    commune: text('commune'),
    /** Digits only. */
    portable: text('portable'),
    fixe: text('fixe'),
    email: text('email'),
    /** Comment kept between sessions (« commentaire inter-séances »). */
    commentaire: text('commentaire'),
    commentaireUpdatedAt: text('commentaire_updated_at'),
    antecedentsTags: text('antecedents_tags', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    /** Former VBA key `NomPrenomJJ/MM/AAAA`, kept by the import. */
    legacyKey: text('legacy_key'),
    /**
     * Folded « nom prénom » (no accents, lower case), written by the repositories with
     * `patientSearchKey`. SQLite cannot strip accents in a generated column.
     */
    searchKey: text('search_key').notNull(),
    /** Soft delete (R-14), purged 30 days later. */
    deletedAt: text('deleted_at'),
    ...timestamps(),
  },
  (t) => [
    index('patients_search_key_idx').on(t.searchKey),
    index('patients_portable_idx').on(t.portable),
    index('patients_email_idx').on(t.email),
    index('patients_ddn_idx').on(t.ddn),
    index('patients_legacy_key_idx').on(t.legacyKey),
    check('patients_sexe_check', sql`${t.sexe} IS NULL OR ${oneOf('sexe', SEXES)}`),
    check(
      'patients_situation_check',
      sql`${t.situation} IS NULL OR ${oneOf('situation', SITUATIONS)}`,
    ),
    check('patients_enfants_check', sql`${t.enfants} IS NULL OR ${t.enfants} >= 0`),
  ],
)

export const seances = sqliteTable(
  'seances',
  {
    id: id(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    heure: text('heure'),
    status: text('status', { enum: SEANCE_STATUSES }).notNull(),
    source: text('source', { enum: SEANCE_SOURCES }).notNull(),
    doctolibKey: text('doctolib_key').unique(),
    motif: text('motif'),
    /** Medical content: never logged. */
    anamnese: text('anamnese'),
    /** Medical content: never logged. */
    pratique: text('pratique'),
    tarifCents: integer('tarif_cents').notNull().default(6000),
    paiement: text('paiement', { enum: PAIEMENTS }),
    doneAt: text('done_at'),
    cancelReason: text('cancel_reason'),
    cancelledAt: text('cancelled_at'),
    prevStatus: text('prev_status', { enum: SEANCE_STATUSES }),
    ...timestamps(),
  },
  (t) => [
    /**
     * R-08: one non-cancelled session per patient and day. Imported history is exempt
     * (docs/MIGRATION.md keeps both sessions and reports them).
     */
    uniqueIndex('seances_patient_day_unique')
      .on(t.patientId, t.date)
      .where(sql`${t.status} <> 'cancelled' AND ${t.source} <> 'import'`),
    index('seances_patient_idx').on(t.patientId),
    index('seances_date_idx').on(t.date),
    check('seances_status_check', oneOf('status', SEANCE_STATUSES)),
    check('seances_source_check', oneOf('source', SEANCE_SOURCES)),
    check('seances_paiement_check', sql`${t.paiement} IS NULL OR ${oneOf('paiement', PAIEMENTS)}`),
    check(
      'seances_prev_status_check',
      sql`${t.prevStatus} IS NULL OR ${oneOf('prev_status', SEANCE_STATUSES)}`,
    ),
    check('seances_tarif_check', sql`${t.tarifCents} >= 0`),
  ],
)

export interface CabinetSnapshot {
  nom: string
  titre: string
  adresse: string
  telephone: string
  adeli: string
  siret: string
  mentionTva: string
}

export const factures = sqliteTable(
  'factures',
  {
    id: id(),
    /** `AAAA-NNNN` (R-11). */
    numero: text('numero').notNull().unique(),
    annee: integer('annee').notNull(),
    sequence: integer('sequence').notNull(),
    seanceId: text('seance_id').references(() => seances.id, { onDelete: 'set null' }),
    patientId: text('patient_id').references(() => patients.id, { onDelete: 'set null' }),
    statut: text('statut', { enum: FACTURE_STATUTS }).notNull(),
    dateEmission: text('date_emission').notNull(),
    // Snapshot taken at issue time (R-12).
    snapPatientNom: text('snap_patient_nom').notNull(),
    snapPatientAdresse: text('snap_patient_adresse').notNull(),
    snapDateSeance: text('snap_date_seance').notNull(),
    snapLibelle: text('snap_libelle').notNull(),
    montantCents: integer('montant_cents').notNull(),
    reglement: text('reglement', { enum: REGLEMENTS }).notNull(),
    modePaiement: text('mode_paiement'),
    /** Day the payment was received when it came after the issue (« Marquer le virement reçu »). */
    acquitteeLe: text('acquittee_le'),
    snapCabinet: text('snap_cabinet', { mode: 'json' }).$type<CabinetSnapshot>().notNull(),
    pdfPath: text('pdf_path'),
    modifiedAt: text('modified_at'),
    modifiedNote: text('modified_note'),
    deletedAt: text('deleted_at'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('factures_annee_sequence_unique').on(t.annee, t.sequence),
    /** At most one active invoice per session (R-10). */
    uniqueIndex('factures_seance_active_unique')
      .on(t.seanceId)
      .where(sql`${t.statut} = 'emise'`),
    index('factures_patient_idx').on(t.patientId),
    index('factures_date_emission_idx').on(t.dateEmission),
    check('factures_statut_check', oneOf('statut', FACTURE_STATUTS)),
    check('factures_reglement_check', oneOf('reglement', REGLEMENTS)),
    check('factures_montant_check', sql`${t.montantCents} > 0`),
  ],
)

/** Credit notes created when an invoice is « supprimée » (R-13). Never shown in the register. */
export const avoirs = sqliteTable(
  'avoirs',
  {
    id: id(),
    /** `AV-AAAA-NNNN`, a sequence distinct from invoices. */
    numero: text('numero').notNull().unique(),
    annee: integer('annee').notNull(),
    sequence: integer('sequence').notNull(),
    factureId: text('facture_id')
      .notNull()
      .unique()
      .references(() => factures.id, { onDelete: 'restrict' }),
    date: text('date').notNull(),
    montantCents: integer('montant_cents').notNull(),
    pdfPath: text('pdf_path'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('avoirs_annee_sequence_unique').on(t.annee, t.sequence),
    check('avoirs_montant_check', sql`${t.montantCents} < 0`),
  ],
)

export const envois = sqliteTable(
  'envois',
  {
    id: id(),
    factureId: text('facture_id')
      .notNull()
      .references(() => factures.id, { onDelete: 'cascade' }),
    canal: text('canal', { enum: ENVOI_CANAUX }).notNull(),
    destinataire: text('destinataire'),
    at: text('at').notNull(),
    ok: integer('ok', { mode: 'boolean' }).notNull(),
    error: text('error'),
    ...timestamps(),
  },
  (t) => [
    index('envois_facture_idx').on(t.factureId),
    check('envois_canal_check', oneOf('canal', ENVOI_CANAUX)),
  ],
)

export const doctolibRdv = sqliteTable(
  'doctolib_rdv',
  {
    /** Stable hash of (date, heure, nom affiché, téléphone). */
    key: text('key').primaryKey(),
    date: text('date').notNull(),
    heure: text('heure'),
    nomAffiche: text('nom_affiche').notNull(),
    telephone: text('telephone'),
    email: text('email'),
    motif: text('motif'),
    etat: text('etat', { enum: RDV_ETATS }).notNull(),
    match: text('match', { enum: RDV_MATCHES }).notNull(),
    patientId: text('patient_id').references(() => patients.id, { onDelete: 'set null' }),
    seanceId: text('seance_id').references(() => seances.id, { onDelete: 'set null' }),
    /** Message-IDs of the source e-mails. */
    messageIds: text('message_ids', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    receivedAt: text('received_at').notNull(),
    ...timestamps(),
  },
  (t) => [
    index('doctolib_rdv_match_idx').on(t.match),
    index('doctolib_rdv_date_idx').on(t.date),
    check('doctolib_rdv_etat_check', oneOf('etat', RDV_ETATS)),
    check('doctolib_rdv_match_check', oneOf('match', RDV_MATCHES)),
  ],
)

/** « Mémoriser ce choix » (R-18): normalised phone + lower-case e-mail → patient. */
export const contactMemory = sqliteTable('contact_memory', {
  contactKey: text('contact_key').primaryKey(),
  patientId: text('patient_id')
    .notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),
  ...timestamps(),
})

/** Pairs marked « pas les mêmes personnes » (R-19), stored with patient_a < patient_b. */
export const duplicateIgnored = sqliteTable(
  'duplicate_ignored',
  {
    patientA: text('patient_a')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    patientB: text('patient_b')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    at: text('at').notNull(),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ columns: [t.patientA, t.patientB] }),
    check('duplicate_ignored_order_check', sql`${t.patientA} < ${t.patientB}`),
  ],
)

/** Relatives (R-25): one row per pair, patient_a < patient_b; `rel_a_to_b` is what b is to a. */
export const patientLinks = sqliteTable(
  'patient_links',
  {
    patientA: text('patient_a')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    patientB: text('patient_b')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    relAToB: text('rel_a_to_b', { enum: RELATIONS }).notNull(),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ columns: [t.patientA, t.patientB] }),
    index('patient_links_b_idx').on(t.patientB),
    check('patient_links_order_check', sql`${t.patientA} < ${t.patientB}`),
    check('patient_links_rel_check', oneOf('rel_a_to_b', RELATIONS)),
  ],
)

/** Blocked days and half-days (R-23). */
export const blocages = sqliteTable(
  'blocages',
  {
    id: id(),
    date: text('date').notNull(),
    creneau: text('creneau', { enum: CRENEAUX }).notNull(),
    motif: text('motif'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('blocages_date_creneau_unique').on(t.date, t.creneau),
    check('blocages_creneau_check', oneOf('creneau', CRENEAUX)),
  ],
)

/** Business journal (R-20). Never any medical content. */
export const journal = sqliteTable(
  'journal',
  {
    id: id(),
    at: text('at').notNull(),
    type: text('type', { enum: JOURNAL_TYPES }).notNull(),
    /** ≤ 60 characters: patient name, or « Patient n° X » once deleted. */
    subject: text('subject').notNull(),
    /** ≤ 140 characters. */
    action: text('action').notNull(),
    /** Patient concerned, for the « Historique » button of the record. */
    patientId: text('patient_id').references(() => patients.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    index('journal_at_idx').on(t.at),
    index('journal_patient_idx').on(t.patientId),
    check('journal_type_check', oneOf('type', JOURNAL_TYPES)),
    check('journal_subject_length_check', sql`length(${t.subject}) <= 60`),
    check('journal_action_length_check', sql`length(${t.action}) <= 140`),
  ],
)

/** R-26 · Documents attached to a record. Metadata only: the bytes live in `document_contents`. */
export const documents = sqliteTable(
  'documents',
  {
    id: id(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    titre: text('titre').notNull(),
    categorie: text('categorie', { enum: DOCUMENT_CATEGORIES }).notNull(),
    /** Name of the file as imported, for its extension and « Enregistrer sous… ». */
    fileName: text('file_name').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** Date of the document itself (YYYY-MM-DD), the import day by default. */
    docDate: text('doc_date').notNull(),
    ...timestamps(),
  },
  (t) => [
    index('documents_patient_idx').on(t.patientId),
    check('documents_categorie_check', oneOf('categorie', DOCUMENT_CATEGORIES)),
    check('documents_size_check', sql`${t.sizeBytes} > 0`),
  ],
)

/** The file itself, apart so that listing documents never reads megabytes. */
export const documentContents = sqliteTable('document_contents', {
  documentId: text('document_id')
    .primaryKey()
    .references(() => documents.id, { onDelete: 'cascade' }),
  bytes: blob('bytes', { mode: 'buffer' }).notNull(),
})

/** Key / JSON value settings (cabinet, tarifs, security, gmail, backup…). */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  ...timestamps(),
})

/** Reference list loaded from resources/communes.csv on first launch (R-16). */
export const communes = sqliteTable(
  'communes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    commune: text('commune').notNull(),
    codePostal: text('code_postal').notNull(),
  },
  (t) => [index('communes_code_postal_idx').on(t.codePostal)],
)
