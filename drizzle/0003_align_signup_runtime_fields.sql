ALTER TABLE `signups` ADD `wechat` text;
--> statement-breakpoint
ALTER TABLE `signups` ADD `license_plate` text;
--> statement-breakpoint
ALTER TABLE `signups` ADD `assigned_owner_id` text;
--> statement-breakpoint
CREATE INDEX `signups_assigned_owner_id_idx` ON `signups` (`assigned_owner_id`);
