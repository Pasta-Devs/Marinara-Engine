import { createHash } from "node:crypto";
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
import {
  generateVideo,
  resolveVideoReferencePublicUploadOptions,
  resolveVideoRequestDuration,
  type VideoReferenceImage,
} from "../video/video-generation.js";

type DiskClip = {
  status?: ConversationCallCharacterVideoClip["status"];
  error?: string | null;
  updatedAt?: string | null;
  origin?: "generated" | "uploaded";
  sourceAvatarPath?: string | null;
  sourceAvatarDigest?: string | null;
  trimStartSeconds?: number | null;
  trimEndSeconds?: number | null;
};

type DiskCustomClip = {
  id: string;
  label: string;
  prompt: string;
  status?: ConversationCallCharacterVideoClip["status"];
  error?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  origin?: "generated" | "uploaded";
  sourceAvatarPath?: string | null;
  sourceAvatarDigest?: string | null;
  trimStartSeconds?: number | null;
  trimEndSeconds?: number | null;
};

type DiskManifest = {
  version: 1;
  characterId: string;
  characterName: string;
  sourceAvatarPath: string | null;
  sourceAvatarDigest: string | null;
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

type AvatarIdentity = {
  path: string | null;
  digest: string | null;
};

type AvatarReference = {
  image: VideoReferenceImage;
  identity: AvatarIdentity;
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
const DEFAULT_SEEDANCE_VIDEO_MODEL = "seedance-2-0";
const DEFAULT_SEEDANCE_VIDEO_BASE_URL = "https://api.seedance2.ai";
const CALL_CHARACTER_VIDEO_VERSION = 1;
type GenerationLock = {
  job: Promise<void>;
  clipKinds: Set<ConversationCallCharacterVideoClipKind>;
};
const GENERATION_LOCKS = new Map<string, GenerationLock>();
const CUSTOM_GENERATION_LOCKS = new Map<string, Promise<void>>();
const MANIFEST_LOCKS = new Map<string, Promise<void>>();
const CUSTOM_CLIP_LIMIT = 128;
const MAX_CALL_VIDEO_TRIM_SECONDS = 3_600;
const CALL_VIDEO_REFERENCE_WIDTH = 1280;
const CALL_VIDEO_REFERENCE_HEIGHT = 720;

export class ConversationCallVideoGenerationInProgressError extends Error {
  constructor(message = "This call video clip is still generating") {
    super(message);
    this.name = "ConversationCallVideoGenerationInProgressError";
  }
}

export class ConversationCallVideoClipNotFoundError extends Error {
  constructor(message = "Call video clip not found") {
    super(message);
    this.name = "ConversationCallVideoClipNotFoundError";
  }
}

export class ConversationCallVideoClipTrimError extends Error {
  constructor(message = "Clip trim end must be after trim start") {
    super(message);
    this.name = "ConversationCallVideoClipTrimError";
  }
}

export class ConversationCallVideoClipAvatarMismatchError extends Error {
  constructor(message = "This call video clip was generated for a previous avatar. Regenerate it before trimming.") {
    super(message);
    this.name = "ConversationCallVideoClipAvatarMismatchError";
  }
}

export class ConversationCallVideoClipUploadError extends Error {
  constructor(message = "Uploaded call video clips must be MP4 files.") {
    super(message);
    this.name = "ConversationCallVideoClipUploadError";
  }
}

type SharpPipeline = {
  resize: (options: Record<string, unknown>) => SharpPipeline;
  png: () => { toBuffer: () => Promise<Buffer> };
};

type SharpFn = (input: Buffer, options?: Record<string, unknown>) => SharpPipeline;

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
  if (
    !characterId ||
    characterId.includes("..") ||
    characterId.includes("/") ||
    characterId.includes("\\") ||
    characterId.includes("\0")
  ) {
    throw new Error("Invalid character id");
  }
  return characterId;
}

function assertSafeCustomClipId(clipId: string) {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(clipId)) throw new Error("Invalid custom clip id");
  return clipId;
}

function characterDir(characterId: string) {
  return assertInsideDir(
    CALL_CHARACTER_VIDEO_ROOT,
    join(CALL_CHARACTER_VIDEO_ROOT, assertSafeCharacterId(characterId)),
  );
}

function manifestPath(characterId: string) {
  return assertInsideDir(CALL_CHARACTER_VIDEO_ROOT, join(characterDir(characterId), "manifest.json"));
}

