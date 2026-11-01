ALTER TABLE `flamekeeper` ADD `drain_admin_started_at` integer;--> statement-breakpoint
ALTER TABLE `flamekeeper` ADD `drain_admin_reminded_at` integer;--> statement-breakpoint
ALTER TABLE `flamekeeper` ADD `health_cursor` text;--> statement-breakpoint
ALTER TABLE `volume` ADD `dropped_at` integer;
