CREATE TABLE `photo` (
	`album_id` text NOT NULL,
	`source_key` text NOT NULL,
	`file_id` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`md5` text,
	`meta` text NOT NULL,
	PRIMARY KEY(`album_id`, `source_key`, `file_id`),
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photo_albumId_fileId_idx` ON `photo` (`album_id`,`file_id`);--> statement-breakpoint
CREATE TABLE `photo_source` (
	`album_id` text NOT NULL,
	`key` text NOT NULL,
	`folder_id` text NOT NULL,
	`stamp` text NOT NULL,
	`status` text NOT NULL,
	`listed_at` integer,
	`failed_at` integer,
	PRIMARY KEY(`album_id`, `key`),
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DELETE FROM `app_state` WHERE `key` LIKE 'album:list:%' OR `key` LIKE 'album:detail:%';--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_app_state` (
	`key` text NOT NULL,
	`part` integer DEFAULT 0 NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer,
	PRIMARY KEY(`key`, `part`)
);
--> statement-breakpoint
INSERT INTO `__new_app_state`("key", "part", "value", "expires_at") SELECT "key", "part", "value", "expires_at" FROM `app_state`;--> statement-breakpoint
DROP TABLE `app_state`;--> statement-breakpoint
ALTER TABLE `__new_app_state` RENAME TO `app_state`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `app_state_expiresAt_idx` ON `app_state` (`expires_at`);--> statement-breakpoint
ALTER TABLE `album` ADD `folder_state` text DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE `album` ADD `photos_checked_at` integer;