function clipPath(characterId: string, kind: ConversationCallCharacterVideoClipKind) {
  return assertInsideDir(CALL_CHARACTER_VIDEO_ROOT, join(characterDir(characterId), `${kind}.mp4`));
}

function clipUrl(characterId: string, kind: ConversationCallCharacterVideoClipKind, version?: string | null) {
  const path = `/api/conversation-calls/character-videos/${encodeURIComponent(characterId)}/file/${encodeURIComponent(kind)}`;
  return version ? `${path}?v=${encodeURIComponent(version)}` : path;
}

function customClipPath(characterId: string, clipId: string) {
  return assertInsideDir(
    CALL_CHARACTER_VIDEO_ROOT,
    join(characterDir(characterId), `${assertSafeCustomClipId(clipId)}.mp4`),
  );
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
    sourceAvatarDigest: null,
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
      sourceAvatarDigest: parsed.sourceAvatarDigest ?? null,
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
      clips[kind] = {
        ...clip,
        sourceAvatarPath: manifest.sourceAvatarPath,
        sourceAvatarDigest: manifest.sourceAvatarDigest,
      };
    } else if (clip && !Object.prototype.hasOwnProperty.call(clip, "sourceAvatarDigest")) {
      clips[kind] = { ...clip, sourceAvatarDigest: manifest.sourceAvatarDigest };
    }
  }
  return { ...manifest, clips };
}

function getClipAvatarIdentity(manifest: DiskManifest, clip: DiskClip): AvatarIdentity {
  return {
    path: Object.prototype.hasOwnProperty.call(clip, "sourceAvatarPath")
      ? (clip.sourceAvatarPath ?? null)
      : manifest.sourceAvatarPath,
    digest: Object.prototype.hasOwnProperty.call(clip, "sourceAvatarDigest")
      ? (clip.sourceAvatarDigest ?? null)
      : manifest.sourceAvatarDigest,
  };
}

function avatarIdentityMatches(clipAvatar: AvatarIdentity, activeAvatar: AvatarIdentity) {
  if (clipAvatar.path !== activeAvatar.path) return false;
  if (activeAvatar.digest) return clipAvatar.digest === activeAvatar.digest;
  return !clipAvatar.digest;
}

function clipUrlVersion(clip: DiskClip, avatar: AvatarIdentity) {
  return [clip.updatedAt, avatar.digest, avatar.path].filter(Boolean).join(":");
}

function readTrimSecond(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return null;
  const clamped = Math.min(MAX_CALL_VIDEO_TRIM_SECONDS, Math.max(0, numeric));
  return Math.round(clamped * 1000) / 1000;
}

