# Modèle de données (SQLite chiffrée, Drizzle)

## Conventions
- **Identifiants** : chaînes `TEXT` au format ULID (ordre chronologique).
- **Dates** : `TEXT` ISO (`YYYY-MM-DD`). Heures : `HH:mm`. Horodatages : ISO complet avec fuseau.
- **Montants** : `INTEGER` en centimes.
- **Horodatage** : chaque table a `created_at` et `updated_at`.
- **Moteur** : `PRAGMA journal_mode=WAL`, `foreign_keys=ON`. Le chiffrement passe par `better-sqlite3-multiple-ciphers`. La clé est générée à l'installation, puis protégée par `safeStorage`.

## patients
| colonne | type | notes |
|---|---|---|
| id | TEXT PK | |
| short_no | INTEGER UNIQUE | n° court affiché dans le journal (« Patient n° 148 ») |
| nom, prenom | TEXT NOT NULL | |
| ddn | TEXT NOT NULL | date de naissance |
| sexe | TEXT | `F` \| `M` \| NULL |
| situation | TEXT | `celibataire`\|`couple`\|`pacse`\|`marie`\|`divorce`\|`veuf`\|NULL |
| enfants | INTEGER | NULL = non renseigné |
| profession, adresse, cp, commune | TEXT | |
| portable, fixe | TEXT | chiffres seuls |
| email | TEXT | |
| commentaire | TEXT | commentaire inter-séances |
| antecedents_tags | TEXT (JSON) | étiquettes courtes affichées sous le commentaire |
| legacy_key | TEXT | ancienne clé VBA `NomPrenomJJ/MM/AAAA` (import) |
| deleted_at | TEXT | suppression douce (R-14), purge à J+30 |

Index : `(nom, prenom)` sans accents ni casse (colonne générée `search_key`), `portable`, `email`, `ddn`.

## seances
| colonne | type | notes |
|---|---|---|
| id | TEXT PK | |
| patient_id | TEXT FK → patients | ON DELETE CASCADE (à la purge) |
| date | TEXT NOT NULL | |
| heure | TEXT | `HH:mm`, depuis Doctolib ou saisie dans le planning (R-24) |
| status | TEXT NOT NULL | `planned` \| `done` \| `cancelled` (statut affiché : R-01) |
| source | TEXT NOT NULL | `doctolib` \| `manual` \| `import` |
| doctolib_key | TEXT UNIQUE | clé du RDV Doctolib rattaché |
| motif | TEXT | |
| anamnese, pratique | TEXT | **contenu médical, jamais journalisé** |
| tarif_cents | INTEGER NOT NULL DEFAULT 6000 | |
| paiement | TEXT | `especes`\|`cheque`\|`virement_attente`\|`virement_recu`\|NULL |
| done_at | TEXT | |
| cancel_reason, cancelled_at, prev_status | TEXT | R-06 |

Contrainte d'unicité partielle : un seul couple `(patient_id, date)` avec `status != 'cancelled'` (R-08).

## factures
| colonne | type | notes |
|---|---|---|
| id | TEXT PK | |
| numero | TEXT UNIQUE NOT NULL | `AAAA-NNNN` |
| annee, sequence | INTEGER | `UNIQUE(annee, sequence)` |
| seance_id | TEXT FK → seances | ON DELETE SET NULL |
| patient_id | TEXT FK → patients | ON DELETE SET NULL |
| statut | TEXT | `emise` \| `deleted` |
| date_emission | TEXT | |
| snap_patient_nom, snap_patient_adresse | TEXT | instantané (R-12) |
| snap_date_seance, snap_libelle | TEXT | « Séance d'ostéopathie » |
| montant_cents | INTEGER | |
| reglement | TEXT | `acquittee` \| `attente` |
| mode_paiement | TEXT | |
| snap_cabinet | TEXT (JSON) | nom, titre, adresse, téléphone, ADELI, SIRET, mention TVA |
| pdf_path | TEXT | |
| modified_at, modified_note | TEXT | R-04 |
| deleted_at | TEXT | R-13 |

Index unique partiel : un seul `seance_id` avec `statut = 'emise'`.

