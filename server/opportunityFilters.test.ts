import { describe, expect, it } from "vitest";
import { buildOpportunityQuery } from "../shared/opportunityFilters";

describe("opportunity filter state mapping", () => {
  it("removes empty generic filters while preserving explicit career, region, and level selections", () => {
    expect(buildOpportunityQuery({ searchText: "  ", careerPath: "all", region: "global", skillLevel: "all" })).toEqual({ search: undefined, careerPath: undefined, region: "global", skillLevel: "all", limit: 12 });
    expect(buildOpportunityQuery({ searchText: " frontend ", careerPath: "software", region: "india", skillLevel: "entry" })).toEqual({ search: "frontend", careerPath: "software", region: "india", skillLevel: "entry", limit: 12 });
  });
});

