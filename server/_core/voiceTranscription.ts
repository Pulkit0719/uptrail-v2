import { storageRead } from "../storage";
import { getAIProvider } from "./aiProvider";

export type TranscribeOptions = { audioUrl: string; language?: string; prompt?: string };
export type TranscriptionError = { error: string; code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "SERVICE_ERROR"; details?: string };
export type TranscriptionResponse = { task: "transcribe"; language: string; duration: number; text: string; segments: unknown[] };

export async function transcribeAudio(options: TranscribeOptions): Promise<TranscriptionResponse | TranscriptionError> {
  try {
    const parsed = new URL(options.audioUrl, "http://uptrail.local");
    if (!parsed.pathname.startsWith("/storage/")) {
      return { error: "Only Uptrail-managed storage URLs can be transcribed", code: "INVALID_FORMAT" };
    }
    const key = decodeURIComponent(parsed.pathname.slice("/storage/".length));
    const audio = await storageRead(key);
    if (audio.data.byteLength > 16 * 1024 * 1024) return { error: "Audio exceeds 16 MB", code: "FILE_TOO_LARGE" };
    const provider = getAIProvider();
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio.data)], { type: audio.contentType }), "audio");
    form.append("model", provider.model("transcription"));
    form.append("response_format", "verbose_json");
    if (options.language) form.append("language", options.language);
    if (options.prompt) form.append("prompt", options.prompt);
    const response = await provider.request("audio/transcriptions", { method: "POST", body: form });
    if (!response.ok) return { error: "Transcription provider rejected the request", code: "TRANSCRIPTION_FAILED", details: `HTTP ${response.status}` };
    const result = await response.json() as Partial<TranscriptionResponse>;
    if (!result.text) return { error: "Transcription provider returned no text", code: "SERVICE_ERROR" };
    return { task: "transcribe", language: result.language ?? options.language ?? "unknown", duration: result.duration ?? 0, text: result.text, segments: result.segments ?? [] };
  } catch (error) {
    return { error: "Voice transcription failed", code: "SERVICE_ERROR", details: error instanceof Error ? error.message : "Unknown error" };
  }
}
