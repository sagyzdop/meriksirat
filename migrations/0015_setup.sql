ALTER TABLE `settings` ADD `club_code` text;
ALTER TABLE `user` ADD `is_member` integer DEFAULT false NOT NULL;
UPDATE `user` SET `is_member` = 1 WHERE `onboarding_complete` = 1;
