CREATE TABLE `document_contents` (
	`document_id` text PRIMARY KEY NOT NULL,
	`bytes` blob NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`titre` text NOT NULL,
	`categorie` text NOT NULL,
	`file_name` text NOT NULL,
	`mime` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`doc_date` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "documents_categorie_check" CHECK("categorie" IN ('imagerie', 'compte_rendu', 'courrier', 'ordonnance', 'administratif', 'photo', 'autre')),
	CONSTRAINT "documents_size_check" CHECK("documents"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE INDEX `documents_patient_idx` ON `documents` (`patient_id`);