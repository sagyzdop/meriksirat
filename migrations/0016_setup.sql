CREATE TABLE `favorite` (
	`user_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `photo_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`photo_id`) REFERENCES `photo`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `favorite_photoId_idx` ON `favorite` (`photo_id`);
--> statement-breakpoint
ALTER TABLE `album` ADD `favorite_count` integer DEFAULT 0 NOT NULL;
