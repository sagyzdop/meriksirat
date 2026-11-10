CREATE TABLE `album_listing` (
	`album_id` text NOT NULL,
	`key` text NOT NULL,
	`folder_id` text NOT NULL,
	`stamp` text NOT NULL,
	`status` text NOT NULL,
	`listed_at` integer,
	`failed_at` integer,
	`files` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`album_id`, `key`),
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE cascade
);
