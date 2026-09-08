ALTER TABLE `learnerAchievements` DROP FOREIGN KEY `learnerAchievements_userId_users_id_fk`;--> statement-breakpoint
ALTER TABLE `learnerAchievements` DROP INDEX `learnerAchievements_user_created_idx`;--> statement-breakpoint
CREATE INDEX `learnerAchievements_user_created_idx` ON `learnerAchievements` (`userId`,`createdAt`);--> statement-breakpoint
ALTER TABLE `learnerAchievements` ADD CONSTRAINT `learnerAchievements_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
