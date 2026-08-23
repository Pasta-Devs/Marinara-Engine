// ──────────────────────────────────────────────
// Routes: Text-to-Speech
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { access, mkdir, readdir, rename, unlink, writeFile } from "fs/promises";
import { join } from "path";
import {
  ttsConfigSchema,
  ttsSourceProfileFromConfig,
  normalizeMusicEnemyTier,
  TTS_SETTINGS_KEY,
  TTS_API_KEY_MASK,
  ttsRoleplaySpeakerExtractorResponseSchema,
  type TTSSource,
  type TTSConfig,
  type TTSRoleplaySpeakerExtractorResponse,
  type TTSSourceProfiles,
  type TTSModelsResponse,
  type TTSVoicesResponse,
} from "@marinara-engine/shared";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { encryptApiKey, decryptApiKey } from "../utils/crypto.js";
import { getChatGenerationTimeoutMs, isTtsLocalUrlsEnabled } from "../config/runtime-config.js";
import { safeFetch } from "../utils/security.js";
import { logger, logDebugOverride } from "../lib/logger.js";
import { buildAssetManifest, GAME_ASSETS_DIR } from "../services/game/asset-manifest.service.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";
import { resolveBaseUrl } from "../services/generation/connection-base-url.js";
import { resolveStoredChatOptions, resolveStoredMaxTokens } from "../services/generation/generation-parameters.js";
import { clampGenerationMaxOutputTokens } from "../services/generation/output-token-limits.js";

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
const ELEVENLABS_FALLBACK_MODELS = [
  "eleven_v3",
  "eleven_multilingual_v2",
  "eleven_flash_v2_5",
  "eleven_turbo_v2_5",
  "eleven_flash_v2",
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
    baseUrl: "http://localhost:8000",
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
const MAX_GAME_AUDIO_BYTES = 60 * 1024 * 1024;
const gameAudioGenerationLocks = new Map<string, Promise<{ tag: string; path: string; cached: boolean }>>();
let gameAssetManifestRebuildTimer: ReturnType<typeof setTimeout> | null = null;

const speakSchema = z.object({
  text: z.string().min(1).max(4096),
  speaker: z.string().max(120).optional(),
  tone: z.string().max(80).optional(),
  voice: z.string().max(200).optional(),
  /** Optional audio-connection override (#5146); absent = default/legacy resolution. */
  audioConnectionId: z.string().optional(),
});

const roleplaySpeakerExtractorSchema = z.object({
  message: z.string().trim().min(1).max(100_000),
  group: z.string().trim().max(500).default(""),
  user: z.string().trim().max(120).default("User"),
  characters: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  messageAuthor: z.string().trim().max(120).default(""),
  debugMode: z.boolean().default(false),
});

const extractedDialogueSchema = z.object({
  dialogue: z
    .array(
      z.object({
        speaker: z.string().trim().min(1).max(120),
        text: z.string().trim().min(1).max(100_000),
        speech: z.string().trim().min(1).max(100_000).optional(),
      }),
    )
    .max(500),
});

const gameAudioSchema = z.object({
  kind: z.enum(["sfx", "music"]),
  prompt: z.string().trim().min(1).max(4_100),
  /** Optional audio-connection override (#5146); absent = default/legacy resolution. */
  audioConnectionId: z.string().optional(),
  /** Context-track request (#5161): a persistent composition generated ONCE
   *  per area slug or encounter tier into the scoreable music library
   *  (music/<axis>/<key>/), instead of a throwaway per-prompt clip. Music only. */
  context: z
    .object({
      axis: z.enum(["area", "tier"]),
      key: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .regex(/^[a-z0-9][a-z0-9_-]*$/),
      /** Composition length; context tracks default to 120s. */
      lengthMs: z.number().int().min(10_000).max(300_000).optional(),
    })
    .optional(),
});

const AUDIO_FILE_PATTERN = /\.(mp3|wav|ogg|m4a|flac)$/i;

type VoiceOption = NonNullable<TTSVoicesResponse["voiceOptions"]>[number];
type ModelOption = TTSModelsResponse["models"][number];

function normalizeGameAudioPrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, " ");
}

function scheduleGameAssetManifestRebuild(): void {
  if (gameAssetManifestRebuildTimer) clearTimeout(gameAssetManifestRebuildTimer);
  gameAssetManifestRebuildTimer = setTimeout(() => {
    gameAssetManifestRebuildTimer = null;
    try {
      buildAssetManifest();
    } catch (error) {
      logger.error(error, "Failed to rebuild the game asset manifest after generating audio");
    }
  }, 500);
  gameAssetManifestRebuildTimer.unref();
}

type GameAudioContext = { axis: "area" | "tier"; key: string; lengthMs?: number };