**Mentions obligatoires du PDF** :
- **Praticien** : nom et prénom, titre « Ostéopathe D.O. », adresse, n° ADELI, SIRET.
- **Facture** : numéro, date d'émission.
- **Patient** : nom, prénom et adresse.
- **Prestation** : date de la séance, désignation, montant et total.
- **Mentions** : « TVA non applicable, article 261-4-1° du CGI », signature, mention « Acquittée le … · règlement : … » ou « Règlement attendu ».

## avoirs
`id`, `numero` (`AV-AAAA-NNNN`, séquence continue distincte), `facture_id` (FK, UNIQUE), `date`, `montant_cents` (négatif), `pdf_path`. Ils ne sont jamais affichés dans le registre, seulement dans l'export comptable (R-13).

## envois
`id`, `facture_id`, `canal` (`email` \| `print`), `destinataire`, `at`, `ok` (bool), `error`.

## doctolib_rdv
| colonne | type | notes |
|---|---|---|
| key | TEXT PK | hash stable : (date, heure, nom affiché, téléphone) |
| date, heure | TEXT | |
| nom_affiche, telephone, email, motif | TEXT | tels que reçus |
| etat | TEXT | `confirme` \| `modifie` \| `annule` |
| match | TEXT | `auto` \| `manual` \| `pending_new` \| `pending_multi` |
| patient_id, seance_id | TEXT FK | |
| message_ids | TEXT (JSON) | e-mails sources (Message-ID) |
| received_at | TEXT | |

## contact_memory
`contact_key` (téléphone normalisé + e-mail en minuscules) PK, `patient_id`. Sert à « Mémoriser ce choix » (R-18).

## duplicate_ignored
`patient_a`, `patient_b` (paire ordonnée) PK, `at`. Paire marquée « pas les mêmes personnes » (R-19). Les doublons possibles eux-mêmes ne sont pas stockés : ils sont recalculés à l'affichage.

## patient_links
| colonne | type | notes |
|---|---|---|
| patient_a | TEXT FK → patients | ON DELETE CASCADE ; `patient_a < patient_b` (paire ordonnée) |
| patient_b | TEXT FK → patients | ON DELETE CASCADE |
| rel_a_to_b | TEXT NOT NULL | ce que **b** est pour **a** : `conjoint` \| `enfant` \| `parent` \| `fratrie` \| `grand_parent` \| `petit_enfant` \| `autre` |
| created_at | TEXT | |

PK `(patient_a, patient_b)`. La relation vue depuis b est l'inverse (`enfant` ↔ `parent`, `grand_parent` ↔ `petit_enfant`, les autres symétriques), calculée dans `shared/domain` (R-25). Si l'ordre des ids inverse la saisie, on stocke l'inverse.

## blocages
`id`, `date`, `creneau` (`day` \| `am` \| `pm`), `motif`. Unicité `(date, creneau)`.

## journal
`id`, `at`, `type` (`patient` \| `facture` \| `verrouillage` \| `reglage`), `subject` (≤ 60 caractères : nom du patient, ou « Patient n° X » après suppression), `action` (≤ 140 caractères). Jamais de contenu médical. Purge selon la durée de conservation choisie (R-20).

