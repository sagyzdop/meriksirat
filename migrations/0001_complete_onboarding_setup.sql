CREATE TABLE `telegram_link_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `user` ADD `telegram_chat_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `telegram_username` text;--> statement-breakpoint
ALTER TABLE `user` ADD `google_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `first_name` text;--> statement-breakpoint
ALTER TABLE `user` ADD `last_name` text;--> statement-breakpoint
ALTER TABLE `user` ADD `birthday` text;--> statement-breakpoint
ALTER TABLE `user` ADD `clearance_level` integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `user` ADD `onboarding_complete` integer DEFAULT false;--> statement-breakpoint
CREATE UNIQUE INDEX `user_google_id_unique` ON `user` (`google_id`);