async function generateElevenLabsGameAudio(
  cfg: TTSConfig,
  kind: "sfx" | "music",
  prompt: string,
  context?: GameAudioContext,
): Promise<{ tag: string; path: string; cached: boolean }> {
  const normalizedPrompt = normalizeGameAudioPrompt(prompt);
  const hash = createHash("sha256").update(`${kind}\0${normalizedPrompt.toLowerCase()}`).digest("hex");
  let category: string;
  let fileName: string;
  let tag: string;
  if (context) {
    // Context tracks (#5161) land in the scoreable library keyed by area/tier
    // and generate ONCE per key: ANY existing audio file under the key —
    // generated earlier or dropped in by the user as a replacement — means
    // the key is covered, regardless of how today's prompt is worded.
    category = `music/${context.axis}/${context.key}`;
    const existing = (await readdir(join(GAME_ASSETS_DIR, "music", context.axis, context.key)).catch(() => [])).filter(
      // Dotfiles never enter the manifest; counting one as coverage would
      // permanently block generation for the key.
      (name) => !name.startsWith(".") && AUDIO_FILE_PATTERN.test(name),
    );
    const coveredBy = existing[0];
    if (coveredBy) {
      return {
        tag: `music:${context.axis}:${context.key}:${coveredBy.replace(/\.[^.]+$/, "")}`,
        path: `${category}/${coveredBy}`,
        cached: true,
      };
    }
    fileName = `generated-${hash.slice(0, 16)}.mp3`;
    tag = `music:${context.axis}:${context.key}:${fileName.replace(/\.mp3$/, "")}`;
  } else {
    category = kind === "sfx" ? "sfx" : "music";
    fileName = `${hash}.mp3`;
    tag = `${category}:generated:${hash}`;
    category = `${category}/generated`;
  }
  const relativePath = `${category}/${fileName}`;
  const targetDirectory = join(GAME_ASSETS_DIR, category);
  const targetPath = join(GAME_ASSETS_DIR, relativePath);

  try {
    await access(targetPath);
    return { tag, path: relativePath, cached: true };
  } catch {
    // Generate below.
  }

  const endpoint = kind === "sfx" ? "/v1/sound-generation" : "/v1/music";
  // Longer compositions take the provider longer to render; give context
  // tracks the headroom a 2-minute piece needs.
  const timeoutMs = context ? 300_000 : 180_000;
  const response = await safeFetch(`${elevenLabsApiRoot(configuredBaseUrl(cfg))}${endpoint}`, {
    method: "POST",
    headers: elevenLabsHeaders(cfg.apiKey),
    body: JSON.stringify(
      kind === "sfx"
        ? { text: normalizedPrompt, prompt_influence: 0.3 }
        : {
            prompt: normalizedPrompt,
            music_length_ms: context ? (context.lengthMs ?? 120_000) : 30_000,
            force_instrumental: true,
          },
    ),
    signal: AbortSignal.timeout(timeoutMs),
    policy: {
      allowLocal: false,
      allowedProtocols: ["https:"],
    },
    maxResponseBytes: MAX_GAME_AUDIO_BYTES,
    decodeCompressedResponse: true,
  });
  if (!response.ok) {
    const detail = readProviderErrorDetail(await response.text().catch(() => ""));
    throw new Error(detail || `ElevenLabs returned ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!resolveTTSAudioResponseContentType(response.headers.get("content-type"), bytes)) {
    throw new Error("ElevenLabs returned a non-audio response");
  }

  await mkdir(targetDirectory, { recursive: true });
  const temporaryPath = join(targetDirectory, `.${hash}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
  scheduleGameAssetManifestRebuild();
  return { tag, path: relativePath, cached: false };
}

// ── Helpers ─────────────────────────────────────

export function buildRoleplaySpeakerExtractorPrompt(input: {
  group: string;
  user: string;
  characters: string[];
  messageAuthor?: string;
  includeEmotions: boolean;
}): string {
  const participants = input.characters.length > 0 ? input.characters.join(", ") : "the roleplay characters";
  const roleplayName = input.group || participants;
  const messageAuthorInstruction = input.messageAuthor
    ? `This response was generated for ${input.messageAuthor}. Use that exact name for dialogue not explicitly attributed to a different speaker.`
    : "";
  const emotionInstruction = input.includeEmotions
    ? 'In "speech", copy the exact dialogue and insert emotional indicators directly in [brackets] before the words they affect. You may use multiple bracketed emotional indicators within a dialogue line, including pauses, small sounds, sighs, and different intonations for different parts. Do not otherwise add, remove, reorder, or rewrite any dialogue.'
    : 'Do not add emotional indicators. Omit the "speech" field.';

  return `You are preparing a message for text-to-speech reading from a roleplay chat between ${roleplayName} and ${input.user}, but it is possible there are other characters involved and mentioned in the message itself.

Known chat characters: ${participants}
${messageAuthorInstruction}

Extract all dialogue lines. Copy every dialogue line exactly without changing any part of it, skip all narration beats, and assign who says it. ${emotionInstruction}

Return JSON only in this exact shape:
{"dialogue":[{"speaker":"Name","text":"Exact source dialogue line"${input.includeEmotions ? ',"speech":"Exact dialogue with only inserted [indicators]"' : ""}}]}

Example input:
Dottore sighs and stands up. "I've had enough of your shenanigans," he drawls. "You're wasting my time, subject. This is your last chance to change my mind before I send you to Lab Thirteen."
A pregnant pause settles in the room.
"Skill issue," Mari chuckles, crossing her arms.

Example output:
{"dialogue":[{"speaker":"Dottore","text":"\\\"I've had enough of your shenanigans,\\\""${input.includeEmotions ? ',"speech":"[irritated] \\\"I\'ve had enough of your shenanigans,\\\""' : ""}},{"speaker":"Dottore","text":"\\\"You're wasting my time, subject. This is your last chance to change my mind before I send you to Lab Thirteen.\\\""${input.includeEmotions ? ',"speech":"[irritated] \\\"You\'re wasting my time, subject. [sigh] This is your last chance to change my mind before I send you to Lab Thirteen.\\\""' : ""}},{"speaker":"Mari","text":"\\\"Skill issue,\\\""${input.includeEmotions ? ',"speech":"[chuckle] \\\"Skill issue,\\\""' : ""}}]}`;
}

export function buildRoleplaySpeakerExtractorUserPrompt(message: string): string {
  // Some Responses-compatible providers validate only input messages, not
  // system instructions, before allowing json_object response formatting.
  return `Return the extracted dialogue as a json object matching the requested schema.\n\nMessage to prepare:\n${message}`;
}

function extractJsonObject(value: string): string {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) return fenced;
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Speaker extractor returned no JSON object");
  return value.slice(start, end + 1);
}

function validateAnnotatedDialogue(source: string, speech: string): string {
  let sourceCursor = 0;
  let speechCursor = 0;
  while (speechCursor < speech.length) {
    if (speech[speechCursor] === "[") {
      let indicatorEnd = -1;
      for (let cursor = speechCursor + 1; cursor <= speechCursor + 81 && cursor < speech.length; cursor++) {
        if (speech[cursor] === "\r" || speech[cursor] === "\n") break;
        if (speech[cursor] === "]") {
          indicatorEnd = cursor;
          break;
        }
      }
      if (indicatorEnd > speechCursor + 1) {
        const bracketSpan = speech.slice(speechCursor, indicatorEnd + 1);
        if (source.startsWith(bracketSpan, sourceCursor)) {
          sourceCursor += bracketSpan.length;
          speechCursor += bracketSpan.length;
        } else {
          speechCursor = indicatorEnd + 1;
          if (speech[speechCursor] === " " && source[sourceCursor] !== " ") speechCursor += 1;
        }
        continue;
      }
    }

    if (sourceCursor >= source.length || speech[speechCursor] !== source[sourceCursor]) {
      throw new Error("Speaker extractor changed dialogue while adding emotion indicators");
    }
    sourceCursor += 1;
    speechCursor += 1;
  }
  if (sourceCursor === source.length) return speech;
  throw new Error("Speaker extractor changed dialogue while adding emotion indicators");
}

/** Build an exact, ordered queue by locating extracted dialogue inside the original message. */
export function parseRoleplaySpeakerExtractorOutput(
  raw: string,
  message: string,
  includeEmotions: boolean,
): TTSRoleplaySpeakerExtractorResponse {
  const extracted = extractedDialogueSchema.parse(JSON.parse(extractJsonObject(raw)));
  const segments: TTSRoleplaySpeakerExtractorResponse["segments"] = [];
  let cursor = 0;

  for (const line of extracted.dialogue) {
    const dialogueIndex = message.indexOf(line.text, cursor);
    if (dialogueIndex < 0) {
      throw new Error(`Speaker extractor changed or could not locate a dialogue line from ${line.speaker}`);
    }

    const narration = message.slice(cursor, dialogueIndex);
    if (narration.trim()) segments.push({ kind: "narration", text: narration });
    segments.push({
      kind: "dialogue",
      speaker: line.speaker,
      text:
        includeEmotions && line.speech
          ? validateAnnotatedDialogue(line.text, line.speech)
          : message.slice(dialogueIndex, dialogueIndex + line.text.length),
    });
    cursor = dialogueIndex + line.text.length;
  }

  const trailingNarration = message.slice(cursor);
  if (trailingNarration.trim()) segments.push({ kind: "narration", text: trailingNarration });
  return ttsRoleplaySpeakerExtractorResponseSchema.parse({ segments });
}

function withoutTemperatureCustomParameter(value: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!value) return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => key.toLowerCase() !== "temperature"));
}

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

