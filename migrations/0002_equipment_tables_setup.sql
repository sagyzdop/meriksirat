CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`model_name` text NOT NULL,
	`description` text,
	`category_id` text,
	`gcal_id` text NOT NULL,
	`required_clearance_level` integer DEFAULT 1,
	`image_path` text,
	`is_active` integer DEFAULT true,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `equipment_gcal_id_unique` ON `equipment` (`gcal_id`);