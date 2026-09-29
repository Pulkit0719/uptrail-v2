import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireCsrf = t.middleware(({ ctx, next }) => {
  if (!ctx.csrfValid) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Invalid CSRF token." });
  }
  return next({ ctx });
});

const requireAnonymousCsrf = t.middleware(({ ctx, next }) => {
  if (!ctx.anonymousCsrfValid) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Invalid CSRF token." });
  }
  return next({ ctx });
});

export const csrfProcedure = t.procedure.use(requireAnonymousCsrf);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (!ctx.csrfValid) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Invalid CSRF token." });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(requireCsrf).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
