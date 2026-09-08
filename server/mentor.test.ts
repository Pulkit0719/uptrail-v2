import { describe, expect, it } from "vitest";
import { createMentorSystemPrompt } from "./mentor";

describe("AI Career Mentor instructions", () => {
  it("grounds recommendations in target role and recorded learner context", () => {
    const prompt = createMentorSystemPrompt({ targetCareer: "frontend-developer", countryCode: "IN", skills: [{ name: "JavaScript", level: "Developing", confidence: "Assessment Verified", score: 70 }] });
    expect(prompt).toContain("Frontend Developer");
    expect(prompt).toContain("JavaScript");
    expect(prompt).toContain("Never invent");
  });
});

