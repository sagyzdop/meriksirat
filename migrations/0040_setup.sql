CREATE TABLE `album_favorite` (
	`user_id` text NOT NULL,
	`album_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `album_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `album_favorite_albumId_idx` ON `album_favorite` (`album_id`);--> statement-breakpoint
CREATE TABLE `buffer_grant` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`refresh_token` text NOT NULL,
	`scopes` text NOT NULL,
	`status` text NOT NULL,
	`state` text DEFAULT 'ok' NOT NULL,
	`state_changed_at` integer,
	`alerted_state` text,
	`retire_after` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buffer_grant_one_active_idx` ON `buffer_grant` (`status`) WHERE "buffer_grant"."status" IN ('active', 'pending');--> statement-breakpoint
ALTER TABLE `album` ADD `heart_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `volume` ADD `number` integer;--> statement-breakpoint
ALTER TABLE `volume` ADD `buffer_grant_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `volume_albumId_number_idx` ON `volume` (`album_id`,`number`) WHERE "volume"."number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `volume_bufferGrantId_idx` ON `volume` (`buffer_grant_id`);