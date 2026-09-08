import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mentorReply: vi.fn(),
  getLiveOpportunities: vi.fn(),
  getLearnerProfile: vi.fn(),
  getLearnerSnapshot: vi.fn(),
  saveLearnerProfile: vi.fn(),
  replaceLearnerSkills: vi.fn(),
  addLearnerAchievement: vi.fn(),
  removeLearnerAchievement: vi.fn(),
  markRoadmapMilestone: vi.fn(),
}));

vi.mock("./mentor", () => ({ mentorReply: mocks.mentorReply }));
vi.mock("./opportunities", () => ({ getLiveOpportunities: mocks.getLiveOpportunities }));
vi.mock("./profile", () => ({ getLearnerProfile: mocks.getLearnerProfile, getLearnerSnapshot: mocks.getLearnerSnapshot, saveLearnerProfile: mocks.saveLearnerProfile, replaceLearnerSkills: mocks.replaceLearnerSkills, addLearnerAchievement: mocks.addLearnerAchievement, removeLearnerAchievement: mocks.removeLearnerAchievement, markRoadmapMilestone: mocks.markRoadmapMilestone }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(): TrpcContext {
  return {
    user: { id: 77, openId: "gateway-user", name: "Gateway User", email: "gateway@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("Uptrail tRPC gateways", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mentorReply.mockResolvedValue("Use React next.");
    mocks.getLiveOpportunities.mockResolvedValue({ status: "live", sourceName: "Remotive", sourceNotice: "source", items: [] });
    mocks.getLearnerProfile.mockResolvedValue(null);
    mocks.getLearnerSnapshot.mockResolvedValue({ profile: null, skills: [], achievements: [], roadmap: [] });
    mocks.saveLearnerProfile.mockResolvedValue({ countryCode: "IN" });
    mocks.replaceLearnerSkills.mockResolvedValue([]);
    mocks.addLearnerAchievement.mockResolvedValue([]);
    mocks.removeLearnerAchievement.mockResolvedValue(undefined);
    mocks.markRoadmapMilestone.mockResolvedValue([]);
  });

  it("sends bounded chat history to the profile-aware mentor gateway", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.mentor.chat({ messages: [{ role: "user", content: "What is my next skill?" }] })).resolves.toEqual({ content: "Use React next." });
    expect(mocks.mentorReply).toHaveBeenCalledWith(77, [{ role: "user", content: "What is my next skill?" }]);
  });

  it("passes career path, region, and skill-level opportunity filters through the public feed gateway", async () => {
    const caller = appRouter.createCaller(context());
    await caller.opportunities.list({ careerPath: "software", region: "global", skillLevel: "entry", search: "frontend", limit: 8 });
    expect(mocks.getLiveOpportunities).toHaveBeenCalledWith({ careerPath: "software", region: "global", skillLevel: "entry", search: "frontend", limit: 8 });
  });

  it("persists profile context, skill evidence, achievements, and roadmap completion under the caller identity", async () => {
    const caller = appRouter.createCaller(context());
    await caller.profile.update({ countryCode: "IN", currentRole: "Student", targetCareer: "frontend-developer" });
    await caller.profile.saveSkills([{ name: "JavaScript", level: "Developing", confidence: "Assessment Verified", score: 70, projectCount: 1 }]);
    await caller.profile.addAchievement({ title: "Shipped a project" });
    await caller.profile.removeAchievement({ id: 3 });
    await caller.roadmap.complete({ careerSlug: "frontend-developer", milestoneId: "frontend-foundations" });
    expect(mocks.saveLearnerProfile).toHaveBeenCalledWith(77, expect.objectContaining({ countryCode: "IN" }));
    expect(mocks.replaceLearnerSkills).toHaveBeenCalledWith(77, expect.arrayContaining([expect.objectContaining({ name: "JavaScript" })]));
    expect(mocks.addLearnerAchievement).toHaveBeenCalledWith(77, "Shipped a project", undefined);
    expect(mocks.removeLearnerAchievement).toHaveBeenCalledWith(77, 3);
    expect(mocks.markRoadmapMilestone).toHaveBeenCalledWith(77, "frontend-developer", "frontend-foundations");
  });
});
