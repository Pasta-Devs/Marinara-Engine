// ──────────────────────────────────────────────
// Routes: Text-to-Speech
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ttsConfigSchema,
  ttsSourceProfileFromConfig,
  TTS_SETTINGS_KEY,
  TTS_API_KEY_MASK,
  type TTSSource,
  type TTSConfig,
  type TTSSourceProfiles,
  type TTSVoicesResponse,
} from "@marinara-engine/shared";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { encryptApiKey, decryptApiKey } from "../utils/crypto.js";
import { isTtsLocalUrlsEnabled } from "../config/runtime-config.js";
import { safeFetch } from "../utils/security.js";

// OpenAI built-in voices used as fallback when the provider has no /audio/voices endpoint
const OPENAI_FALLBACK_VOICES = ["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];
const XAI_FALLBACK_VOICES = ["eve", "ara", "rex", "sal", "leo"];
const ELEVENLABS_DEFAULT_VOICES: VoiceOption[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", category: "ElevenLabs default" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", category: "ElevenLabs default" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", category: "ElevenLabs default" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", category: "ElevenLabs default" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", category: "ElevenLabs default" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", category: "ElevenLabs default" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", category: "ElevenLabs default" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", category: "ElevenLabs default" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", category: "ElevenLabs default" },
];

const TTS_SOURCE_DEFAULTS: Record<TTSSource, { baseUrl: string; model: string }> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "tts-1",
  },
  elevenlabs: {
    baseUrl: "https://api.elevenlabs.io",
    model: "eleven_multilingual_v2",
  },
  pockettts: {
    baseUrl: "http://localhost:49112",
    model: "pocket-tts",
  },
  xai: {
    baseUrl: "https://api.x.ai/v1",
    model: "grok-tts",
  },
};
const TTS_SOURCES: readonly TTSSource[] = ["openai", "elevenlabs", "pockettts", "xai"];

const ELEVENLABS_NON_TTS_MODELS = new Set(["eleven_ttv_v3", "eleven_multilingual_ttv_v2"]);
const ELEVENLABS_TTS_MODEL_ALIASES: Record<string, string> = {
  tts_v3: "eleven_v3",
  elevenlabs_v3: "eleven_v3",
  elevenlabs_tts_v3: "eleven_v3",
};
const NANOGPT_TTS_MODEL_ALIASES: Record<string, string> = {
  eleven_v3: "Elevenlabs-V3",
  "elevenlabs-v3": "Elevenlabs-V3",
  elevenlabs_v3: "Elevenlabs-V3",
  elevenlabs_tts_v3: "Elevenlabs-V3",
  eleven_turbo_v2_5: "Elevenlabs-Turbo-V2.5",
  eleven_flash_v2_5: "Elevenlabs-Turbo-V2.5",
};
const NANOGPT_ELEVENLABS_VOICES = [
  "Adam",
  "Alice",
  "Antoni",
  "Aria",
  "Arnold",
  "Bella",
  "Bill",
  "Brian",
  "Callum",
  "Charlie",
  "Charlotte",
  "Chris",
  "Daniel",
  "Domi",
  "Dorothy",
  "Drew",
  "Elli",
  "Emily",
  "Eric",
  "Ethan",
  "Fin",
  "Freya",
  "George",
  "Gigi",
  "Giovanni",
  "Grace",
  "James",
  "Jeremy",
  "Jessica",
  "Joseph",
  "Josh",
  "Laura",
  "Liam",
  "Lily",
  "Matilda",
  "Matthew",
  "Michael",
  "Nicole",
  "Rachel",
  "River",
  "Roger",
  "Ryan",
  "Sam",
  "Sarah",
  "Thomas",
  "Will",
];
const MAX_TTS_AUDIO_BYTES = 20 * 1024 * 1024;

const speakSchema = z.object({
  text: z.string().min(1).max(4096),
  speaker: z.string().max(120).optional(),
  tone: z.string().max(80).optional(),
  voice: z.string().max(200).optional(),
});

type VoiceOption = NonNullable<TTSVoicesResponse["voiceOptions"]>[number];

// ── Helpers ─────────────────────────────────────

