ALTER TABLE `booking` ADD `started_at` integer;--> statement-breakpoint
ALTER TABLE `booking` ADD `start_reminder_sent_at` integer;--> statement-breakpoint
ALTER TABLE `booking` ADD `start_warning_sent_at` integer;--> statement-breakpoint
ALTER TABLE `booking` ADD `return_reminder_sent_at` integer;--> statement-breakpoint
ALTER TABLE `booking` ADD `grace_warning_sent_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `cancelled_in_start_window_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `overdue_count` integer DEFAULT 0 NOT NULL;