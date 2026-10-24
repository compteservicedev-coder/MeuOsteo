CREATE TABLE `avoirs` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` text NOT NULL,
	`annee` integer NOT NULL,
	`sequence` integer NOT NULL,
	`facture_id` text NOT NULL,
	`date` text NOT NULL,
	`montant_cents` integer NOT NULL,
	`pdf_path` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`facture_id`) REFERENCES `factures`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "avoirs_montant_check" CHECK("avoirs"."montant_cents" < 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `avoirs_numero_unique` ON `avoirs` (`numero`);--> statement-breakpoint
CREATE UNIQUE INDEX `avoirs_facture_id_unique` ON `avoirs` (`facture_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `avoirs_annee_sequence_unique` ON `avoirs` (`annee`,`sequence`);--> statement-breakpoint
CREATE TABLE `blocages` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`creneau` text NOT NULL,
	`motif` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "blocages_creneau_check" CHECK("creneau" IN ('day', 'am', 'pm'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blocages_date_creneau_unique` ON `blocages` (`date`,`creneau`);--> statement-breakpoint
CREATE TABLE `communes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`commune` text NOT NULL,
	`code_postal` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `communes_code_postal_idx` ON `communes` (`code_postal`);--> statement-breakpoint
CREATE TABLE `contact_memory` (
	`contact_key` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `doctolib_rdv` (
	`key` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`heure` text,
	`nom_affiche` text NOT NULL,
	`telephone` text,
	`email` text,
	`motif` text,
	`etat` text NOT NULL,
	`match` text NOT NULL,
	`patient_id` text,
	`seance_id` text,
	`message_ids` text DEFAULT '[]' NOT NULL,
	`received_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`seance_id`) REFERENCES `seances`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "doctolib_rdv_etat_check" CHECK("etat" IN ('confirme', 'modifie', 'annule')),
	CONSTRAINT "doctolib_rdv_match_check" CHECK("match" IN ('auto', 'manual', 'pending_new', 'pending_multi'))
);
--> statement-breakpoint
CREATE INDEX `doctolib_rdv_match_idx` ON `doctolib_rdv` (`match`);--> statement-breakpoint
CREATE INDEX `doctolib_rdv_date_idx` ON `doctolib_rdv` (`date`);--> statement-breakpoint
CREATE TABLE `duplicate_ignored` (
	`patient_a` text NOT NULL,
	`patient_b` text NOT NULL,
	`at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`patient_a`, `patient_b`),
	FOREIGN KEY (`patient_a`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_b`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "duplicate_ignored_order_check" CHECK("duplicate_ignored"."patient_a" < "duplicate_ignored"."patient_b")
);
--> statement-breakpoint
CREATE TABLE `envois` (
	`id` text PRIMARY KEY NOT NULL,
	`facture_id` text NOT NULL,
	`canal` text NOT NULL,
	`destinataire` text,
	`at` text NOT NULL,
	`ok` integer NOT NULL,
	`error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`facture_id`) REFERENCES `factures`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "envois_canal_check" CHECK("canal" IN ('email', 'print'))
);
--> statement-breakpoint
CREATE INDEX `envois_facture_idx` ON `envois` (`facture_id`);--> statement-breakpoint
CREATE TABLE `factures` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` text NOT NULL,
	`annee` integer NOT NULL,
	`sequence` integer NOT NULL,
	`seance_id` text,
	`patient_id` text,
	`statut` text NOT NULL,
	`date_emission` text NOT NULL,
	`snap_patient_nom` text NOT NULL,
	`snap_patient_adresse` text NOT NULL,
	`snap_date_seance` text NOT NULL,
	`snap_libelle` text NOT NULL,
	`montant_cents` integer NOT NULL,
	`reglement` text NOT NULL,
	`mode_paiement` text,
	`snap_cabinet` text NOT NULL,
	`pdf_path` text,
	`modified_at` text,
	`modified_note` text,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`seance_id`) REFERENCES `seances`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "factures_statut_check" CHECK("statut" IN ('emise', 'deleted')),
	CONSTRAINT "factures_reglement_check" CHECK("reglement" IN ('acquittee', 'attente')),
	CONSTRAINT "factures_montant_check" CHECK("factures"."montant_cents" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `factures_numero_unique` ON `factures` (`numero`);--> statement-breakpoint
CREATE UNIQUE INDEX `factures_annee_sequence_unique` ON `factures` (`annee`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `factures_seance_active_unique` ON `factures` (`seance_id`) WHERE "factures"."statut" = 'emise';--> statement-breakpoint
CREATE INDEX `factures_patient_idx` ON `factures` (`patient_id`);--> statement-breakpoint
CREATE INDEX `factures_date_emission_idx` ON `factures` (`date_emission`);--> statement-breakpoint
CREATE TABLE `journal` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`type` text NOT NULL,
	`subject` text NOT NULL,
	`action` text NOT NULL,
	`patient_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "journal_type_check" CHECK("type" IN ('patient', 'facture', 'verrouillage', 'reglage')),
	CONSTRAINT "journal_subject_length_check" CHECK(length("journal"."subject") <= 60),
	CONSTRAINT "journal_action_length_check" CHECK(length("journal"."action") <= 140)
);
--> statement-breakpoint
CREATE INDEX `journal_at_idx` ON `journal` (`at`);--> statement-breakpoint
CREATE INDEX `journal_patient_idx` ON `journal` (`patient_id`);--> statement-breakpoint
CREATE TABLE `patient_links` (
	`patient_a` text NOT NULL,
	`patient_b` text NOT NULL,
	`rel_a_to_b` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`patient_a`, `patient_b`),
	FOREIGN KEY (`patient_a`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_b`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "patient_links_order_check" CHECK("patient_links"."patient_a" < "patient_links"."patient_b"),
	CONSTRAINT "patient_links_rel_check" CHECK("rel_a_to_b" IN ('conjoint', 'enfant', 'parent', 'fratrie', 'grand_parent', 'petit_enfant', 'autre'))
);
--> statement-breakpoint
CREATE INDEX `patient_links_b_idx` ON `patient_links` (`patient_b`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`short_no` integer NOT NULL,
	`nom` text NOT NULL,
	`prenom` text NOT NULL,
	`ddn` text NOT NULL,
	`sexe` text,
	`situation` text,
	`enfants` integer,
	`profession` text,
	`adresse` text,
	`cp` text,
	`commune` text,
	`portable` text,
	`fixe` text,
	`email` text,
	`commentaire` text,
	`commentaire_updated_at` text,
	`antecedents_tags` text DEFAULT '[]' NOT NULL,
	`legacy_key` text,
	`search_key` text NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "patients_sexe_check" CHECK("patients"."sexe" IS NULL OR "sexe" IN ('F', 'M')),
	CONSTRAINT "patients_situation_check" CHECK("patients"."situation" IS NULL OR "situation" IN ('celibataire', 'couple', 'pacse', 'marie', 'divorce', 'veuf')),
	CONSTRAINT "patients_enfants_check" CHECK("patients"."enfants" IS NULL OR "patients"."enfants" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patients_short_no_unique` ON `patients` (`short_no`);--> statement-breakpoint
CREATE INDEX `patients_search_key_idx` ON `patients` (`search_key`);--> statement-breakpoint
CREATE INDEX `patients_portable_idx` ON `patients` (`portable`);--> statement-breakpoint
CREATE INDEX `patients_email_idx` ON `patients` (`email`);--> statement-breakpoint
CREATE INDEX `patients_ddn_idx` ON `patients` (`ddn`);--> statement-breakpoint
CREATE INDEX `patients_legacy_key_idx` ON `patients` (`legacy_key`);--> statement-breakpoint
CREATE TABLE `seances` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`date` text NOT NULL,
	`heure` text,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`doctolib_key` text,
	`motif` text,
	`anamnese` text,
	`pratique` text,
	`tarif_cents` integer DEFAULT 6000 NOT NULL,
	`paiement` text,
	`done_at` text,
	`cancel_reason` text,
	`cancelled_at` text,
	`prev_status` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "seances_status_check" CHECK("status" IN ('planned', 'done', 'cancelled')),
	CONSTRAINT "seances_source_check" CHECK("source" IN ('doctolib', 'manual', 'import')),
	CONSTRAINT "seances_paiement_check" CHECK("seances"."paiement" IS NULL OR "paiement" IN ('especes', 'cheque', 'virement_attente', 'virement_recu')),
	CONSTRAINT "seances_prev_status_check" CHECK("seances"."prev_status" IS NULL OR "prev_status" IN ('planned', 'done', 'cancelled')),
	CONSTRAINT "seances_tarif_check" CHECK("seances"."tarif_cents" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seances_doctolib_key_unique` ON `seances` (`doctolib_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `seances_patient_day_unique` ON `seances` (`patient_id`,`date`) WHERE "seances"."status" <> 'cancelled' AND "seances"."source" <> 'import';--> statement-breakpoint
CREATE INDEX `seances_patient_idx` ON `seances` (`patient_id`);--> statement-breakpoint
CREATE INDEX `seances_date_idx` ON `seances` (`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
