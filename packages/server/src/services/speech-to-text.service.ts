// ──────────────────────────────────────────────
// Speech to Text: an OpenAI-compatible transcription server
// that Calls can use instead of Local Whisper
// ──────────────────────────────────────────────
import {
  SPEECH_TO_TEXT_DEFAULT_MODEL,
  SPEECH_TO_TEXT_SETTINGS_KEY,
  TTS_API_KEY_MASK,
  speechToTextConfigSchema,
  type CapabilitySpeechTranscribeOptions,
  type SpeechToTextConfig,
} from "@marinara-engine/shared";
import { z } from "zod";
import type { DB } from "../db/connection.js";
import { isSttLocalUrlsEnabled } from "../config/runtime-config.js";
import { logger } from "../lib/logger.js";
import { decryptApiKey, encryptApiKey } from "../utils/crypto.js";
import { safeFetch } from "../utils/security.js";
import { createAppSettingsStorage } from "./storage/app-settings.storage.js";

/** OpenAI's own upload limit. A call recording (at most a minute of 16 kHz WAV) stays far below it. */
export const SPEECH_TO_TEXT_MAX_AUDIO_BYTES = 25 * 1024 * 1024;
/** A slow self-hosted server can need a while for a full minute of speech. */
const SPEECH_TO_TEXT_TIMEOUT_MS = 120_000;
const SPEECH_TO_TEXT_MAX_RESPONSE_BYTES = 1024 * 1024;
const SAFE_FILENAME = /^[\w.-]{1,80}$/u;
const SAFE_AUDIO_TYPE = /^audio\/[\w.+-]{1,40}$/u;
// The saved key is encrypted, which more than doubles its length, so the browser's key limit does not apply.
const storedConfigSchema = speechToTextConfigSchema.extend({ apiKey: z.string().default("") });

function parseStoredConfig(raw: string | null): SpeechToTextConfig {
  if (raw) {
    try {
      const parsed = storedConfigSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // Unreadable settings count as off, which keeps Local Whisper.
    }
  }
  return speechToTextConfigSchema.parse({});
}

async function readStoredConfig(db: DB): Promise<SpeechToTextConfig> {
  return parseStoredConfig(await createAppSettingsStorage(db).get(SPEECH_TO_TEXT_SETTINGS_KEY));
}

/** The saved settings for the browser: the key is replaced by the mask. */
export async function readMaskedSpeechToTextConfig(db: DB): Promise<SpeechToTextConfig> {
  const config = await readStoredConfig(db);
  return { ...config, apiKey: config.apiKey ? TTS_API_KEY_MASK : "" };
}

let configWrites: Promise<unknown> = Promise.resolve();

/** Save settings from the browser. The mask keeps the saved key; any other value replaces it, encrypted. */
export function saveSpeechToTextConfig(db: DB, input: SpeechToTextConfig): Promise<void> {
  // One write at a time, so a save sending the mask cannot put back a key a newer save replaced.
  const run = configWrites.then(async () => {
    const existing = await readStoredConfig(db);
    const apiKey = input.apiKey === TTS_API_KEY_MASK ? existing.apiKey : encryptApiKey(input.apiKey.trim());
    await createAppSettingsStorage(db).set(SPEECH_TO_TEXT_SETTINGS_KEY, JSON.stringify({ ...input, apiKey }));
  });
  configWrites = run.catch(() => undefined);
  return run;
}

/** The saved settings with the key decrypted, for server-side requests only. */
export async function loadSpeechToTextConfig(db: DB): Promise<SpeechToTextConfig> {
  const config = await readStoredConfig(db);
  return { ...config, apiKey: decryptApiKey(config.apiKey) };
}

function transcriptionUrl(baseUrl: string): URL {
  // Server guides often show the full endpoint, so accept that as well as the API root.
  const root = baseUrl
    .trim()
    .replace(/\/+$/u, "")
    .replace(/\/audio\/transcriptions$/iu, "");
  let url: URL;
  try {
    url = new URL(`${root}/audio/transcriptions`);
  } catch {
    throw new Error("The speech-to-text server URL is not a valid web address.");
  }
  // Like Decision connections: fetch refuses a user name or password and would log it in its error,
  // and a ? or # would swallow the /audio/transcriptions path.
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Remove the user name, password, ? or # from the speech-to-text server URL.");
  }
  return url;
}

