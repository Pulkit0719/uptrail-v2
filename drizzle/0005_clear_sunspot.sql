CREATE TABLE `authCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`emailNormalized` varchar(320) NOT NULL,
	`passwordHash` varchar(128) NOT NULL,
	`passwordSalt` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `authCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `authCredentials_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `authCredentials_emailNormalized_unique` UNIQUE(`emailNormalized`)
);
--> statement-breakpoint
CREATE TABLE `authSessions` (
	`id` char(36) NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` char(64) NOT NULL,
	`csrfHash` char(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `authSessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `authCredentials` ADD CONSTRAINT `authCredentials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `authSessions` ADD CONSTRAINT `authSessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `authSessions_user_idx` ON `authSessions` (`userId`);--> statement-breakpoint
CREATE INDEX `authSessions_expiry_idx` ON `authSessions` (`expiresAt`);