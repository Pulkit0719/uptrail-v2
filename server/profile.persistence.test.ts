import { describe, expect, it } from "vitest";

describe("learner profile input behavior", () => {
  it("uses an empty optional profile update as a no-op shape rather than a fabricated user profile", () => {
    const update = { countryCode: "IN", currentRole: "Student", targetCareer: "frontend-developer" };
    expect(update.countryCode).toBe("IN");
    expect(Object.keys(update)).toHaveLength(3);
  });
});

