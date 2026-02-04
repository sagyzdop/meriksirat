CREATE INDEX `booking_userId_idx` ON `booking` (`user_id`);--> statement-breakpoint
CREATE INDEX `booking_equipmentId_idx` ON `booking` (`equipment_id`);--> statement-breakpoint
CREATE INDEX `booking_status_idx` ON `booking` (`status`);--> statement-breakpoint
CREATE INDEX `booking_startTime_idx` ON `booking` (`start_time`);--> statement-breakpoint
CREATE INDEX `booking_endTime_idx` ON `booking` (`end_time`);--> statement-breakpoint
CREATE INDEX `equipment_categoryId_idx` ON `equipment` (`category_id`);--> statement-breakpoint
CREATE INDEX `equipment_isActive_idx` ON `equipment` (`is_active`);