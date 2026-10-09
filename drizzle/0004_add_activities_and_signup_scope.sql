CREATE TABLE `signups_next` (
  `id` text PRIMARY KEY NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `status` text DEFAULT '待匹配' NOT NULL,
  `signup_status` text DEFAULT '已报名' NOT NULL,
  `activity_id` text DEFAULT 'legacy-main' NOT NULL,
  `user_id` text,
  `name` text NOT NULL,
  `phone` text NOT NULL,
  `wechat` text,
  `role` text NOT NULL,
  `gender` text,
  `age` text,
  `zodiac` text,
  `work` text NOT NULL,
  `home` text NOT NULL,
  `pickup` text,
  `vehicle` text,
  `license_plate` text,
  `seats` integer DEFAULT 0 NOT NULL,
  `note` text,
  `smoking` text DEFAULT '不吸烟' NOT NULL,
  `accepts_smoking` text DEFAULT '不接受' NOT NULL,
  `room_type` text DEFAULT '单间' NOT NULL,
  `modifications_json` text DEFAULT '[]' NOT NULL,
  `modification_other` text,
  `deposit_status` text DEFAULT '待支付' NOT NULL,
  `interests_json` text DEFAULT '[]' NOT NULL,
  `assigned_owner_id` text,
  `contact_consent` integer DEFAULT 0 NOT NULL,
  `notification_consent` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `signups_next` (
  `id`, `created_at`, `updated_at`, `status`, `name`, `phone`, `wechat`,
  `role`, `gender`, `age`, `zodiac`, `work`, `home`, `pickup`, `vehicle`,
  `license_plate`, `seats`, `note`, `smoking`, `accepts_smoking`,
  `room_type`, `modifications_json`, `modification_other`,
  `deposit_status`, `interests_json`, `assigned_owner_id`
)
SELECT
  `id`, `created_at`, `updated_at`, `status`, `name`, `phone`, `wechat`,
  `role`, `gender`, `age`, `zodiac`, `work`, `home`, `pickup`, `vehicle`,
  `license_plate`, `seats`, `note`, `smoking`, `accepts_smoking`,
  `room_type`, `modifications_json`, `modification_other`,
  `deposit_status`, `interests_json`, `assigned_owner_id`
FROM `signups`;
--> statement-breakpoint
DROP TABLE `signups`;
--> statement-breakpoint
ALTER TABLE `signups_next` RENAME TO `signups`;
--> statement-breakpoint
CREATE UNIQUE INDEX `signups_activity_phone_unique` ON `signups` (`activity_id`, `phone`);
--> statement-breakpoint
CREATE INDEX `signups_created_at_idx` ON `signups` (`created_at`);
--> statement-breakpoint
CREATE INDEX `signups_role_idx` ON `signups` (`role`);
--> statement-breakpoint
CREATE INDEX `signups_activity_id_idx` ON `signups` (`activity_id`);
--> statement-breakpoint
CREATE INDEX `signups_assigned_owner_id_idx` ON `signups` (`assigned_owner_id`);
--> statement-breakpoint
CREATE TABLE `activities` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `date_text` text NOT NULL,
  `start_at` text,
  `end_at` text,
  `route` text NOT NULL,
  `timeline_json` text DEFAULT '[]' NOT NULL,
  `notice` text DEFAULT '' NOT NULL,
  `summary` text DEFAULT '' NOT NULL,
  `cover_url` text DEFAULT '' NOT NULL,
  `media_json` text DEFAULT '[]' NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `signup_open` integer DEFAULT 1 NOT NULL,
  `capacity` integer DEFAULT 0 NOT NULL,
  `published_version` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `published_at` text
);
--> statement-breakpoint
CREATE INDEX `activities_status_published_at_idx` ON `activities` (`status`, `published_at`);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `admin_id` text NOT NULL,
  `action` text NOT NULL,
  `resource_type` text NOT NULL,
  `resource_id` text NOT NULL,
  `metadata_json` text DEFAULT '{}' NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_resource_idx` ON `audit_logs` (`resource_type`, `resource_id`, `created_at`);
