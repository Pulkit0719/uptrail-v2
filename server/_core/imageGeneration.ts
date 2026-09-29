import { storagePut } from "../storage";
import { getAIProvider } from "./aiProvider";

export type GenerateImageOptions = { prompt: string; model?: string; quality?: string };
export type GenerateImageResponse = { url?: string };

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const provider = getAIProvider();
  const response = await provider.request("images/generations", {
    method: "POST",
    body: JSON.stringify({
      model: options.model ?? provider.model("image"),
      prompt: options.prompt,
      quality: options.quality ?? "medium",
      response_format: "b64_json",
    }),
  });
  if (!response.ok) throw new Error(`Image generation failed (${response.status})`);
  const result = await response.json() as { data?: Array<{ b64_json?: string }> };
  const encoded = result.data?.[0]?.b64_json;
  if (!encoded) throw new Error("Image provider returned no image data");
  const saved = await storagePut(`generated/${Date.now()}.png`, Buffer.from(encoded, "base64"), "image/png");
  return { url: saved.url };
}

export async function listImageModels() {
  return { models: [{ id: getAIProvider().model("image") }] };
}
