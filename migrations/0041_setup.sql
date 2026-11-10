CREATE TABLE `app_state` (
	`key` text NOT NULL,
	`part` integer DEFAULT 0 NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`key`, `part`)
);
--> statement-breakpoint
CREATE INDEX `app_state_expiresAt_idx` ON `app_state` (`expires_at`);