DROP INDEX `volume_albumId_flamekeeperUserId_idx`;--> statement-breakpoint
DROP INDEX `volume_albumId_buffer_idx`;--> statement-breakpoint
CREATE INDEX `volume_albumId_flamekeeperUserId_idx` ON `volume` (`album_id`,`flamekeeper_user_id`);--> statement-breakpoint
CREATE INDEX `volume_albumId_buffer_idx` ON `volume` (`album_id`) WHERE "volume"."flamekeeper_user_id" IS NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` text PRIMARY KEY DEFAULT 'global' NOT NULL,
	`global_booking_note` text DEFAULT '',
	`club_code` text,
	`flamekeeper_cap_bytes` integer DEFAULT 21474836480 NOT NULL,
	`pool_low_alerted_at` integer,
	`buffer_limit_bytes` integer DEFAULT 5497558138880 NOT NULL,
	`buffer_alert_percent` integer DEFAULT 90 NOT NULL,
	`album_deletion_notice_days` integer DEFAULT 14 NOT NULL,
	`pool_low_alert_percent` integer DEFAULT 90 NOT NULL,
	`lost_grace_days` integer DEFAULT 7 NOT NULL,
	`graduation_prompt_days` integer DEFAULT 60 NOT NULL,
	`birthdays_calendar_id` text,
	`operating_hours_start` integer DEFAULT 0,
	`operating_hours_end` integer DEFAULT 1439,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "global_booking_note", "club_code", "flamekeeper_cap_bytes", "pool_low_alerted_at", "buffer_limit_bytes", "buffer_alert_percent", "album_deletion_notice_days", "pool_low_alert_percent", "lost_grace_days", "graduation_prompt_days", "birthdays_calendar_id", "operating_hours_start", "operating_hours_end", "created_at", "updated_at") SELECT "id", "global_booking_note", "club_code", "flamekeeper_cap_bytes", "pool_low_alerted_at", "buffer_limit_bytes", "buffer_alert_percent", "album_deletion_notice_days", "pool_low_alert_percent", "lost_grace_days", "graduation_prompt_days", "birthdays_calendar_id", "operating_hours_start", "operating_hours_end", "created_at", "updated_at" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
UPDATE `settings` SET `pool_low_alert_percent` = 100 - `pool_low_alert_percent`;
--> statement-breakpoint
UPDATE `user` SET `status` = 'Active' WHERE `status` NOT IN ('Active','Inactive','Alumni');
