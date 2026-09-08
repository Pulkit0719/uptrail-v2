import { and, desc, eq } from "drizzle-orm";
import { learnerAchievements, learnerProfiles, learnerSkills, roadmapProgress, type InsertLearnerProfile } from "../drizzle/schema";
import type { LearnerSkill } from "../shared/careerData";
import { getDb } from "./db";

export type LearnerProfileUpdate = Pick<InsertLearnerProfile, "countryCode" | "preferredLanguage" | "educationLevel" | "qualification" | "fieldOfStudy" | "yearOfStudy" | "currentRole" | "experienceYears" | "targetCareer" | "preferredIndustries" | "workStyle" | "workLocation" | "remotePreference" | "onboardingComplete">;

export async function getLearnerProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [profile] = await db.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1);
  return profile ?? null;
}

export async function saveLearnerProfile(userId: number, update: LearnerProfileUpdate) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(learnerProfiles).values({ userId, ...update }).onDuplicateKeyUpdate({
    set: { ...update },
  });
  return getLearnerProfile(userId);
}

export async function getLearnerSnapshot(userId: number) {
  const db = await getDb();
  if (!db) return { profile: null, skills: [], achievements: [], roadmap: [] };
  const [profile, skills, achievements, roadmap] = await Promise.all([
    getLearnerProfile(userId),
    db.select().from(learnerSkills).where(eq(learnerSkills.userId, userId)),
    db.select().from(learnerAchievements).where(eq(learnerAchievements.userId, userId)).orderBy(desc(learnerAchievements.achievedAt)).limit(12),
    db.select().from(roadmapProgress).where(eq(roadmapProgress.userId, userId)).orderBy(desc(roadmapProgress.updatedAt)).limit(24),
  ]);
  return { profile, skills, achievements, roadmap };
}

export async function replaceLearnerSkills(userId: number, skills: LearnerSkill[]) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(learnerSkills).where(eq(learnerSkills.userId, userId));
  if (skills.length) await db.insert(learnerSkills).values(skills.map((skill) => ({ userId, name: skill.name, level: skill.level, confidence: skill.confidence, assessmentScore: skill.score ?? null, projectCount: skill.projectCount ?? 0 })));
  return db.select().from(learnerSkills).where(eq(learnerSkills.userId, userId));
}

export async function addLearnerAchievement(userId: number, title: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(learnerAchievements).values({ userId, title, description: description || null });
  return db.select().from(learnerAchievements).where(eq(learnerAchievements.userId, userId)).orderBy(desc(learnerAchievements.achievedAt)).limit(12);
}

export async function removeLearnerAchievement(userId: number, achievementId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(learnerAchievements).where(and(eq(learnerAchievements.id, achievementId), eq(learnerAchievements.userId, userId)));
}

export async function markRoadmapMilestone(userId: number, careerSlug: string, milestoneId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(roadmapProgress).values({ userId, careerSlug, milestoneId, completed: true, completedAt: new Date() }).onDuplicateKeyUpdate({ set: { completed: true, completedAt: new Date() } });
  return db.select().from(roadmapProgress).where(eq(roadmapProgress.userId, userId));
}
