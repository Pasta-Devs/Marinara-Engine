import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS,
  getConversationCallVideoClipDuration,
  normalizeVideoGenerationUserSettings,
  VIDEO_DEFAULTS_STORAGE_KEY,
  createDefaultVideoGenerationProfile,
  inferVideoSource,
  normalizeVideoGenerationProfile,
  type ConversationCallCharacterVideoClip,
  type ConversationCallCharacterVideoCustomClip,
  type ConversationCallCharacterVideoClipKind,
  type ConversationCallCharacterVideoManifest,
  type VideoGenerationUserSettings,
} from "@marinara-engine/shared";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { newId } from "../../utils/id-generator.js";
import { assertInsideDir, isAllowedImageBuffer } from "../../utils/security.js";
import {
  CONVERSATION_CALL_CUSTOM_VIDEO_PROMPT,
  CONVERSATION_CALL_VIDEO_CLIP_INSTRUCTION_BY_KIND,
  CONVERSATION_CALL_VIDEO_CLIP_LABEL_BY_KIND,
  CONVERSATION_CALL_VIDEO_PROMPT_BY_KIND,
  loadPrompt,
} from "../prompt-overrides/index.js";
import type { PromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { generateVideo, type VideoReferenceImage } from "../video/video-generation.js";

type DiskClip = {
  status?: ConversationCallCharacterVideoClip["status"];
  error?: string | null;
  updatedAt?: string | null;
  sourceAvatarPath?: string | null;
};

type DiskCustomClip = {
  id: string;
  label: string;
  prompt: string;
  status?: ConversationCallCharacterVideoClip["status"];
  error?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  sourceAvatarPath?: string | null;
};

type DiskManifest = {
  version: 1;
  characterId: string;
  characterName: string;
  sourceAvatarPath: string | null;
  updatedAt: string | null;
  clips: Partial<Record<ConversationCallCharacterVideoClipKind, DiskClip>>;
  customClips: Record<string, DiskCustomClip>;
};

type VideoGenerationConnection = {
  id: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
  videoGenerationSource?: string | null;
  videoService?: string | null;
  defaultParameters?: string | null;
};

const CALL_CHARACTER_VIDEO_ROOT = join(DATA_DIR, "conversation-call-character-videos");
const AVATARS_ROOT = join(DATA_DIR, "avatars");
const DEFAULT_GEMINI_OMNI_MODEL = "gemini-omni-flash-preview";
const DEFAULT_GEMINI_OMNI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GOOGLE_VEO_MODEL = "veo-3.1-generate-preview";
const DEFAULT_GOOGLE_VEO_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_XAI_VIDEO_MODEL = "grok-imagine-video-1.5";
const DEFAULT_XAI_VIDEO_BASE_URL = "https://api.x.ai/v1";
const DEFAULT_OPENROUTER_VIDEO_MODEL = "google/veo-3.1";
const DEFAULT_OPENROUTER_VIDEO_BASE_URL = "https://openrouter.ai/api/v1";
const CALL_CHARACTER_VIDEO_VERSION = 1;
const GENERATION_LOCKS = new Map<string, Promise<void>>();
const CUSTOM_GENERATION_LOCKS = new Map<string, Promise<void>>();
const MANIFEST_LOCKS = new Map<string, Promise<void>>();
const CUSTOM_CLIP_LIMIT = 24;

export class ConversationCallVideoGenerationInProgressError extends Error {
  constructor(message = "This call video clip is still generating") {
    super(message);
    this.name = "ConversationCallVideoGenerationInProgressError";
  }
}

type SharpFn = (input: Buffer, options?: Record<string, unknown>) => {
  png: () => { toBuffer: () => Promise<Buffer> };
};

let sharpLoad: Promise<SharpFn> | null = null;

async function getSharp(): Promise<SharpFn> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - optional native dep, may not be installed on all supported platforms.
  sharpLoad ??= import("sharp").then((mod) => (mod.default ?? mod) as unknown as SharpFn);
  return sharpLoad;
}

function nowIso() {
  return new Date().toISOString();
}

function assertSafeCharacterId(characterId: string) {
  if (!characterId || characterId.includes("..") || characterId.includes("/") || characterId.includes("\\") || characterId.includes("\0")) {
    throw new Error("Invalid character id");
  }
  return characterId;
}

