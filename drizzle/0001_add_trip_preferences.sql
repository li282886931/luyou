ALTER TABLE `signups` ADD `smoking` text DEFAULT '不吸烟' NOT NULL;
--> statement-breakpoint
ALTER TABLE `signups` ADD `accepts_smoking` text DEFAULT '不接受' NOT NULL;
--> statement-breakpoint
ALTER TABLE `signups` ADD `room_type` text DEFAULT '单间' NOT NULL;
