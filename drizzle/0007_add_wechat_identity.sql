CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `phone` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `users_phone_idx` ON `users` (`phone`);
--> statement-breakpoint
CREATE TABLE `wechat_identities` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `openid` text NOT NULL,
  `unionid` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wechat_identities_openid_unique` ON `wechat_identities` (`openid`);
--> statement-breakpoint
CREATE INDEX `wechat_identities_user_id_idx` ON `wechat_identities` (`user_id`);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `token_hash` text NOT NULL,
  `expires_at` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_token_hash_unique` ON `user_sessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `user_sessions_user_expires_idx` ON `user_sessions` (`user_id`, `expires_at`);
--> statement-breakpoint
CREATE TABLE `subscription_grants` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `template_id` text NOT NULL,
  `status` text NOT NULL,
  `template_version` text NOT NULL DEFAULT '',
  `granted_at` text,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_grants_user_template_unique` ON `subscription_grants` (`user_id`, `template_id`);
--> statement-breakpoint
CREATE INDEX `subscription_grants_status_idx` ON `subscription_grants` (`status`, `updated_at`);
