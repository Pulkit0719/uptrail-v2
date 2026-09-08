import { describe, expect, it } from "vitest";
import { calculateCareerReadiness, calculateSkillGaps, explainCareerMatch, getCareer, type LearnerSkill } from "../shared/careerData";

const learnerSkills: LearnerSkill[] = [
  { name: "HTML & CSS", level: "Proficient", confidence: "Project Verified", projectCount: 2 },
  { name: "JavaScript", level: "Developing", confidence: "Assessment Verified", score: 68 },
  { name: "Git & GitHub", level: "Developing", confidence: "Self Reported" },
];

describe("career skill reasoning", () => {
  it("prioritizes high-weight, low-readiness skills instead of the first missing skill", () => {
    const career = getCareer("frontend-developer");
    expect(career).toBeDefined();
    const gaps = calculateSkillGaps(career!, learnerSkills);
    expect(gaps[0]?.name).toBe("React");
    expect(gaps.find((gap) => gap.name === "HTML & CSS")?.status).toBe("Ready");
  });

  it("calculates a bounded weighted readiness score and gives a human explanation", () => {
    const career = getCareer("frontend-developer")!;
    const readiness = calculateCareerReadiness(career, learnerSkills);
    expect(readiness).toBeGreaterThan(0);
    expect(readiness).toBeLessThan(100);
    expect(explainCareerMatch(career, learnerSkills)).toContain("Frontend Developer");
  });
});

