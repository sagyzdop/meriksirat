CREATE TABLE `flamekeeper` (
	`user_id` text PRIMARY KEY NOT NULL,
	`pledged_bytes` integer NOT NULL,
	`used_bytes` integer DEFAULT 0 NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`graduation_date` text NOT NULL,
	`graduation_confirmed_at` integer,
	`draining_deadline` integer,
	`lost_since` integer,
	`leaderboard_anonymous` integer DEFAULT false NOT NULL,
	`terms_accepted_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `flamekeeper_state_idx` ON `flamekeeper` (`state`);
--> statement-breakpoint
CREATE TABLE `flamekeeper_grant` (
	`user_id` text PRIMARY KEY NOT NULL,
	`refresh_token` text NOT NULL,
	`scopes` text NOT NULL,
	`last_refresh_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
