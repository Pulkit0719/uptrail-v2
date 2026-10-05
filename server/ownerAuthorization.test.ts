import { describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import { applyOwnerRole } from "./_core/auth";
import { isValidOwnerUserId, parseOwnerUserId } from "./_core/env";

const user = {
  id: 1,
  openId: "test-owner",
  name: "Test Owner",
  email: "owner@example.com",
  loginMethod: "password",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
} satisfies User;

describe("OWNER_USER_ID authorization", () => {
  it("grants the runtime admin role only to the exact server-configured ID", () => {
    expect(applyOwnerRole(user, 1)).toMatchObject({ id: 1, role: "admin" });
    expect(applyOwnerRole(user, 2)).toBe(user);
    expect(applyOwnerRole(user, undefined)).toBe(user);
    expect(user.role).toBe("user");
  });

  it("does not let user-controlled object fields override the database ID comparison", () => {
    const requestControlled = { ...user, claimedOwnerId: 1 };
    expect(applyOwnerRole(requestControlled, 2)).toMatchObject({
      id: 1,
      role: "user",
    });
  });

  it("parses the configured ID numerically and rejects unsafe values", () => {
    expect(parseOwnerUserId("1")).toBe(1);
    expect(isValidOwnerUserId(parseOwnerUserId("1"))).toBe(true);
    expect(isValidOwnerUserId(parseOwnerUserId(undefined))).toBe(true);
    expect(isValidOwnerUserId(parseOwnerUserId("0"))).toBe(false);
    expect(isValidOwnerUserId(parseOwnerUserId("1.5"))).toBe(false);
    expect(isValidOwnerUserId(parseOwnerUserId("not-a-number"))).toBe(false);
  });
});
