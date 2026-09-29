import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, verifyPassword } from "./_core/auth";

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
});
