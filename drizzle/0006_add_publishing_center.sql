CREATE TABLE `posts` (
  `id` text PRIMARY KEY NOT NULL,
  `activity_id` text NOT NULL,
  `type` text NOT NULL,
  `title` text NOT NULL,
  `content_json` text DEFAULT '{}' NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `version` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `published_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_activity_type_version_unique` ON `posts` (`activity_id`, `type`, `version`);
--> statement-breakpoint
CREATE INDEX `posts_activity_status_published_idx` ON `posts` (`activity_id`, `status`, `published_at`);
--> statement-breakpoint
CREATE TABLE `media_assets` (
  `id` text PRIMARY KEY NOT NULL,
  `activity_id` text NOT NULL,
  `storage_path` text NOT NULL,
  `name` text NOT NULL,
  `mime_type` text NOT NULL,
  `size` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'uploaded' NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_assets_activity_status_idx` ON `media_assets` (`activity_id`, `status`, `created_at`);
--> statement-breakpoint
CREATE TABLE `post_media` (
  `post_id` text NOT NULL,
  `media_asset_id` text NOT NULL,
  `role` text DEFAULT 'gallery' NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  PRIMARY KEY (`post_id`, `media_asset_id`)
);
--> statement-breakpoint
CREATE INDEX `post_media_post_order_idx` ON `post_media` (`post_id`, `sort_order`);
