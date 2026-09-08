export type SkillLevel = "Foundational" | "Developing" | "Proficient" | "Advanced";
export type SkillConfidence = "Self Reported" | "Assessment Verified" | "Project Verified";

export type CountryProfile = {
  code: string;
  name: string;
  currency: string;
  salaryLocale: string;
  languages: string[];
  educationSystem: string;
  qualifications: string[];
  academicLevels: string[];
  locationLabel: string;
};

export type SkillRequirement = {
  name: string;
  weight: number;
  targetLevel: SkillLevel;
  prerequisite?: string;
};

export type Career = {
  slug: string;
  title: string;
  family: "Technology" | "Product & Business" | "Design & Creative" | "Marketing" | "Finance";
  summary: string;
  difficulty: "Foundation" | "Intermediate" | "Advanced";
  demand: "Rising" | "Steady" | "Specialist";
  accent: string;
  responsibilities: string[];
  requiredSkills: SkillRequirement[];
  relatedCareers: string[];
  interviewTopics: string[];
  recommendedProjects: string[];
  salaryByCountry: Record<string, { range: string; context: string }>;
};

export type LearnerSkill = {
  name: string;
  level: SkillLevel;
  confidence: SkillConfidence;
  score?: number;
  projectCount?: number;
};

export type SkillGap = {
  name: string;
  targetLevel: SkillLevel;
  readiness: number;
  weight: number;
  status: "Ready" | "Strengthen" | "Build";
  priority: number;
  prerequisite?: string;
};

export type RoadmapMilestone = {
  id: string;
  title: string;
  description: string;
  duration: string;
  outcome: string;
  resources: string[];
  skillTags: string[];
};

export const countryProfiles: CountryProfile[] = [
  {
    code: "IN",
    name: "India",
    currency: "INR",
    salaryLocale: "en-IN",
    languages: ["English", "Hindi", "Tamil", "Telugu"],
    educationSystem: "School, diploma, undergraduate, postgraduate",
    qualifications: ["10th", "12th", "Diploma", "B.Tech", "B.E.", "BCA", "B.Sc", "MCA", "M.Tech", "MBA"],
    academicLevels: ["School", "Undergraduate", "Postgraduate", "Early career"],
    locationLabel: "City or state",
  },
  {
    code: "US",
    name: "United States",
    currency: "USD",
    salaryLocale: "en-US",
    languages: ["English", "Spanish"],
    educationSystem: "High school, college, graduate school",
    qualifications: ["High School", "Associate Degree", "Bachelor's Degree", "Master's Degree", "Bootcamp"],
    academicLevels: ["Freshman", "Sophomore", "Junior", "Senior", "Early career"],
    locationLabel: "City, state, or metro area",
  },
  {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    salaryLocale: "en-GB",
    languages: ["English", "Welsh"],
    educationSystem: "Secondary education, further education, higher education",
    qualifications: ["GCSE", "A Level", "Diploma", "BSc", "BA", "MSc", "MBA"],
    academicLevels: ["Year 1", "Year 2", "Year 3", "Graduate", "Early career"],
    locationLabel: "City, county, or region",
  },
  {
    code: "CA",
    name: "Canada",
    currency: "CAD",
    salaryLocale: "en-CA",
    languages: ["English", "French"],
    educationSystem: "Secondary school, college, university",
    qualifications: ["High School", "College Diploma", "Bachelor's Degree", "Master's Degree"],
    academicLevels: ["Year 1", "Year 2", "Year 3", "Year 4", "Early career"],
    locationLabel: "City, province, or territory",
  },
  {
    code: "GLOBAL",
    name: "Global / remote",
    currency: "USD",
    salaryLocale: "en-US",
    languages: ["English"],
    educationSystem: "Flexible and self-directed",
    qualifications: ["Secondary School", "Diploma", "Bachelor's Degree", "Master's Degree", "Certificate"],
    academicLevels: ["Student", "Career switcher", "Early career", "Professional"],
    locationLabel: "Region or time zone",
  },
];

