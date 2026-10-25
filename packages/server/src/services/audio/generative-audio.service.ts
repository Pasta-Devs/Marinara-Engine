import { createHash, randomUUID } from "node:crypto";
import { addAbortListener } from "node:events";
import { access, mkdir, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  GENERATIVE_AUDIO_DEFAULTS,
  GENERATIVE_AUDIO_SOURCES,
  TTS_SETTINGS_KEY,
  audioConnectionSupportsGeneration,
  ttsConfigSchema,
  type GenerativeAudioSource,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { migrateGenerativeAudioConnections } from "../connections/generative-audio-connection-migration.js";
import { buildAssetManifest, GAME_ASSETS_DIR } from "../game/asset-manifest.service.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import {
  generateAudioBytes,
  validateSunoMusicCallback,
  type GenerativeAudioProviderConfig,
} from "./generative-audio-providers.js";

export type GeneratedAudioContext =
  { axis: "area" | "tier"; key: string; lengthMs?: number } | { scope: string; key: string; lengthMs?: number };
export type GeneratedAudioAsset = { tag: string; path: string; cached: boolean };
type ResolvedConfig = GenerativeAudioProviderConfig & {
  id: string;
  music: boolean;
  soundEffects: boolean;
  legacyId: string | null;
};
const warnedOptionalMigrationFailures = new WeakSet<DB>();

export class AudioGenerationConfigurationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 409 = 400,
  ) {
    super(message);
  }
}

/** Imported endpoints are never promoted here; migration skips quarantined rows. */
export async function resolveGenerativeAudioConfig(db: DB, requestedId?: string | null): Promise<ResolvedConfig> {
  const connections = createConnectionsStorage(db);
  let row;
  if (requestedId) {
    const candidate = await connections.getWithKey(requestedId);
    row =
      candidate?.provider === "audio_generation"
        ? candidate
        : await connections.getAudioGenerationForLegacyConnection(requestedId);
    if (
      !row &&
      candidate?.provider === "audio" &&
      (audioConnectionSupportsGeneration(candidate, "music") || audioConnectionSupportsGeneration(candidate, "sfx"))
    ) {
      await migrateGenerativeAudioConnections(db);
      row = await connections.getAudioGenerationForLegacyConnection(requestedId);
    }
    if (!row) {
      if (candidate?.provider === "audio") {
        throw new AudioGenerationConfigurationError(
          "Music and sound-effect generation is not enabled for this connection",
        );
      }
      throw new AudioGenerationConfigurationError(
        "The selected Music & Sound Effects connection is missing or unavailable",
        409,
      );
    }
  } else {
    row = (await connections.getDefaultForAudioGeneration()) ?? (await connections.getFallbackForAudioGeneration());
    if (!row) {
      // Legacy/import fixtures can reach this bridge without the startup split.
      // Configured connections never pay for a migration transaction per cue.
      try {
        await migrateGenerativeAudioConnections(db);
      } catch (error) {
        if (!warnedOptionalMigrationFailures.has(db)) {
          warnedOptionalMigrationFailures.add(db);
          logger.warn(error, "[migration] Deferring the optional unconfigured music and sound-effect split");
        }
      }
      row = (await connections.getDefaultForAudioGeneration()) ?? (await connections.getFallbackForAudioGeneration());
    }
    if (!row) {
      // Preserve the old explicit-source failure until the user chooses a new
      // independent generation default. Never borrow another connection's key.
      const raw = await createAppSettingsStorage(db).get(TTS_SETTINGS_KEY);
      let chosenId = "";
      try {
        chosenId = ttsConfigSchema.parse(JSON.parse(raw ?? "{}")).connectionId;
      } catch {
        /* no usable legacy selection */
      }
      if (chosenId && !(await connections.getWithKey(chosenId))) {
        throw new AudioGenerationConfigurationError(
          "The Audio connection chosen for Text to Speech is missing or unavailable.",
          409,
        );
      }
      throw new AudioGenerationConfigurationError("Choose a Music & Sound Effects connection with generation enabled");
    }
  }
  const source = row.audioGenerationSource ?? "elevenlabs";
  if (!GENERATIVE_AUDIO_SOURCES.includes(source as GenerativeAudioSource)) {
    throw new AudioGenerationConfigurationError("Unsupported Music & Sound Effects source");
  }
  const defaults = GENERATIVE_AUDIO_DEFAULTS[source as GenerativeAudioSource];
  return {
    id: row.id,
    source: source as GenerativeAudioSource,
    apiKey: row.apiKey,
    baseUrl: row.baseUrl || defaults.baseUrl,
    model: row.model || defaults.model,
    soundEffectsModel: row.audioSoundEffectsModel || defaults.soundEffectsModel,
    callbackUrl: row.audioGenerationCallbackUrl || undefined,
    musicEndpoint: row.audioMusicEndpoint || undefined,
    soundEffectsEndpoint: row.audioSoundEffectsEndpoint || undefined,
    requestFormat: row.audioGenerationFormat === "chat_completions" ? "chat_completions" : "binary",
    responseFormat: "mp3",
    music: audioConnectionSupportsGeneration(row, "music"),
    soundEffects: audioConnectionSupportsGeneration(row, "sfx"),
    legacyId: row.audioGenerationLegacyConnectionId ?? null,
  };
}

