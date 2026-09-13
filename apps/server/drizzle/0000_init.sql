CREATE TABLE `device_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` text NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`context` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `device_logs_device_created` ON `device_logs` (`device_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`pairing_code` text,
	`claimed_at` integer,
	`token_hash` text NOT NULL,
	`model` text NOT NULL,
	`android_version` text NOT NULL,
	`app_version` text NOT NULL,
	`screen_width` integer NOT NULL,
	`screen_height` integer NOT NULL,
	`assignment_type` text DEFAULT 'none' NOT NULL,
	`screen_id` text,
	`playlist_id` text,
	`current_screen_id` text,
	`playlist_position` integer DEFAULT 0 NOT NULL,
	`last_seen_at` integer,
	`last_ip` text,
	`status` text DEFAULT '{}' NOT NULL,
	`registered_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`screen_id`) REFERENCES `screens`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`current_screen_id`) REFERENCES `screens`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_pairing_code` ON `devices` (`pairing_code`);--> statement-breakpoint
CREATE TABLE `playlist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`screen_id` text NOT NULL,
	`position` integer NOT NULL,
	`dwell_seconds` integer NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`screen_id`) REFERENCES `screens`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playlist_items_playlist_position` ON `playlist_items` (`playlist_id`,`position`);--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `screens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`html` text NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`generation_prompt` text,
	`data_refresh_seconds` integer DEFAULT 60 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
