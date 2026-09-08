import { describe, expect, it } from "vitest";
import { inferOpportunityKind, inferSkillLevel, normalizeRemotiveJob } from "./opportunities";

describe("opportunity normalization", () => {
  const job = { id: 42, url: "https://example.com/job", title: "Junior Frontend Developer", company_name: "Example", category: "Software Development", job_type: "full_time", candidate_required_location: "Worldwide", publication_date: "2026-08-18T00:00:00", salary: "$50k", description: "An entry level opportunity" };
  it("labels source-attributed provider jobs without inventing fields", () => {
    const item = normalizeRemotiveJob(job);
    expect(item.id).toBe("remotive-42");
    expect(item.sourceName).toBe("Remotive");
    expect(item.location).toBe("Worldwide");
  });
  it("derives transparent job kind and coarse level filters from provider text", () => {
    expect(inferOpportunityKind({ title: "Product Intern", job_type: "internship", description: "" })).toBe("internship");
    expect(inferSkillLevel(job)).toBe("entry");
  });
  it("keeps normalized career category available for an explicit career-path filter", () => {
    expect(normalizeRemotiveJob(job).careerPath).toBe("Software Development");
  });
});
