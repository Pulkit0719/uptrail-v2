import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(".env"), override: false, quiet: true });
const accountLinkEnv = process.env.ACCOUNT_LINK_ENV_FILE ?? ".env.account-link";
const linkConfig = config({ path: resolve(accountLinkEnv), override: true, quiet: true });
if (linkConfig.error) throw new Error("Could not load the ignored account-link environment file");

const email = process.env.LOCAL_AUTH_EMAIL?.trim();
const openId = process.env.LEGACY_USER_OPEN_ID?.trim();
if (!email || !openId) throw new Error("LOCAL_AUTH_EMAIL and LEGACY_USER_OPEN_ID are required");
if (process.env.EXPECTED_DATABASE_NAME !== "defaultdb") {
  throw new Error("Owner-ID discovery requires EXPECTED_DATABASE_NAME=defaultdb");
}

const [{ and, eq, sql }, { authCredentials, users }, { normalizeEmail }, { closeDb, getDb }] = await Promise.all([
  import("drizzle-orm"),
  import("../drizzle/schema"),
  import("../server/_core/auth"),
  import("../server/db"),
]);

const db = await getDb();
if (!db) throw new Error("DATABASE_URL is required");
try {
  const [databaseRows] = await db.execute(sql`SELECT DATABASE() AS activeDatabase`);
  if ((databaseRows as Array<{ activeDatabase: string }>)[0]?.activeDatabase !== "defaultdb") {
    throw new Error("Live database target mismatch");
  }
  const results = await db.select({ id: users.id, role: users.role })
    .from(authCredentials)
    .innerJoin(users, eq(authCredentials.userId, users.id))
    .where(and(
      eq(authCredentials.emailNormalized, normalizeEmail(email)),
      eq(users.openId, openId),
    ))
    .limit(2);
  if (results.length !== 1) throw new Error("The linked identity did not resolve to exactly one user");
  console.log(`User ID: ${results[0]!.id}`);
  console.log(`Current role: ${results[0]!.role}`);
  console.log("Set OWNER_USER_ID only after separate explicit authorization.");
} finally {
  await closeDb();
}
