ALTER TABLE `overseas_assets` MODIFY COLUMN `type` enum('character','scene','prop','costume') NOT NULL DEFAULT 'character';--> statement-breakpoint
ALTER TABLE `script_shots` MODIFY COLUMN `videoEngine` enum('seedance_1_5','seedance_2_0','veo_3_1','kling_3_0','kling_3_0_omni','runway_gen4','hailuo_2_3','grok_video_3','sora_2_pro','wan2_6');--> statement-breakpoint
ALTER TABLE `video_jobs` MODIFY COLUMN `engine` enum('seedance_1_5','seedance_2_0','veo_3_1','kling_3_0','kling_3_0_omni','runway_gen4','hailuo_2_3','grok_video_3','sora_2_pro','wan2_6') NOT NULL;--> statement-breakpoint
ALTER TABLE `overseas_assets` ADD `stylePrompt` text;--> statement-breakpoint
ALTER TABLE `overseas_assets` ADD `styleImageUrl` text;--> statement-breakpoint
ALTER TABLE `overseas_assets` ADD `styleModel` varchar(64);--> statement-breakpoint
ALTER TABLE `overseas_assets` ADD `mainModel` varchar(64);--> statement-breakpoint
ALTER TABLE `overseas_assets` ADD `viewCloseUpUrl` text;--> statement-breakpoint
ALTER TABLE `overseas_assets` ADD `multiAngleGridUrl` text;--> statement-breakpoint
ALTER TABLE `overseas_assets` ADD `referenceImageUrl` text;--> statement-breakpoint
ALTER TABLE `overseas_assets` ADD `resolution` varchar(32);--> statement-breakpoint
ALTER TABLE `overseas_assets` ADD `aspectRatio_asset` varchar(16);--> statement-breakpoint
ALTER TABLE `overseas_projects` ADD `imageEngine` varchar(64) DEFAULT 'gemini_3_pro_image';--> statement-breakpoint
ALTER TABLE `overseas_projects` ADD `videoEngine_proj` enum('seedance_1_5','seedance_2_0','veo_3_1','kling_3_0','kling_3_0_omni','runway_gen4','hailuo_2_3','grok_video_3','sora_2_pro','wan2_6') DEFAULT 'seedance_1_5';--> statement-breakpoint
ALTER TABLE `script_shots` ADD `imageEngine_shot` varchar(64);--> statement-breakpoint
ALTER TABLE `script_shots` ADD `subjectRefUrls` text;