const locks = new Map<string, Promise<GeneratedAudioAsset>>();
const testPublicationTails = new Map<string, Promise<GeneratedAudioAsset>>();

/** Report each usable capability independently; checking readiness never calls a provider. */
export async function resolveGenerativeAudioReadiness(db: DB, requestedId?: string | null) {
  const config = await resolveGenerativeAudioConfig(db, requestedId);
  const authorized = config.source === "custom" || Boolean(config.apiKey);
  let music = config.music && authorized;
  const soundEffects = config.soundEffects && authorized;
  if (music && config.source === "sunoapi") {
    try {
      await validateSunoMusicCallback(config.callbackUrl);
    } catch {
      music = false;
    }
  }
  return { connectionId: config.id, configured: music || soundEffects, music, soundEffects, source: config.source };
}

const AUDIO_FILE_PATTERN = /\.(mp3|wav|ogg|m4a|flac|aac|webm)$/i;
let manifestTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleManifestRebuild() {
  if (manifestTimer) clearTimeout(manifestTimer);
  manifestTimer = setTimeout(() => {
    manifestTimer = undefined;
    try {
      buildAssetManifest();
    } catch (error) {
      logger.error(error, "Failed to refresh generated audio assets");
    }
  }, 500);
  manifestTimer.unref();
}

function cacheIdentity(config: ResolvedConfig, kind: "music" | "sfx") {
  // Legacy row and standalone settings shared a prompt-only ElevenLabs cache.
  // Only the canonical endpoint and original models can safely reuse it.
  if (
    config.source === "elevenlabs" &&
    config.baseUrl.replace(/\/+$/, "") === GENERATIVE_AUDIO_DEFAULTS.elevenlabs.baseUrl &&
    config.model === "music_v1" &&
    (!config.soundEffectsModel || config.soundEffectsModel === "eleven_text_to_sound_v2") &&
    !config.musicEndpoint &&
    !config.soundEffectsEndpoint
  )
    return "";
  const identity =
    [
      config.baseUrl,
      kind === "music" ? config.model : config.soundEffectsModel || config.model,
      config.requestFormat,
      kind === "music" ? config.musicEndpoint : config.soundEffectsEndpoint,
    ].join("\0") + "\0";
  // Compatible generation already keyed all of these fields before the split.
  return config.source === "custom" ? identity : `${config.source}\0${identity}`;
}

