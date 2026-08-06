CREATE TABLE `booking_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`equipment_id` integer NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`gcal_event_id` text,
	`returned_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `booking`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `booking_item_bookingId_idx` ON `booking_item` (`booking_id`);--> statement-breakpoint
CREATE INDEX `booking_item_equipmentId_idx` ON `booking_item` (`equipment_id`);--> statement-breakpoint
CREATE INDEX `booking_item_status_idx` ON `booking_item` (`status`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_booking` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`user_event_details` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_booking`("id", "user_id", "start_time", "end_time", "status", "user_event_details", "created_at", "updated_at") SELECT "id", "user_id", "start_time", "end_time", "status", "user_event_details", "created_at", "updated_at" FROM `booking`;--> statement-breakpoint
DROP TABLE `booking`;--> statement-breakpoint
ALTER TABLE `__new_booking` RENAME TO `booking`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `booking_userId_idx` ON `booking` (`user_id`);--> statement-breakpoint
CREATE INDEX `booking_status_idx` ON `booking` (`status`);--> statement-breakpoint
CREATE INDEX `booking_startTime_idx` ON `booking` (`start_time`);--> statement-breakpoint
CREATE INDEX `booking_endTime_idx` ON `booking` (`end_time`);