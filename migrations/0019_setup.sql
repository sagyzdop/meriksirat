ALTER TABLE `photo` ADD `flamekeeper_user_id` text;
--> statement-breakpoint
ALTER TABLE `flamekeeper` ADD `drive_usage_bytes` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `flamekeeper` ADD `drive_usage_checked_at` integer;
--> statement-breakpoint
ALTER TABLE `settings` ADD `flamekeeper_cap_bytes` integer DEFAULT 21474836480 NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD `pool_low_alerted_at` integer;
--> statement-breakpoint
CREATE TABLE `volume` (
	`album_id` text NOT NULL,
	`flamekeeper_user_id` text NOT NULL,
	`permission_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`album_id`, `flamekeeper_user_id`),
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`flamekeeper_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `volume_flamekeeperUserId_idx` ON `volume` (`flamekeeper_user_id`);
--> statement-breakpoint
CREATE TABLE `upload_reservation` (
	`id` text PRIMARY KEY NOT NULL,
	`flamekeeper_user_id` text NOT NULL,
	`album_id` text NOT NULL,
	`bytes` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`flamekeeper_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `upload_reservation_flamekeeperUserId_idx` ON `upload_reservation` (`flamekeeper_user_id`);
