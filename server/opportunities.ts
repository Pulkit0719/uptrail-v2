import type { Opportunity, OpportunityFeed, OpportunityQuery, OpportunitySkillLevel } from "../shared/opportunity";

type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
};

type RemotiveResponse = { jobs?: RemotiveJob[] };
type CachedFeed = { value: OpportunityFeed; expiresAt: number };
const cache = new Map<string, CachedFeed>();
const CACHE_MS = 6 * 60 * 60 * 1000;
const REMOTIVE_URL = "https://remotive.com/api/remote-jobs";

function cleanHtml(value = ""): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export function inferOpportunityKind(job: Pick<RemotiveJob, "title" | "job_type" | "description">): "job" | "internship" {
  const text = `${job.title} ${job.job_type ?? ""} ${cleanHtml(job.description)}`.toLowerCase();
  return /intern(ship)?|trainee|apprentice/.test(text) ? "internship" : "job";
}

export function inferSkillLevel(job: Pick<RemotiveJob, "title" | "description">): OpportunitySkillLevel {
  const text = `${job.title} ${cleanHtml(job.description)}`.toLowerCase();
  if (/intern|graduate|junior|entry.?level|associate|0.?[-–]?2 years/.test(text)) return "entry";
  if (/mid.?level|early career|2.?[-–]?4 years/.test(text)) return "early";
  if (/senior|lead|staff|principal|manager|director/.test(text)) return "experienced";
  return "all";
}

export function normalizeRemotiveJob(job: RemotiveJob): Opportunity {
  return {
    id: `remotive-${job.id}`,
    title: job.title,
    organization: job.company_name,
    kind: inferOpportunityKind(job),
    careerPath: job.category || "Remote work",
    location: job.candidate_required_location || "Remote",
    skillLevel: inferSkillLevel(job),
    employmentType: job.job_type?.replaceAll("_", " "),
    salary: job.salary,
    publishedAt: job.publication_date,
    url: job.url,
    sourceName: "Remotive",
    sourceUrl: job.url,
    freshnessLabel: "Provider listings are delayed by 24 hours.",
  };
}

function matchesRegion(item: Opportunity, region?: string) {
  if (!region || region === "global") return true;
  const candidateLocation = item.location.toLowerCase();
  return candidateLocation.includes(region.toLowerCase()) || candidateLocation.includes("worldwide");
}

export async function getLiveOpportunities(query: OpportunityQuery = {}): Promise<OpportunityFeed> {
  const normalizedQuery = {
    search: query.search?.trim().slice(0, 80) || "",
    careerPath: query.careerPath?.trim().slice(0, 80) || "",
    region: query.region?.trim().slice(0, 80) || "global",
    skillLevel: query.skillLevel || "all",
    limit: Math.min(Math.max(query.limit ?? 12, 1), 24),
  };
  const cacheKey = JSON.stringify(normalizedQuery);
  const previous = cache.get(cacheKey);
  if (previous && previous.expiresAt > Date.now()) return previous.value;

  try {
    const params = new URLSearchParams({ limit: String(Math.max(normalizedQuery.limit * 3, 12)) });
    if (normalizedQuery.search) params.set("search", normalizedQuery.search);
    const response = await fetch(`${REMOTIVE_URL}?${params.toString()}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    const payload = await response.json() as RemotiveResponse;
    const items = (payload.jobs ?? [])
      .map(normalizeRemotiveJob)
      .filter((item) => !normalizedQuery.careerPath || item.careerPath.toLowerCase().includes(normalizedQuery.careerPath.toLowerCase()))
      .filter((item) => matchesRegion(item, normalizedQuery.region))
      .filter((item) => normalizedQuery.skillLevel === "all" || item.skillLevel === normalizedQuery.skillLevel || item.skillLevel === "all")
      .slice(0, normalizedQuery.limit);
    const value: OpportunityFeed = {
      status: "live",
      sourceName: "Remotive",
      sourceNotice: "Source: Remotive. Listings are provider-delayed by 24 hours and link to the original source.",
      cachedAt: Date.now(),
      items,
    };
    cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_MS });
    return value;
  } catch {
    return {
      status: "unavailable",
      sourceName: "Remotive",
      sourceNotice: "The live opportunity provider is temporarily unavailable. Uptrail will not show stale or invented listings as live data.",
      items: [],
    };
  }
}