function assertSafeCustomClipId(clipId: string) {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(clipId)) throw new Error("Invalid custom clip id");
  return clipId;
}

function characterDir(characterId: string) {
  return assertInsideDir(CALL_CHARACTER_VIDEO_ROOT, join(CALL_CHARACTER_VIDEO_ROOT, assertSafeCharacterId(characterId)));
}

function manifestPath(characterId: string) {
  return assertInsideDir(CALL_CHARACTER_VIDEO_ROOT, join(characterDir(characterId), "manifest.json"));
}

function clipPath(characterId: string, kind: ConversationCallCharacterVideoClipKind) {
  return assertInsideDir(CALL_CHARACTER_VIDEO_ROOT, join(characterDir(characterId), `${kind}.mp4`));
}

function clipUrl(characterId: string, kind: ConversationCallCharacterVideoClipKind) {
  return `/api/conversation-calls/character-videos/${encodeURIComponent(characterId)}/file/${encodeURIComponent(kind)}`;
}

function customClipPath(characterId: string, clipId: string) {
  return assertInsideDir(CALL_CHARACTER_VIDEO_ROOT, join(characterDir(characterId), `${assertSafeCustomClipId(clipId)}.mp4`));
}

function customClipUrl(characterId: string, clipId: string) {
  return `/api/conversation-calls/character-videos/${encodeURIComponent(characterId)}/custom/${encodeURIComponent(clipId)}/file`;
}

function blankManifest(characterId: string, characterName: string, sourceAvatarPath: string | null): DiskManifest {
  return {
    version: CALL_CHARACTER_VIDEO_VERSION,
    characterId,
    characterName,
    sourceAvatarPath,
    updatedAt: null,
    clips: {},
    customClips: {},
  };
}

async function readDiskManifest(
  characterId: string,
  characterName: string,
  sourceAvatarPath: string | null,
): Promise<DiskManifest> {
  const fallback = blankManifest(characterId, characterName, sourceAvatarPath);
  try {
    const raw = await readFile(manifestPath(characterId), "utf8");
    const parsed = JSON.parse(raw) as Partial<DiskManifest>;
    return {
      ...fallback,
      ...parsed,
      version: CALL_CHARACTER_VIDEO_VERSION,
      characterId,
      characterName,
      sourceAvatarPath: parsed.sourceAvatarPath ?? sourceAvatarPath,
      clips: parsed.clips && typeof parsed.clips === "object" ? parsed.clips : {},
      customClips:
        parsed.customClips && typeof parsed.customClips === "object" && !Array.isArray(parsed.customClips)
          ? parsed.customClips
          : {},
    };
  } catch {
    return fallback;
  }
}

