ALTER TABLE `signups` ADD `modifications_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `signups` ADD `modification_other` text;
--> statement-breakpoint
ALTER TABLE `signups` ADD `deposit_status` text DEFAULT '待支付' NOT NULL;
