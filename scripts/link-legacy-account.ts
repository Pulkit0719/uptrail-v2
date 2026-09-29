import "dotenv/config";
import { and, eq, ne } from "drizzle-orm";
import { authCredentials, users } from "../drizzle/schema";
import { getDb } from "../server/db";
import { hashPassword, normalizeEmail } from "../server/_core/auth";

const openId = process.env.LEGACY_USER_OPEN_ID?.trim();
const email = process.env.LOCAL_AUTH_EMAIL?.trim();
const password = process.env.LOCAL_AUTH_PASSWORD;

if (!openId || !email || !password) {
  throw new Error("Set LEGACY_USER_OPEN_ID, LOCAL_AUTH_EMAIL, and LOCAL_AUTH_PASSWORD before running this command.");
}
if (password.length < 12 || password.length > 128) throw new Error("LOCAL_AUTH_PASSWORD must be 12-128 characters.");

const db = await getDb();
if (!db) throw new Error("DATABASE_URL is not configured.");
const [user] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
if (!user) throw new Error("No legacy user matches LEGACY_USER_OPEN_ID.");
const normalized = normalizeEmail(email);
const conflicts = await db.select().from(authCredentials).where(
  and(eq(authCredentials.emailNormalized, normalized), ne(authCredentials.userId, user.id))
).limit(1);
if (conflicts.length) throw new Error("That local-auth email belongs to another account.");
const existing = await db.select().from(authCredentials).where(eq(authCredentials.userId, user.id)).limit(1);
if (existing.length) throw new Error("This user already has local credentials. No changes were made.");
const credential = await hashPassword(password);
await db.insert(authCredentials).values({
  userId: user.id,
  emailNormalized: normalized,
  passwordHash: credential.hash,
  passwordSalt: credential.salt,
});
await db.update(users).set({ email, loginMethod: "password" }).where(and(eq(users.id, user.id), eq(users.openId, openId)));
console.log(`Local credentials linked to user id ${user.id}.`);
