CREATE TABLE `video_segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`episodeNumber` int NOT NULL,
	`segmentNumber` int NOT NULL,
	`title` varchar(128),
	`shotIds` text NOT NULL,
	`duration` int NOT NULL DEFAULT 15,
	`prompt` text,
	`referenceAssetIds` text,
	`referenceImageUrls` text,
	`videoUrl` text,
	`status` enum('draft','prompt_ready','generating_video','done','failed') NOT NULL DEFAULT 'draft',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_segments_id` PRIMARY KEY(`id`)
);
