import { describe, expect, it } from "vitest";
import { hashPassword, isSessionRecordActive, normalizeEmail, verifyPassword } from "./_core/auth";
import { enforceRateLimit, resetRateLimitsForTests } from "./_core/rateLimit";

describe("independent authentication primitives", () => {
  it("normalizes login emails without using them to identify imported users", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
  });

  it("salts and verifies passwords with scrypt", async () => {
    const password = "a strong local password";
    const stored = await hashPassword(password);
    expect(stored.hash).not.toContain(password);
    expect(await verifyPassword(password, stored.hash, stored.salt)).toBe(true);
    expect(await verifyPassword("incorrect password", stored.hash, stored.salt)).toBe(false);
  });

  it("rejects expired and revoked sessions", () => {
    const now = new Date("2026-09-29T12:00:00Z");
    expect(isSessionRecordActive({ expiresAt: new Date("2026-09-29T12:01:00Z"), revokedAt: null }, now)).toBe(true);
    expect(isSessionRecordActive({ expiresAt: new Date("2026-09-29T11:59:00Z"), revokedAt: null }, now)).toBe(false);
    expect(isSessionRecordActive({ expiresAt: new Date("2026-09-29T12:01:00Z"), revokedAt: now }, now)).toBe(false);
  });

  it("enforces bounded authentication attempts", () => {
    resetRateLimitsForTests();
    enforceRateLimit("test-login", 2, 60_000);
    enforceRateLimit("test-login", 2, 60_000);
    expect(() => enforceRateLimit("test-login", 2, 60_000)).toThrow("Too many attempts");
  });
});
