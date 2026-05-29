import { ttsConfigSchema, type TTSConfig, type TTSVoicesResponse } from "../../engine/contracts/types/tts";
import { invokeTauri } from "./tauri-client";

export interface TtsSpeakInput {
  text: string;
  speaker?: string;
  tone?: string;
  voice?: string;
}

interface TtsSpeakResponse {
  audioBase64?: string;
  base64?: string;
  audio?: string;
  contentType?: string;
  mimeType?: string;
  ok?: boolean;
  message?: string;
  error?: string;
}

function isTtsSpeakResponse(value: unknown): value is TtsSpeakResponse {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function ttsFailureMessage(response: unknown): string {
  if (!isTtsSpeakResponse(response)) {
    return `TTS request returned an invalid response: ${String(response)}`;
  }
  return optionalString(response.error) ?? optionalString(response.message) ?? "TTS request did not return audio.";
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const chunks: ArrayBuffer[] = [];
  for (let offset = 0; offset < binary.length; offset += 8192) {
    const slice = binary.slice(offset, offset + 8192);
    const bytes = new Uint8Array(slice.length);
    for (let index = 0; index < slice.length; index += 1) {
      bytes[index] = slice.charCodeAt(index);
    }
    chunks.push(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  return new Blob(chunks, { type: contentType });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeTTSConfigResponse(value: unknown): TTSConfig {
  if (!isRecord(value)) {
    return ttsConfigSchema.parse(value);
  }

  const raw = value;
  const config = ttsConfigSchema.parse({});
  const fields = ttsConfigSchema.shape;

  for (const key of Object.keys(fields) as Array<keyof TTSConfig>) {
    if (!(key in raw)) continue;
    const parsed = fields[key].safeParse(raw[key]);
    if (parsed.success) {
      (config as Record<keyof TTSConfig, unknown>)[key] = parsed.data;
    }
  }

  return config;
}

export const ttsApi = {
  config: async () => normalizeTTSConfigResponse(await invokeTauri<unknown>("tts_config")),
  updateConfig: async (config: TTSConfig) =>
    invokeTauri<void>("tts_update_config", { config: ttsConfigSchema.parse(config) }),
  voices: () => invokeTauri<TTSVoicesResponse>("tts_voices"),
  speak: async (input: TtsSpeakInput, signal?: AbortSignal): Promise<Blob> => {
    throwIfAborted(signal);
    const response = await invokeTauri<TtsSpeakResponse>("tts_speak", { input });
    throwIfAborted(signal);
    if (!isTtsSpeakResponse(response)) {
      throw new Error(ttsFailureMessage(response));
    }
    const audio = optionalString(response.audioBase64) ?? optionalString(response.base64) ?? optionalString(response.audio);
    if (!audio) {
      throw new Error(ttsFailureMessage(response));
    }
    return base64ToBlob(audio, optionalString(response.contentType) ?? optionalString(response.mimeType) ?? "audio/mpeg");
  },
};
