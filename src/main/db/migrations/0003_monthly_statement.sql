CREATE TABLE `monthly_statements` (
	`month` text PRIMARY KEY NOT NULL,
	`overrides` text DEFAULT '{}' NOT NULL,
	`exceptional` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `seances` ADD `paiement_recu_le` text;