import { boolean, char, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// Local credentials are deliberately separate from the legacy `users.email`
// field. A matching email never silently merges an independently registered
// account into an imported account.
export const authCredentials = mysqlTable("authCredentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  emailNormalized: varchar("emailNormalized", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 128 }).notNull(),
  passwordSalt: varchar("passwordSalt", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const authSessions = mysqlTable("authSessions", {
  id: char("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: char("tokenHash", { length: 64 }).notNull().unique(),
  csrfHash: char("csrfHash", { length: 64 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("authSessions_user_idx").on(table.userId),
  index("authSessions_expiry_idx").on(table.expiresAt),
]);

export const learnerProfiles = mysqlTable("learnerProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  countryCode: varchar("countryCode", { length: 8 }).default("GLOBAL").notNull(),
  preferredLanguage: varchar("preferredLanguage", { length: 64 }).default("English").notNull(),
  educationLevel: varchar("educationLevel", { length: 96 }),
  qualification: varchar("qualification", { length: 128 }),
  fieldOfStudy: varchar("fieldOfStudy", { length: 160 }),
  yearOfStudy: varchar("yearOfStudy", { length: 64 }),
  currentRole: varchar("currentRole", { length: 160 }),
  experienceYears: int("experienceYears").default(0).notNull(),
  targetCareer: varchar("targetCareer", { length: 120 }),
  preferredIndustries: text("preferredIndustries"),
  workStyle: varchar("workStyle", { length: 64 }),
  workLocation: varchar("workLocation", { length: 128 }),
  remotePreference: varchar("remotePreference", { length: 64 }),
  onboardingComplete: boolean("onboardingComplete").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const learnerSkills = mysqlTable("learnerSkills", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  level: mysqlEnum("level", ["Foundational", "Developing", "Proficient", "Advanced"]).default("Foundational").notNull(),
  confidence: mysqlEnum("confidence", ["Self Reported", "Assessment Verified", "Project Verified"]).default("Self Reported").notNull(),
  assessmentScore: int("assessmentScore"),
  projectCount: int("projectCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("learnerSkills_user_skill_idx").on(table.userId, table.name)]);

export const roadmapProgress = mysqlTable("roadmapProgress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  careerSlug: varchar("careerSlug", { length: 120 }).notNull(),
  milestoneId: varchar("milestoneId", { length: 120 }).notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("roadmapProgress_user_milestone_idx").on(table.userId, table.milestoneId)]);

export const learnerAchievements = mysqlTable("learnerAchievements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description"),
  achievedAt: timestamp("achievedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("learnerAchievements_user_created_idx").on(table.userId, table.createdAt)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AuthCredential = typeof authCredentials.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;
export type LearnerProfile = typeof learnerProfiles.$inferSelect;
export type InsertLearnerProfile = typeof learnerProfiles.$inferInsert;
export type LearnerSkillRecord = typeof learnerSkills.$inferSelect;
export type InsertLearnerSkill = typeof learnerSkills.$inferInsert;
export type RoadmapProgress = typeof roadmapProgress.$inferSelect;
export type LearnerAchievement = typeof learnerAchievements.$inferSelect;
