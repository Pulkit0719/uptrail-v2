import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleProvider, setAIProviderForTests, type AIProvider } from "./_core/aiProvider";
import { invokeLLM } from "./_core/llm";
import { normalizeStorageKey } from "./storage";

afterEach(() => {
  setAIProviderForTests(undefined);
  vi.restoreAllMocks();
});

describe("independent service abstractions", () => {
  it("rejects traversal and accepts scoped object keys", () => {
    expect(normalizeStorageKey("users/42/resume.pdf")).toBe("users/42/resume.pdf");
    expect(() => normalizeStorageKey("../secret")).toThrow("Invalid storage key");
  });

  it("keeps the AI key in the provider authorization header", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const provider = new OpenAICompatibleProvider("https://ai.example/v1", "server-secret", {
      chat: "chat-model", image: "image-model", transcription: "audio-model",
    });
    await provider.request("models");
    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer server-secret");
  });

  it("lets the mentor call a replaceable provider", async () => {
    const provider: AIProvider = {
      model: () => "test-model",
      request: vi.fn(async () => Response.json({ id: "1", created: 1, model: "test-model", choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }] })),
    };
    setAIProviderForTests(provider);
    const result = await invokeLLM({ messages: [{ role: "user", content: "hello" }] });
    expect(result.choices[0]?.message.content).toBe("ok");
    expect(provider.request).toHaveBeenCalled();
  });
});
