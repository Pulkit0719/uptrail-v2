import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { parse as parseCookieHeader } from "cookie";
import type { Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import {
  authCredentials,
  authSessions,
  passwordResetTokens,
  users,
  type AuthSession,
  type User,
} from "../../drizzle/schema";
import {
  COOKIE_NAME,
  CSRF_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "../../shared/const";
import { getDb } from "../db";
import { getCsrfCookieOptions, getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sendPasswordResetEmail } from "./email";

const PASSWORD_BYTES = 64;
const SCRYPT_OPTIONS = {
  N: 32768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

export type RequestAuth = {
  user: User | null;
  sessionId: string | null;
  csrfValid: boolean;
};

export function applyOwnerRole(
  user: User,
  ownerUserId = ENV.ownerUserId
): User {
  if (ownerUserId === user.id && user.role !== "admin")
    return { ...user, role: "admin" };
  return user;
}

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const randomToken = () => randomBytes(32).toString("base64url");
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isSessionRecordActive = (
  session: Pick<AuthSession, "expiresAt" | "revokedAt">,
  now = new Date()
) => !session.revokedAt && session.expiresAt > now;

async function requireDb() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database is not configured.",
    });
  return db;
}

export async function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex")
) {
  const derived = await new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      PASSWORD_BYTES,
      SCRYPT_OPTIONS,
      (error, value) => {
        if (error) reject(error);
        else resolve(value as Buffer);
      }
    );
  });
  return { hash: derived.toString("hex"), salt };
}

export async function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string
) {
  const { hash } = await hashPassword(password, salt);
  const actual = Buffer.from(hash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function registerLocalUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const db = await requireDb();
  const emailNormalized = normalizeEmail(input.email);
  const password = await hashPassword(input.password);
  try {
    return await db.transaction(async tx => {
      const inserted = await tx
        .insert(users)
        .values({
          openId: `local_${randomUUID()}`,
          name: input.name.trim(),
          email: input.email.trim(),
          loginMethod: "password",
          lastSignedIn: new Date(),
        })
        .$returningId();
      const userId = inserted[0]?.id;
      if (!userId) throw new Error("Unable to create user");
      await tx.insert(authCredentials).values({
        userId,
        emailNormalized,
        passwordHash: password.hash,
        passwordSalt: password.salt,
      });
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) throw new Error("Unable to load created user");
      return user;
    });
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An account with that email already exists.",
      });
    }
    throw error;
  }
}

export async function authenticateLocalUser(email: string, password: string) {
  const db = await requireDb();
  const [credential] = await db
    .select()
    .from(authCredentials)
    .where(eq(authCredentials.emailNormalized, normalizeEmail(email)))
    .limit(1);
  const fallback = {
    passwordHash: "00".repeat(PASSWORD_BYTES),
    passwordSalt: "00".repeat(16),
  };
  const selected = credential ?? fallback;
  const valid = await verifyPassword(
    password,
    selected.passwordHash,
    selected.passwordSalt
  );
  if (!credential || !valid) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid email or password.",
    });
  }
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, credential.userId))
    .limit(1);
  if (!user)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid email or password.",
    });
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, user.id));
  return user;
}

export async function createSession(
  userId: number,
  req: Request,
  res: Response
) {
  const db = await requireDb();
  const token = randomToken();
  const csrfToken = randomToken();
  await db.insert(authSessions).values({
    id: randomUUID(),
    userId,
    tokenHash: sha256(token),
    csrfHash: sha256(csrfToken),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: SESSION_DURATION_MS,
  });
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    ...getCsrfCookieOptions(req),
    maxAge: SESSION_DURATION_MS,
  });
}

function readCsrfHeader(req: Request) {
  const value = req.headers["x-csrf-token"];
  return Array.isArray(value) ? value[0] : value;
}

