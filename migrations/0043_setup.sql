DROP INDEX `photo_albumId_fileId_idx`;--> statement-breakpoint
CREATE INDEX `album_createdAt_id_idx` ON `album` (`created_at`,`id`);--> statement-breakpoint
DELETE FROM `photo` WHERE `source_key` = 'buffer';--> statement-breakpoint
DELETE FROM `photo_source` WHERE `key` = 'buffer';