export const careers: Career[] = [
  {
    slug: "frontend-developer",
    title: "Frontend Developer",
    family: "Technology",
    summary: "Design and build responsive, accessible interfaces that make digital products useful and intuitive.",
    difficulty: "Intermediate",
    demand: "Rising",
    accent: "#7C3AED",
    responsibilities: ["Translate product requirements into interfaces", "Build reusable UI systems", "Improve performance and accessibility"],
    requiredSkills: [
      { name: "HTML & CSS", weight: 14, targetLevel: "Proficient" },
      { name: "JavaScript", weight: 22, targetLevel: "Proficient", prerequisite: "Programming Fundamentals" },
      { name: "Git & GitHub", weight: 10, targetLevel: "Developing" },
      { name: "TypeScript", weight: 14, targetLevel: "Developing", prerequisite: "JavaScript" },
      { name: "React", weight: 18, targetLevel: "Developing", prerequisite: "JavaScript" },
      { name: "REST APIs", weight: 10, targetLevel: "Developing" },
      { name: "Testing", weight: 12, targetLevel: "Developing", prerequisite: "JavaScript" },
    ],
    relatedCareers: ["UI/UX Designer", "Full Stack Developer", "Mobile Developer"],
    interviewTopics: ["JavaScript fundamentals", "Component design", "Accessibility", "Browser performance"],
    recommendedProjects: ["Accessible portfolio", "Data-rich dashboard", "Collaborative planning tool"],
    salaryByCountry: {
      IN: { range: "₹4L–₹18L", context: "Annual base range" },
      US: { range: "$72k–$145k", context: "Annual base range" },
      GB: { range: "£32k–£72k", context: "Annual base range" },
      GLOBAL: { range: "Local market dependent", context: "Compare by location" },
    },
  },
  {
    slug: "data-analyst",
    title: "Data Analyst",
    family: "Technology",
    summary: "Turn complex information into clear, decision-ready insights through analysis, visualization, and communication.",
    difficulty: "Intermediate",
    demand: "Rising",
    accent: "#0F766E",
    responsibilities: ["Analyze datasets for trends", "Build decision-ready reports", "Partner with stakeholders on metrics"],
    requiredSkills: [
      { name: "Spreadsheet Analysis", weight: 12, targetLevel: "Proficient" },
      { name: "SQL", weight: 22, targetLevel: "Proficient" },
      { name: "Data Visualization", weight: 18, targetLevel: "Developing" },
      { name: "Statistics", weight: 18, targetLevel: "Developing" },
      { name: "Python", weight: 16, targetLevel: "Developing", prerequisite: "Programming Fundamentals" },
      { name: "Business Communication", weight: 14, targetLevel: "Proficient" },
    ],
    relatedCareers: ["Data Scientist", "Business Analyst", "Product Analyst"],
    interviewTopics: ["SQL queries", "Metric definition", "Statistics", "Insight storytelling"],
    recommendedProjects: ["Customer retention analysis", "Public data dashboard", "Experiment readout"],
    salaryByCountry: {
      IN: { range: "₹4L–₹15L", context: "Annual base range" },
      US: { range: "$65k–$125k", context: "Annual base range" },
      GB: { range: "£30k–£62k", context: "Annual base range" },
      GLOBAL: { range: "Local market dependent", context: "Compare by location" },
    },
  },
  {
    slug: "product-manager",
    title: "Product Manager",
    family: "Product & Business",
    summary: "Align customer needs, business goals, and delivery teams to bring meaningful products to market.",
    difficulty: "Advanced",
    demand: "Specialist",
    accent: "#C2410C",
    responsibilities: ["Frame customer problems", "Set product direction", "Align cross-functional delivery"],
    requiredSkills: [
      { name: "Product Discovery", weight: 20, targetLevel: "Developing" },
      { name: "User Research", weight: 15, targetLevel: "Developing" },
      { name: "Data Literacy", weight: 16, targetLevel: "Developing" },
      { name: "Communication", weight: 20, targetLevel: "Proficient" },
      { name: "Prioritization", weight: 16, targetLevel: "Developing" },
      { name: "Business Strategy", weight: 13, targetLevel: "Developing" },
    ],
    relatedCareers: ["Business Analyst", "UX Researcher", "Product Designer"],
    interviewTopics: ["Product sense", "Execution", "Strategy", "Leadership"],
    recommendedProjects: ["Product teardown", "Opportunity solution tree", "Metric improvement proposal"],
    salaryByCountry: {
      IN: { range: "₹10L–₹35L", context: "Annual base range" },
      US: { range: "$95k–$175k", context: "Annual base range" },
      GB: { range: "£45k–£95k", context: "Annual base range" },
      GLOBAL: { range: "Local market dependent", context: "Compare by location" },
    },
  },
  {
    slug: "ui-ux-designer",
    title: "UI/UX Designer",
    family: "Design & Creative",
    summary: "Create thoughtful, accessible experiences by combining user research, information design, and interface craft.",
    difficulty: "Intermediate",
    demand: "Rising",
    accent: "#BE185D",
    responsibilities: ["Understand user needs", "Design flows and interfaces", "Validate decisions with evidence"],
    requiredSkills: [
      { name: "User Research", weight: 18, targetLevel: "Developing" },
      { name: "Interaction Design", weight: 20, targetLevel: "Proficient" },
      { name: "Visual Design", weight: 16, targetLevel: "Proficient" },
      { name: "Figma", weight: 15, targetLevel: "Proficient" },
      { name: "Accessibility", weight: 15, targetLevel: "Developing" },
      { name: "Communication", weight: 16, targetLevel: "Developing" },
    ],
    relatedCareers: ["Product Designer", "Frontend Developer", "UX Researcher"],
    interviewTopics: ["Portfolio presentation", "Design process", "Research synthesis", "Accessibility"],
    recommendedProjects: ["Service redesign", "Mobile workflow prototype", "Accessible design system"],
    salaryByCountry: {
      IN: { range: "₹4L–₹16L", context: "Annual base range" },
      US: { range: "$70k–$135k", context: "Annual base range" },
      GB: { range: "£32k–£68k", context: "Annual base range" },
      GLOBAL: { range: "Local market dependent", context: "Compare by location" },
    },
  },
  {
    slug: "digital-marketer",
    title: "Digital Marketer",
    family: "Marketing",
    summary: "Plan, execute, and optimize digital campaigns that connect the right audience with a compelling value proposition.",
    difficulty: "Foundation",
    demand: "Steady",
    accent: "#A16207",
    responsibilities: ["Plan channel strategies", "Measure campaign performance", "Create audience-relevant content"],
    requiredSkills: [
      { name: "Content Strategy", weight: 16, targetLevel: "Developing" },
      { name: "SEO", weight: 15, targetLevel: "Developing" },
      { name: "Analytics", weight: 18, targetLevel: "Developing" },
      { name: "Campaign Management", weight: 20, targetLevel: "Developing" },
      { name: "Copywriting", weight: 15, targetLevel: "Proficient" },
      { name: "Experimentation", weight: 16, targetLevel: "Developing" },
    ],
    relatedCareers: ["Content Marketer", "Growth Analyst", "Brand Manager"],
    interviewTopics: ["Channel strategy", "Campaign analysis", "Audience segmentation", "Experiment design"],
    recommendedProjects: ["Campaign plan", "SEO audit", "Content performance analysis"],
    salaryByCountry: {
      IN: { range: "₹3L–₹12L", context: "Annual base range" },
      US: { range: "$50k–$105k", context: "Annual base range" },
      GB: { range: "£28k–£58k", context: "Annual base range" },
      GLOBAL: { range: "Local market dependent", context: "Compare by location" },
    },
  },
  {
    slug: "financial-analyst",
    title: "Financial Analyst",
    family: "Finance",
    summary: "Use financial data, business context, and clear modeling to support investment and operating decisions.",
    difficulty: "Intermediate",
    demand: "Steady",
    accent: "#1D4ED8",
    responsibilities: ["Build financial analyses", "Interpret business performance", "Communicate recommendations"],
    requiredSkills: [
      { name: "Financial Modeling", weight: 22, targetLevel: "Developing" },
      { name: "Accounting Fundamentals", weight: 18, targetLevel: "Proficient" },
      { name: "Spreadsheet Analysis", weight: 18, targetLevel: "Proficient" },
      { name: "Business Communication", weight: 14, targetLevel: "Developing" },
      { name: "Valuation", weight: 16, targetLevel: "Developing" },
      { name: "Data Visualization", weight: 12, targetLevel: "Developing" },
    ],
    relatedCareers: ["Investment Analyst", "Business Analyst", "Risk Analyst"],
    interviewTopics: ["Accounting", "Modeling", "Valuation", "Commercial awareness"],
    recommendedProjects: ["Three-statement model", "Public company analysis", "Budget variance dashboard"],
    salaryByCountry: {
      IN: { range: "₹4L–₹18L", context: "Annual base range" },
      US: { range: "$65k–$125k", context: "Annual base range" },
      GB: { range: "£32k–£70k", context: "Annual base range" },
      GLOBAL: { range: "Local market dependent", context: "Compare by location" },
    },
  },
];