async function compose(
  config: ResolvedConfig,
  kind: "music" | "sfx",
  prompt: string,
  context?: GeneratedAudioContext,
): Promise<GeneratedAudioAsset> {
  const isConnectionTest = context && "scope" in context && context.scope === "connection-test";
  const hash = isConnectionTest
    ? randomUUID().replaceAll("-", "")
    : createHash("sha256")
        .update(`${cacheIdentity(config, kind)}${kind}\0${prompt.toLowerCase()}`)
        .digest("hex");
  const category = context
    ? "axis" in context
      ? `music/${context.axis}/${context.key}`
      : `music/contexts/${context.scope}/${context.key}`
    : `${kind === "music" ? "music" : "sfx"}/generated`;
  const directory = join(GAME_ASSETS_DIR, category);
  if (context && !isConnectionTest) {
    // A user-supplied replacement covers the context as well as a generated file.
    const covered = (await readdir(directory, { withFileTypes: true }).catch(() => [])).find(
      (entry) => entry.isFile() && !entry.name.startsWith(".") && AUDIO_FILE_PATTERN.test(entry.name),
    );
    if (covered)
      return {
        tag: `${category.replaceAll("/", ":")}:${covered.name.replace(/\.[^.]+$/, "")}`,
        path: `${category}/${covered.name}`,
        cached: true,
      };
  }
  const filename = context ? `generated-${hash.slice(0, 16)}.mp3` : `${hash}.mp3`;
  const path = `${category}/${filename}`;
  const tag = `${category.replaceAll("/", ":")}:${filename.replace(/\.mp3$/, "")}`;
  if (!isConnectionTest) {
    try {
      await access(join(GAME_ASSETS_DIR, path));
      return { tag, path, cached: true };
    } catch {
      /* compose below */
    }
  }
  const bytes = await generateAudioBytes(config, kind, prompt, {
    lengthMs: context?.lengthMs ?? (context ? 120_000 : 5_000),
  });
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `.${hash}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, join(GAME_ASSETS_DIR, path));
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  if (isConnectionTest) {
    const previousTracks = await readdir(directory, { withFileTypes: true }).catch((error) => {
      logger.warn(error, "Failed to list previous connection test tracks");
      return [];
    });
    for (const entry of previousTracks) {
      if (entry.isFile() && /^generated-[a-f0-9]{16}\.mp3$/.test(entry.name) && entry.name !== filename)
        await unlink(join(directory, entry.name)).catch((error) =>
          logger.warn(error, "Failed to remove a previous connection test track"),
        );
    }
  }
  scheduleManifestRebuild();
  return { tag, path, cached: false };
}

/** One paid composition per context/prompt, shared by Game, Roleplay and packages. */
export async function generateAudioAsset(
  db: DB,
  request: {
    kind: "music" | "sfx";
    prompt: string;
    audioConnectionId?: string | null;
    context?: GeneratedAudioContext;
    debugMode?: boolean;
    signal?: AbortSignal;
  },
): Promise<GeneratedAudioAsset> {
  request.signal?.throwIfAborted();
  const config = await resolveGenerativeAudioConfig(db, request.audioConnectionId);
  request.signal?.throwIfAborted();
  if (!(request.kind === "music" ? config.music : config.soundEffects)) {
    throw new AudioGenerationConfigurationError(
      `${request.kind} generation is not enabled for this Music & Sound Effects connection`,
    );
  }
  if (config.source !== "custom" && !config.apiKey)
    throw new AudioGenerationConfigurationError("Audio generation API key is not configured");
  const prompt = request.prompt.trim().replace(/\s+/g, " ");
  logDebugOverride(
    request.debugMode === true || isDebugAgentsEnabled(),
    "[debug/audio/generate] Prompt sent to audio provider:\n%s",
    prompt,
  );
  const context =
    request.context && "scope" in request.context && request.context.scope === "connection-test"
      ? { ...request.context, key: createHash("sha256").update(config.id).digest("hex").slice(0, 32) }
      : request.context;
  const directoryKey = context
    ? "axis" in context
      ? `music/${context.axis}/${context.key}`
      : `music/contexts/${context.scope}/${context.key}`
    : `${cacheIdentity(config, request.kind)}${request.kind}\0${prompt.toLowerCase()}`;
  const isConnectionTest = context && "scope" in context && context.scope === "connection-test";
  const key = isConnectionTest
    ? `${directoryKey}\0${createHash("sha256")
        .update(JSON.stringify([config, request.kind, prompt, context.lengthMs ?? 120_000]))
        .digest("hex")}`
    : directoryKey;
  let pending = locks.get(key);
  if (!pending) {
    // Aborting one listener must not discard a paid result for other listeners.
    const previousTest = isConnectionTest ? testPublicationTails.get(directoryKey) : undefined;
    const generate = () => compose(config, request.kind, prompt, context);
    pending = (previousTest ? previousTest.catch(() => {}).then(generate) : generate()).finally(() => {
      locks.delete(key);
      if (isConnectionTest && testPublicationTails.get(directoryKey) === pending)
        testPublicationTails.delete(directoryKey);
    });
    locks.set(key, pending);
    if (isConnectionTest) testPublicationTails.set(directoryKey, pending);
  }
  let listener: ReturnType<typeof addAbortListener> | undefined;
  try {
    const result = request.signal
      ? await Promise.race([
          pending,
          new Promise<never>((_, reject) => {
            listener = addAbortListener(request.signal!, () => reject(request.signal!.reason));
          }),
        ])
      : await pending;
    request.signal?.throwIfAborted();
    return result;
  } finally {
    listener?.[Symbol.dispose]();
  }
}