function isMp4Buffer(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

function normalizeClipTrim(input: { trimStartSeconds?: unknown; trimEndSeconds?: unknown }): {
  trimStartSeconds: number | null;
  trimEndSeconds: number | null;
} {
  const trimStartSeconds = readTrimSecond(input.trimStartSeconds);
  const trimEndSeconds = readTrimSecond(input.trimEndSeconds);
  const normalizedStart = trimStartSeconds && trimStartSeconds > 0 ? trimStartSeconds : null;
  const normalizedEnd = trimEndSeconds && trimEndSeconds > 0 ? trimEndSeconds : null;
  if (normalizedStart !== null && normalizedEnd !== null && normalizedEnd <= normalizedStart) {
    throw new ConversationCallVideoClipTrimError("Clip trim end must be after trim start");
  }
  return { trimStartSeconds: normalizedStart, trimEndSeconds: normalizedEnd };
}

function customClipAvatarIdentity(manifest: DiskManifest, clip: DiskCustomClip): AvatarIdentity {
  return {
    path: Object.prototype.hasOwnProperty.call(clip, "sourceAvatarPath")
      ? (clip.sourceAvatarPath ?? null)
      : manifest.sourceAvatarPath,
    digest: Object.prototype.hasOwnProperty.call(clip, "sourceAvatarDigest")
      ? (clip.sourceAvatarDigest ?? null)
      : manifest.sourceAvatarDigest,
  };
}

function isClipReadyForAvatar(
  manifest: DiskManifest,
  kind: ConversationCallCharacterVideoClipKind,
  avatar: AvatarIdentity,
) {
  const disk = manifest.clips[kind] ?? {};
  const clipAvatar = getClipAvatarIdentity(manifest, disk);
  const diskReady = disk.status === "ready" || !disk.status;
  return (
    diskReady &&
    (disk.origin === "uploaded" || avatarIdentityMatches(clipAvatar, avatar)) &&
    existsSync(clipPath(manifest.characterId, kind))
  );
}

function toPublicManifest(
  manifest: DiskManifest,
  activeAvatar: AvatarIdentity,
): ConversationCallCharacterVideoManifest {
  manifest = stampClipSourceAvatarPaths(manifest);
  const customLockPrefix = `${manifest.characterId}:`;
  const customGenerating = [...CUSTOM_GENERATION_LOCKS.keys()].some((key) => key.startsWith(customLockPrefix));
  const activeGeneration = GENERATION_LOCKS.get(manifest.characterId);
  const generating = Boolean(activeGeneration) || customGenerating;
  const clips = CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.map((kind): ConversationCallCharacterVideoClip => {
    const disk = manifest.clips[kind] ?? {};
    const clipAvatar = getClipAvatarIdentity(manifest, disk);
    const avatarMatches = avatarIdentityMatches(clipAvatar, activeAvatar);
    const activeClipGenerating = activeGeneration?.clipKinds.has(kind) === true;
    const fileExists = existsSync(clipPath(manifest.characterId, kind));
    const diskReady = disk.status === "ready" || !disk.status;
    const uploadedStandardClip = disk.origin === "uploaded";
    const status =
      fileExists && diskReady && (avatarMatches || uploadedStandardClip)
        ? "ready"
        : avatarMatches && disk.status === "generating" && activeClipGenerating
          ? "generating"
          : avatarMatches && disk.status === "error"
            ? "error"
            : "missing";
    return {
      kind,
      status,
      url: status === "ready" ? clipUrl(manifest.characterId, kind, clipUrlVersion(disk, clipAvatar)) : null,
      error: status === "error" ? (disk.error ?? "Video generation failed") : null,
      updatedAt: disk.updatedAt ?? null,
      origin:
        status === "missing"
          ? undefined
          : disk.origin === "uploaded"
            ? "uploaded"
            : disk.updatedAt
              ? "generated"
              : undefined,
      trimStartSeconds: readTrimSecond(disk.trimStartSeconds),
      trimEndSeconds: readTrimSecond(disk.trimEndSeconds),
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
        origin: disk.origin === "uploaded" ? "uploaded" : "generated",
        trimStartSeconds: readTrimSecond(disk.trimStartSeconds),
        trimEndSeconds: readTrimSecond(disk.trimEndSeconds),
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

function avatarDigest(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function readAvatarFile(avatarPath: string | null) {
  if (!avatarPath) throw new Error("The character needs an avatar before Marinara can generate call videos.");
  const filename = avatarPath.split("?")[0]!.split("/").pop();
  if (!filename) throw new Error("The character avatar path is invalid.");
  const filepath = assertInsideDir(AVATARS_ROOT, join(AVATARS_ROOT, filename));
  if (!existsSync(filepath)) throw new Error("The character avatar file could not be found.");
  const buffer = await readFile(filepath);
  const imageInfo = isAllowedImageBuffer(buffer, extname(filename));
  if (!imageInfo) throw new Error("The character avatar is not a supported image file.");
  return { buffer, imageInfo };
}

async function readAvatarIdentity(avatarPath: string | null): Promise<AvatarIdentity> {
  if (!avatarPath) return { path: null, digest: null };
  try {
    const { buffer } = await readAvatarFile(avatarPath);
    return { path: avatarPath, digest: avatarDigest(buffer) };
  } catch {
    return { path: avatarPath, digest: null };
  }
}

function isVideoReferenceMimeType(mimeType: string): mimeType is VideoReferenceImage["mimeType"] {
  return mimeType === "image/png" || mimeType === "image/jpeg";
}

async function buildCallVideoReferenceImage(
  buffer: Buffer,
  mimeType: string,
  url: string | null,
): Promise<VideoReferenceImage> {
  try {
    const sharp = await getSharp();
    const framed = await sharp(buffer)
      .resize({
        width: CALL_VIDEO_REFERENCE_WIDTH,
        height: CALL_VIDEO_REFERENCE_HEIGHT,
        fit: "cover",
        position: "north",
      })
      .png()
      .toBuffer();
    return { base64: framed.toString("base64"), mimeType: "image/png", url };
  } catch (err) {
    if (isVideoReferenceMimeType(mimeType)) {
      logger.warn(
        err instanceof Error ? err : new Error(String(err)),
        "[conversation-call/videos] Failed to frame avatar reference for 16:9 video; using original avatar image",
      );
      return { base64: buffer.toString("base64"), mimeType, url };
    }
    throw err;
  }
}

async function readAvatarReferenceImage(avatarPath: string | null): Promise<AvatarReference> {
  const { buffer, imageInfo } = await readAvatarFile(avatarPath);
  const identity = { path: avatarPath, digest: avatarDigest(buffer) };
  const url = avatarPath?.split("?")[0] ?? null;
  const image = await buildCallVideoReferenceImage(buffer, imageInfo.mimeType, url);
  return { image, identity };
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
  usesAvatarReference: boolean;
}) {
  const def = CONVERSATION_CALL_VIDEO_PROMPT_BY_KIND.get(input.kind);
  if (!def) {
    const referenceLines = input.usesAvatarReference
      ? [
          "Reference: use the attached 16:9 image as the character identity, crop, and first/final frame target.",
          "Preserve the reference image's crop, especially the top/head framing. If any framing must be lost, crop lower body or lower clothing instead of hair, head, mask, or face.",
          "Preserve the reference image's background, lighting, colors, face shape, hair, clothing, mask or eyewear, accessories, and art style.",
        ]
      : [
          "No reference image is attached. Generate a clean 16:9 animated portrait loop from the prompt alone.",
          "Keep the character design consistent for the whole clip, with no outfit, accessory, face, hair, or background changes.",
        ];
    return [
      `Create a ${input.durationSeconds}-second 16:9 animated portrait loop for an AI video call.`,
      ...referenceLines,
      `Action: ${getClipInstruction(input.kind)}`,
      "Motion quality: one smooth, restrained, video-call-like motion throughout the clip.",
      input.usesAvatarReference
        ? "Lighting and background: keep them from the reference image; do not invent a new ambience or setting."
        : "Lighting and background: keep them stable and simple; do not change the setting mid-clip.",
      "Camera: locked-off still camera, no zoom, pan, tilt, dolly, crop change, reframing, handheld shake, or scene cut.",
      "Looping: return to the first-frame pose by the final frame for a seamless loop.",
      "Focus: single character only, no captions, subtitles, UI, logos, extra people, new clothing, or new facial features.",
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
    referenceInstruction: input.usesAvatarReference
      ? "Use the attached image as the character identity, crop, and first/final frame target."
      : "No reference image is attached. Generate from the prompt alone and keep identity, framing, and styling consistent.",
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
  usesAvatarReference: boolean;
}) {
  return loadPrompt(input.promptOverridesStorage, CONVERSATION_CALL_CUSTOM_VIDEO_PROMPT, {
    characterName: input.characterName,
    clipLabel: input.label,
    customPrompt: input.prompt,
    durationSeconds: input.durationSeconds,
    aspectRatio: "16:9",
    referenceInstruction: input.usesAvatarReference
      ? "Reference: use the attached 16:9 image as the character identity, crop, and first/final frame target."
      : "No reference image is attached. Generate from the custom action and keep identity, framing, and styling consistent.",
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
  const serviceHint =
    connection.videoService ||
    (source === "google_ai_studio" ? inferVideoSource(connection.model || "", connection.baseUrl || "") : source);
  const isXaiVideo = source === "xai" || serviceHint === "xai";
  const isGoogleVeoVideo = source === "google_veo" || serviceHint === "google_veo";
  const isOpenRouterVideo = source === "openrouter" || serviceHint === "openrouter";
  const isSeedanceVideo = source === "seedance" || serviceHint === "seedance";
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
            : isSeedanceVideo
              ? DEFAULT_SEEDANCE_VIDEO_BASE_URL
              : DEFAULT_GEMINI_OMNI_BASE_URL),
    model:
      connection.model ||
      (isXaiVideo
        ? DEFAULT_XAI_VIDEO_MODEL
        : isGoogleVeoVideo
          ? DEFAULT_GOOGLE_VEO_MODEL
          : isOpenRouterVideo
            ? DEFAULT_OPENROUTER_VIDEO_MODEL
            : isSeedanceVideo
              ? DEFAULT_SEEDANCE_VIDEO_MODEL
              : DEFAULT_GEMINI_OMNI_MODEL),
    resolution: isXaiVideo
      ? videoDefaults.xai.resolution
      : isGoogleVeoVideo
        ? videoDefaults.googleVeo.resolution
        : isOpenRouterVideo
          ? videoDefaults.openrouter.resolution
          : isSeedanceVideo
            ? videoDefaults.seedance.resolution
            : undefined,
    publicReferenceUpload: resolveVideoReferencePublicUploadOptions(isSeedanceVideo, videoDefaults.seedance),
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
  clipKinds?: ConversationCallCharacterVideoClipKind[] | null;
  connection: VideoGenerationConnection;
  promptOverridesStorage: PromptOverridesStorage;
  videoSettings: VideoGenerationUserSettings;
  debugMode?: boolean;
  includeAvatarReference?: boolean;
}) {
  const startedAt = nowIso();
  const avatar = await readAvatarIdentity(input.avatarPath);
  const reference = input.includeAvatarReference === false ? null : await readAvatarReferenceImage(input.avatarPath);
  const clipAvatar = reference?.identity ?? avatar;
  const resolved = resolveVideoConnection(input.connection);
  logger.info(
    "[conversation-call/videos] Generating call videos for %s via connection=%s source=%s model=%s",
    input.characterId,
    input.connection.id,
    resolved.source,
    resolved.model,
  );

  const clipKinds = input.clipKinds?.length ? input.clipKinds : CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS;
  for (const kind of clipKinds) {
    const manifest = stampClipSourceAvatarPaths(
      await readDiskManifest(input.characterId, input.characterName, input.avatarPath),
    );
    if (isClipReadyForAvatar(manifest, kind, clipAvatar)) {
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
        sourceAvatarDigest: clipAvatar.digest,
        updatedAt: queuedAt,
        clips: {
          ...latest.clips,
          [kind]: {
            status: "generating",
            error: null,
            updatedAt: queuedAt,
            origin: "generated",
            sourceAvatarPath: input.avatarPath,
            sourceAvatarDigest: clipAvatar.digest,
            trimStartSeconds: null,
            trimEndSeconds: null,
          },
        },
      }),
    });
    const requestedDurationSeconds = getConversationCallVideoClipDuration(input.videoSettings, kind);
    const durationSeconds = resolveVideoRequestDuration(resolved.source, resolved.serviceHint, {
      durationSeconds: requestedDurationSeconds,
      resolution: resolved.resolution,
      referenceImage: reference?.image,
    });
    const prompt = await buildClipPrompt({
      promptOverridesStorage: input.promptOverridesStorage,
      characterName: input.characterName,
      kind,
      durationSeconds,
      usesAvatarReference: reference !== null,
    });
    try {
      if (input.debugMode) {
        logDebugOverride(
          true,
          "[debug/conversation-call/videos] %s prompt for %s:\n%s",
          kind,
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
          ...(reference ? { referenceImage: reference.image, lastFrameImage: reference.image } : {}),
          publicReferenceUpload: resolved.publicReferenceUpload,
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
          sourceAvatarDigest: clipAvatar.digest,
          updatedAt,
          clips: {
            ...latest.clips,
            [kind]: {
              status: "ready",
              error: null,
              updatedAt,
              origin: "generated",
              sourceAvatarPath: input.avatarPath,
              sourceAvatarDigest: clipAvatar.digest,
              trimStartSeconds: null,
              trimEndSeconds: null,
            },
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
          sourceAvatarDigest: clipAvatar.digest,
          updatedAt,
          clips: {
            ...latest.clips,
            [kind]: {
              status: "error",
              error: message,
              updatedAt,
              origin: "generated",
              sourceAvatarPath: input.avatarPath,
              sourceAvatarDigest: clipAvatar.digest,
              trimStartSeconds: null,
              trimEndSeconds: null,
            },
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
  includeAvatarReference?: boolean;
}) {
  const startedAt = nowIso();
  try {
    const avatar = await readAvatarIdentity(input.avatarPath);
    const reference = input.includeAvatarReference === false ? null : await readAvatarReferenceImage(input.avatarPath);
    const clipAvatar = reference?.identity ?? avatar;
    const resolved = resolveVideoConnection(input.connection);
    const requestedDurationSeconds = input.videoSettings.callCustomClipDurationSeconds;
    const durationSeconds = resolveVideoRequestDuration(resolved.source, resolved.serviceHint, {
      durationSeconds: requestedDurationSeconds,
      resolution: resolved.resolution,
      referenceImage: reference?.image,
    });
    const prompt = await buildCustomClipPrompt({
      promptOverridesStorage: input.promptOverridesStorage,
      characterName: input.characterName,
      label: input.label,
      prompt: input.prompt,
      durationSeconds,
      usesAvatarReference: reference !== null,
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
        ...(reference ? { referenceImage: reference.image, lastFrameImage: reference.image } : {}),
        publicReferenceUpload: resolved.publicReferenceUpload,
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
          sourceAvatarDigest: clipAvatar.digest,
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
              origin: "generated",
              sourceAvatarPath: input.avatarPath,
              sourceAvatarDigest: clipAvatar.digest,
              trimStartSeconds: null,
              trimEndSeconds: null,
            },
          },
        }),
    });
    logger.info("[conversation-call/videos] Generated custom clip %s for %s", input.clipId, input.characterId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video generation failed";
    const updatedAt = nowIso();
    const avatar = await readAvatarIdentity(input.avatarPath);
    await updateDiskManifest({
      characterId: input.characterId,
      characterName: input.characterName,
      avatarPath: input.avatarPath,
      update: (latest) => ({
        ...latest,
        characterName: input.characterName,
        sourceAvatarPath: input.avatarPath,
        sourceAvatarDigest: avatar.digest,
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
            origin: "generated",
            sourceAvatarPath: input.avatarPath,
            sourceAvatarDigest: avatar.digest,
          },
        },
      }),
    });
    logger.warn(
      error,
      "[conversation-call/videos] Failed to generate custom clip %s for %s",
      input.clipId,
      input.characterId,
    );
  }
}

export async function getConversationCallCharacterVideoManifest(input: {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
}): Promise<ConversationCallCharacterVideoManifest> {
  assertSafeCharacterId(input.characterId);
  const avatar = await readAvatarIdentity(input.avatarPath);
  const manifest = await readDiskManifest(input.characterId, input.characterName, input.avatarPath);
  return toPublicManifest(manifest, avatar);
}

export async function startConversationCallCharacterVideoGeneration(input: {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
  clipKinds?: ConversationCallCharacterVideoClipKind[] | null;
  connection: VideoGenerationConnection;
  promptOverridesStorage: PromptOverridesStorage;
  videoSettings?: VideoGenerationUserSettings | null;
  debugMode?: boolean;
  includeAvatarReference?: boolean;
}): Promise<ConversationCallCharacterVideoManifest> {
  assertSafeCharacterId(input.characterId);
  const videoSettings = normalizeVideoGenerationUserSettings(input.videoSettings);
  const avatar = await readAvatarIdentity(input.avatarPath);
  if (!GENERATION_LOCKS.has(input.characterId)) {
    const timestamp = nowIso();
    const clipKinds = input.clipKinds?.length ? input.clipKinds : CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS;
    const activeClipKinds = new Set(clipKinds);
    await updateDiskManifest({
      characterId: input.characterId,
      characterName: input.characterName,
      avatarPath: input.avatarPath,
      update: (current) => {
        const clips = { ...current.clips };
        const firstPendingKind = clipKinds.find((kind) => !isClipReadyForAvatar(current, kind, avatar));
        if (firstPendingKind) {
          clips[firstPendingKind] = {
            status: "generating",
            error: null,
            updatedAt: timestamp,
            origin: "generated",
            sourceAvatarPath: input.avatarPath,
            sourceAvatarDigest: avatar.digest,
          };
        }
        return {
          ...current,
          characterName: input.characterName,
          sourceAvatarPath: input.avatarPath,
          sourceAvatarDigest: avatar.digest,
          updatedAt: timestamp,
          clips,
        };
      },
    });
    const job = runGenerationJob({ ...input, videoSettings }).finally(() => {
      GENERATION_LOCKS.delete(input.characterId);
    });
    GENERATION_LOCKS.set(input.characterId, { job, clipKinds: activeClipKinds });
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
  includeAvatarReference?: boolean;
}): Promise<ConversationCallCharacterVideoManifest> {
  assertSafeCharacterId(input.characterId);
  const videoSettings = normalizeVideoGenerationUserSettings(input.videoSettings);
  const avatar = await readAvatarIdentity(input.avatarPath);
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
        sourceAvatarDigest: avatar.digest,
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
            origin: "generated",
            sourceAvatarPath: input.avatarPath,
            sourceAvatarDigest: avatar.digest,
            trimStartSeconds: null,
            trimEndSeconds: null,
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

export async function uploadConversationCallCharacterVideoClip(input: {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
  buffer: Buffer;
  label?: string | null;
  kind?: ConversationCallCharacterVideoClipKind | null;
}): Promise<ConversationCallCharacterVideoManifest> {
  assertSafeCharacterId(input.characterId);
  if (!input.buffer.length || !isMp4Buffer(input.buffer)) {
    throw new ConversationCallVideoClipUploadError("Uploaded call video clips must be valid MP4 files.");
  }

  const avatar = await readAvatarIdentity(input.avatarPath);
  const updatedAt = nowIso();
  await mkdir(characterDir(input.characterId), { recursive: true });

  if (input.kind) {
    if (!CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.includes(input.kind)) {
      throw new ConversationCallVideoClipUploadError("Invalid call video clip kind.");
    }
    if (GENERATION_LOCKS.has(input.characterId)) {
      throw new ConversationCallVideoGenerationInProgressError(
        "Call video clips are still generating for this character",
      );
    }

    const file = clipPath(input.characterId, input.kind);
    const tmp = assertInsideDir(CALL_CHARACTER_VIDEO_ROOT, `${file}.${process.pid}.${Date.now()}.tmp`);
    await writeFile(tmp, input.buffer);
    await rename(tmp, file);
    await updateDiskManifest({
      characterId: input.characterId,
      characterName: input.characterName,
      avatarPath: input.avatarPath,
      update: (current) => ({
        ...current,
        characterName: input.characterName,
        sourceAvatarPath: input.avatarPath,
        sourceAvatarDigest: avatar.digest,
        updatedAt,
        clips: {
          ...current.clips,
          [input.kind!]: {
            status: "ready",
            error: null,
            updatedAt,
            origin: "uploaded",
            sourceAvatarPath: input.avatarPath,
            sourceAvatarDigest: avatar.digest,
            trimStartSeconds: null,
            trimEndSeconds: null,
          },
        },
      }),
    });
    logger.info(
      "[conversation-call/videos] Uploaded %s call video clip for %s",
      getClipLabel(input.kind),
      input.characterId,
    );
    return getConversationCallCharacterVideoManifest(input);
  }

  const clipId = `upload-${newId()}`;
  const label = sanitizeCustomClipText(input.label ?? "", "Uploaded clip", 80);
  const prompt = "Uploaded by user.";
  const file = customClipPath(input.characterId, clipId);
  const tmp = assertInsideDir(CALL_CHARACTER_VIDEO_ROOT, `${file}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tmp, input.buffer);
  await rename(tmp, file);
  await updateDiskManifest({
    characterId: input.characterId,
    characterName: input.characterName,
    avatarPath: input.avatarPath,
    update: async (current) =>
      pruneCustomClips({
        ...current,
        characterName: input.characterName,
        sourceAvatarPath: input.avatarPath,
        sourceAvatarDigest: avatar.digest,
        updatedAt,
        customClips: {
          ...current.customClips,
          [clipId]: {
            id: clipId,
            label,
            prompt,
            status: "ready",
            error: null,
            createdAt: updatedAt,
            updatedAt,
            origin: "uploaded",
            sourceAvatarPath: input.avatarPath,
            sourceAvatarDigest: avatar.digest,
            trimStartSeconds: null,
            trimEndSeconds: null,
          },
        },
      }),
  });
  logger.info("[conversation-call/videos] Uploaded custom call video clip %s for %s", clipId, input.characterId);
  return getConversationCallCharacterVideoManifest(input);
}

export async function updateConversationCallCharacterVideoClipTrim(input: {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
  kind: ConversationCallCharacterVideoClipKind;
  trimStartSeconds?: unknown;
  trimEndSeconds?: unknown;
}): Promise<ConversationCallCharacterVideoManifest> {
  assertSafeCharacterId(input.characterId);
  if (!CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.includes(input.kind)) {
    throw new Error("Invalid call video clip kind");
  }
  if (!existsSync(clipPath(input.characterId, input.kind))) {
    throw new ConversationCallVideoClipNotFoundError("Call video clip not found");
  }
  const trim = normalizeClipTrim(input);
  const avatar = await readAvatarIdentity(input.avatarPath);
  const updatedAt = nowIso();
  let updated = false;
  await updateDiskManifest({
    characterId: input.characterId,
    characterName: input.characterName,
    avatarPath: input.avatarPath,
    update: (current) => {
      const existing = current.clips[input.kind];
      if (!existing) {
        throw new ConversationCallVideoClipNotFoundError("Call video clip not found");
      }
      const existingAvatar = getClipAvatarIdentity(current, existing);
      if (!avatarIdentityMatches(existingAvatar, avatar)) {
        throw new ConversationCallVideoClipAvatarMismatchError();
      }
      updated = true;
      return {
        ...current,
        characterName: input.characterName,
        sourceAvatarPath: input.avatarPath,
        sourceAvatarDigest: avatar.digest,
        updatedAt,
        clips: {
          ...current.clips,
          [input.kind]: {
            ...existing,
            status: "ready",
            error: null,
            updatedAt,
            sourceAvatarPath: input.avatarPath,
            sourceAvatarDigest: avatar.digest,
            trimStartSeconds: trim.trimStartSeconds,
            trimEndSeconds: trim.trimEndSeconds,
          },
        },
      };
    },
  });
  if (!updated) throw new ConversationCallVideoClipNotFoundError("Call video clip not found");
  logger.info("[conversation-call/videos] Updated %s trim for %s", input.kind, input.characterId);
  return getConversationCallCharacterVideoManifest(input);
}

export async function updateConversationCallCustomVideoClipTrim(input: {
  characterId: string;
  characterName: string;
  avatarPath: string | null;
  clipId: string;
  trimStartSeconds?: unknown;
  trimEndSeconds?: unknown;
}): Promise<ConversationCallCharacterVideoManifest> {
  assertSafeCharacterId(input.characterId);
  const clipId = assertSafeCustomClipId(input.clipId);
  if (!existsSync(customClipPath(input.characterId, clipId))) {
    throw new ConversationCallVideoClipNotFoundError("Custom call video clip not found");
  }
  const trim = normalizeClipTrim(input);
  const avatar = await readAvatarIdentity(input.avatarPath);
  const updatedAt = nowIso();
  let found = false;
  await updateDiskManifest({
    characterId: input.characterId,
    characterName: input.characterName,
    avatarPath: input.avatarPath,
    update: (current) => {
      const existing = current.customClips[clipId];
      found = Boolean(existing);
      if (!existing) throw new ConversationCallVideoClipNotFoundError("Custom call video clip not found");
      const existingAvatar = customClipAvatarIdentity(current, existing);
      if (!avatarIdentityMatches(existingAvatar, avatar)) {
        throw new ConversationCallVideoClipAvatarMismatchError();
      }
      return {
        ...current,
        characterName: input.characterName,
        sourceAvatarPath: input.avatarPath,
        sourceAvatarDigest: avatar.digest,
        updatedAt,
        customClips: {
          ...current.customClips,
          [clipId]: {
            ...existing,
            status: "ready",
            error: null,
            updatedAt,
            sourceAvatarPath: input.avatarPath,
            sourceAvatarDigest: avatar.digest,
            trimStartSeconds: trim.trimStartSeconds,
            trimEndSeconds: trim.trimEndSeconds,
          },
        },
      };
    },
  });
  if (!found) throw new ConversationCallVideoClipNotFoundError("Custom call video clip not found");
  logger.info("[conversation-call/videos] Updated custom clip %s trim for %s", clipId, input.characterId);
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
    throw new ConversationCallVideoGenerationInProgressError(
      "Call video clips are still generating for this character",
    );
  }

  const file = clipPath(input.characterId, input.kind);
  const fileExisted = existsSync(file);
  const avatar = await readAvatarIdentity(input.avatarPath);
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
        sourceAvatarDigest: avatar.digest,
        updatedAt,
        clips: {
          ...current.clips,
          [input.kind]: {
            status: "missing",
            error: null,
            updatedAt,
            sourceAvatarPath: input.avatarPath,
            sourceAvatarDigest: avatar.digest,
            trimStartSeconds: null,
            trimEndSeconds: null,
          },
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
  const avatar = await readAvatarIdentity(input.avatarPath);
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
        sourceAvatarDigest: avatar.digest,
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

export function getConversationCallCharacterVideoFile(
  characterId: string,
  kind: ConversationCallCharacterVideoClipKind,
) {
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
