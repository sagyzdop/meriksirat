ALTER TABLE `user` ADD `terms_accepted_at` integer;--> statement-breakpoint
UPDATE `user` SET `terms_accepted_at` = `created_at` WHERE `is_member` = 1;
