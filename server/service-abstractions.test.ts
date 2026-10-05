import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OpenAICompatibleProvider,
  setAIProviderForTests,
  type AIProvider,
} from "./_core/aiProvider";
import { invokeLLM } from "./_core/llm";

afterEach(() => {
  setAIProviderForTests(undefined);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("independent service abstractions", () => {
  it("keeps the AI key in the provider authorization header", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));
    const provider = new OpenAICompatibleProvider(
      "https://ai.example/v1",
      "server-secret",
      {
        chat: "chat-model",
      }
    );
    await provider.request("models");
    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer server-secret"
    );
  });

  it("lets the mentor call a replaceable provider", async () => {
    const provider: AIProvider = {
      model: () => "test-model",
      request: vi.fn(async () =>
        Response.json({
          id: "1",
          created: 1,
          model: "test-model",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "ok" },
              finish_reason: "stop",
            },
          ],
        })
      ),
    };
    setAIProviderForTests(provider);
    const result = await invokeLLM({
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result.choices[0]?.message.content).toBe("ok");
    expect(provider.request).toHaveBeenCalled();
  });

  it("surfaces an invalid-key response without retrying it", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 401 }));
    setAIProviderForTests(
      new OpenAICompatibleProvider(
        "https://openrouter.ai/api/v1",
        "invalid-test-key",
        { chat: "openrouter/free" }
      )
    );

    await expect(
      invokeLLM({ messages: [{ role: "user", content: "hello" }] })
    ).rejects.toThrow("LLM invoke failed (401)");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503])(
    "retries a retryable provider status and then fails safely (%s)",
    async status => {
      vi.useFakeTimers();
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
        async () =>
          new Response(null, {
            status,
            headers: { "retry-after": "0" },
          })
      );
      const provider = new OpenAICompatibleProvider(
        "https://openrouter.ai/api/v1",
        "test-key",
        { chat: "openrouter/free" }
      );

      const pending = provider.request("chat/completions");
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toMatchObject({ status });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    }
  );

  it("times out an unavailable provider", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          const rejectAbort = () =>
            reject(signal?.reason ?? new Error("request aborted"));
          if (signal?.aborted) rejectAbort();
          else signal?.addEventListener("abort", rejectAbort, { once: true });
        })
    );
    const provider = new OpenAICompatibleProvider(
      "https://openrouter.ai/api/v1",
      "test-key",
      { chat: "openrouter/free" }
    );

    const assertion = expect(provider.request("models")).rejects.toThrow(
      "AI provider request timed out"
    );
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("rejects a malformed provider response", async () => {
    setAIProviderForTests({
      model: () => "openrouter/free",
      request: vi.fn(async () => Response.json({ unexpected: true })),
    });

    await expect(
      invokeLLM({ messages: [{ role: "user", content: "hello" }] })
    ).rejects.toThrow("AI provider returned an invalid chat response");
  });
});
