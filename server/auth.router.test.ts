import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

const user = {
  id: 42,
  openId: "local-test",
  name: "Test User",
  email: "test@example.com",
  loginMethod: "password",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};
const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  authenticate: vi.fn(),
  createSession: vi.fn(),
  revokeSession: vi.fn(),
  clearCookies: vi.fn(),
  requestReset: vi.fn(),
  resetPassword: vi.fn(),
  notifyOwner: vi.fn(),
}));

vi.mock("./_core/auth", () => ({
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
  registerLocalUser: mocks.register,
  authenticateLocalUser: mocks.authenticate,
  createSession: mocks.createSession,
  revokeSession: mocks.revokeSession,
  clearAuthCookies: mocks.clearCookies,
  requestPasswordReset: mocks.requestReset,
  resetPassword: mocks.resetPassword,
}));
vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));

import { appRouter } from "./routers";
import { resetRateLimitsForTests } from "./_core/rateLimit";

function context(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: null,
    sessionId: null,
    csrfValid: false,
    anonymousCsrfValid: true,
    req: { ip: "127.0.0.55", protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    ...overrides,
  };
}

describe("authentication router boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitsForTests();
    mocks.register.mockResolvedValue(user);
    mocks.authenticate.mockResolvedValue(user);
    mocks.notifyOwner.mockResolvedValue(true);
  });

  it("registers a valid account and creates its session", async () => {
    await expect(appRouter.createCaller(context()).auth.register({
      name: "Test User", email: "test@example.com", password: "a secure passphrase",
    })).resolves.toEqual(user);
    expect(mocks.register).toHaveBeenCalledWith(expect.objectContaining({ email: "test@example.com" }));
    expect(mocks.createSession).toHaveBeenCalledWith(42, expect.anything(), expect.anything());
  });

  it("logs in valid credentials and rejects invalid credentials", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.auth.login({ email: "test@example.com", password: "valid" })).resolves.toEqual(user);
    mocks.authenticate.mockRejectedValueOnce(new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." }));
    await expect(caller.auth.login({ email: "test@example.com", password: "wrong" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires CSRF for credential changes", async () => {
    const caller = appRouter.createCaller(context({ anonymousCsrfValid: false }));
    await expect(caller.auth.login({ email: "test@example.com", password: "valid" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks anonymous protected calls and non-admin admin calls", async () => {
    await expect(appRouter.createCaller(context()).profile.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(appRouter.createCaller(context({ user, csrfValid: true })).system.notifyOwner({ title: "x", content: "y" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an authenticated admin with valid CSRF", async () => {
    const admin = { ...user, role: "admin" as const };
    await expect(appRouter.createCaller(context({ user: admin, csrfValid: true })).system.notifyOwner({ title: "x", content: "y" }))
      .resolves.toEqual({ success: true });
    expect(mocks.notifyOwner).toHaveBeenCalledWith({ title: "x", content: "y" });
  });

  it("accepts recovery requests without revealing account existence", async () => {
    await expect(appRouter.createCaller(context()).auth.requestPasswordReset({ email: "unknown@example.com" }))
      .resolves.toEqual({ success: true });
    expect(mocks.requestReset).toHaveBeenCalledWith("unknown@example.com");
  });

  it("resets a password through a token and clears old cookies", async () => {
    await expect(appRouter.createCaller(context()).auth.resetPassword({ token: "x".repeat(43), password: "new secure passphrase" }))
      .resolves.toEqual({ success: true });
    expect(mocks.resetPassword).toHaveBeenCalledWith("x".repeat(43), "new secure passphrase");
    expect(mocks.clearCookies).toHaveBeenCalled();
  });
});
