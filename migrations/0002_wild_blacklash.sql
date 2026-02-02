PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_booking` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`equipment_id` integer NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`gcal_event_id` text,
	`user_event_details` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_booking`("id", "user_id", "equipment_id", "start_time", "end_time", "status", "gcal_event_id", "user_event_details", "created_at", "updated_at") SELECT "id", "user_id", "equipment_id", "start_time", "end_time", "status", "gcal_event_id", "user_event_details", "created_at", "updated_at" FROM `booking`;--> statement-breakpoint
DROP TABLE `booking`;--> statement-breakpoint
ALTER TABLE `__new_booking` RENAME TO `booking`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `equipment` ADD `short_name` text;