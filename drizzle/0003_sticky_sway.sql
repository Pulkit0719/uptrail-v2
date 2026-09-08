CREATE TABLE `learnerAchievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text,
	`achievedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learnerAchievements_id` PRIMARY KEY(`id`),
	CONSTRAINT `learnerAchievements_user_created_idx` UNIQUE(`userId`,`createdAt`)
);
--> statement-breakpoint
ALTER TABLE `learnerAchievements` ADD CONSTRAINT `learnerAchievements_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;