function readErrorDetail(body: string): string {
  try {
    const data = JSON.parse(body) as { error?: unknown; message?: unknown; detail?: unknown };
    const nested = data.error && typeof data.error === "object" ? (data.error as { message?: unknown }).message : null;
    const message = [nested, data.message, data.detail, data.error].find((value) => typeof value === "string");
    if (typeof message === "string") return message.slice(0, 300);
  } catch {
    // Not JSON: fall back to the raw text.
  }
  return body.trim().slice(0, 300);
}

function readTranscript(body: string, contentType: string): string {
  try {
    const data = JSON.parse(body) as { text?: unknown } | null;
    if (data && typeof data.text === "string") return data.text.trim();
  } catch {
    // A server asked for JSON may still answer in plain text.
    if (!/json/iu.test(contentType)) return body.trim();
  }
  throw new Error("The speech-to-text server answered without any text.");
}

/** Send recorded audio to the server and return its transcript. Errors carry a message the user can act on. */
export async function transcribeWithSpeechToTextServer(
  config: SpeechToTextConfig,
  audio: Uint8Array,
  options: CapabilitySpeechTranscribeOptions & { timeoutMs?: number } = {},
): Promise<string> {
  if (!config.baseUrl.trim()) throw new Error("Speech to Text has no server URL.");
  if (audio.byteLength === 0) throw new Error("There is no audio to transcribe.");
  if (audio.byteLength > SPEECH_TO_TEXT_MAX_AUDIO_BYTES) {
    throw new Error("The recording is too large for the speech-to-text server.");
  }
  const endpoint = transcriptionUrl(config.baseUrl);
  const filename = options.filename && SAFE_FILENAME.test(options.filename) ? options.filename : "audio.wav";
  const mimeType = options.mimeType && SAFE_AUDIO_TYPE.test(options.mimeType) ? options.mimeType : "audio/wav";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), filename);
  form.append("model", config.model || SPEECH_TO_TEXT_DEFAULT_MODEL);
  form.append("response_format", "json");
  if (config.language) form.append("language", config.language);
  // Encode the upload before sending: cancelling a request while undici still streams a FormData
  // body throws outside the request's promise and takes the whole server down.
  const upload = new Request("http://upload.invalid", { method: "POST", body: form });
  const headers: Record<string, string> = { "Content-Type": upload.headers.get("content-type") ?? "" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const uploadBody = new Uint8Array(await upload.arrayBuffer());

  const timeout = AbortSignal.timeout(options.timeoutMs ?? SPEECH_TO_TEXT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await safeFetch(endpoint, {
      method: "POST",
      headers,
      body: uploadBody,
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
      policy: {
        // Like model providers: a server on this machine works as is; another private address needs the opt-in.
        allowLocal: isSttLocalUrlsEnabled(),
        allowLoopback: true,
        allowedProtocols: ["https:", "http:"],
        flagName: "STT_LOCAL_URLS_ENABLED",
      },
      maxResponseBytes: SPEECH_TO_TEXT_MAX_RESPONSE_BYTES,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (timeout.aborted) throw new Error("The speech-to-text server took too long to answer.");
    // A refused address already says which .env setting allows it; anything else is a network failure.
    if (error instanceof Error && error.message.startsWith("Refused to fetch")) throw error;
    logger.warn(error, "[speech-to-text] Could not reach the speech-to-text server");
    throw new Error("Could not reach the speech-to-text server.");
  }

  const body = await response.text();
  if (!response.ok) {
    const detail = readErrorDetail(body);
    throw new Error(`The speech-to-text server answered ${response.status}${detail ? `: ${detail}` : "."}`);
  }
  const text = readTranscript(body, response.headers.get("content-type") ?? "");
  logger.debug("[speech-to-text] Transcribed %d bytes of audio into %d characters", audio.byteLength, text.length);
  return text;
}

/** Transcribe with the saved server, or resolve null while it is off so the caller keeps Local Whisper. */
export async function transcribeWithSavedSpeechToTextServer(
  db: DB,
  audio: Uint8Array,
  options?: CapabilitySpeechTranscribeOptions,
): Promise<string | null> {
  const config = await loadSpeechToTextConfig(db);
  if (!config.enabled || !config.baseUrl) return null;
  // Pass on only the documented options, so a package cannot lift the host's time limit.
  const { filename, mimeType, signal } = options ?? {};
  return transcribeWithSpeechToTextServer(config, audio, { filename, mimeType, signal });
}

/** One second of 16 kHz mono silence: enough for a server to accept the upload and answer. */
export function createSilentTestClip(): Uint8Array {
  const sampleRate = 16_000;
  const dataBytes = sampleRate * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write("WAVE", 8, "ascii");
  wav.write("fmt ", 12, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(dataBytes, 40);
  return wav;
}
