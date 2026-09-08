import type { OpportunityQuery, OpportunitySkillLevel } from "./opportunity";

export type OpportunityFilterState = {
  searchText: string;
  careerPath: string;
  region: string;
  skillLevel: OpportunitySkillLevel;
};

export function buildOpportunityQuery(filters: OpportunityFilterState): OpportunityQuery & { limit: number } {
  const search = filters.searchText.trim();
  return {
    search: search || undefined,
    careerPath: filters.careerPath === "all" ? undefined : filters.careerPath,
    region: filters.region || "global",
    skillLevel: filters.skillLevel,
    limit: 12,
  };
}

