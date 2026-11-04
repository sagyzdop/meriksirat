CREATE TABLE `__new_volume` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`flamekeeper_user_id` text,
	`permission_id` text DEFAULT '' NOT NULL,
	`drive_folder_id` text,
	`dropped_at` integer,
	`expected_count` integer,
	`expected_bytes` integer,
	`expected_changed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`flamekeeper_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_volume`("id", "album_id", "flamekeeper_user_id", "permission_id", "drive_folder_id", "dropped_at", "expected_count", "expected_bytes", "expected_changed_at", "created_at") SELECT lower(hex(randomblob(8))), "album_id", "flamekeeper_user_id", "permission_id", "drive_folder_id", "dropped_at", NULL, NULL, NULL, "created_at" FROM `volume`;--> statement-breakpoint
INSERT INTO `__new_volume`("id", "album_id", "flamekeeper_user_id", "permission_id", "drive_folder_id", "dropped_at", "expected_count", "expected_bytes", "expected_changed_at", "created_at") SELECT lower(hex(randomblob(8))), "album_id", NULL, "permission_id", "drive_folder_id", NULL, "expected_count", "expected_bytes", NULL, "created_at" FROM `buffer_volume`;--> statement-breakpoint
DROP TABLE `volume`;--> statement-breakpoint
DROP TABLE `buffer_volume`;--> statement-breakpoint
ALTER TABLE `__new_volume` RENAME TO `volume`;--> statement-breakpoint
CREATE UNIQUE INDEX `volume_albumId_flamekeeperUserId_idx` ON `volume` (`album_id`,`flamekeeper_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `volume_albumId_buffer_idx` ON `volume` (`album_id`) WHERE "volume"."flamekeeper_user_id" IS NULL;--> statement-breakpoint
CREATE INDEX `volume_flamekeeperUserId_idx` ON `volume` (`flamekeeper_user_id`);
