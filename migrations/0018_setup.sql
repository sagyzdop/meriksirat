ALTER TABLE `album` ADD `expires_at` integer;
ALTER TABLE `album` ADD `pinned` integer DEFAULT false NOT NULL;
ALTER TABLE `album` ADD `tombstone_reason` text;
ALTER TABLE `album` ADD `deleted_at` integer;
ALTER TABLE `album` ADD `expiry_reminder_30_sent_at` integer;
ALTER TABLE `album` ADD `expiry_reminder_7_sent_at` integer;
CREATE INDEX `album_expiresAt_idx` ON `album` (`expires_at`);
UPDATE `album` SET `expires_at` = cast(strftime('%s', coalesce(`event_date`, `created_at`) / 1000, 'unixepoch', '+2 years') as integer) * 1000;
UPDATE `album` SET `expires_at` = (cast(strftime('%s', 'now') as integer) + 30 * 86400) * 1000 WHERE `expires_at` < (cast(strftime('%s', 'now') as integer) + 30 * 86400) * 1000;
