CREATE TABLE `album` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '',
	`drive_folder_id` text NOT NULL,
	`cover_file_id` text,
	`edit_share_token` text NOT NULL,
	`is_shared` integer DEFAULT false,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `album_drive_folder_id_unique` ON `album` (`drive_folder_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `album_edit_share_token_unique` ON `album` (`edit_share_token`);--> statement-breakpoint
CREATE INDEX `album_ownerUserId_idx` ON `album` (`owner_user_id`);--> statement-breakpoint
CREATE INDEX `album_isShared_idx` ON `album` (`is_shared`);--> statement-breakpoint
CREATE TABLE `album_member` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `album_member_albumId_userId_idx` ON `album_member` (`album_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `album_member_userId_idx` ON `album_member` (`user_id`);