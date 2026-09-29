import { TRPCError } from "@trpc/server";

const attempts = new Map<string, { count: number; resetAt: number }>();

export function enforceRateLimit(key: string, limit = 10, windowMs = 15 * 60_000) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again later." });
  }
  current.count += 1;
}