function parseStoredConfig(raw: string | null) {
  if (!raw) return ttsConfigSchema.parse({});
  try {
    return ttsConfigSchema.parse(JSON.parse(raw));
  } catch {
    return ttsConfigSchema.parse({});
  }
}

function withActiveSourceProfile(config: TTSConfig): TTSConfig {
  return {
    ...config,
    sourceProfiles: {
      ...config.sourceProfiles,
      [config.source]: ttsSourceProfileFromConfig(config),
    },
  };
}

/** Mask every stored provider key before returning TTS configuration to the browser. */
export function maskTTSConfigForResponse(config: TTSConfig): TTSConfig {
  const configWithProfiles = withActiveSourceProfile(config);
  const sourceProfiles: TTSSourceProfiles = {};
  for (const source of TTS_SOURCES) {
    const profile = configWithProfiles.sourceProfiles[source];
    if (!profile) continue;
    sourceProfiles[source] = {
      ...profile,
      apiKey: profile.apiKey ? TTS_API_KEY_MASK : "",
    };
  }
  return {
    ...configWithProfiles,
    apiKey: configWithProfiles.apiKey ? TTS_API_KEY_MASK : "",
    sourceProfiles,
  };
}

/**
 * Preserve masked provider credentials, encrypt new keys, and keep the active
 * provider fields synchronized with its source profile.
 */
export function prepareTTSConfigForStorage(
  input: TTSConfig,
  existing: TTSConfig,
  encryptKey: (value: string) => string = encryptApiKey,
): TTSConfig {
  const existingProfiles = withActiveSourceProfile(existing).sourceProfiles;
  const sourceProfiles: TTSSourceProfiles = { ...existingProfiles };

  for (const source of TTS_SOURCES) {
    const incomingProfile = input.sourceProfiles[source];
    if (!incomingProfile) continue;
    sourceProfiles[source] = {
      ...incomingProfile,
      apiKey:
        incomingProfile.apiKey === TTS_API_KEY_MASK
          ? (existingProfiles[source]?.apiKey ?? "")
          : encryptKey(incomingProfile.apiKey),
    };
  }

  const apiKey =
    input.apiKey === TTS_API_KEY_MASK ? (existingProfiles[input.source]?.apiKey ?? "") : encryptKey(input.apiKey);
  const storedConfig: TTSConfig = {
    ...input,
    apiKey,
    sourceProfiles,
  };
  storedConfig.sourceProfiles[input.source] = ttsSourceProfileFromConfig(storedConfig);
  return storedConfig;
}

/**
 * Resolve the stored config and decrypt the API key.
 * Returns config with the plain-text key (never sent to client).
 */
async function loadConfig(storage: ReturnType<typeof createAppSettingsStorage>) {
  const raw = await storage.get(TTS_SETTINGS_KEY);
  const cfg = parseStoredConfig(raw);
  cfg.apiKey = decryptApiKey(cfg.apiKey);
  return cfg;
}

function responseFromVoiceOptions(
  source: TTSSource,
  voiceOptions: VoiceOption[],
  fromProvider: boolean,
): TTSVoicesResponse {
  return {
    voices: voiceOptions.map((v) => v.id),
    voiceOptions,
    fromProvider,
    source,
  };
}

function fallbackVoices(source: TTSSource): TTSVoicesResponse {
  if (source === "elevenlabs") {
    return responseFromVoiceOptions(source, ELEVENLABS_DEFAULT_VOICES, false);
  }

  if (source === "pockettts") {
    const voices = [
      "alba",
      "anna",
      "azelma",
      "bill_boerst",
      "caro_davy",
      "charles",
      "cosette",
      "eponine",
      "eve",
      "fantine",
      "george",
      "jane",
      "jean",
      "javert",
      "marius",
      "mary",
      "michael",
      "paul",
      "peter_yearsley",
      "stuart_bell",
      "vera",
    ];
    return responseFromVoiceOptions(
      source,
      voices.map((voice) => ({ id: voice, name: voice, category: "PocketTTS built-in" })),
      false,
    );
  }

  if (source === "xai") {
    return responseFromVoiceOptions(
      source,
      XAI_FALLBACK_VOICES.map((voice) => ({ id: voice, name: voice, category: "xAI built-in" })),
      false,
    );
  }

  return responseFromVoiceOptions(
    source,
    OPENAI_FALLBACK_VOICES.map((voice) => ({ id: voice, name: voice })),
    false,
  );
}

