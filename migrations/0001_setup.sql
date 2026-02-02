CREATE TABLE `booking` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`equipment_id` integer NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`gcal_event_id` text,
	`user_event_details` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `category` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_name_unique` ON `category` (`name`);--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_name` text NOT NULL,
	`description` text,
	`category_id` integer,
	`gcal_id` text NOT NULL,
	`required_clearance_level` integer DEFAULT 1,
	`image_path` text,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_gcal_id_unique` ON `equipment` (`gcal_id`);--> statement-breakpoint
CREATE TABLE `telegram_link_token` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `user` ADD `telegram_chat_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `telegram_username` text;--> statement-breakpoint
ALTER TABLE `user` ADD `instagram_username` text;--> statement-breakpoint
ALTER TABLE `user` ADD `google_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `nu_id` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `first_name` text;--> statement-breakpoint
ALTER TABLE `user` ADD `last_name` text;--> statement-breakpoint
ALTER TABLE `user` ADD `birthday` text;--> statement-breakpoint
ALTER TABLE `user` ADD `major` text;--> statement-breakpoint
ALTER TABLE `user` ADD `graduation_year` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `status` text DEFAULT 'Active';--> statement-breakpoint
ALTER TABLE `user` ADD `clearance_level` integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `user` ADD `onboarding_complete` integer DEFAULT false;--> statement-breakpoint
CREATE UNIQUE INDEX `user_google_id_unique` ON `user` (`google_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_nu_id_unique` ON `user` (`nu_id`);