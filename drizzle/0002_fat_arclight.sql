CREATE TABLE `learnerProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`countryCode` varchar(8) NOT NULL DEFAULT 'GLOBAL',
	`preferredLanguage` varchar(64) NOT NULL DEFAULT 'English',
	`educationLevel` varchar(96),
	`qualification` varchar(128),
	`fieldOfStudy` varchar(160),
	`yearOfStudy` varchar(64),
	`currentRole` varchar(160),
	`experienceYears` int NOT NULL DEFAULT 0,
	`targetCareer` varchar(120),
	`preferredIndustries` text,
	`workStyle` varchar(64),
	`workLocation` varchar(128),
	`remotePreference` varchar(64),
	`onboardingComplete` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learnerProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `learnerProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `learnerSkills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`level` enum('Foundational','Developing','Proficient','Advanced') NOT NULL DEFAULT 'Foundational',
	`confidence` enum('Self Reported','Assessment Verified','Project Verified') NOT NULL DEFAULT 'Self Reported',
	`assessmentScore` int,
	`projectCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learnerSkills_id` PRIMARY KEY(`id`),
	CONSTRAINT `learnerSkills_user_skill_idx` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `roadmapProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`careerSlug` varchar(120) NOT NULL,
	`milestoneId` varchar(120) NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roadmapProgress_id` PRIMARY KEY(`id`),
	CONSTRAINT `roadmapProgress_user_milestone_idx` UNIQUE(`userId`,`milestoneId`)
);
--> statement-breakpoint
ALTER TABLE `learnerProfiles` ADD CONSTRAINT `learnerProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learnerSkills` ADD CONSTRAINT `learnerSkills_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roadmapProgress` ADD CONSTRAINT `roadmapProgress_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;