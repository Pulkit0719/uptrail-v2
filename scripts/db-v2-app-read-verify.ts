import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import {
  authCredentials,
  authSessions,
  careerAssessmentAttempts,
  passwordResetTokens,
  skillAssessmentAttempts,
  users,
} from "../drizzle/schema";
import { closeDb, getDb } from "../server/db";
import { getLearnerProfile, getLearnerSnapshot } from "../server/profile";

const expectedDatabase = process.env.EXPECTED_DATABASE_NAME;
if (expectedDatabase !== "defaultdb") {
  throw new Error("Application read verification requires EXPECTED_DATABASE_NAME=defaultdb");
}

let failed = false;
try {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");

  const [databaseRows] = await db.execute(sql`SELECT DATABASE() AS activeDatabase`);
  const activeDatabase = (databaseRows as Array<{ activeDatabase: string }>)[0]?.activeDatabase;
  if (activeDatabase !== expectedDatabase) throw new Error("Live database target mismatch");

  const userRows = await db.select({ id: users.id }).from(users).limit(2);
  if (userRows.length !== 1) throw new Error("Legacy user read mismatch");
  const userId = userRows[0]!.id;

  const profile = await getLearnerProfile(userId);
  const snapshot = await getLearnerSnapshot(userId);
  if (!profile || snapshot.profile?.userId !== userId) throw new Error("Learner profile read mismatch");
  if (snapshot.skills.length !== 2) throw new Error("Learner skill read mismatch");
  if (snapshot.roadmap.length !== 2) throw new Error("Roadmap progress read mismatch");
  if (snapshot.achievements.length !== 0) throw new Error("Achievement read mismatch");

  const careerRows = await db.select({ id: careerAssessmentAttempts.id })
    .from(careerAssessmentAttempts).where(eq(careerAssessmentAttempts.userId, userId)).limit(2);
  const skillRows = await db.select({ id: skillAssessmentAttempts.id })
    .from(skillAssessmentAttempts).where(eq(skillAssessmentAttempts.userId, userId)).limit(2);
  if (careerRows.length !== 1) throw new Error("Career assessment read mismatch");
  if (skillRows.length !== 1) throw new Error("Skill assessment read mismatch");

  const credentialRows = await db.select({ id: authCredentials.id }).from(authCredentials).limit(1);
  const sessionRows = await db.select({ id: authSessions.id }).from(authSessions).limit(1);
  const resetRows = await db.select({ id: passwordResetTokens.id }).from(passwordResetTokens).limit(1);
  if (credentialRows.length || sessionRows.length || resetRows.length) {
    throw new Error("Auth tables are not empty");
  }

  console.log("Active database: defaultdb");
  console.log("Legacy user read: PASS");
  console.log("Learner profile read: PASS");
  console.log("Learner skills read: PASS");
  console.log("Roadmap progress read: PASS");
  console.log("Achievements read: PASS");
  console.log("Career assessment read: PASS");
  console.log("Skill assessment read: PASS");
  console.log("Empty auth schema reads: PASS");
} catch {
  failed = true;
  console.error("Application database read verification failed; sensitive details were suppressed.");
} finally {
  await closeDb();
}

if (failed) process.exitCode = 1;
