CREATE TABLE `batchJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'running',
	`total` int NOT NULL DEFAULT 0,
	`current` int NOT NULL DEFAULT 0,
	`currentName` varchar(255) NOT NULL DEFAULT '',
	`succeeded` int NOT NULL DEFAULT 0,
	`failed` int NOT NULL DEFAULT 0,
	`errorMsg` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `batchJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `api_settings`;