/**
 * Resolve the effective audio configuration (#5146): an audio CONNECTION —
 * the explicitly requested one, else the category default — provides the
 * identity half (source, key, base URL, voice, and the sound-effect/music
 * capability flags), overlaid on the legacy TTS settings blob, which remains
 * the knob store (speed, stability, extractor settings, source profiles).
 * With no audio connection at all, behavior is exactly the legacy blob —
 * pre-migration installs keep working untouched.
 */
/** Callers pass this sentinel to force the legacy settings blob even when audio connections exist. */
export const LEGACY_TTS_CONFIG_SENTINEL = "";

async function resolveAudioConfig(
  storage: ReturnType<typeof createAppSettingsStorage>,
  connections: ReturnType<typeof createConnectionsStorage>,
  requestedConnectionId?: string | null,
) {
  const cfg = await loadConfig(storage);
  // The TTS settings card tests the blob it edits; the empty-string sentinel
  // must reach it even when a default audio connection exists.
  if (requestedConnectionId === LEGACY_TTS_CONFIG_SENTINEL) return cfg;
  let row = null;
  let explicitlyRequested = false;
  if (requestedConnectionId) {
    const candidate = await connections.getWithKey(requestedConnectionId);
    if (candidate?.provider === "audio") {
      row = candidate;
      explicitlyRequested = true;
    } else {
      logger.warn("Requested audio connection %s missing or not audio; using the default", requestedConnectionId);
    }
  }
  if (!row) row = await connections.getDefaultForAudio();
  if (!row) row = await connections.getFallbackForAudio();
  if (!row) return cfg;
  const source = (row.audioSource ?? "elevenlabs") as TTSSource;
  // Blank row fields fall back per the ROW's source. The blob's top-level
  // fields belong to its own active source — inheriting them would leak
  // cross-source values (e.g. the schema-default voice "alloy" into an
  // ElevenLabs row, defeating the missing-voice guard downstream).
  const profile = source === cfg.source ? cfg : withActiveSourceProfile(cfg).sourceProfiles[source];
  return {
    ...cfg,
    // An explicitly requested connection is a direct expression of intent;
    // default/fallback resolution keeps honoring the legacy master toggle so
    // an upgrade cannot silently re-enable TTS the user switched off.
    enabled: explicitlyRequested ? true : cfg.enabled,
    source,
    apiKey: row.apiKey,
    baseUrl: row.baseUrl || profile?.baseUrl || TTS_SOURCE_DEFAULTS[source].baseUrl,
    voice: row.audioVoice || profile?.voice || "",
    model: row.model || profile?.model || TTS_SOURCE_DEFAULTS[source].model,
    elevenLabsGameSoundEffects: row.audioSoundEffects === "true",
    elevenLabsGameMusic: row.audioMusic === "true",
  };
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
      "giovanni",
      "lola",
      "juergen",
      "rafael",
      "estelle",
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

type PocketTtsApiMode = "official" | "openai";
const pocketTtsApiModeCache = new Map<string, Promise<PocketTtsApiMode>>();

export function resolvePocketTtsApiMode(openApi: unknown): PocketTtsApiMode {
  const paths = asObject(asObject(openApi)?.["paths"]);
  return paths?.["/tts"] ? "official" : "openai";
}

export function buildOfficialPocketTtsForm(text: string, voice: string): FormData {
  const form = new FormData();
  form.append("text", text);
  if (voice) form.append("voice_url", voice);
  return form;
}

async function detectPocketTtsApiMode(cfg: TTSConfig): Promise<PocketTtsApiMode> {
  const base = configuredBaseUrl(cfg);
  const cached = pocketTtsApiModeCache.get(base);
  if (cached) return cached;

  const pending = (async (): Promise<PocketTtsApiMode> => {
    try {
      const response = await safeFetch(`${base}/openapi.json`, {
        headers: optionalBearerHeaders(cfg.apiKey),
        signal: AbortSignal.timeout(5_000),
        policy: {
          allowLocal: true,
          allowedProtocols: ["https:", "http:"],
          flagName: "TTS_LOCAL_URLS_ENABLED",
        },
        maxResponseBytes: 2 * 1024 * 1024,
      });
      if (!response.ok) {
        pocketTtsApiModeCache.delete(base);
        return "openai";
      }
      return resolvePocketTtsApiMode(await response.json());
    } catch {
      pocketTtsApiModeCache.delete(base);
      return "openai";
    }
  })();
  pocketTtsApiModeCache.set(base, pending);
  return pending;
}

function clearPocketTtsApiModeCache(cfg: TTSConfig): void {
  if (cfg.source !== "pockettts") return;
  pocketTtsApiModeCache.delete(configuredBaseUrl(cfg));
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

/** Returns true only for an explicit provider-declared audio media type. */
export function isAllowedTTSAudioContentType(contentType: string | null): boolean {
  const normalized = contentType?.toLowerCase() ?? "";
  return normalized.startsWith("audio/");
}

/** Detects the supported encoded audio container from its leading bytes. */
export function detectTTSAudioMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return "audio/mpeg";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return "audio/wav";
  }
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return "audio/ogg";
  }
  if (bytes.length >= 4 && bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return "audio/flac";
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "audio/webm";
  }
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return "audio/mp4";
  }
  return null;
}

