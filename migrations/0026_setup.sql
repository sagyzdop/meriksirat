ALTER TABLE `album` ADD `public_notice_pending_at` integer;--> statement-breakpoint
UPDATE `album` SET `public_notice_pending_at` = cast(unixepoch('subsecond') * 1000 as integer) WHERE coalesce(`is_shared`, 0) = 0 AND `deleted_at` IS NULL;--> statement-breakpoint
DROP INDEX `album_isShared_idx`;--> statement-breakpoint
ALTER TABLE `album` DROP COLUMN `is_shared`;
