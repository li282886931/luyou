ALTER TABLE `media_assets` ADD `focus_x` real DEFAULT 0.5 NOT NULL;
--> statement-breakpoint
ALTER TABLE `media_assets` ADD `focus_y` real DEFAULT 0.5 NOT NULL;
--> statement-breakpoint
ALTER TABLE `media_assets` ADD `cover_score` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `media_assets` ADD `crop_suggestions_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `match_assignments` ADD `route_distance_km` real;
--> statement-breakpoint
CREATE TABLE `signup_locations` (
  `signup_id` text PRIMARY KEY NOT NULL,
  `activity_id` text NOT NULL,
  `home_lat` real,
  `home_lng` real,
  `pickup_lat` real,
  `pickup_lng` real,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `signup_locations_activity_idx` ON `signup_locations` (`activity_id`);
--> statement-breakpoint
CREATE TABLE `signup_operations` (
  `id` text PRIMARY KEY NOT NULL,
  `activity_id` text NOT NULL,
  `signup_id` text NOT NULL,
  `type` text NOT NULL,
  `status` text NOT NULL,
  `amount` integer DEFAULT 0 NOT NULL,
  `note` text DEFAULT '' NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `signup_operations_activity_type_idx` ON `signup_operations` (`activity_id`, `type`, `created_at`);
--> statement-breakpoint
CREATE TABLE `content_generations` (
  `id` text PRIMARY KEY NOT NULL,
  `activity_id` text NOT NULL,
  `input_json` text NOT NULL,
  `variants_json` text NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `content_generations_activity_idx` ON `content_generations` (`activity_id`, `created_at`);
