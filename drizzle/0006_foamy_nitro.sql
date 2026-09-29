CREATE TABLE `passwordResetTokens` (
	`id` char(36) NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` char(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `passwordResetTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `passwordResetTokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `passwordResetTokens` ADD CONSTRAINT `passwordResetTokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `passwordResetTokens_user_idx` ON `passwordResetTokens` (`userId`);--> statement-breakpoint
CREATE INDEX `passwordResetTokens_expiry_idx` ON `passwordResetTokens` (`expiresAt`);