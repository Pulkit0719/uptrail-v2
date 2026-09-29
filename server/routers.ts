import { z } from "zod";
import { mentorReply } from "./mentor";
import { getLiveOpportunities } from "./opportunities";
import { addLearnerAchievement, getLearnerProfile, getLearnerSnapshot, markRoadmapMilestone, removeLearnerAchievement, replaceLearnerSkills, saveLearnerProfile } from "./profile";
import { authenticateLocalUser, clearAuthCookies, createSession, normalizeEmail, registerLocalUser, requestPasswordReset, resetPassword, revokeSession } from "./_core/auth";
import { enforceRateLimit } from "./_core/rateLimit";
import { systemRouter } from "./_core/systemRouter";
import { csrfProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: csrfProcedure.input(z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(320),
      password: z.string().min(12).max(128),
    })).mutation(async ({ ctx, input }) => {
      enforceRateLimit(`register-ip:${ctx.req.ip}`, 10, 60 * 60_000);
      enforceRateLimit(`register:${ctx.req.ip}:${normalizeEmail(input.email)}`, 5);
      const user = await registerLocalUser(input);
      await createSession(user.id, ctx.req, ctx.res);
      return user;
    }),
    login: csrfProcedure.input(z.object({
      email: z.string().trim().email().max(320),
      password: z.string().min(1).max(128),
    })).mutation(async ({ ctx, input }) => {
      enforceRateLimit(`login-ip:${ctx.req.ip}`, 30);
      enforceRateLimit(`login:${ctx.req.ip}:${normalizeEmail(input.email)}`);
      const user = await authenticateLocalUser(input.email, input.password);
      await createSession(user.id, ctx.req, ctx.res);
      return user;
    }),
    logout: protectedProcedure.mutation(async ({ ctx }) => {
      await revokeSession(ctx.sessionId);
      clearAuthCookies(ctx.req, ctx.res);
      return { success: true } as const;
    }),
    requestPasswordReset: csrfProcedure.input(z.object({
      email: z.string().trim().email().max(320),
    })).mutation(async ({ ctx, input }) => {
      enforceRateLimit(`password-reset-request:${ctx.req.ip}`, 5, 30 * 60_000);
      await requestPasswordReset(input.email);
      return { success: true } as const;
    }),
    resetPassword: csrfProcedure.input(z.object({
      token: z.string().min(32).max(128),
      password: z.string().min(12).max(128),
    })).mutation(async ({ ctx, input }) => {
      enforceRateLimit(`password-reset:${ctx.req.ip}`, 10, 30 * 60_000);
      await resetPassword(input.token, input.password);
      clearAuthCookies(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),
  mentor: router({
    chat: protectedProcedure.input(z.object({
      messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(3000) })).min(1).max(12),
    })).mutation(async ({ ctx, input }) => ({ content: await mentorReply(ctx.user.id, input.messages) })),
  }),
  profile: router({
    me: protectedProcedure.query(({ ctx }) => getLearnerProfile(ctx.user.id)),
    snapshot: protectedProcedure.query(({ ctx }) => getLearnerSnapshot(ctx.user.id)),
    update: protectedProcedure.input(z.object({
      countryCode: z.string().trim().min(2).max(8).optional(),
      preferredLanguage: z.string().trim().min(1).max(64).optional(),
      educationLevel: z.string().trim().max(96).optional(),
      qualification: z.string().trim().max(128).optional(),
      fieldOfStudy: z.string().trim().max(160).optional(),
      yearOfStudy: z.string().trim().max(64).optional(),
      currentRole: z.string().trim().max(160).optional(),
      experienceYears: z.number().int().min(0).max(60).optional(),
      targetCareer: z.string().trim().max(120).optional(),
      preferredIndustries: z.string().trim().max(1000).optional(),
      workStyle: z.string().trim().max(64).optional(),
      workLocation: z.string().trim().max(128).optional(),
      remotePreference: z.string().trim().max(64).optional(),
      onboardingComplete: z.boolean().optional(),
    })).mutation(({ ctx, input }) => saveLearnerProfile(ctx.user.id, input)),
    saveSkills: protectedProcedure.input(z.array(z.object({
      name: z.string().trim().min(1).max(120),
      level: z.enum(["Foundational", "Developing", "Proficient", "Advanced"]),
      confidence: z.enum(["Self Reported", "Assessment Verified", "Project Verified"]),
      score: z.number().int().min(0).max(100).optional(),
      projectCount: z.number().int().min(0).max(99).optional(),
    })).max(40)).mutation(({ ctx, input }) => replaceLearnerSkills(ctx.user.id, input)),
    addAchievement: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(180), description: z.string().trim().max(2000).optional() })).mutation(({ ctx, input }) => addLearnerAchievement(ctx.user.id, input.title, input.description)),
    removeAchievement: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => removeLearnerAchievement(ctx.user.id, input.id)),
  }),
  roadmap: router({
    complete: protectedProcedure.input(z.object({ careerSlug: z.string().trim().min(1).max(120), milestoneId: z.string().trim().min(1).max(120) })).mutation(({ ctx, input }) => markRoadmapMilestone(ctx.user.id, input.careerSlug, input.milestoneId)),
  }),
  opportunities: router({
    list: publicProcedure.input(z.object({
      search: z.string().trim().max(80).optional(),
      careerPath: z.string().trim().max(80).optional(),
      region: z.string().trim().max(80).optional(),
      skillLevel: z.enum(["entry", "early", "experienced", "all"]).optional(),
      limit: z.number().int().min(1).max(24).optional(),
    }).optional()).query(({ input }) => getLiveOpportunities(input)),
  }),
});

export type AppRouter = typeof appRouter;