export const frontendRoadmap: RoadmapMilestone[] = [
  {
    id: "frontend-foundations",
    title: "Strengthen JavaScript foundations",
    description: "Move from page scripting to confident problem solving with modern JavaScript patterns.",
    duration: "2 weeks",
    outcome: "Build reliable interactive UI features without copying snippets.",
    resources: ["JavaScript practice set", "DOM patterns guide"],
    skillTags: ["JavaScript", "Programming Fundamentals"],
  },
  {
    id: "frontend-tooling",
    title: "Work like a product team",
    description: "Use Git, TypeScript, and issue-based workflows to ship maintainable work.",
    duration: "2 weeks",
    outcome: "Contribute through clean commits and typed components.",
    resources: ["Git collaboration lab", "TypeScript essentials"],
    skillTags: ["Git & GitHub", "TypeScript"],
  },
  {
    id: "frontend-react",
    title: "Build composable React interfaces",
    description: "Learn component boundaries, data flow, state, and accessible interaction patterns.",
    duration: "3 weeks",
    outcome: "Ship a responsive, accessible interface with reusable components.",
    resources: ["React component workshop", "Accessibility checklist"],
    skillTags: ["React", "Accessibility"],
  },
  {
    id: "frontend-portfolio",
    title: "Prove capability through projects",
    description: "Create two outcome-oriented projects and document the decisions behind them.",
    duration: "3 weeks",
    outcome: "Publish portfolio-ready case studies and a clear project narrative.",
    resources: ["Project brief: analytics dashboard", "Portfolio storytelling guide"],
    skillTags: ["REST APIs", "Testing", "Communication"],
  },
];

