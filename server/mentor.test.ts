import { describe, expect, it } from "vitest";
import { createMentorSystemPrompt, extractMentorContent } from "./mentor";

describe("AI Career Mentor instructions", () => {
  it("grounds recommendations in target role and recorded learner context", () => {
    const prompt = createMentorSystemPrompt({
      targetCareer: "frontend-developer",
      countryCode: "IN",
      skills: [
        {
          name: "JavaScript",
          level: "Developing",
          confidence: "Assessment Verified",
          score: 70,
        },
      ],
    });
    expect(prompt).toContain("Frontend Developer");
    expect(prompt).toContain("JavaScript");
    expect(prompt).toContain("Never invent");
  });

  it("rejects an empty provider response instead of rendering a blank answer", () => {
    expect(() =>
      extractMentorContent({
        id: "empty",
        created: 1,
        model: "openrouter/free",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "   " },
            finish_reason: "stop",
          },
        ],
      })
    ).toThrow("AI mentor returned no usable content");
  });
});
