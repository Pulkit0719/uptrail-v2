CREATE TABLE `authCredentials` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `emailNormalized` varchar(320) NOT NULL,
  `passwordHash` varchar(128) NOT NULL,
  `passwordSalt` varchar(64) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `authCredentials_id` PRIMARY KEY (`id`),
  CONSTRAINT `authCredentials_userId_unique` UNIQUE (`userId`),
  CONSTRAINT `authCredentials_emailNormalized_unique` UNIQUE (`emailNormalized`),
  CONSTRAINT `authCredentials_userId_users_id_fk`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `authSessions` (
  `id` char(36) NOT NULL,
  `userId` int NOT NULL,
  `tokenHash` char(64) NOT NULL,
  `csrfHash` char(64) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `revokedAt` timestamp NULL,
  `lastSeenAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `authSessions_id` PRIMARY KEY (`id`),
  CONSTRAINT `authSessions_tokenHash_unique` UNIQUE (`tokenHash`),
  KEY `authSessions_user_idx` (`userId`),
  KEY `authSessions_expiry_idx` (`expiresAt`),
  CONSTRAINT `authSessions_userId_users_id_fk`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `passwordResetTokens` (
  `id` char(36) NOT NULL,
  `userId` int NOT NULL,
  `tokenHash` char(64) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `usedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `passwordResetTokens_id` PRIMARY KEY (`id`),
  CONSTRAINT `passwordResetTokens_tokenHash_unique` UNIQUE (`tokenHash`),
  KEY `passwordResetTokens_user_idx` (`userId`),
  KEY `passwordResetTokens_expiry_idx` (`expiresAt`),
  CONSTRAINT `passwordResetTokens_userId_users_id_fk`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
