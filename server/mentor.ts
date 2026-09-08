import { eq } from "drizzle-orm";
import { learnerProfiles, learnerSkills } from "../drizzle/schema";
import { careers, getCareer, type LearnerSkill } from "../shared/careerData";
import { getDb } from "./db";
import { invokeLLM, listLLMModels, type Message } from "./_core/llm";

type MentorMessage = { role: "user" | "assistant"; content: string };

export async function getMentorContext(userId: number) {
  const db = await getDb();
  if (!db) return { targetCareer: "frontend-developer", countryCode: "GLOBAL", skills: [] as LearnerSkill[] };
  const [profile] = await db.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1);
  const skillRows = await db.select().from(learnerSkills).where(eq(learnerSkills.userId, userId));
  return {
    targetCareer: profile?.targetCareer || "frontend-developer",
    countryCode: profile?.countryCode || "GLOBAL",
    skills: skillRows.map((skill) => ({
      name: skill.name,
      level: skill.level,
      confidence: skill.confidence,
      score: skill.assessmentScore ?? undefined,
      projectCount: skill.projectCount,
    })),
  };
}

export function createMentorSystemPrompt(context: Awaited<ReturnType<typeof getMentorContext>>): string {
  const career = getCareer(context.targetCareer) ?? careers[0];
  const skills = context.skills.length ? context.skills.map((skill) => `${skill.name} (${skill.level}; ${skill.confidence})`).join(", ") : "No skill evidence recorded yet";
  return `You are Uptrail's AI Career Mentor: calm, practical, specific, and honest. You help people navigate their careers, not merely give generic encouragement. The learner's destination is ${career.title} in country context ${context.countryCode}. Their known skills are: ${skills}. The role requires: ${career.requiredSkills.map((skill) => skill.name).join(", ")}. Explain why advice follows from the learner's target, readiness, and skill dependencies. Recommend one high-impact next action and, where useful, a small time-boxed plan. Never invent accomplishments, job openings, salaries, qualifications, or assessment results. Do not make promises of employment. Keep your answer under 320 words and use concise markdown headings or bullets only when they improve clarity.`;
}

export async function mentorReply(userId: number, messages: MentorMessage[]): Promise<string> {
  const context = await getMentorContext(userId);
  const { data: models } = await listLLMModels();
  const model = models.find((item) => item.id === "gpt-5-mini")?.id ?? models.find((item) => item.id.startsWith("gpt-5"))?.id ?? models[0]?.id;
  const conversation: Message[] = [
    { role: "system", content: createMentorSystemPrompt(context) },
    ...messages.slice(-10).map((message) => ({ role: message.role, content: message.content.slice(0, 3000) })),
  ];
  const response = await invokeLLM({ model, messages: conversation, maxTokens: 700 });
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("AI mentor returned no usable content");
  return content;
}

