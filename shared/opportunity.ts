export type OpportunityKind = "job" | "internship" | "course";
export type OpportunitySkillLevel = "entry" | "early" | "experienced" | "all";
export type OpportunityProviderStatus = "live" | "unavailable";

export type Opportunity = {
  id: string;
  title: string;
  organization: string;
  kind: OpportunityKind;
  careerPath: string;
  location: string;
  skillLevel: OpportunitySkillLevel;
  employmentType?: string;
  salary?: string;
  publishedAt?: string;
  url: string;
  sourceName: string;
  sourceUrl: string;
  freshnessLabel: string;
};

export type OpportunityQuery = {
  search?: string;
  careerPath?: string;
  region?: string;
  skillLevel?: OpportunitySkillLevel;
  limit?: number;
};

export type OpportunityFeed = {
  status: OpportunityProviderStatus;
  sourceName: string;
  sourceNotice: string;
  cachedAt?: number;
  items: Opportunity[];
};