const levelScore: Record<SkillLevel, number> = {
  Foundational: 35,
  Developing: 55,
  Proficient: 76,
  Advanced: 94,
};

const confidenceBoost: Record<SkillConfidence, number> = {
  "Self Reported": 0,
  "Assessment Verified": 6,
  "Project Verified": 10,
};

export function skillReadiness(skill?: LearnerSkill): number {
  if (!skill) return 0;
  const base = skill.score ?? levelScore[skill.level];
  return Math.min(100, Math.round(base + confidenceBoost[skill.confidence] + Math.min(8, (skill.projectCount ?? 0) * 3)));
}

export function calculateSkillGaps(career: Career, learnerSkills: LearnerSkill[]): SkillGap[] {
  const normalized = new Map(learnerSkills.map((skill) => [skill.name.toLowerCase(), skill]));
  return career.requiredSkills
    .map((requirement) => {
      const readiness = skillReadiness(normalized.get(requirement.name.toLowerCase()));
      const status: SkillGap["status"] = readiness >= 75 ? "Ready" : readiness >= 45 ? "Strengthen" : "Build";
      const priority = Math.round(requirement.weight * (1 - readiness / 100));
      return { ...requirement, readiness, status, priority };
    })
    .sort((a, b) => b.priority - a.priority);
}

export function calculateCareerReadiness(career: Career, learnerSkills: LearnerSkill[]): number {
  const gaps = calculateSkillGaps(career, learnerSkills);
  const weighted = gaps.reduce((sum, gap) => sum + gap.readiness * gap.weight, 0);
  const totalWeight = gaps.reduce((sum, gap) => sum + gap.weight, 0);
  return Math.round(weighted / totalWeight);
}

export function explainCareerMatch(career: Career, learnerSkills: LearnerSkill[]): string {
  const strengths = calculateSkillGaps(career, learnerSkills)
    .filter((gap) => gap.status === "Ready")
    .slice(0, 2)
    .map((gap) => gap.name);
  const buildNext = calculateSkillGaps(career, learnerSkills).find((gap) => gap.status !== "Ready");
  const strengthText = strengths.length ? `you already show momentum in ${strengths.join(" and ")}` : "your selected interests align with its core work";
  const nextText = buildNext ? `and the next focused step is ${buildNext.name}` : "and your current profile covers its core skill areas";
  return `${career.title} is a strong direction because ${strengthText}; ${nextText}.`;
}

export function getCareer(slug: string): Career | undefined {
  return careers.find((career) => career.slug === slug);
}

