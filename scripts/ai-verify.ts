import "dotenv/config";
import { ENV, validateConfiguration } from "../server/_core/env";
import { invokeLLM } from "../server/_core/llm";
import { extractMentorContent } from "../server/mentor";

async function verifyAI() {
  console.log("Uptrail AI Provider Verification");
  console.log("---------------------------------");
  console.log(`AI Base URL: ${ENV.aiBaseUrl}`);
  console.log(`AI Chat Model: ${ENV.aiChatModel}`);

  const config = validateConfiguration();
  if (config.errors.some(err => err.includes("AI_"))) {
    console.error("Configuration errors:");
    for (const error of config.errors.filter(err => err.includes("AI_"))) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  const isOpenRouter = ENV.aiBaseUrl.toLowerCase().includes("openrouter.ai");
  const isFreeModel = ENV.aiChatModel === "openrouter/free" || ENV.aiChatModel.endsWith(":free");

  if (isOpenRouter && !isFreeModel) {
    console.error("FAILED: Non-free model configured for OpenRouter. Paid fallback is strictly prohibited.");
    process.exitCode = 1;
    return;
  }

  console.log(`Free-only model enforcement: PASS (${ENV.aiChatModel})`);

  if (!ENV.aiApiKey) {
    console.log("AI_API_KEY is not configured in local environment.");
    console.log("Verifying offline/unconfigured safety...");
    try {
      await invokeLLM({ messages: [{ role: "user", content: "ping" }] });
      console.error("FAILED: invokeLLM succeeded without API key!");
      process.exitCode = 1;
      return;
    } catch (err: any) {
      if (err.message?.includes("AI_API_KEY is not configured")) {
        console.log("Graceful unconfigured rejection: PASS");
      } else {
        console.log(`Graceful rejection with: ${err.message}`);
      }
    }
    console.log("RESULT: AI provider is safely optional. No secrets exposed.");
    return;
  }

  console.log("AI_API_KEY detected (hidden for security). Testing live connectivity...");

  try {
    const startTime = Date.now();
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are a test assistant. Reply with one word only: READY" },
        { role: "user", content: "Status check" },
      ],
      maxTokens: 20,
    });
    const elapsed = Date.now() - startTime;
    const content = extractMentorContent(result);

    console.log(`Live response received in ${elapsed}ms: PASS`);
    console.log(`Reported model: ${result.model}`);
    console.log(`Response length: ${content.trim().length} chars`);
    console.log("AI live verification: PASS");
  } catch (error: any) {
    console.error("Live AI test failed:");
    console.error(`- Message: ${error?.message || error}`);
    process.exitCode = 1;
  }
}

verifyAI();
