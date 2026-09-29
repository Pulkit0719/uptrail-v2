import "dotenv/config";
import { eq } from "drizzle-orm";
import { authCredentials, users } from "../drizzle/schema";
import { normalizeEmail } from "../server/_core/auth";
import { closeDb, getDb } from "../server/db";

const email = process.env.LOCAL_AUTH_EMAIL;
if (!email) throw new Error("LOCAL_AUTH_EMAIL is required");
const db = await getDb();
if (!db) throw new Error("DATABASE_URL is required");
try {
  const [result] = await db.select({ id: users.id, role: users.role })
    .from(authCredentials)
    .innerJoin(users, eq(authCredentials.userId, users.id))
    .where(eq(authCredentials.emailNormalized, normalizeEmail(email)))
    .limit(1);
  if (!result) throw new Error("No local credential matches LOCAL_AUTH_EMAIL");
  console.log(`User ID: ${result.id}`);
  console.log(`Current role: ${result.role}`);
  console.log("Set OWNER_USER_ID to this ID only after independently verifying the account owner.");
} finally {
  await closeDb();
}
