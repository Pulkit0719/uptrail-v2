import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateRequest, hasValidAnonymousCsrf } from "./auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  sessionId: string | null;
  csrfValid: boolean;
  anonymousCsrfValid: boolean;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let auth = { user: null, sessionId: null, csrfValid: false } as Awaited<ReturnType<typeof authenticateRequest>>;
  try {
    auth = await authenticateRequest(opts.req);
  } catch {
    console.warn("[Auth] Request authentication unavailable");
  }
  return {
    req: opts.req,
    res: opts.res,
    user: auth.user,
    sessionId: auth.sessionId,
    csrfValid: auth.csrfValid,
    anonymousCsrfValid: hasValidAnonymousCsrf(opts.req),
  };
}
