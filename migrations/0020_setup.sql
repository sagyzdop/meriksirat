ALTER TABLE `flamekeeper` ADD `drain_reason` text;
--> statement-breakpoint
ALTER TABLE `flamekeeper` ADD `drain_reminder_sent_at` integer;
--> statement-breakpoint
UPDATE `flamekeeper` SET `drain_reason` = 'pledge' WHERE `state` = 'draining';
