CREATE TABLE `signups` (
  `id` text PRIMARY KEY NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `status` text DEFAULT '待匹配' NOT NULL,
  `name` text NOT NULL,
  `phone` text NOT NULL,
  `role` text NOT NULL,
  `gender` text,
  `age` text,
  `zodiac` text,
  `work` text NOT NULL,
  `home` text NOT NULL,
  `pickup` text,
  `vehicle` text,
  `seats` integer DEFAULT 0 NOT NULL,
  `note` text,
  `interests_json` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signups_phone_unique` ON `signups` (`phone`);
--> statement-breakpoint
CREATE INDEX `signups_created_at_idx` ON `signups` (`created_at`);
--> statement-breakpoint
CREATE INDEX `signups_role_idx` ON `signups` (`role`);