/**
 * Resolves the safe response media type for provider audio.
 *
 * Generic or missing media types require a recognized encoded container so a
 * JSON/text error body cannot be relabeled as audio.
 */
export function resolveTTSAudioResponseContentType(contentType: string | null, bytes: Uint8Array): string | null {
  const declaredContentType = contentType?.trim() ?? "";
  if (isAllowedTTSAudioContentType(declaredContentType)) return declaredContentType;
  return detectTTSAudioMimeType(bytes);
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

export function buildElevenLabsTextInput(text: string, tone?: string): string {
  const normalizedTone = tone?.replace(/[\[\]\r\n]/g, "").trim();
  if (!normalizedTone || text.trimStart().startsWith(`[${normalizedTone}]`)) return text;
  return `[${normalizedTone}] ${text}`;
}

export function resolveTTSRequestVoice(configuredVoice: string, requestedVoice?: string | null): string {
  const trimmedRequest = requestedVoice?.trim();
  return trimmedRequest || configuredVoice;
}

export async function fetchElevenLabsVoiceOptions(
  baseUrl: string,
  apiKey: string,
  query: Record<string, string> = {},
): Promise<VoiceOption[]> {
  const voiceOptions: VoiceOption[] = [];
  const seenPageTokens = new Set<string>();
  let nextPageToken: string | null = null;

  for (let page = 0; page < 100; page += 1) {
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
      decodeCompressedResponse: true,
    });

    if (!res.ok) {
      const detail = readProviderErrorDetail(await res.text().catch(() => ""));
      throw new Error(`ElevenLabs voices request failed (${res.status})${detail ? `: ${detail}` : ""}`);
    }

    const data = await res.json();
    voiceOptions.push(...parseVoiceOptions(data));

    const obj = asObject(data);
    const hasMore = obj?.has_more === true;
    nextPageToken = readString(obj?.next_page_token) ?? null;
    if (!hasMore || !nextPageToken) break;
    if (seenPageTokens.has(nextPageToken)) {
      throw new Error("ElevenLabs voices pagination returned a repeated page token");
    }
    seenPageTokens.add(nextPageToken);
  }

  return voiceOptions;
}