function configuredBaseUrl(cfg: TTSConfig) {
  const fallbackBase = TTS_SOURCE_DEFAULTS[cfg.source].baseUrl;
  return (cfg.baseUrl || fallbackBase).replace(/\/+$/, "");
}

function allowLocalTtsUrl(cfg: TTSConfig) {
  return cfg.source === "pockettts" || isTtsLocalUrlsEnabled();
}

function elevenLabsApiRoot(baseUrl: string) {
  return baseUrl.replace(/\/v\d+$/, "");
}

function isNanoGptBaseUrl(baseUrl: string) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === "nano-gpt.com" || hostname.endsWith(".nano-gpt.com");
  } catch {
    return baseUrl.toLowerCase().includes("nano-gpt.com");
  }
}

function nanoGptApiRoot(baseUrl: string) {
  return baseUrl.replace(/\/v\d+$/, "");
}

function nanoGptV1BaseUrl(baseUrl: string) {
  const root = nanoGptApiRoot(baseUrl);
  return root.endsWith("/v1") ? root : `${root}/v1`;
}

function pocketTtsV1BaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

function normalizeElevenLabsTtsModelId(model: string) {
  const trimmed = model.trim();
  return ELEVENLABS_TTS_MODEL_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

function normalizeNanoGptTtsModelId(model: string) {
  const trimmed = model.trim();
  return NANOGPT_TTS_MODEL_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

function clampElevenLabsSpeed(speed: number) {
  return Math.min(1.2, Math.max(0.7, Number.isFinite(speed) ? speed : 1));
}

function clampXaiSpeed(speed: number) {
  return Math.min(1.5, Math.max(0.7, Number.isFinite(speed) ? speed : 1));
}

function elevenLabsModelSupportsSpeed(model: string) {
  return model.trim().toLowerCase() !== "eleven_v3";
}

function isNanoGptElevenLabsModel(model: string) {
  return /^elevenlabs[-_]/i.test(model.trim());
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readLabels(value: unknown): Record<string, string | number | boolean | null> | null {
  const obj = asObject(value);
  if (!obj) return null;

  const labels = Object.fromEntries(
    Object.entries(obj).filter((entry): entry is [string, string | number | boolean | null] => {
      const [, labelValue] = entry;
      return (
        labelValue === null ||
        typeof labelValue === "string" ||
        typeof labelValue === "number" ||
        typeof labelValue === "boolean"
      );
    }),
  );

  return Object.keys(labels).length > 0 ? labels : null;
}

function parseVoiceOption(value: unknown): VoiceOption | null {
  if (typeof value === "string") {
    return value.trim() ? { id: value, name: value } : null;
  }

  const obj = asObject(value);
  if (!obj) return null;

  const id =
    readString(obj["voice_id"]) ??
    readString(obj["voiceId"]) ??
    readString(obj["id"]) ??
    readString(obj["name"]) ??
    readString(obj["voice_url"]) ??
    readString(obj["voiceUrl"]) ??
    readString(obj["url"]) ??
    readString(obj["path"]);
  if (!id) return null;

  const name = readString(obj["name"]) ?? readString(obj["display_name"]) ?? readString(obj["displayName"]) ?? id;
  const providerType = readString(obj["type"]);
  return {
    id,
    name,
    description: readString(obj["description"]) ?? null,
    previewUrl: readString(obj["preview_url"]) ?? readString(obj["previewUrl"]) ?? null,
    category: readString(obj["category"]) ?? providerType ?? null,
    labels: readLabels(obj["labels"]),
  };
}

function parseVoiceOptions(data: unknown): VoiceOption[] {
  const list = Array.isArray(data)
    ? data
    : (() => {
        const obj = asObject(data);
        const voices = obj?.["voices"] ?? obj?.["data"];
        return Array.isArray(voices) ? voices : [];
      })();

  return list.map(parseVoiceOption).filter((voice): voice is VoiceOption => Boolean(voice));
}

function mergeVoiceOptions(voiceOptions: VoiceOption[]): VoiceOption[] {
  const byId = new Map<string, VoiceOption>();
  for (const option of voiceOptions) {
    const existing = byId.get(option.id);
    if (!existing) {
      byId.set(option.id, option);
      continue;
    }

    byId.set(option.id, {
      ...existing,
      ...option,
      description: option.description ?? existing.description ?? null,
      previewUrl: option.previewUrl ?? existing.previewUrl ?? null,
      category: option.category ?? existing.category ?? null,
      labels: { ...(existing.labels ?? {}), ...(option.labels ?? {}) },
    });
  }
  return [...byId.values()];
}

function elevenLabsHeaders(apiKey: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["xi-api-key"] = apiKey;
  return headers;
}

function openAiHeaders(apiKey: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

function nanoGptHeaders(apiKey: string) {
  const headers = openAiHeaders(apiKey);
  if (apiKey) headers["x-api-key"] = apiKey;
  return headers;
}

function optionalBearerHeaders(apiKey: string) {
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

function openAiModelSupportsSpeechInstructions(model: string) {
  return /^gpt-4o/i.test(model.trim());
}

function articleForWord(value: string) {
  return /^[aeiou]/i.test(value.trim()) ? "an" : "a";
}

function readProviderErrorDetail(body: string): string {
  if (!body.trim()) return "";

  try {
    const data = JSON.parse(body) as Record<string, unknown>;
    const directDetail = readString(data.detail);
    const error = asObject(data.error);
    const detail = asObject(data.detail);
    const errorMessage = readString(error?.message) ?? readString(error?.status);
    const detailMessage = readString(detail?.message) ?? readString(detail?.status);
    return (
      readString(data.message) ??
      readString(data.error) ??
      errorMessage ??
      directDetail ??
      detailMessage ??
      body.slice(0, 500)
    );
  } catch {
    return body.slice(0, 500);
  }
}

export function isAllowedTTSAudioContentType(contentType: string | null): boolean {
  const normalized = contentType?.toLowerCase() ?? "";
  return normalized.includes("audio/") || normalized.includes("application/octet-stream");
}

function audioFormatMimeType(format: string): string {
  switch (format) {
    case "wav":
      return "audio/wav";
    default:
      return "audio/mpeg";
  }
}

function buildSpeechInstructions(input: { speaker?: string; tone?: string; includeSpeaker?: boolean }) {
  const parts: string[] = [];
  if (input.includeSpeaker !== false && input.speaker?.trim()) {
    parts.push(`Voice the line as ${input.speaker.trim()}.`);
  }
  const tone = input.tone?.trim();
  if (tone) {
    parts.push(`Use ${articleForWord(tone)} ${tone} tone.`);
  }
  if (parts.length === 0) return undefined;
  parts.push("Do not read speaker names, brackets, markup, or stage directions aloud.");
  return parts.join(" ");
}

export function buildElevenLabsTextInput(text: string, _tone?: string): string {
  return text;
}

export function resolveTTSRequestVoice(configuredVoice: string, requestedVoice?: string | null): string {
  const trimmedRequest = requestedVoice?.trim();
  return trimmedRequest || configuredVoice;
}

async function fetchElevenLabsVoiceOptions(
  baseUrl: string,
  apiKey: string,
  query: Record<string, string> = {},
): Promise<VoiceOption[]> {
  const voiceOptions: VoiceOption[] = [];
  let nextPageToken: string | null = null;

  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`${elevenLabsApiRoot(baseUrl)}/v2/voices`);
    url.searchParams.set("page_size", "100");
    url.searchParams.set("include_total_count", "false");
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    if (nextPageToken) {
      url.searchParams.set("next_page_token", nextPageToken);
    }

    const res = await safeFetch(url, {
      headers: elevenLabsHeaders(apiKey),
      signal: AbortSignal.timeout(10_000),
      policy: {
        allowLocal: isTtsLocalUrlsEnabled(),
        allowedProtocols: ["https:", "http:"],
        flagName: "TTS_LOCAL_URLS_ENABLED",
      },
      maxResponseBytes: 2 * 1024 * 1024,
    });

    if (!res.ok) throw new Error(`ElevenLabs voices request failed (${res.status})`);

    const data = await res.json();
    voiceOptions.push(...parseVoiceOptions(data));

    const obj = asObject(data);
    const hasMore = obj?.has_more === true;
    nextPageToken = readString(obj?.next_page_token) ?? null;
    if (!hasMore || !nextPageToken) break;
  }

  return voiceOptions;
}

async function fetchProviderVoices(cfg: TTSConfig): Promise<TTSVoicesResponse> {
  if (!cfg.enabled) return fallbackVoices(cfg.source);

  const base = configuredBaseUrl(cfg);

  if (cfg.source === "pockettts") {
    const res = await safeFetch(`${pocketTtsV1BaseUrl(base)}/voices`, {
      headers: optionalBearerHeaders(cfg.apiKey),
      signal: AbortSignal.timeout(10_000),
      policy: {
        allowLocal: true,
        allowedProtocols: ["https:", "http:"],
        flagName: "TTS_LOCAL_URLS_ENABLED",
      },
      maxResponseBytes: 2 * 1024 * 1024,
    });
    if (!res.ok) return fallbackVoices(cfg.source);
    const voices = mergeVoiceOptions(parseVoiceOptions(await res.json()));
    return voices.length > 0 ? responseFromVoiceOptions(cfg.source, voices, true) : fallbackVoices(cfg.source);
  }

  if (cfg.source === "elevenlabs") {
    if (!cfg.apiKey) return fallbackVoices(cfg.source);

    if (isNanoGptBaseUrl(base)) {
      return responseFromVoiceOptions(
        cfg.source,
        NANOGPT_ELEVENLABS_VOICES.map((voice) => ({ id: voice, name: voice, category: "NanoGPT ElevenLabs" })),
        true,
      );
    }

    const [defaultVoices, accountVoices] = await Promise.all([
      fetchElevenLabsVoiceOptions(base, cfg.apiKey, { voice_type: "default" }).catch(() => []),
      fetchElevenLabsVoiceOptions(base, cfg.apiKey).catch(() => []),
    ]);
    const voices = mergeVoiceOptions([...defaultVoices, ...accountVoices]);
    return voices.length > 0 ? responseFromVoiceOptions(cfg.source, voices, true) : fallbackVoices(cfg.source);
  }

  if (cfg.source === "xai") {
    if (!cfg.apiKey) return fallbackVoices(cfg.source);
    const res = await safeFetch(`${base}/tts/voices`, {
      headers: openAiHeaders(cfg.apiKey),
      signal: AbortSignal.timeout(10_000),
      policy: {
        allowLocal: false,
        allowedProtocols: ["https:"],
        flagName: "TTS_LOCAL_URLS_ENABLED",
      },
      maxResponseBytes: 2 * 1024 * 1024,
    });
    if (!res.ok) return fallbackVoices(cfg.source);
    const voices = parseVoiceOptions(await res.json());
    return voices.length > 0 ? responseFromVoiceOptions(cfg.source, voices, true) : fallbackVoices(cfg.source);
  }

  const res = await safeFetch(`${base}/audio/voices`, {
    headers: openAiHeaders(cfg.apiKey),
    signal: AbortSignal.timeout(10_000),
    policy: {
      allowLocal: allowLocalTtsUrl(cfg),
      allowedProtocols: ["https:", "http:"],
      flagName: "TTS_LOCAL_URLS_ENABLED",
    },
    maxResponseBytes: 2 * 1024 * 1024,
  });

  if (!res.ok) return fallbackVoices(cfg.source);

  const voices = parseVoiceOptions(await res.json());
  return voices.length > 0 ? responseFromVoiceOptions(cfg.source, voices, true) : fallbackVoices(cfg.source);
}

// ── Routes ──────────────────────────────────────

export async function ttsRoutes(app: FastifyInstance) {
  const storage = createAppSettingsStorage(app.db);

  /**
   * GET /api/tts/config
   * Returns TTS config with the API key masked.
   */
  app.get("/config", async () => {
    const raw = await storage.get(TTS_SETTINGS_KEY);
    const cfg = parseStoredConfig(raw);
    return maskTTSConfigForResponse(cfg);
  });

  /**
   * PUT /api/tts/config
   * Saves TTS config. Encrypts the API key before storage.
   * If apiKey equals the mask, the existing key is kept unchanged.
   */
  app.put("/config", async (req, reply) => {
    const input = ttsConfigSchema.parse(req.body);
    const existing = parseStoredConfig(await storage.get(TTS_SETTINGS_KEY));
    const storedConfig = prepareTTSConfigForStorage(input, existing);
    await storage.set(TTS_SETTINGS_KEY, JSON.stringify(storedConfig));
    return reply.status(204).send();
  });

  /**
   * GET /api/tts/voices
   * Fetches available voices from the configured provider.
   */
  app.get("/voices", async () => {
    const cfg = await loadConfig(storage);

    try {
      return await fetchProviderVoices(cfg);
    } catch {
      return fallbackVoices(cfg.source);
    }
  });

  /**
   * POST /api/tts/speak
   * Proxies a TTS request to the configured provider and streams the audio back.
   */
  app.post("/speak", async (req, reply) => {
    const { text, speaker, tone, voice } = speakSchema.parse(req.body);

    const cfg = await loadConfig(storage);

    if (!cfg.enabled) {
      return reply.status(400).send({ error: "TTS is not enabled" });
    }

    if (cfg.source === "elevenlabs" && !cfg.apiKey) {
      return reply.status(400).send({ error: "ElevenLabs API key is not configured" });
    }

    if (cfg.source === "xai" && !cfg.apiKey) {
      return reply.status(400).send({ error: "xAI API key is not configured" });
    }

    const requestVoice = resolveTTSRequestVoice(cfg.voice, voice);

    if (cfg.source === "elevenlabs" && !requestVoice) {
      return reply.status(400).send({ error: "ElevenLabs voice is not selected" });
    }

    const base = configuredBaseUrl(cfg);
    const useNanoGptSpeech = isNanoGptBaseUrl(base);
    const usePocketTtsSpeech = cfg.source === "pockettts";
    const useXaiSpeech = cfg.source === "xai";
    const configuredModel = (cfg.model || TTS_SOURCE_DEFAULTS[cfg.source].model).trim();
    const model = useNanoGptSpeech
      ? normalizeNanoGptTtsModelId(configuredModel)
      : cfg.source === "elevenlabs"
        ? normalizeElevenLabsTtsModelId(configuredModel)
        : configuredModel;
    const normalizedModel = model.toLowerCase();
    if (cfg.source === "elevenlabs" && ELEVENLABS_NON_TTS_MODELS.has(normalizedModel)) {
      return reply.status(400).send({
        error: `ElevenLabs model "${model}" cannot generate text-to-speech`,
        detail: `That model is for Text to Voice / voice design. Use "eleven_v3" for Eleven v3 speech, or "eleven_multilingual_v2", "eleven_flash_v2_5", or "eleven_turbo_v2_5" for regular TTS.`,
      });
    }

    const audioFormat = cfg.source === "elevenlabs" || useXaiSpeech ? "mp3" : (cfg.audioFormat ?? "mp3");
    const nanoGptElevenLabsModel = useNanoGptSpeech && isNanoGptElevenLabsModel(model);
    const includeSpeed = useXaiSpeech
      ? true
      : useNanoGptSpeech
        ? !nanoGptElevenLabsModel
        : cfg.source === "elevenlabs"
          ? elevenLabsModelSupportsSpeed(model)
          : true;
    const elevenLabsSpeed = clampElevenLabsSpeed(cfg.speed);
    const xaiSpeed = clampXaiSpeed(cfg.speed);
    const url = useNanoGptSpeech
      ? `${nanoGptV1BaseUrl(base)}/audio/speech`
      : usePocketTtsSpeech
        ? `${pocketTtsV1BaseUrl(base)}/audio/speech`
        : useXaiSpeech
          ? `${base}/tts`
          : cfg.source === "elevenlabs"
            ? `${elevenLabsApiRoot(base)}/v1/text-to-speech/${encodeURIComponent(requestVoice)}?output_format=mp3_44100_128`
            : `${base}/audio/speech`;
    const providerText = cfg.source === "elevenlabs" ? buildElevenLabsTextInput(text, tone) : text;
    const elevenLabsLanguageCode = cfg.elevenLabsLanguageCode?.trim();
    const includeSpeakerInstructions = cfg.source !== "elevenlabs";
    const speechInstructions = useNanoGptSpeech
      ? !nanoGptElevenLabsModel && openAiModelSupportsSpeechInstructions(model)
        ? buildSpeechInstructions({ speaker, tone, includeSpeaker: includeSpeakerInstructions })
        : undefined
      : cfg.source === "openai" && openAiModelSupportsSpeechInstructions(model)
        ? buildSpeechInstructions({ speaker, tone })
        : undefined;

    let providerRes: Response;
    try {
      providerRes = await safeFetch(url, {
        method: "POST",
        headers: useNanoGptSpeech
          ? nanoGptHeaders(cfg.apiKey)
          : useXaiSpeech
            ? openAiHeaders(cfg.apiKey)
            : cfg.source === "elevenlabs"
              ? elevenLabsHeaders(cfg.apiKey)
              : openAiHeaders(cfg.apiKey),
        body: useNanoGptSpeech
          ? JSON.stringify({
              model,
              input: providerText,
              voice: requestVoice || "alloy",
              ...(includeSpeed ? { speed: cfg.speed } : {}),
              response_format: audioFormat,
              ...(speechInstructions ? { instructions: speechInstructions } : {}),
            })
          : useXaiSpeech
            ? JSON.stringify({
                text: providerText,
                voice_id: requestVoice || "eve",
                language: "auto",
                output_format: {
                  codec: audioFormat,
                  sample_rate: audioFormat === "mp3" ? 44_100 : 24_000,
                  ...(audioFormat === "mp3" ? { bit_rate: 128_000 } : {}),
                },
                ...(includeSpeed ? { speed: xaiSpeed } : {}),
              })
            : cfg.source === "elevenlabs"
              ? JSON.stringify({
                  text: providerText,
                  model_id: model,
                  ...(elevenLabsLanguageCode ? { language_code: elevenLabsLanguageCode } : {}),
                  voice_settings: {
                    stability: cfg.elevenLabsStability,
                    ...(includeSpeed ? { speed: elevenLabsSpeed } : {}),
                  },
                })
              : JSON.stringify({
                  model,
                  input: providerText,
                  voice: requestVoice || (usePocketTtsSpeech ? "alba" : ""),
                  ...(includeSpeed ? { speed: cfg.speed } : {}),
                  response_format: audioFormat,
                  ...(speechInstructions ? { instructions: speechInstructions } : {}),
                }),
        signal: AbortSignal.timeout(60_000),
        policy: {
          allowLocal: allowLocalTtsUrl(cfg),
          allowedProtocols: ["https:", "http:"],
          flagName: "TTS_LOCAL_URLS_ENABLED",
        },
        maxResponseBytes: MAX_TTS_AUDIO_BYTES,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.name === "TimeoutError" ? "TTS request timed out" : "TTS provider unreachable";
      req.log.error(err, "TTS provider request failed");
      return reply.status(502).send({ error: msg });
    }

    if (!providerRes.ok) {
      const body = await providerRes.text().catch(() => "");
      return reply
        .status(502)
        .send({ error: `TTS provider returned ${providerRes.status}`, detail: readProviderErrorDetail(body) });
    }

    const contentType = providerRes.headers.get("content-type");
    if (!isAllowedTTSAudioContentType(contentType)) {
      const body = await providerRes.text().catch(() => "");
      return reply.status(502).send({
        error: "TTS provider returned a non-audio response",
        detail: readProviderErrorDetail(body) || `Content-Type: ${contentType || "missing"}`,
      });
    }

    const audioBuffer = await providerRes.arrayBuffer();
    reply.header("Content-Type", contentType?.startsWith("audio/") ? contentType : audioFormatMimeType(audioFormat));
    reply.header("Content-Length", String(audioBuffer.byteLength));
    return reply.send(Buffer.from(audioBuffer));
  });
}
