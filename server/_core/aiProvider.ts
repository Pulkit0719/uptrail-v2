import { ENV } from "./env";

export type AIModelKind = "chat" | "image" | "transcription";

export interface AIProvider {
  model(kind: AIModelKind): string;
  request(path: string, init?: RequestInit): Promise<Response>;
}

const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

export class OpenAICompatibleProvider implements AIProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly models: Record<AIModelKind, string>,
  ) {}

  model(kind: AIModelKind) {
    return this.models[kind];
  }

  async request(path: string, init: RequestInit = {}) {
    if (!this.apiKey) throw new Error("AI_API_KEY is not configured");
    const url = new URL(path.replace(/^\//, ""), `${this.baseUrl.replace(/\/+$/, "")}/`);
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const headers = new Headers(init.headers);
        headers.set("authorization", `Bearer ${this.apiKey}`);
        if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }
        const response = await fetch(url, { ...init, headers });
        if (!RETRYABLE_STATUS.has(response.status) || attempt === 3) return response;
        await response.body?.cancel().catch(() => undefined);
        const retryAfterHeader = response.headers.get("retry-after");
        const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
        const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : 500 * 2 ** attempt;
        await new Promise(resolve => setTimeout(resolve, Math.min(delay, 10_000)));
      } catch (error) {
        lastError = error;
        if (attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("AI provider request failed");
  }
}

let provider: AIProvider | undefined;

export function getAIProvider(): AIProvider {
  provider ??= new OpenAICompatibleProvider(ENV.aiBaseUrl, ENV.aiApiKey, {
    chat: ENV.aiChatModel,
    image: ENV.aiImageModel,
    transcription: ENV.aiTranscriptionModel,
  });
  return provider;
}

export function setAIProviderForTests(value: AIProvider | undefined) {
  provider = value;
}