export async function fetchAllElevenLabsVoiceOptions(baseUrl: string, apiKey: string): Promise<VoiceOption[]> {
  const results = await Promise.allSettled([
    fetchElevenLabsVoiceOptions(baseUrl, apiKey),
    fetchElevenLabsVoiceOptions(baseUrl, apiKey, { voice_type: "saved" }),
  ]);
  const successfulResults = results.filter(
    (result): result is PromiseFulfilledResult<VoiceOption[]> => result.status === "fulfilled",
  );
  if (successfulResults.length === 0) {
    const errors = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)));
    throw new Error(
      errors.length > 0
        ? `ElevenLabs voice discovery failed: ${errors.join("; ")}`
        : "ElevenLabs voice discovery failed",
    );
  }
  return mergeVoiceOptions(successfulResults.flatMap((result) => result.value));
}

export function parseElevenLabsModelOptions(data: unknown): ModelOption[] {
  if (!Array.isArray(data)) return [];

  return data.flatMap((value) => {
    const model = asObject(value);
    const id = readString(model?.model_id);
    if (!id || model?.can_do_text_to_speech !== true) return [];
    return [{ id, name: readString(model?.name) ?? id }];
  });
}

async function fetchElevenLabsModelOptions(baseUrl: string, apiKey: string): Promise<ModelOption[]> {
  const res = await safeFetch(`${elevenLabsApiRoot(baseUrl)}/v1/models`, {
    headers: elevenLabsHeaders(apiKey),
    signal: AbortSignal.timeout(10_000),
    policy: {
      allowLocal: isTtsLocalUrlsEnabled(),
      allowedProtocols: ["https:", "http:"],
      flagName: "TTS_LOCAL_URLS_ENABLED",
    },
    maxResponseBytes: 2 * 1024 * 1024,
    decodeCompressedResponse: true,
  });
  if (!res.ok) {
    const detail = readProviderErrorDetail(await res.text().catch(() => ""));
    throw new Error(`ElevenLabs models request failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  return parseElevenLabsModelOptions(await res.json());
}

async function fetchProviderModels(cfg: TTSConfig): Promise<TTSModelsResponse> {
  if (cfg.source !== "elevenlabs" || !cfg.apiKey || isNanoGptBaseUrl(configuredBaseUrl(cfg))) {
    return {
      models: ELEVENLABS_FALLBACK_MODELS.map((id) => ({ id, name: id })),
      fromProvider: false,
      source: cfg.source,
    };
  }

  const models = await fetchElevenLabsModelOptions(configuredBaseUrl(cfg), cfg.apiKey);
  return {
    models: models.length > 0 ? models : ELEVENLABS_FALLBACK_MODELS.map((id) => ({ id, name: id })),
    fromProvider: models.length > 0,
    source: cfg.source,
  };
}

async function fetchProviderVoices(cfg: TTSConfig): Promise<TTSVoicesResponse> {
  const base = configuredBaseUrl(cfg);

  if (cfg.source === "pockettts") {
    if ((await detectPocketTtsApiMode(cfg)) === "official") return fallbackVoices(cfg.source);
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

    const voices = await fetchAllElevenLabsVoiceOptions(base, cfg.apiKey);
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
  const connections = createConnectionsStorage(app.db);

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
    clearPocketTtsApiModeCache(existing);
    clearPocketTtsApiModeCache(storedConfig);
    await storage.set(TTS_SETTINGS_KEY, JSON.stringify(storedConfig));
    return reply.status(204).send();
  });

  /**
   * GET /api/tts/voices
   * Fetches available voices from the configured provider.
   */
  app.get("/voices", async (req, reply) => {
    const { connectionId } = (req.query ?? {}) as { connectionId?: string };
    // Without an explicit connection this endpoint serves the TTS settings
    // card, which edits the blob — resolving the default audio connection here
    // would show the card voices for a source it is not configuring.
    const cfg = connectionId ? await resolveAudioConfig(storage, connections, connectionId) : await loadConfig(storage);

    try {
      return await fetchProviderVoices(cfg);
    } catch (error) {
      logger.warn(error, "TTS voice discovery failed for source %s", cfg.source);
      if (cfg.source === "elevenlabs" && cfg.apiKey) {
        return reply.status(502).send({
          error: "Could not load ElevenLabs voices. Check the connection and try again.",
          detail: error instanceof Error ? error.message : "Unknown provider error",
        });
      }
      return fallbackVoices(cfg.source);
    }
  });

  /**
   * GET /api/tts/models
   * Fetches text-to-speech-capable models from ElevenLabs.
   */
  app.get("/models", async (req, reply) => {
    const { connectionId } = (req.query ?? {}) as { connectionId?: string };
    const cfg = connectionId ? await resolveAudioConfig(storage, connections, connectionId) : await loadConfig(storage);

    try {
      return await fetchProviderModels(cfg);
    } catch (error) {
      logger.warn(error, "TTS model discovery failed for source %s", cfg.source);
      return reply.status(502).send({
        error: "Could not load ElevenLabs models. Check the connection and try again.",
        detail: error instanceof Error ? error.message : "Unknown provider error",
      });
    }
  });

  /**
   * POST /api/tts/roleplay-speaker-extractor
   * Uses one isolated LLM call to classify the newest Roleplay message for ordered TTS playback.
   */
  app.post("/roleplay-speaker-extractor", async (req, reply) => {
    const input = roleplaySpeakerExtractorSchema.parse(req.body);
    const cfg = await loadConfig(storage);
    if (!cfg.roleplaySpeakerExtractorEnabled) {
      return reply.status(400).send({ error: "Roleplay speaker extractor is not enabled" });
    }

    const configuredConnectionId = cfg.roleplaySpeakerExtractorConnectionId.trim();
    const connection = configuredConnectionId
      ? await connections.getWithKey(configuredConnectionId)
      : await connections.getDefaultForAgents();
    if (!connection) {
      return reply.status(400).send({
        error: configuredConnectionId
          ? "The selected Roleplay speaker extractor connection is unavailable"
          : "No default agent connection is configured for Roleplay speaker extractor",
      });
    }
    if (
      connection.provider === "image_generation" ||
      connection.provider === "video_generation" ||
      connection.provider === "audio"
    ) {
      return reply.status(400).send({ error: "Roleplay speaker extractor requires a language-model connection" });
    }

    const baseUrl = resolveBaseUrl(connection);
    if (!baseUrl || !connection.model.trim()) {
      return reply.status(400).send({ error: "Roleplay speaker extractor connection has no usable model or Base URL" });
    }

    const includeEmotions = cfg.roleplaySpeakerExtractorEmotionsEnabled;
    const systemPrompt = buildRoleplaySpeakerExtractorPrompt({
      group: input.group,
      user: input.user || "User",
      characters: input.characters,
      messageAuthor: input.messageAuthor,
      includeEmotions,
    });
    const userPrompt = buildRoleplaySpeakerExtractorUserPrompt(input.message);
    logDebugOverride(input.debugMode, "[debug/tts/speaker-extractor] system prompt:\n%s", systemPrompt);
    logDebugOverride(input.debugMode, "[debug/tts/speaker-extractor] user prompt:\n%s", userPrompt);

    const storedOptions = resolveStoredChatOptions(connection.defaultParameters, connection.provider, connection.model);
    const maxTokens = clampGenerationMaxOutputTokens({
      provider: connection.provider,
      model: connection.model,
      maxTokens: resolveStoredMaxTokens(connection.defaultParameters, 8192),
      maxTokensOverride: connection.maxTokensOverride,
    });
    const provider = createLLMProvider(
      connection.provider,
      baseUrl,
      connection.apiKey,
      connection.maxContext,
      connection.openrouterProvider,
      connection.maxTokensOverride,
      connection.claudeFastMode === "true",
      connection.treatAsLocalEndpoint === "true",
      undefined,
      connection.id,
    );

    try {
      const {
        temperature: _storedTemperature,
        customParameters,
        enabledParameters,
        ...connectionOptions
      } = storedOptions;
      const result = await provider.chatComplete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {
          ...connectionOptions,
          model: connection.model,
          maxTokens,
          maxContext: connection.maxContext,
          customParameters: withoutTemperatureCustomParameter(customParameters),
          enabledParameters: {
            ...enabledParameters,
            temperature: false,
            maxTokens: true,
          },
          enableCaching: connection.enableCaching === "true",
          anthropicExtendedCacheTtl: connection.anthropicExtendedCacheTtl === "true",
          cachingAtDepth: Number(connection.cachingAtDepth) || 5,
          responseFormat: { type: "json_object" },
          debugMode: input.debugMode,
          signal: AbortSignal.timeout(getChatGenerationTimeoutMs()),
        },
      );
      const raw = result.content?.trim() ?? "";
      logDebugOverride(input.debugMode, "[debug/tts/speaker-extractor] raw response:\n%s", raw);
      if (!raw) throw new Error("Speaker extractor returned an empty response");
      return parseRoleplaySpeakerExtractorOutput(raw, input.message, includeEmotions);
    } catch (error) {
      logger.warn(error, "Roleplay speaker extractor failed with connection %s", connection.id);
      return reply.status(502).send({
        error: "Roleplay speaker extractor failed",
        detail: error instanceof Error ? error.message : "Unknown provider error",
      });
    }
  });

  /**
   * POST /api/tts/game-audio
   * Generates and caches scene-specific Game Mode music or sound effects.
   */
  app.post("/game-audio", async (req, reply) => {
    const { kind, prompt, audioConnectionId, context } = gameAudioSchema.parse(req.body);
    if (context && kind !== "music") {
      return reply.status(400).send({ error: "Context tracks are music only" });
    }
    if (kind === "music" && !context) {
      // The per-prompt 30-second music path is retired (#5161); leaving it
      // reachable would let stray callers keep filling music/generated/ with
      // clips nothing selects.
      return reply.status(400).send({ error: "Music generation requires a context key (area or tier)" });
    }
    if (context?.axis === "tier") {
      // Aliases (elite, legendary, …) are accepted but the STORED key must be
      // canonical — a music/tier/elite/ folder would be a paid composition the
      // scorer can never select.
      const canonicalTier = normalizeMusicEnemyTier(context.key);
      if (!canonicalTier) {
        return reply.status(400).send({ error: `Unknown encounter tier "${context.key}"` });
      }
      context.key = canonicalTier;
    }
    const cfg = await resolveAudioConfig(storage, connections, audioConnectionId);
    const enabled = kind === "sfx" ? cfg.elevenLabsGameSoundEffects === true : cfg.elevenLabsGameMusic === true;
    if (cfg.source !== "elevenlabs" || !enabled) {
      return reply.status(400).send({ error: `ElevenLabs game ${kind} generation is not enabled` });
    }
    if (!cfg.apiKey) {
      return reply.status(400).send({ error: "ElevenLabs API key is not configured" });
    }

    const normalizedPrompt = normalizeGameAudioPrompt(prompt);
    // Context generations lock on their KEY: two turns racing the same area
    // must collapse into one composition even when their prompts differ.
    const lockKey = context ? `context\0${context.axis}\0${context.key}` : `${kind}\0${normalizedPrompt.toLowerCase()}`;
    let generation = gameAudioGenerationLocks.get(lockKey);
    if (!generation) {
      generation = generateElevenLabsGameAudio(cfg, kind, normalizedPrompt, context).finally(() => {
        gameAudioGenerationLocks.delete(lockKey);
      });
      gameAudioGenerationLocks.set(lockKey, generation);
    }
    try {
      return await generation;
    } catch (error) {
      logger.error(error, "ElevenLabs game %s generation failed", kind);
      return reply.status(502).send({
        error: `ElevenLabs game ${kind} generation failed`,
        detail: error instanceof Error ? error.message : "Unknown provider error",
      });
    }
  });

  /**
   * POST /api/tts/speak
   * Proxies a TTS request to the configured provider and streams the audio back.
   */
  app.post("/speak", async (req, reply) => {
    const { text, speaker, tone, voice, audioConnectionId } = speakSchema.parse(req.body);

    const cfg = await resolveAudioConfig(storage, connections, audioConnectionId);

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
    const pocketTtsApiMode = usePocketTtsSpeech ? await detectPocketTtsApiMode(cfg) : null;
    const useOfficialPocketTtsSpeech = pocketTtsApiMode === "official";
    const useXaiSpeech = cfg.source === "xai";
    const configuredModel = (cfg.model || TTS_SOURCE_DEFAULTS[cfg.source].model).trim();
    const model = useNanoGptSpeech
      ? normalizeNanoGptTtsModelId(configuredModel)
      : cfg.source === "elevenlabs"
        ? normalizeElevenLabsTtsModelId(configuredModel)
        : configuredModel;
    const normalizedModel = model.toLowerCase();
    const nanoGptElevenLabsModel = useNanoGptSpeech && isNanoGptElevenLabsModel(model);
    if (cfg.source === "elevenlabs" && ELEVENLABS_NON_TTS_MODELS.has(normalizedModel)) {
      return reply.status(400).send({
        error: `ElevenLabs model "${model}" cannot generate text-to-speech`,
        detail: `That model is for Text to Voice / voice design. Use "eleven_v3" for Eleven v3 speech, or "eleven_multilingual_v2", "eleven_flash_v2_5", or "eleven_turbo_v2_5" for regular TTS.`,
      });
    }

    const audioFormat = cfg.source === "elevenlabs" || useXaiSpeech ? "mp3" : (cfg.audioFormat ?? "mp3");
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
        ? useOfficialPocketTtsSpeech
          ? `${base}/tts`
          : `${pocketTtsV1BaseUrl(base)}/audio/speech`
        : useXaiSpeech
          ? `${base}/tts`
          : cfg.source === "elevenlabs"
            ? `${elevenLabsApiRoot(base)}/v1/text-to-speech/${encodeURIComponent(requestVoice)}?output_format=mp3_44100_128`
            : `${base}/audio/speech`;
    const providerText =
      cfg.source === "elevenlabs" || nanoGptElevenLabsModel ? buildElevenLabsTextInput(text, tone) : text;
    const elevenLabsLanguageCode = cfg.elevenLabsLanguageCode?.trim();
    const includeSpeakerInstructions = cfg.source !== "elevenlabs";
    const speechInstructions = useNanoGptSpeech
      ? !nanoGptElevenLabsModel && openAiModelSupportsSpeechInstructions(model)
        ? buildSpeechInstructions({ speaker, tone, includeSpeaker: includeSpeakerInstructions })
        : undefined
      : cfg.source === "openai" && openAiModelSupportsSpeechInstructions(model)
        ? buildSpeechInstructions({ speaker, tone })
        : undefined;
    const pocketTtsForm = useOfficialPocketTtsSpeech ? buildOfficialPocketTtsForm(providerText, requestVoice) : null;

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
              : useOfficialPocketTtsSpeech
                ? optionalBearerHeaders(cfg.apiKey)
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
              : useOfficialPocketTtsSpeech
                ? pocketTtsForm
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
        decodeCompressedResponse: cfg.source === "elevenlabs",
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
    let audioBuffer: ArrayBuffer;
    try {
      audioBuffer = await providerRes.arrayBuffer();
    } catch (error: unknown) {
      logger.error(error, "Failed to read TTS provider response body");
      return reply.status(502).send({ error: "TTS provider response could not be read" });
    }

    const responseContentType = resolveTTSAudioResponseContentType(contentType, new Uint8Array(audioBuffer));
    if (!responseContentType) {
      const body = new TextDecoder().decode(audioBuffer);
      return reply.status(502).send({
        error: "TTS provider returned a non-audio response",
        detail: readProviderErrorDetail(body) || `Content-Type: ${contentType || "missing"}`,
      });
    }

    reply.header("Content-Type", responseContentType);
    reply.header("Content-Length", String(audioBuffer.byteLength));
    return reply.send(Buffer.from(audioBuffer));
  });
}
