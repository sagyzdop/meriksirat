DELETE FROM `album` WHERE `tombstone_reason` IN ('expired', 'no_space');--> statement-breakpoint
UPDATE `album` SET `event_date` = coalesce(`event_date`, `created_at`) WHERE `event_date` IS NULL;--> statement-breakpoint
DELETE FROM `album_member` WHERE `album_id` NOT IN (SELECT `id` FROM `album`);--> statement-breakpoint
DELETE FROM `favorite` WHERE `album_id` NOT IN (SELECT `id` FROM `album`);--> statement-breakpoint
DELETE FROM `volume` WHERE `album_id` NOT IN (SELECT `id` FROM `album`);--> statement-breakpoint
CREATE TABLE `_bak_album_member` AS SELECT * FROM `album_member`;--> statement-breakpoint
CREATE TABLE `_bak_favorite` AS SELECT * FROM `favorite`;--> statement-breakpoint
CREATE TABLE `_bak_volume` AS SELECT * FROM `volume`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_album` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '',
	`drive_folder_id` text NOT NULL,
	`cover_file_id` text,
	`photo_count` integer DEFAULT 0 NOT NULL,
	`photo_bytes` integer DEFAULT 0 NOT NULL,
	`favorite_count` integer DEFAULT 0 NOT NULL,
	`tombstone_reason` text,
	`deleted_at` integer,
	`rescued_at` integer,
	`scheduled_deletion_at` integer,
	`edit_share_token` text NOT NULL,
	`event` text DEFAULT '' NOT NULL,
	`event_date` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_album`("id", "owner_user_id", "title", "description", "drive_folder_id", "cover_file_id", "photo_count", "photo_bytes", "favorite_count", "tombstone_reason", "deleted_at", "rescued_at", "scheduled_deletion_at", "edit_share_token", "event", "event_date", "created_at", "updated_at") SELECT "id", "owner_user_id", "title", "description", "drive_folder_id", "cover_file_id", "photo_count", "photo_bytes", "favorite_count", "tombstone_reason", "deleted_at", NULL, NULL, "edit_share_token", "event", "event_date", "created_at", "updated_at" FROM `album`;--> statement-breakpoint
DROP TABLE `album`;--> statement-breakpoint
ALTER TABLE `__new_album` RENAME TO `album`;--> statement-breakpoint
DELETE FROM `album_member`;--> statement-breakpoint
DELETE FROM `favorite`;--> statement-breakpoint
DELETE FROM `volume`;--> statement-breakpoint
INSERT INTO `album_member` SELECT * FROM `_bak_album_member`;--> statement-breakpoint
INSERT INTO `favorite` SELECT * FROM `_bak_favorite`;--> statement-breakpoint
INSERT INTO `volume` SELECT * FROM `_bak_volume`;--> statement-breakpoint
DROP TABLE `_bak_album_member`;--> statement-breakpoint
DROP TABLE `_bak_favorite`;--> statement-breakpoint
DROP TABLE `_bak_volume`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `album_drive_folder_id_unique` ON `album` (`drive_folder_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `album_edit_share_token_unique` ON `album` (`edit_share_token`);--> statement-breakpoint
CREATE INDEX `album_ownerUserId_idx` ON `album` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `album_scheduledDeletionAt_idx` ON `album` (`scheduled_deletion_at`);--> statement-breakpoint
ALTER TABLE `settings` ADD `buffer_limit_bytes` integer DEFAULT 5497558138880 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `buffer_alert_percent` integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `album_deletion_notice_days` integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `pool_low_alert_percent` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `lost_grace_days` integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `graduation_prompt_days` integer DEFAULT 60 NOT NULL;