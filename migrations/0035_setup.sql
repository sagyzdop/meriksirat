PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_favorite` (
	`user_id` text NOT NULL,
	`album_id` text NOT NULL,
	`drive_file_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `album_id`, `drive_file_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_favorite`("user_id", "album_id", "drive_file_id", "created_at") SELECT f."user_id", p."album_id", p."drive_file_id", f."created_at" FROM `favorite` f INNER JOIN `photo` p ON p."id" = f."photo_id";--> statement-breakpoint
DROP TABLE `favorite`;--> statement-breakpoint
ALTER TABLE `__new_favorite` RENAME TO `favorite`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `favorite_albumId_driveFileId_idx` ON `favorite` (`album_id`,`drive_file_id`);--> statement-breakpoint
UPDATE `album` SET `favorite_count` = (SELECT COUNT(*) FROM `favorite` WHERE `favorite`.`album_id` = `album`.`id`);
