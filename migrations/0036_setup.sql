DROP TABLE `photo`;--> statement-breakpoint
DROP TABLE `upload_reservation`;--> statement-breakpoint
ALTER TABLE `album` DROP COLUMN `photos_indexed_at`;--> statement-breakpoint
ALTER TABLE `album` DROP COLUMN `photos_index_requested_at`;--> statement-breakpoint
ALTER TABLE `album` DROP COLUMN `photos_index_skipped`;--> statement-breakpoint
ALTER TABLE `flamekeeper` DROP COLUMN `draining_deadline`;--> statement-breakpoint
ALTER TABLE `flamekeeper` DROP COLUMN `drain_reason`;--> statement-breakpoint
ALTER TABLE `flamekeeper` DROP COLUMN `drain_reminder_sent_at`;--> statement-breakpoint
ALTER TABLE `flamekeeper` DROP COLUMN `drain_admin_started_at`;--> statement-breakpoint
ALTER TABLE `flamekeeper` DROP COLUMN `drain_admin_reminded_at`;--> statement-breakpoint
ALTER TABLE `flamekeeper` DROP COLUMN `health_cursor`;--> statement-breakpoint
ALTER TABLE `flamekeeper` DROP COLUMN `leaderboard_anonymous`;--> statement-breakpoint
ALTER TABLE `volume` DROP COLUMN `release_blocked_at`;--> statement-breakpoint
ALTER TABLE `volume` DROP COLUMN `release_blocked_since`;--> statement-breakpoint
ALTER TABLE `volume` DROP COLUMN `release_alerted_at`;