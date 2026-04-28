ALTER TABLE `overseas_projects` MODIFY COLUMN `projectType` enum('premium','batch') NOT NULL DEFAULT 'premium';--> statement-breakpoint
ALTER TABLE `overseas_projects` MODIFY COLUMN `videoEngine_proj` enum('seedance_1_5','seedance_2_0','veo_3_1','kling_3_0','kling_3_0_omni','runway_gen4','hailuo_2_3','grok_video_3','sora_2_pro','wan2_6') DEFAULT 'seedance_2_0';--> statement-breakpoint
ALTER TABLE `overseas_projects` ADD `definition` text;--> statement-breakpoint
ALTER TABLE `overseas_assets` MODIFY COLUMN `type` enum('character','scene','prop','costume','storyboard','camera_diagram','custom') NOT NULL DEFAULT 'character';--> statement-breakpoint
ALTER TABLE `script_shots` ADD `storyboardPrompt` text;--> statement-breakpoint
ALTER TABLE `script_shots` ADD `storyboardSketchUrl` text;--> statement-breakpoint
ALTER TABLE `script_shots` ADD `cameraDiagramPrompt` text;--> statement-breakpoint
ALTER TABLE `script_shots` ADD `cameraDiagramUrl` text;
