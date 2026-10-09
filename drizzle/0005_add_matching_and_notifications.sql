CREATE TABLE `match_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `activity_id` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `algorithm_version` text NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text NOT NULL,
  `confirmed_at` text
);
--> statement-breakpoint
CREATE INDEX `match_runs_activity_status_idx` ON `match_runs` (`activity_id`, `status`, `created_at`);
--> statement-breakpoint
CREATE TABLE `match_assignments` (
  `id` text PRIMARY KEY NOT NULL,
  `match_run_id` text NOT NULL,
  `activity_id` text NOT NULL,
  `owner_signup_id` text DEFAULT '' NOT NULL,
  `rider_signup_id` text NOT NULL,
  `score` integer DEFAULT 0 NOT NULL,
  `reasons_json` text DEFAULT '[]' NOT NULL,
  `source` text DEFAULT 'automatic' NOT NULL,
  `locked` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_assignments_run_rider_unique` ON `match_assignments` (`match_run_id`, `rider_signup_id`);
--> statement-breakpoint
CREATE INDEX `match_assignments_activity_owner_idx` ON `match_assignments` (`activity_id`, `owner_signup_id`);
--> statement-breakpoint
CREATE TABLE `participant_capabilities` (
  `id` text PRIMARY KEY NOT NULL,
  `activity_id` text NOT NULL,
  `signup_id` text NOT NULL,
  `token_hash` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_capabilities_activity_signup_unique` ON `participant_capabilities` (`activity_id`, `signup_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_capabilities_token_hash_unique` ON `participant_capabilities` (`token_hash`);
--> statement-breakpoint
CREATE TABLE `notifications` (
  `id` text PRIMARY KEY NOT NULL,
  `activity_id` text NOT NULL,
  `signup_id` text NOT NULL,
  `match_run_id` text NOT NULL,
  `type` text NOT NULL,
  `channel` text DEFAULT 'in_app' NOT NULL,
  `payload_json` text DEFAULT '{}' NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `last_error` text,
  `sent_at` text,
  `dedupe_key` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe_key_unique` ON `notifications` (`dedupe_key`);
--> statement-breakpoint
CREATE INDEX `notifications_signup_created_idx` ON `notifications` (`signup_id`, `created_at`);