## documents
R-26. `id`, `patient_id` (FK, suppression en cascade avec la fiche), `titre`, `categorie` (`imagerie` \| `compte_rendu` \| `courrier` \| `ordonnance` \| `administratif` \| `photo` \| `autre`), `file_name` (nom d'origine), `mime`, `size_bytes` (> 0, ≤ 25 Mo), `doc_date` (date du document), `created_at`, `updated_at`. Index sur `patient_id`.

## document_contents
`document_id` (PK et FK vers `documents`, cascade), `bytes` (BLOB). Le contenu est à part pour que la liste des documents ne lise jamais les fichiers. Comme le reste de la base, il est chiffré (SQLCipher) et inclus dans les sauvegardes.

## settings
Table clé / valeur (`key` TEXT PK, `value` TEXT JSON). Clés principales :
- **Cabinet** : `cabinet` (nom, titre, adresse, téléphone, ADELI, SIRET, chemin de la signature).
- **Tarifs** : `tarifs` (liste en centimes, valeur par défaut).
- **Facturation** : `mention_tva`, `email_template` (objet et corps), `invoice_next` (par année, en lecture seule).
- **Agenda** : `agenda` (jours, horaires, durée, semaines affichées, rattachement automatique).
- **Sécurité** : `security` (code activé, hash du code, sel, délai de verrouillage, hash de la clé de secours).
- **Gmail** : `gmail` (adresse, mot de passe chiffré, libellé, fréquence, dernier UID par dossier).
- **Sauvegarde et journal** : `backup` (dossier, nombre de copies, dernière date), `journal_retention_months`.
- **Reprise de l'historique** : `import_dates_to_fix` (`{ id de séance: date lue dans le fichier }`), séances importées avec une « date à corriger » (MIGRATION.md). L'entrée est retirée quand la date est corrigée.

## communes
Table chargée au premier lancement depuis `resources/communes.csv` (`commune;code_postal`, 35 576 lignes). Index sur `code_postal`.

## Choix d'implémentation (validés)
- **`patients.search_key`** : calculé par l'application (nom et prénom sans accents, en minuscules) à chaque écriture, et non par une colonne générée SQL, car SQLite ne sait pas retirer les accents. La recherche sur la commune et le métier utilise une fonction `fold()` enregistrée à l'ouverture de la connexion, jamais stockée dans le schéma.
- **Unicité R-08** : l'index unique partiel exclut les séances `source = 'import'`, car l'import conserve les doublons de l'historique (MIGRATION.md).
- **Colonnes ajoutées** : `journal.patient_id` (bouton « Historique » de la fiche), `patients.commentaire_updated_at` (« Modifié le … »), `avoirs.annee` et `avoirs.sequence` (numérotation continue des avoirs).
- **Purge R-14** : au démarrage, les fiches supprimées depuis plus de 30 jours sont purgées ; leurs lignes de journal ne gardent que « Patient n° X ». Les lignes au-delà de la durée de conservation (R-20) sont purgées au même moment.
- **Facturation (lot 3)** :
  - `factures.acquittee_le` (colonne ajoutée) : date de réception d'un virement arrivé après l'émission (« Marquer le virement comme reçu ») ; la mention devient « Acquittée le … » et le PDF est régénéré.
  - `factures.mode_paiement` garde le libellé imprimé (« chèque », « espèces », « virement »), et `pdf_path` un chemin relatif à `userData` (`factures/2026/2026-0001.pdf`, `factures/2026/AV-2026-0001.pdf` pour les avoirs).
  - Le « prochain numéro » est calculé (plus grande séquence de l'année + 1), jamais stocké. Le réglage `invoice_start` (`{ "2026": 143 }`) permet de reprendre une numérotation commencée dans un autre outil, uniquement avant la première facture de l'année.
  - L'émission et la suppression (avoir) se font dans une transaction `BEGIN IMMEDIATE` : le verrou d'écriture est pris avant de lire le numéro.
  - Réglages : `cabinet` (nom, titre, adresse, téléphone, ADELI, SIRET, fichier de signature dans `userData`), `mention_tva`, `email_template` (`subject`, `body`), `gmail` (mot de passe chiffré par `safeStorage`).
- **Planning et Doctolib (lot 4)** :
  - Réglages : `agenda` (jours, horaires, durée, semaines affichées, rattachement automatique), `sync_state` (dernière synchronisation, e-mails non reconnus), `dismissed_alerts` (alertes « À rapprocher » vues).
  - `doctolib_rdv.key` = `rdv_` + hash FNV-1a 64 bits de (date, heure, nom affiché sans accents, téléphone normalisé). Une modification change la clé de la ligne existante ; l'idempotence s'appuie aussi sur les Message-ID déjà traités.
  - Les séances importées (`source = import`) ne sont pas affichées dans le planning.
- **Sauvegarde (lot 5)** : `backup` (`folder`, `keep`, `lastAt`). La copie est faite par `VACUUM INTO` sur la connexion chiffrée : le fichier `.mosave` est chiffré avec la même clé que la base. La restauration vérifie le fichier (clé, `integrity_check`), fait une copie de sécurité, puis remplace la base au redémarrage (`meuosteo.db.restore`). Une sauvegarde venue d'un autre PC demande sa clé de sauvegarde (64 caractères hexadécimaux), qui remplace alors `meuosteo.key`.
- **Journal (R-20)** : seuls les événements listés par R-20 sont inscrits ; l'envoi d'une facture à l'émission complète la ligne « émise » (« · envoyée par e-mail »).
