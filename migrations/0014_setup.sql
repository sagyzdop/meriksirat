CREATE TABLE `photo` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`drive_file_id` text NOT NULL,
	`name` text NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	`mime_type` text NOT NULL,
	`width` integer,
	`height` integer,
	`captured_at` integer,
	`exif` text,
	`state` text DEFAULT 'live' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photo_albumId_idx` ON `photo` (`album_id`);
CREATE UNIQUE INDEX `photo_driveFileId_idx` ON `photo` (`drive_file_id`);
ALTER TABLE `album` ADD `photo_count` integer DEFAULT 0 NOT NULL;
ALTER TABLE `album` ADD `photo_bytes` integer DEFAULT 0 NOT NULL;
ALTER TABLE `album` ADD `photos_indexed_at` integer;
ALTER TABLE `album` ADD `photos_index_requested_at` integer;
ALTER TABLE `album` ADD `photos_index_skipped` text;
