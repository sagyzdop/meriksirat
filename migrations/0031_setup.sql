ALTER TABLE `user` ADD `graduation_date` text;--> statement-breakpoint
UPDATE `user` SET `graduation_date` = `graduation_year` || '-06-01' WHERE `graduation_year` IS NOT NULL;--> statement-breakpoint
UPDATE `user` SET `graduation_date` = (SELECT `flamekeeper`.`graduation_date` FROM `flamekeeper` WHERE `flamekeeper`.`user_id` = `user`.`id`) WHERE EXISTS (SELECT 1 FROM `flamekeeper` WHERE `flamekeeper`.`user_id` = `user`.`id`);--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `graduation_year`;--> statement-breakpoint
ALTER TABLE `flamekeeper` DROP COLUMN `graduation_date`;