async function writeDiskManifest(manifest: DiskManifest) {
  const dir = characterDir(manifest.characterId);
  await mkdir(dir, { recursive: true });
  const file = manifestPath(manifest.characterId);
  const tmp = assertInsideDir(CALL_CHARACTER_VIDEO_ROOT, `${file}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tmp, JSON.stringify(manifest, null, 2), "utf8");
  await rename(tmp, file);
}

async function withManifestLock<T>(characterId: string, task: () => Promise<T>): Promise<T> {
  const safeCharacterId = assertSafeCharacterId(characterId);
  const previous = MANIFEST_LOCKS.get(safeCharacterId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => {}).then(() => current);
  MANIFEST_LOCKS.set(safeCharacterId, queued);
  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    release();
    if (MANIFEST_LOCKS.get(safeCharacterId) === queued) {
      MANIFEST_LOCKS.delete(safeCharacterId);
    }
  }
}

async function updateDiskManifest(input: {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
  update: (manifest: DiskManifest) => DiskManifest | Promise<DiskManifest>;
}) {
  return withManifestLock(input.characterId, async () => {
    const current = stampClipSourceAvatarPaths(
      await readDiskManifest(input.characterId, input.characterName, input.avatarPath),
    );
    const next = await input.update(current);
    await writeDiskManifest(next);
    return next;
  });
}

function stampClipSourceAvatarPaths(manifest: DiskManifest): DiskManifest {
  const clips = { ...manifest.clips };
  for (const kind of CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS) {
    const clip = clips[kind];
    if (clip && !Object.prototype.hasOwnProperty.call(clip, "sourceAvatarPath")) {
      clips[kind] = { ...clip, sourceAvatarPath: manifest.sourceAvatarPath };
    }
  }
  return { ...manifest, clips };
}

function isClipReadyForAvatar(manifest: DiskManifest, kind: ConversationCallCharacterVideoClipKind, avatarPath: string | null) {
  const disk = manifest.clips[kind] ?? {};
  const clipAvatarPath = Object.prototype.hasOwnProperty.call(disk, "sourceAvatarPath")
    ? (disk.sourceAvatarPath ?? null)
    : manifest.sourceAvatarPath;
  const diskReady = disk.status === "ready" || !disk.status;
  return diskReady && clipAvatarPath === avatarPath && existsSync(clipPath(manifest.characterId, kind));
}

function toPublicManifest(
  manifest: DiskManifest,
  activeAvatarPath: string | null,
): ConversationCallCharacterVideoManifest {
  manifest = stampClipSourceAvatarPaths(manifest);
  const customLockPrefix = `${manifest.characterId}:`;
  const customGenerating = [...CUSTOM_GENERATION_LOCKS.keys()].some((key) => key.startsWith(customLockPrefix));
  const generating = GENERATION_LOCKS.has(manifest.characterId) || customGenerating;
  const clips = CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.map((kind): ConversationCallCharacterVideoClip => {
    const disk = manifest.clips[kind] ?? {};
    const clipAvatarPath = Object.prototype.hasOwnProperty.call(disk, "sourceAvatarPath")
      ? (disk.sourceAvatarPath ?? null)
      : manifest.sourceAvatarPath;
    const avatarMatches = clipAvatarPath === activeAvatarPath;
    const fileExists = existsSync(clipPath(manifest.characterId, kind));
    const diskReady = disk.status === "ready" || !disk.status;
    const status = fileExists && avatarMatches && diskReady
      ? "ready"
      : avatarMatches && disk.status === "generating" && generating
        ? "generating"
        : avatarMatches && disk.status === "error"
          ? "error"
          : "missing";
    return {
      kind,
      status,
      url: status === "ready" ? clipUrl(manifest.characterId, kind) : null,
      error: status === "error" ? (disk.error ?? "Video generation failed") : null,
      updatedAt: disk.updatedAt ?? null,
    };
  });
  const customClips = Object.values(manifest.customClips ?? {})
    .sort((a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt))
    .slice(0, CUSTOM_CLIP_LIMIT)
    .map((disk): ConversationCallCharacterVideoCustomClip => {
      const fileExists = existsSync(customClipPath(manifest.characterId, disk.id));
      const clipGenerating = CUSTOM_GENERATION_LOCKS.has(`${manifest.characterId}:${disk.id}`);
      const status = fileExists
        ? "ready"
        : disk.status === "error"
          ? "error"
          : disk.status === "generating" && clipGenerating
            ? "generating"
            : "missing";
      return {
        id: disk.id,
        label: disk.label,
        prompt: disk.prompt,
        status,
        url: status === "ready" ? customClipUrl(manifest.characterId, disk.id) : null,
        error: status === "error" ? (disk.error ?? "Video generation failed") : null,
        createdAt: disk.createdAt,
        updatedAt: disk.updatedAt ?? null,
      };
    });
  return {
    characterId: manifest.characterId,
    characterName: manifest.characterName,
    sourceAvatarPath: manifest.sourceAvatarPath,
    generating,
    updatedAt: manifest.updatedAt,
    clips,
    customClips,
  };
}

function parseDefaultParametersRoot(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  let parsed: unknown = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? { ...(parsed as Record<string, unknown>) }
    : {};
}

function getStoredVideoDefaults(raw: unknown) {
  const root = parseDefaultParametersRoot(raw);
  return normalizeVideoGenerationProfile(root[VIDEO_DEFAULTS_STORAGE_KEY]).profile;
}

async function readAvatarReferenceImage(avatarPath: string | null): Promise<VideoReferenceImage> {
  if (!avatarPath) throw new Error("The character needs an avatar before Marinara can generate call videos.");
  const filename = avatarPath.split("?")[0]!.split("/").pop();
  if (!filename) throw new Error("The character avatar path is invalid.");
  const filepath = assertInsideDir(AVATARS_ROOT, join(AVATARS_ROOT, filename));
  if (!existsSync(filepath)) throw new Error("The character avatar file could not be found.");
  const buffer = await readFile(filepath);
  const imageInfo = isAllowedImageBuffer(buffer, extname(filename));
  if (!imageInfo) throw new Error("The character avatar is not a supported image file.");
  if (imageInfo.mimeType === "image/png" || imageInfo.mimeType === "image/jpeg") {
    return { base64: buffer.toString("base64"), mimeType: imageInfo.mimeType };
  }
  const sharp = await getSharp();
  const png = await sharp(buffer, { limitInputPixels: false }).png().toBuffer();
  return { base64: png.toString("base64"), mimeType: "image/png" };
}

function getClipLabel(kind: ConversationCallCharacterVideoClipKind) {
  return CONVERSATION_CALL_VIDEO_CLIP_LABEL_BY_KIND.get(kind) ?? `${kind} clip`;
}

function getClipInstruction(kind: ConversationCallCharacterVideoClipKind) {
  return (
    CONVERSATION_CALL_VIDEO_CLIP_INSTRUCTION_BY_KIND.get(kind) ??
    "Start from the neutral video-call idle pose, animate naturally for the clip type, then return to the identical neutral pose by the final frame so the clip loops cleanly."
  );
}

async function buildClipPrompt(input: {
  promptOverridesStorage: PromptOverridesStorage;
  characterName: string;
  kind: ConversationCallCharacterVideoClipKind;
  durationSeconds: number;
}) {
  const def = CONVERSATION_CALL_VIDEO_PROMPT_BY_KIND.get(input.kind);
  if (!def) {
    return [
      `Create a ${input.durationSeconds}-second 16:9 ${getClipLabel(input.kind)} for an AI character in a private video call.`,
      `Character name: ${input.characterName}.`,
      getClipInstruction(input.kind),
      "Use only the supplied avatar/reference image as the character identity, appearance, outfit, art style, camera framing, and background reference.",
      "The first frame must match the supplied reference image as closely as the provider allows.",
      "The final frame must return to that same reference-matching pose, expression, framing, lighting, outfit, and background so the clip loops seamlessly.",
      "This must be a clean loop with no jump cut, sudden pose reset, snap in expression, or identity drift at the loop point.",
      "Use a still camera: the camera must be completely locked off for the entire clip. Do not animate the camera.",
      "No zoom in, zoom out, push-in, pull-out, dolly, pan, tilt, roll, crop change, reframing, phone movement, handheld drift, or perspective change.",
      "Keep the character's face at the same screen position and the same apparent size from first frame to final frame. Only the character may move.",
      "Preserve the reference image's face, hair, outfit, mask/accessories, colors, proportions, and art style for the entire clip.",
      "No sudden outfit changes, hairstyle changes, identity drift, lighting shifts, new accessories, or altered facial features.",
      "Single character only. No extra people. No UI, captions, subtitles, speech bubbles, text, logos, or watermarks.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return loadPrompt(input.promptOverridesStorage, def, {
    characterName: input.characterName,
    clipLabel: getClipLabel(input.kind),
    clipInstruction: getClipInstruction(input.kind),
    durationSeconds: input.durationSeconds,
    aspectRatio: "16:9",
  });
}

function sanitizeCustomClipText(value: string, fallback: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  return (compact || fallback).slice(0, maxLength);
}

async function buildCustomClipPrompt(input: {
  promptOverridesStorage: PromptOverridesStorage;
  characterName: string;
  label: string;
  prompt: string;
  durationSeconds: number;
}) {
  return loadPrompt(input.promptOverridesStorage, CONVERSATION_CALL_CUSTOM_VIDEO_PROMPT, {
    characterName: input.characterName,
    clipLabel: input.label,
    customPrompt: input.prompt,
    durationSeconds: input.durationSeconds,
    aspectRatio: "16:9",
  });
}

function resolveVideoConnection(connection: VideoGenerationConnection) {
  const videoDefaults = connection.defaultParameters
    ? getStoredVideoDefaults(connection.defaultParameters)
    : createDefaultVideoGenerationProfile();
  const explicitVideoSource = connection.videoGenerationSource || connection.videoService || "";
  const source =
    explicitVideoSource ||
    (videoDefaults.service !== "gemini_omni"
      ? videoDefaults.service
      : inferVideoSource(connection.model || "", connection.baseUrl || ""));
  const serviceHint = connection.videoService || source;
  const isXaiVideo = source === "xai" || serviceHint === "xai";
  const isGoogleVeoVideo = source === "google_veo" || serviceHint === "google_veo";
  const isOpenRouterVideo = source === "openrouter" || serviceHint === "openrouter";
  return {
    source,
    serviceHint,
    baseUrl:
      connection.baseUrl ||
      (isXaiVideo
        ? DEFAULT_XAI_VIDEO_BASE_URL
        : isGoogleVeoVideo
          ? DEFAULT_GOOGLE_VEO_BASE_URL
        : isOpenRouterVideo
          ? DEFAULT_OPENROUTER_VIDEO_BASE_URL
          : DEFAULT_GEMINI_OMNI_BASE_URL),
    model:
      connection.model ||
      (isXaiVideo
        ? DEFAULT_XAI_VIDEO_MODEL
        : isGoogleVeoVideo
          ? DEFAULT_GOOGLE_VEO_MODEL
        : isOpenRouterVideo
          ? DEFAULT_OPENROUTER_VIDEO_MODEL
          : DEFAULT_GEMINI_OMNI_MODEL),
    resolution: isXaiVideo
      ? videoDefaults.xai.resolution
      : isGoogleVeoVideo
        ? videoDefaults.googleVeo.resolution
      : isOpenRouterVideo
        ? videoDefaults.openrouter.resolution
        : undefined,
  };
}

async function pruneCustomClips(manifest: DiskManifest): Promise<DiskManifest> {
  const entries = Object.values(manifest.customClips ?? {}).sort(
    (a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt),
  );
  if (entries.length <= CUSTOM_CLIP_LIMIT) return manifest;
  const keep = new Set(entries.slice(0, CUSTOM_CLIP_LIMIT).map((entry) => entry.id));
  const customClips: Record<string, DiskCustomClip> = {};
  for (const entry of entries) {
    if (keep.has(entry.id)) {
      customClips[entry.id] = entry;
      continue;
    }
    const file = customClipPath(manifest.characterId, entry.id);
    if (existsSync(file)) await unlink(file).catch(() => {});
  }
  return { ...manifest, customClips };
}

async function runGenerationJob(input: {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
  connection: VideoGenerationConnection;
  promptOverridesStorage: PromptOverridesStorage;
  videoSettings: VideoGenerationUserSettings;
  debugMode?: boolean;
}) {
  const startedAt = nowIso();
  const referenceImage = await readAvatarReferenceImage(input.avatarPath);
  const resolved = resolveVideoConnection(input.connection);
  logger.info(
    "[conversation-call/videos] Generating call videos for %s via connection=%s source=%s model=%s",
    input.characterId,
    input.connection.id,
    resolved.source,
    resolved.model,
  );

  for (const kind of CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS) {
    const manifest = stampClipSourceAvatarPaths(
      await readDiskManifest(input.characterId, input.characterName, input.avatarPath),
    );
    if (isClipReadyForAvatar(manifest, kind, input.avatarPath)) {
      continue;
    }
    const queuedAt = nowIso();
    await updateDiskManifest({
      characterId: input.characterId,
      characterName: input.characterName,
      avatarPath: input.avatarPath,
      update: (latest) => ({
        ...latest,
        characterName: input.characterName,
        sourceAvatarPath: input.avatarPath,
        updatedAt: queuedAt,
        clips: {
          ...latest.clips,
          [kind]: { status: "generating", error: null, updatedAt: queuedAt, sourceAvatarPath: input.avatarPath },
        },
      }),
    });
    const durationSeconds = getConversationCallVideoClipDuration(input.videoSettings, kind);
    const prompt = await buildClipPrompt({
      promptOverridesStorage: input.promptOverridesStorage,
      characterName: input.characterName,
      kind,
      durationSeconds,
    });
    try {
      if (input.debugMode) {
        logDebugOverride(true, "[debug/conversation-call/videos] %s prompt for %s:\n%s", kind, input.characterId, prompt);
      }
      const generated = await generateVideo(
        resolved.source,
        resolved.baseUrl,
        input.connection.apiKey || "",
        resolved.serviceHint,
        {
          prompt,
          model: resolved.model,
          durationSeconds,
          aspectRatio: "16:9",
          resolution: resolved.resolution,
          referenceImage,
        },
      );
      const file = clipPath(input.characterId, kind);
      const tmp = assertInsideDir(CALL_CHARACTER_VIDEO_ROOT, `${file}.${process.pid}.${Date.now()}.tmp`);
      await writeFile(tmp, Buffer.from(generated.base64, "base64"));
      await rename(tmp, file);
      const updatedAt = nowIso();
      await updateDiskManifest({
        characterId: input.characterId,
        characterName: input.characterName,
        avatarPath: input.avatarPath,
        update: (latest) => ({
          ...latest,
          characterName: input.characterName,
          sourceAvatarPath: input.avatarPath,
          updatedAt,
          clips: {
            ...latest.clips,
            [kind]: { status: "ready", error: null, updatedAt, sourceAvatarPath: input.avatarPath },
          },
        }),
      });
      logger.info("[conversation-call/videos] Generated %s for %s", getClipLabel(kind), input.characterId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Video generation failed";
      const updatedAt = nowIso();
      await updateDiskManifest({
        characterId: input.characterId,
        characterName: input.characterName,
        avatarPath: input.avatarPath,
        update: (latest) => ({
          ...latest,
          characterName: input.characterName,
          sourceAvatarPath: input.avatarPath,
          updatedAt,
          clips: {
            ...latest.clips,
            [kind]: { status: "error", error: message, updatedAt, sourceAvatarPath: input.avatarPath },
          },
        }),
      });
      logger.warn(error, "[conversation-call/videos] Failed to generate %s for %s", kind, input.characterId);
    }
  }

  logger.info(
    "[conversation-call/videos] Finished call video generation for %s in %dms",
    input.characterId,
    Date.now() - Date.parse(startedAt),
  );
}

async function runCustomClipGenerationJob(input: {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
  connection: VideoGenerationConnection;
  promptOverridesStorage: PromptOverridesStorage;
  videoSettings: VideoGenerationUserSettings;
  clipId: string;
  label: string;
  prompt: string;
  debugMode?: boolean;
}) {
  const startedAt = nowIso();
  try {
    const referenceImage = await readAvatarReferenceImage(input.avatarPath);
    const resolved = resolveVideoConnection(input.connection);
    const durationSeconds = input.videoSettings.callCustomClipDurationSeconds;
    const prompt = await buildCustomClipPrompt({
      promptOverridesStorage: input.promptOverridesStorage,
      characterName: input.characterName,
      label: input.label,
      prompt: input.prompt,
      durationSeconds,
    });
    if (input.debugMode) {
      logDebugOverride(
        true,
        "[debug/conversation-call/videos] custom clip %s prompt for %s:\n%s",
        input.clipId,
        input.characterId,
        prompt,
      );
    }
    const generated = await generateVideo(
      resolved.source,
      resolved.baseUrl,
      input.connection.apiKey || "",
      resolved.serviceHint,
      {
        prompt,
        model: resolved.model,
        durationSeconds,
        aspectRatio: "16:9",
        resolution: resolved.resolution,
        referenceImage,
      },
    );
    const file = customClipPath(input.characterId, input.clipId);
    const tmp = assertInsideDir(CALL_CHARACTER_VIDEO_ROOT, `${file}.${process.pid}.${Date.now()}.tmp`);
    await writeFile(tmp, Buffer.from(generated.base64, "base64"));
    await rename(tmp, file);
    const updatedAt = nowIso();
    await updateDiskManifest({
      characterId: input.characterId,
      characterName: input.characterName,
      avatarPath: input.avatarPath,
      update: async (latest) =>
        pruneCustomClips({
          ...latest,
          characterName: input.characterName,
          sourceAvatarPath: input.avatarPath,
          updatedAt,
          customClips: {
            ...latest.customClips,
            [input.clipId]: {
              ...(latest.customClips[input.clipId] ?? {
                id: input.clipId,
                label: input.label,
                prompt: input.prompt,
                createdAt: startedAt,
              }),
              status: "ready",
              error: null,
              updatedAt,
              sourceAvatarPath: input.avatarPath,
            },
          },
        }),
    });
    logger.info("[conversation-call/videos] Generated custom clip %s for %s", input.clipId, input.characterId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video generation failed";
    const updatedAt = nowIso();
    await updateDiskManifest({
      characterId: input.characterId,
      characterName: input.characterName,
      avatarPath: input.avatarPath,
      update: (latest) => ({
        ...latest,
        characterName: input.characterName,
        sourceAvatarPath: input.avatarPath,
        updatedAt,
        customClips: {
          ...latest.customClips,
          [input.clipId]: {
            ...(latest.customClips[input.clipId] ?? {
              id: input.clipId,
              label: input.label,
              prompt: input.prompt,
              createdAt: startedAt,
            }),
            status: "error",
            error: message,
            updatedAt,
            sourceAvatarPath: input.avatarPath,
          },
        },
      }),
    });
    logger.warn(error, "[conversation-call/videos] Failed to generate custom clip %s for %s", input.clipId, input.characterId);
  }
}

export async function getConversationCallCharacterVideoManifest(input: {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
}): Promise<ConversationCallCharacterVideoManifest> {
  assertSafeCharacterId(input.characterId);
  const manifest = await readDiskManifest(input.characterId, input.characterName, input.avatarPath);
  return toPublicManifest(manifest, input.avatarPath);
}

export async function startConversationCallCharacterVideoGeneration(input: {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
  connection: VideoGenerationConnection;
  promptOverridesStorage: PromptOverridesStorage;
  videoSettings?: VideoGenerationUserSettings | null;
  debugMode?: boolean;
}): Promise<ConversationCallCharacterVideoManifest> {
  assertSafeCharacterId(input.characterId);
  const videoSettings = normalizeVideoGenerationUserSettings(input.videoSettings);
  if (!GENERATION_LOCKS.has(input.characterId)) {
    const timestamp = nowIso();
    await updateDiskManifest({
      characterId: input.characterId,
      characterName: input.characterName,
      avatarPath: input.avatarPath,
      update: (current) => {
        const clips = { ...current.clips };
        const firstPendingKind = CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.find(
          (kind) => !isClipReadyForAvatar(current, kind, input.avatarPath),
        );
        if (firstPendingKind) {
          clips[firstPendingKind] = {
            status: "generating",
            error: null,
            updatedAt: timestamp,
            sourceAvatarPath: input.avatarPath,
          };
        }
        return {
          ...current,
          characterName: input.characterName,
          sourceAvatarPath: input.avatarPath,
          updatedAt: timestamp,
          clips,
        };
      },
    });
    const job = runGenerationJob({ ...input, videoSettings }).finally(() => {
      GENERATION_LOCKS.delete(input.characterId);
    });
    GENERATION_LOCKS.set(input.characterId, job);
    void job.catch((error) => {
      logger.warn(error, "[conversation-call/videos] Call video generation job failed for %s", input.characterId);
    });
  }
  return getConversationCallCharacterVideoManifest(input);
}

export async function startConversationCallCustomVideoClipGeneration(input: {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
  connection: VideoGenerationConnection;
  promptOverridesStorage: PromptOverridesStorage;
  videoSettings?: VideoGenerationUserSettings | null;
  label?: string | null;
  prompt: string;
  debugMode?: boolean;
}): Promise<ConversationCallCharacterVideoManifest> {
  assertSafeCharacterId(input.characterId);
  const videoSettings = normalizeVideoGenerationUserSettings(input.videoSettings);
  const clipId = `custom-${newId()}`;
  const timestamp = nowIso();
  const label = sanitizeCustomClipText(input.label ?? "", "Custom clip", 80);
  const prompt = sanitizeCustomClipText(input.prompt, "A short custom video-call clip requested by the user.", 800);
  await updateDiskManifest({
    characterId: input.characterId,
    characterName: input.characterName,
    avatarPath: input.avatarPath,
    update: async (current) =>
      pruneCustomClips({
        ...current,
        characterName: input.characterName,
        sourceAvatarPath: input.avatarPath,
        updatedAt: timestamp,
        customClips: {
          ...current.customClips,
          [clipId]: {
            id: clipId,
            label,
            prompt,
            status: "generating",
            error: null,
            createdAt: timestamp,
            updatedAt: timestamp,
            sourceAvatarPath: input.avatarPath,
          },
        },
      }),
  });
  const lockKey = `${input.characterId}:${clipId}`;
  const job = runCustomClipGenerationJob({ ...input, clipId, label, prompt, videoSettings }).finally(() => {
    CUSTOM_GENERATION_LOCKS.delete(lockKey);
  });
  CUSTOM_GENERATION_LOCKS.set(lockKey, job);
  void job.catch((error) => {
    logger.warn(error, "[conversation-call/videos] Custom call video generation job failed for %s", input.characterId);
  });
  return getConversationCallCharacterVideoManifest(input);
}

export async function deleteConversationCallCharacterVideoClip(input: {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
  kind: ConversationCallCharacterVideoClipKind;
}): Promise<boolean> {
  assertSafeCharacterId(input.characterId);
  if (!CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.includes(input.kind)) {
    throw new Error("Invalid call video clip kind");
  }
  if (GENERATION_LOCKS.has(input.characterId)) {
    throw new ConversationCallVideoGenerationInProgressError("Call video clips are still generating for this character");
  }

  const file = clipPath(input.characterId, input.kind);
  const fileExisted = existsSync(file);
  await unlink(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });

  let hadManifestEntry = false;
  const updatedAt = nowIso();
  await updateDiskManifest({
    characterId: input.characterId,
    characterName: input.characterName,
    avatarPath: input.avatarPath,
    update: (current) => {
      hadManifestEntry = Boolean(current.clips[input.kind]);
      return {
        ...current,
        characterName: input.characterName,
        sourceAvatarPath: input.avatarPath,
        updatedAt,
        clips: {
          ...current.clips,
          [input.kind]: { status: "missing", error: null, updatedAt },
        },
      };
    },
  });

  const deleted = fileExisted || hadManifestEntry;
  if (deleted) {
    logger.info(
      "[conversation-call/videos] Deleted %s call video clip for %s",
      getClipLabel(input.kind),
      input.characterId,
    );
  }
  return deleted;
}

export async function deleteConversationCallCustomVideoClip(input: {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
  clipId: string;
}): Promise<boolean> {
  assertSafeCharacterId(input.characterId);
  const clipId = assertSafeCustomClipId(input.clipId);
  if (CUSTOM_GENERATION_LOCKS.has(`${input.characterId}:${clipId}`)) {
    throw new ConversationCallVideoGenerationInProgressError("This custom call video clip is still generating");
  }
  const file = customClipPath(input.characterId, clipId);
  const fileExisted = existsSync(file);
  await unlink(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });

  let hadManifestEntry = false;
  const updatedAt = nowIso();
  await updateDiskManifest({
    characterId: input.characterId,
    characterName: input.characterName,
    avatarPath: input.avatarPath,
    update: (current) => {
      hadManifestEntry = Boolean(current.customClips[clipId]);
      const customClips = { ...current.customClips };
      delete customClips[clipId];
      return {
        ...current,
        characterName: input.characterName,
        sourceAvatarPath: input.avatarPath,
        updatedAt,
        customClips,
      };
    },
  });

  const deleted = fileExisted || hadManifestEntry;
  if (deleted) {
    logger.info("[conversation-call/videos] Deleted custom call video clip %s for %s", clipId, input.characterId);
  }
  return deleted;
}

export function getConversationCallCharacterVideoFile(characterId: string, kind: ConversationCallCharacterVideoClipKind) {
  assertSafeCharacterId(characterId);
  if (!CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.includes(kind)) return null;
  const file = clipPath(characterId, kind);
  return existsSync(file) ? file : null;
}

export function getConversationCallCustomVideoClipFile(characterId: string, clipId: string) {
  assertSafeCharacterId(characterId);
  assertSafeCustomClipId(clipId);
  const file = customClipPath(characterId, clipId);
  return existsSync(file) ? file : null;
}