export async function authenticateRequest(req: Request): Promise<RequestAuth> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const token = cookies[COOKIE_NAME];
  if (!token) return { user: null, sessionId: null, csrfValid: false };
  const db = await getDb();
  if (!db) return { user: null, sessionId: null, csrfValid: false };
  const rows = await db
    .select({ session: authSessions, user: users })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(
      and(
        eq(authSessions.tokenHash, sha256(token)),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date())
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) return { user: null, sessionId: null, csrfValid: false };
  const csrfCookie = cookies[CSRF_COOKIE_NAME];
  const csrfHeader = readCsrfHeader(req);
  const csrfValid = Boolean(
    csrfCookie &&
    csrfHeader &&
    csrfCookie === csrfHeader &&
    sha256(csrfCookie) === row.session.csrfHash
  );
  // OWNER_USER_ID is an operational override, not a persistent privilege
  // mutation. Removing/changing the variable therefore removes the grant.
  const user = applyOwnerRole(row.user);
  return { user, sessionId: row.session.id, csrfValid };
}

export function hasValidAnonymousCsrf(req: Request) {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const cookie = cookies[CSRF_COOKIE_NAME];
  const header = readCsrfHeader(req);
  return Boolean(cookie && header && cookie === header);
}

export async function issueCsrfToken(req: Request, res: Response) {
  const db = await getDb();
  let auth: RequestAuth = { user: null, sessionId: null, csrfValid: false };
  try {
    auth = await authenticateRequest(req);
  } catch {
    // An anonymous CSRF token still lets the public UI render and reach login;
    // credential operations will report the underlying database outage.
  }
  const csrfToken = randomToken();
  if (db && auth.sessionId) {
    await db
      .update(authSessions)
      .set({ csrfHash: sha256(csrfToken), lastSeenAt: new Date() })
      .where(eq(authSessions.id, auth.sessionId));
  }
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    ...getCsrfCookieOptions(req),
    maxAge: SESSION_DURATION_MS,
  });
  return csrfToken;
}

export async function revokeSession(sessionId: string | null) {
  if (!sessionId) return;
  const db = await getDb();
  if (db)
    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(eq(authSessions.id, sessionId));
}

export async function requestPasswordReset(email: string) {
  // Known and unknown addresses intentionally have the same externally visible result.
  if (!ENV.emailProviderUrl || !ENV.emailProviderApiKey || !ENV.emailFrom)
    return;
  const db = await requireDb();
  const [credential] = await db
    .select()
    .from(authCredentials)
    .where(eq(authCredentials.emailNormalized, normalizeEmail(email)))
    .limit(1);
  if (!credential) return;

  const token = randomToken();
  const now = new Date();
  await db.transaction(async tx => {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.userId, credential.userId),
          isNull(passwordResetTokens.usedAt)
        )
      );
    await tx.insert(passwordResetTokens).values({
      id: randomUUID(),
      userId: credential.userId,
      tokenHash: sha256(token),
      expiresAt: new Date(now.getTime() + ENV.passwordResetTtlMinutes * 60_000),
    });
  });

  try {
    await sendPasswordResetEmail(credential.emailNormalized, token);
  } catch {
    console.error("[Auth] Password reset email delivery failed");
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const db = await requireDb();
  const nextPassword = await hashPassword(newPassword);
  const now = new Date();

  await db.transaction(async tx => {
    const [reset] = await tx
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, sha256(token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now)
        )
      )
      .limit(1);
    if (!reset)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This password reset link is invalid or expired.",
      });

    const result = await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.id, reset.id),
          isNull(passwordResetTokens.usedAt)
        )
      );
    const affectedRows =
      Array.isArray(result) && result[0] && "affectedRows" in result[0]
        ? Number(result[0].affectedRows)
        : 0;
    if (affectedRows !== 1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This password reset link is invalid or expired.",
      });
    }
    await tx
      .update(authCredentials)
      .set({
        passwordHash: nextPassword.hash,
        passwordSalt: nextPassword.salt,
      })
      .where(eq(authCredentials.userId, reset.userId));
    await tx
      .update(authSessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(authSessions.userId, reset.userId),
          isNull(authSessions.revokedAt)
        )
      );
  });
}

export function clearAuthCookies(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
  res.clearCookie(CSRF_COOKIE_NAME, getCsrfCookieOptions(req));
}
