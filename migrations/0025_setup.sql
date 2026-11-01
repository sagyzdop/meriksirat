ALTER TABLE `user` ADD `banned_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banned_by` text;--> statement-breakpoint
ALTER TABLE `volume` ADD `writer_revoked_at` integer;
