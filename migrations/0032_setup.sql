CREATE TABLE `buffer_volume` (
	`album_id` text PRIMARY KEY NOT NULL,
	`drive_folder_id` text,
	`permission_id` text DEFAULT '' NOT NULL,
	`expected_count` integer DEFAULT 0 NOT NULL,
	`expected_bytes` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `album`(`id`) ON UPDATE no action ON DELETE cascade
);
