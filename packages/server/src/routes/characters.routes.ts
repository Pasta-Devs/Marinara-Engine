// ──────────────────────────────────────────────
// Routes: Characters, Personas & Groups
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  canonicalizeLegacyPersonaInput,
  createCharacterSchema,
  updateCharacterSchema,
  createGroupSchema,
  updateGroupSchema,
  createPersonaGroupSchema,
  updatePersonaGroupSchema,
  personaCreateInputSchema,
  personaLocalPaintSchema,
  personaUpdateInputSchema,
  normalizeTrackerCardColorConfig,
  trackerCardColorConfigSchema,
  PROFESSOR_MARI_ID,
  CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS,
  findImageStyleProfile,
  MAX_FILE_SIZES,
} from "@marinara-engine/shared";
import type { CharacterData, ConversationCallCharacterVideoClipKind, ExportEnvelope } from "@marinara-engine/shared";
import { createCharactersStorage, type PersonaStorageRow } from "../services/storage/characters.storage.js";
import { encodePersonaCreate, encodePersonaUpdate, projectPersona } from "../services/personas/persona-projector.js";
import { createCharacterGalleryStorage } from "../services/storage/character-gallery.storage.js";
import { createPersonaGalleryStorage } from "../services/storage/persona-gallery.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createGameSceneVideosStorage } from "../services/storage/game-scene-videos.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createLorebooksStorage } from "../services/storage/lorebooks.storage.js";
import { createNoodleStorage } from "../services/storage/noodle.storage.js";
import { createPromptOverridesStorage } from "../services/storage/prompt-overrides.storage.js";
import { CHARACTERS_REFERENCE_SHEET, loadPrompt } from "../services/prompt-overrides/index.js";
import { generateImage } from "../services/image/image-generation.js";
import {
  resolveConnectionImageDefaults,
  resolveConnectionImageQuality,
} from "../services/image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../services/image/image-generation-settings.js";
import { compileImagePrompt } from "../services/image/image-prompt-compiler.js";
import { resolveImagePromptReviewSize } from "../services/image/image-prompt-review.js";
import { resolveImageConnectionFallback } from "../services/generation/media-connection-fallback.js";
import {
  ConversationCallVideoClipAvatarMismatchError,
  ConversationCallVideoClipNotFoundError,
  ConversationCallVideoClipTrimError,
  ConversationCallVideoClipUploadError,
  ConversationCallVideoGenerationInProgressError,
  deleteConversationCallCharacterVideoClip,
  deleteConversationCallCustomVideoClip,
  getConversationCallCharacterVideoManifest,
  updateConversationCallCharacterVideoClipTrim,
  updateConversationCallCustomVideoClipTrim,
  uploadConversationCallCharacterVideoClip,
} from "../services/conversation/call-character-videos.service.js";
import { removeSavedVideoFromDisk } from "../services/video/video-generation.js";
import { writeFile, mkdir, readFile, readdir, stat, unlink } from "fs/promises";
import { join } from "path";
import { DATA_DIR } from "../utils/data-dir.js";
import { createWriteStream, existsSync, rmSync, unlinkSync } from "fs";
import { normalizeTimestampOverrides } from "../services/import/import-timestamps.js";
import { assertInsideDir, extensionFromImageMime, isAllowedImageBuffer } from "../utils/security.js";
import {
  sendValidatedMediaFile,
  validateImageAssetFile,
  validateVideoAssetFile,
} from "../utils/media-file-security.js";
import { logger, logDebugOverride } from "../lib/logger.js";
import { isDebugAgentsEnabled } from "../config/runtime-config.js";
import { parseLibraryPageQuery } from "../utils/list-pagination.js";
import { importSTLorebook } from "../services/import/st-lorebook.importer.js";
import { embeddedSpriteSizesAreWithinLimits, MAX_EMBEDDED_SPRITE_COUNT } from "../services/import/marinara.importer.js";
import {
  clearEmbeddedLorebookFromCharacter,
  embedLorebookIntoCharacter,
  getEmbeddedLorebookId,
} from "../services/lorebook/character-book-sync.js";
import AdmZip from "adm-zip";
import { extname } from "path";
import { pipeline } from "stream/promises";
import { newId } from "../utils/id-generator.js";
import { createReplyFallbackNotifier } from "./generate/fallback-notification.js";
import {
  findGalleryRowByFilename,
  galleryFileHasReferences,
  resolveStoredGalleryFile,
  unlinkGalleryFileIfUnreferenced,
} from "../services/image/gallery-file-lifecycle.js";
import {
  collectCharacterAvatarPaths,
  collectPersonaAvatarPaths,
  mutateAvatarReferencesAndCleanup,
  removeUnattachedAvatarFile,
} from "../services/image/avatar-file-lifecycle.js";

const CHARACTER_GALLERY_ROOT = join(DATA_DIR, "gallery", "characters");
const PERSONA_GALLERY_ROOT = join(DATA_DIR, "gallery", "personas");
const AVATAR_ROOT = join(DATA_DIR, "avatars");
const CHARACTER_GALLERY_VIDEO_ROOT = join(DATA_DIR, "gallery", "character-videos");
const PERSONA_GALLERY_VIDEO_ROOT = join(DATA_DIR, "gallery", "persona-videos");
const ALLOWED_GALLERY_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const ALLOWED_GALLERY_VIDEO_EXTS = new Set([".mp4", ".webm", ".mov"]);
const CHARACTER_CARD_PNG_KEYWORDS = new Set(["chara", "ccv3"]);
const CUSTOM_NAME_RE = /^[a-z0-9_]{1,32}$/;
const PATH_SAFE_ID_RE = /^[A-Za-z0-9_-]+$/;
const CUSTOM_KIND_MAX_DIMENSION = {
  emoji: 256,
  sticker: 512,
} as const;
const CALL_VIDEO_CLIP_LABELS = {
  idle: "Idle",
  talking: "Talking",
  laughing: "Laughing",
  angry: "Angry",
  crying: "Crying",
  sighing: "Sighing",
} as const;
const CALL_VIDEO_CLIP_UPLOAD_MAX_BYTES = 250 * 1024 * 1024;
const ALLOWED_CALL_VIDEO_CLIP_UPLOAD_EXTS = new Set([".mp4"]);
const renameCardVersionSchema = z.object({ version: z.string().trim().min(1).max(100) });
type UploadedMultipartFile = NonNullable<Awaited<ReturnType<FastifyRequest["file"]>>>;

function applyTrackerCardPaint(currentValue: unknown, paint: Record<string, unknown>, preserveStatIcons = true) {
  const current = parseCharacterDataRecord(currentValue);
  const next = { ...paint };
  const preservedKeys = preserveStatIcons
    ? (["portraitFocusX", "portraitFocusY", "portraitZoom", "statIcons"] as const)
    : (["portraitFocusX", "portraitFocusY", "portraitZoom"] as const);
  for (const key of preservedKeys) {
    if (Object.hasOwn(current, key)) next[key] = current[key];
    else delete next[key];
  }
  return next;
}

// Exactly { mode: "chat" } is the bare-chat clear sentinel: it clears paint/stat-icon state while preserving stored portrait framing.
function isTrackerCardClear(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    (value as Record<string, unknown>).mode === "chat"
  );
}

const TRACKER_CARD_PAINT_FIELDS = [
  "mode",
  "displayEnabled",
  "nameColor",
  "nameColorOpacity",
  "accentEnabled",
  "dialogueColor",
  "dialogueColorOpacity",
  "surfaceEnabled",
  "boxColor",
  "boxColorOpacity",
  "tintIntensity",
  "materialBrightness",
  "glowIntensity",
  "contrastIntensity",
  "portraitStageBackground",
] as const;

function applyPersonaTrackerCardPaint(currentValue: unknown, paint: Record<string, unknown>) {
  const current = normalizeTrackerCardColorConfig(parseCharacterDataRecord(currentValue));
  const next: Record<string, unknown> = { ...current, ...paint };
  for (const key of TRACKER_CARD_PAINT_FIELDS) if (!Object.hasOwn(paint, key)) delete next[key];
  for (const key of ["portraitFocusX", "portraitFocusY", "portraitZoom", "statIcons"] as const) {
    if (Object.hasOwn(current, key)) next[key] = current[key];
    else delete next[key];
  }
  return normalizeTrackerCardColorConfig(next);
}

function mergePersonaTrackerCardColors(currentValue: unknown, patch: Record<string, unknown>) {
  const current = parseCharacterDataRecord(currentValue),
    next = { ...current, ...patch };
  for (const key of ["portraitFocusX", "portraitFocusY", "portraitZoom"] as const) {
    if (Object.hasOwn(current, key)) next[key] = current[key];
    else delete next[key];
  }
  return next;
}

function buildTrackerCardPortraitClear(currentValue: unknown): Record<string, unknown> {
  const current = normalizeTrackerCardColorConfig(currentValue),
    result: Record<string, unknown> = { mode: "chat" };
  for (const key of ["portraitFocusX", "portraitFocusY", "portraitZoom"] as const)
    if (Object.hasOwn(current, key)) result[key] = current[key];
  return result;
}

type GalleryVideoEntry = {
  id: string;
  filename: string;
  label: string;
  prompt: string;
  provider: string;
  model: string;
  aspectRatio: string;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

type GalleryVideoManifest = {
  version: 1;
  videos: GalleryVideoEntry[];
};

class CallVideoClipUploadTooLargeError extends Error {
  constructor() {
    super("Video call clip uploads must be 250 MB or smaller.");
  }
}

function isMultipartFileTruncated(data: UploadedMultipartFile) {
  return (data.file as typeof data.file & { truncated?: boolean }).truncated === true;
}

async function readCallVideoClipUploadBuffer(data: UploadedMultipartFile) {
  try {
    const buffer = await data.toBuffer();
    if (buffer.length > CALL_VIDEO_CLIP_UPLOAD_MAX_BYTES || isMultipartFileTruncated(data)) {
      throw new CallVideoClipUploadTooLargeError();
    }
    return buffer;
  } catch (error) {
    if (error instanceof CallVideoClipUploadTooLargeError) throw error;
    if (isMultipartFileTruncated(data) || (error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      throw new CallVideoClipUploadTooLargeError();
    }
    throw error;
  }
}

async function ensureCharacterGalleryDir(characterId: string) {
  const dir = join(CHARACTER_GALLERY_ROOT, characterId);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function ensurePersonaGalleryDir(personaId: string) {
  if (isUnsafePathSegment(personaId)) {
    throw new Error("Invalid persona id");
  }
  const dir = assertInsideDir(PERSONA_GALLERY_ROOT, join(PERSONA_GALLERY_ROOT, personaId));
  await mkdir(dir, { recursive: true });
  return dir;
}

function ensureGalleryVideoDir(root: string, entityId: string) {
  if (isUnsafePathSegment(entityId)) {
    throw new Error("Invalid gallery video id");
  }
  return assertInsideDir(root, join(root, entityId));
}

function galleryVideoManifestPath(root: string, entityId: string) {
  return assertInsideDir(root, join(ensureGalleryVideoDir(root, entityId), "manifest.json"));
}

async function readGalleryVideoManifest(root: string, entityId: string): Promise<GalleryVideoManifest> {
  try {
    const raw = await readFile(galleryVideoManifestPath(root, entityId), "utf8");
    const parsed = JSON.parse(raw) as Partial<GalleryVideoManifest>;
    return {
      version: 1,
      videos: Array.isArray(parsed.videos)
        ? parsed.videos.filter((entry): entry is GalleryVideoEntry => {
            return (
              !!entry &&
              typeof entry === "object" &&
              typeof entry.id === "string" &&
              typeof entry.filename === "string" &&
              !isUnsafePathSegment(entry.id) &&
              !isUnsafePathSegment(entry.filename)
            );
          })
        : [],
    };
  } catch {
    return { version: 1, videos: [] };
  }
}

async function writeGalleryVideoManifest(root: string, entityId: string, manifest: GalleryVideoManifest) {
  const dir = ensureGalleryVideoDir(root, entityId);
  await mkdir(dir, { recursive: true });
  await writeFile(galleryVideoManifestPath(root, entityId), JSON.stringify(manifest, null, 2));
}

function toGalleryVideoClip(input: {
  entry: GalleryVideoEntry;
  entityId: string;
  entityKind: "character" | "persona";
}) {
  const routeBase =
    input.entityKind === "character"
      ? `/api/characters/${input.entityId}/gallery/videos/file`
      : `/api/characters/personas/${input.entityId}/gallery/videos/file`;
  return {
    id: `uploaded:${input.entry.id}`,
    source: "uploaded-video" as const,
    label: input.entry.label || "Uploaded video",
    prompt: input.entry.prompt,
    status: "ready" as const,
    url: `${routeBase}/${encodeURIComponent(input.entry.filename)}`,
    createdAt: input.entry.createdAt,
    updatedAt: input.entry.updatedAt,
    origin: "uploaded" as const,
    durationSeconds: input.entry.durationSeconds,
    trimStartSeconds: null,
    trimEndSeconds: null,
    aspectRatio: input.entry.aspectRatio,
    provider: input.entry.provider,
    model: input.entry.model,
    chatId: null,
    chatName: null,
    clipKind: null,
  };
}

async function listGalleryVideoClips(root: string, entityId: string, entityKind: "character" | "persona") {
  const manifest = await readGalleryVideoManifest(root, entityId);
  return manifest.videos.map((entry) => toGalleryVideoClip({ entry, entityId, entityKind }));
}

async function removeGalleryVideoClip(root: string, entityId: string, clipId: string) {
  const videoId = clipId.slice("uploaded:".length);
  if (!videoId || isUnsafePathSegment(videoId)) return false;
  const manifest = await readGalleryVideoManifest(root, entityId);
  const entry = manifest.videos.find((video) => video.id === videoId);
  if (!entry) return false;
  const dir = ensureGalleryVideoDir(root, entityId);
  const filePath = assertInsideDir(dir, join(dir, entry.filename));
  await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  await writeGalleryVideoManifest(root, entityId, {
    version: 1,
    videos: manifest.videos.filter((video) => video.id !== videoId),
  });
  return true;
}

function isUnsafePathSegment(value: string) {
  return value === "." || value === ".." || value.includes("..") || value.includes("/") || value.includes("\\");
}

function isValidCustomDimension(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max;
}

function validateCustomTagPayload(kind: "emoji" | "sticker" | null, name: string, width: unknown, height: unknown) {
  if (kind === null) return null;
  if (!CUSTOM_NAME_RE.test(name)) return "customName must use 1-32 lowercase letters, numbers, or underscores";
  const max = CUSTOM_KIND_MAX_DIMENSION[kind];
  if (width !== undefined && !isValidCustomDimension(width, max)) return `width must be an integer from 1 to ${max}`;
  if (height !== undefined && !isValidCustomDimension(height, max)) return `height must be an integer from 1 to ${max}`;
  return null;
}

function parseCharacterDataRecord(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function readCharacterDisplayName(raw: unknown, fallback = "Character") {
  const data = parseCharacterDataRecord(raw);
  return typeof data.name === "string" && data.name.trim() ? data.name.trim() : fallback;
}

function parseCharacterIdList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function parseConversationCallClipKind(value: string): ConversationCallCharacterVideoClipKind | null {
  return CONVERSATION_CALL_CHARACTER_VIDEO_CLIP_KINDS.includes(value as ConversationCallCharacterVideoClipKind)
    ? (value as ConversationCallCharacterVideoClipKind)
    : null;
}

function parseRouteRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isRouteTrimSecondValue(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || (typeof value === "number" && Number.isFinite(value));
}

function readMultipartStringField(fields: unknown, key: string): string {
  if (!fields || typeof fields !== "object") return "";
  const value = (fields as Record<string, unknown>)[key];
  const field = Array.isArray(value) ? value[0] : value;
  if (!field || typeof field !== "object") return "";
  const raw = (field as { value?: unknown }).value;
  return typeof raw === "string" ? raw.trim() : "";
}

function labelFromUploadedClipFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  return base
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toSafeExportName(name: string, fallback: string) {
  const sanitized = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || fallback;
}

type AvatarGenerationPromptOverride = {
  id: string;
  prompt: string;
  negativePrompt?: string;
};

type AvatarGenerationBody = {
  connectionId?: string;
  name?: string;
  appearance?: string;
  purpose?: "avatar" | "character-sheet";
  referenceImages?: string[];
  width?: number;
  height?: number;
  styleProfileId?: string | null;
  debugMode?: boolean;
  promptOverrides?: AvatarGenerationPromptOverride[];
};

const AVATAR_GENERATION_MAX_DIMENSION = 4096;
const AVATAR_GENERATION_MAX_PIXELS = 16_000_000;

function validateAvatarGenerationDimensions(width: unknown, height: unknown) {
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return { error: "width and height must be positive integers" as const };
  }
  if (width > AVATAR_GENERATION_MAX_DIMENSION || height > AVATAR_GENERATION_MAX_DIMENSION) {
    return { error: `width and height must not exceed ${AVATAR_GENERATION_MAX_DIMENSION}` as const };
  }
  if (width * height > AVATAR_GENERATION_MAX_PIXELS) {
    return { error: `width and height must not exceed ${AVATAR_GENERATION_MAX_PIXELS} total pixels` as const };
  }
  return { width, height };
}

const avatarGenerationPromptId = (name: string, purpose: AvatarGenerationBody["purpose"] = "avatar") =>
  `${purpose === "character-sheet" ? "character-sheet" : "avatar"}:${
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 120) || "character"
  }`;

const AVATAR_GENERATION_HARD_NEGATIVE_PROMPT =
  "text, captions, logos, watermarks, borders, UI, collage layouts, duplicate faces, extra people, cropped-off heads";
const CHARACTER_SHEET_HARD_NEGATIVE_PROMPT =
  "text, captions, logos, watermarks, decorative borders, unrelated characters, extra limbs, inconsistent faces, cropped-off body parts";

async function buildAvatarGenerationPrompt(
  promptOverridesStorage: ReturnType<typeof createPromptOverridesStorage>,
  body: AvatarGenerationBody,
  profileSubjectTags: string,
): Promise<string> {
  const name = body.name?.trim() || "Character";
  const appearance = body.appearance?.trim() || name;
  if (body.purpose === "character-sheet") {
    return loadPrompt(promptOverridesStorage, CHARACTERS_REFERENCE_SHEET, { name, appearance });
  }
  if (profileSubjectTags.trim()) return `Canonical appearance for ${name}: ${appearance}.`;
  return `Create a polished character avatar portrait for ${name}. Canonical appearance: ${appearance}. Composition: centered face-and-shoulders portrait, readable expression, clear silhouette, suitable as a chat avatar.`;
}

async function resolveAvatarGenerationConnection(app: FastifyInstance, body: AvatarGenerationBody) {
  if (body.purpose !== undefined && body.purpose !== "avatar" && body.purpose !== "character-sheet") {
    return { error: "purpose must be avatar or character-sheet" as const };
  }
  if (!body.connectionId) {
    return { error: "connectionId is required" as const };
  }
  if (!body.appearance?.trim()) {
    return { error: "appearance description is required" as const };
  }

  const connections = createConnectionsStorage(app.db);
  const conn = await connections.getWithKey(body.connectionId);
  if (!conn || conn.provider !== "image_generation") {
    return { error: "Image generation connection not found or could not be decrypted" as const };
  }
  return { conn };
}

type ExportFormat = "native" | "compatible";

// Read an image file and return it as a base64 data URL, or null if the file
// is missing, outside the expected dir, or not a recognized image type. Used
// by native exports to embed binary data (avatars, sprites, gallery shots)
// directly into the JSON envelope so personas/characters round-trip with
// every image intact.
async function readImageAsDataUrl(rootDir: string, filename: string): Promise<string | null> {
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) return null;
  let filepath: string;
  try {
    filepath = assertInsideDir(rootDir, join(rootDir, filename));
  } catch {
    return null;
  }
  if (!existsSync(filepath)) return null;
  try {
    const buf = await readFile(filepath);
    const info = isAllowedImageBuffer(buf, extname(filename));
    if (!info) return null;
    return `data:${info.mimeType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// Pull the avatar off disk for the persona/character row's avatarPath
// (format: /api/avatars/file/<filename>). Returns null if missing/invalid.
async function readAvatarDataUrl(avatarPath: string | null | undefined): Promise<string | null> {
  if (!avatarPath || typeof avatarPath !== "string") return null;
  const filename = avatarPath.split("?")[0]!.split("/").pop();
  if (!filename) return null;
  return readImageAsDataUrl(join(DATA_DIR, "avatars"), filename);
}

async function copyGalleryImageToAvatar(
  entityKind: "character" | "persona",
  entityId: string,
  galleryFilePath: string,
): Promise<string> {
  const galleryRoot = join(DATA_DIR, "gallery");
  const sourcePath = assertInsideDir(galleryRoot, join(galleryRoot, galleryFilePath));
  const imageBuffer = await readFile(sourcePath);
  const imageInfo = isAllowedImageBuffer(imageBuffer, extname(sourcePath));
  if (!imageInfo) throw new Error("Unsupported or invalid gallery image");

  await mkdir(AVATAR_ROOT, { recursive: true });
  const filename = `${entityKind}-${entityId}-${newId()}.${imageInfo.ext}`;
  const avatarFilePath = assertInsideDir(AVATAR_ROOT, join(AVATAR_ROOT, filename));
  try {
    await writeFile(avatarFilePath, imageBuffer);
  } catch (error) {
    await removeUnattachedAvatarFile({ filePath: avatarFilePath });
    throw error;
  }
  return `/api/avatars/file/${filename}`;
}

// Read every sprite file in data/sprites/<id>/ and return it as
// { filename, data } so import can restore the same expression set under a
// new id.
async function readSpritesForId(id: string): Promise<Array<{ filename: string; data: string }>>;
async function readSpritesForId(
  id: string,
  enforcePortableLimits: true,
): Promise<Array<{ filename: string; data: string }> | null>;
async function readSpritesForId(
  id: string,
  enforcePortableLimits = false,
): Promise<Array<{ filename: string; data: string }> | null> {
  const dir = join(DATA_DIR, "sprites", id);
  if (!existsSync(dir)) return [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const sprites: Array<{ filename: string; data: string }> = [];
  const byteLengths: number[] = [];
  let totalBytes = 0;
  for (const entry of entries) {
    if (enforcePortableLimits) {
      try {
        const fileSize = (await stat(assertInsideDir(dir, join(dir, entry)))).size;
        if (fileSize > MAX_FILE_SIZES.SPRITE || totalBytes + fileSize > MAX_FILE_SIZES.CHARACTER_CARD) {
          return null;
        }
      } catch {
        continue;
      }
    }
    const dataUrl = await readImageAsDataUrl(dir, entry);
    if (dataUrl) {
      if (enforcePortableLimits) {
        if (sprites.length >= MAX_EMBEDDED_SPRITE_COUNT) return null;
        const byteLength = Buffer.byteLength(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
        if (!embeddedSpriteSizesAreWithinLimits([...byteLengths, byteLength])) return null;
        byteLengths.push(byteLength);
        totalBytes += byteLength;
      }
      sprites.push({ filename: entry, data: dataUrl });
    }
  }
  return sprites;
}

// Read every gallery image for a character (metadata row + binary on disk),
// returning a serializable list that import can rebuild the gallery from.
async function readGalleryForOwner(
  ownerId: string,
  listImages: (id: string) => Promise<any[]>,
  characterSheetImageId?: string | null,
): Promise<Array<Record<string, unknown>>> {
  const images = await listImages(ownerId);
  const result: Array<Record<string, unknown>> = [];
  for (const img of images) {
    // img.filePath is stored relative to data/gallery/ — usually
    // "characters/<id>/<filename>", but GENERATED images keep their canonical
    // chat-scoped or "shared/<filename>" path. Resolve through the same helper
    // the serving route uses so those rows export their bytes too instead of
    // being silently dropped (which stranded card://self refs to them).
    const relPath: string = typeof img.filePath === "string" ? img.filePath : "";
    const storedFile = relPath ? resolveStoredGalleryFile(relPath) : null;
    if (!storedFile) continue;
    const dataUrl = await readImageAsDataUrl(storedFile.directory, storedFile.filename);
    if (!dataUrl) continue;
    result.push({
      filename: storedFile.filename,
      data: dataUrl,
      prompt: img.prompt ?? "",
      provider: img.provider ?? "",
      model: img.model ?? "",
      width: img.width ?? null,
      height: img.height ?? null,
      ...(img.id === characterSheetImageId ? { isCharacterSheet: true } : {}),
    });
  }
  return result;
}

async function buildNativeCharacterEnvelope(
  char: { id: string; createdAt: string; updatedAt: string; comment?: string | null; avatarPath?: string | null },
  data: any,
  galleryStorage: { listByCharacterId: (id: string) => Promise<any[]> },
) {
  const extensions = parseCharacterDataRecord(data?.extensions);
  const characterSheetImageId =
    typeof extensions.characterSheetImageId === "string" ? extensions.characterSheetImageId : null;
  const portableExtensions = { ...extensions };
  delete portableExtensions.characterSheetImageId;
  const portableData = { ...data, extensions: portableExtensions };
  const [avatar, sprites, gallery] = await Promise.all([
    readAvatarDataUrl(char.avatarPath),
    readSpritesForId(char.id),
    readGalleryForOwner(char.id, (id) => galleryStorage.listByCharacterId(id), characterSheetImageId),
  ]);
  return {
    type: "marinara_character",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: portableData,
      ...(avatar ? { avatar } : {}),
      ...(sprites.length > 0 ? { sprites } : {}),
      ...(gallery.length > 0 ? { gallery } : {}),
      metadata: {
        createdAt: char.createdAt,
        updatedAt: char.updatedAt,
        comment: char.comment ?? "",
      },
    },
  } satisfies ExportEnvelope;
}

export function buildCompatibleCharacterExport(data: any, sprites: Array<{ filename: string; data: string }> = []) {
  const extensions = { ...parseCharacterDataRecord(data?.extensions) };
  delete extensions.characterSheetImageId;
  extensions.useCharacterSheetAsReference = false;
  if (sprites.length > 0) {
    extensions.marinara = {
      ...parseCharacterDataRecord(extensions.marinara),
      sprites,
    };
  }
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: { ...data, extensions },
  };
}

async function buildNativePersonaEnvelope(
  persona: Record<string, unknown>,
  galleryStorage: { listByPersonaId: (id: string) => Promise<any[]> },
) {
  const {
    id: _id,
    createdAt,
    updatedAt,
    avatarPath,
    isActive: _isActive,
    characterSheetImageId: rawCharacterSheetImageId,
    ...personaData
  } = persona;
  const personaId = typeof _id === "string" ? _id : "";
  const characterSheetImageId = typeof rawCharacterSheetImageId === "string" ? rawCharacterSheetImageId : null;
  const [avatar, sprites, gallery] = await Promise.all([
    readAvatarDataUrl(typeof avatarPath === "string" ? avatarPath : null),
    personaId ? readSpritesForId(personaId) : Promise.resolve([] as Array<{ filename: string; data: string }>),
    personaId
      ? readGalleryForOwner(personaId, (id) => galleryStorage.listByPersonaId(id), characterSheetImageId)
      : Promise.resolve([] as Array<Record<string, unknown>>),
  ]);
  return {
    type: "marinara_persona",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      ...personaData,
      ...(avatar ? { avatar } : {}),
      ...(sprites.length > 0 ? { sprites } : {}),
      ...(gallery.length > 0 ? { gallery } : {}),
      metadata: {
        createdAt,
        updatedAt,
      },
    },
  } satisfies ExportEnvelope;
}

function buildCompatiblePersonaExport(persona: Record<string, unknown>) {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    avatarPath: _avatarPath,
    isActive: _isActive,
    characterSheetImageId: _characterSheetImageId,
    useCharacterSheetAsReference: _useCharacterSheetAsReference,
    ...personaData
  } = persona;
  return {
    ...personaData,
    extensions: {
      marinara: {
        exportedAt: new Date().toISOString(),
        source: "Marinara Engine compatibility export",
      },
    },
  };
}

function canonicalizePersonaForExport(persona: Record<string, unknown>): {
  row: Record<string, unknown>;
  usesFallbackName: boolean;
} {
  const projected = projectPersona(persona as PersonaStorageRow);
  const {
    id: _id,
    avatarPath: _avatarPath,
    isActive: _isActive,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...projectedFields
  } = projected;
  const validationFields: Record<string, unknown> = { ...projectedFields };
  const usesFallbackName = typeof validationFields.name !== "string" || !validationFields.name.trim();

  if (usesFallbackName) validationFields.name = "Unnamed Persona";
  const topLevelPaintFields = ["nameColor", "dialogueColor", "boxColor"] as const;
  for (const field of topLevelPaintFields) {
    if (
      typeof validationFields[field] === "string" &&
      !personaLocalPaintSchema.safeParse(validationFields[field]).success
    ) {
      delete validationFields[field];
    }
  }
  const trackerCardColors = validationFields.trackerCardColors;
  if (trackerCardColors && typeof trackerCardColors === "object" && !Array.isArray(trackerCardColors)) {
    const repairedTrackerCardColors = { ...(trackerCardColors as Record<string, unknown>) };
    let removedTrackerPaint = false;
    for (const field of topLevelPaintFields) {
      if (
        typeof repairedTrackerCardColors[field] === "string" &&
        !personaLocalPaintSchema.safeParse(repairedTrackerCardColors[field]).success
      ) {
        delete repairedTrackerCardColors[field];
        removedTrackerPaint = true;
      }
    }
    if (removedTrackerPaint) validationFields.trackerCardColors = repairedTrackerCardColors;
  }

  const parsed = personaCreateInputSchema.safeParse(validationFields);
  if (!parsed.success) throw new Error("Persona export invariant failed after salvage");

  const { name, description, extra } = encodePersonaCreate(parsed.data);
  const row: Record<string, unknown> = { ...persona, ...extra, name, description };
  // Export the public boolean contract rather than the storage-only text flag
  // so compatible and native Persona payloads can be imported unchanged.
  row.versioningEnabled = parsed.data.versioningEnabled ?? true;
  // Never restore raw rejected top-level paint over the repaired export copy.
  for (const field of topLevelPaintFields) if (!Object.hasOwn(parsed.data, field)) delete row[field];
  return { row, usesFallbackName };
}

export async function validateCharacterGalleryReferences<T extends Record<string, unknown>>(
  characterId: string,
  characterDataUpdate: T,
  getGalleryImage: (imageId: string) => Promise<{ characterId: string } | null>,
): Promise<T> {
  const extensions = parseCharacterDataRecord(characterDataUpdate.extensions);
  if (!Object.hasOwn(extensions, "characterSheetImageId")) return characterDataUpdate;

  const selectedImageId =
    typeof extensions.characterSheetImageId === "string" ? extensions.characterSheetImageId : null;
  const selectedImage = selectedImageId ? await getGalleryImage(selectedImageId) : null;
  if (selectedImage?.characterId === characterId) return characterDataUpdate;

  return {
    ...characterDataUpdate,
    extensions: {
      ...extensions,
      characterSheetImageId: null,
      useCharacterSheetAsReference: false,
    },
  };
}

export async function charactersRoutes(app: FastifyInstance) {
  const storage = createCharactersStorage(app.db);
  const characterGallery = createCharacterGalleryStorage(app.db);
  const personaGallery = createPersonaGalleryStorage(app.db);
  const lorebooksStorage = createLorebooksStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const promptOverridesStorage = createPromptOverridesStorage(app.db);
  const characterUpdateQueues = new Map<string, Promise<unknown>>();
  const personaUpdateQueues = new Map<string, Promise<unknown>>();

  function enqueueUpdate<T>(queues: Map<string, Promise<unknown>>, id: string, update: () => Promise<T>): Promise<T> {
    const previous = queues.get(id);
    const next = previous ? previous.catch(() => undefined).then(update) : update();
    queues.set(id, next);
    void next
      .finally(() => {
        if (queues.get(id) === next) queues.delete(id);
      })
      .catch(() => undefined);
    return next;
  }

  // ── Characters ──

  app.get<{
    Querystring: {
      includeBuiltIn?: string;
      limit?: string;
      offset?: string;
      search?: string;
      sort?: string;
      favoriteFilter?: string;
    };
  }>("/", async (req) => {
    const includeBuiltIn = req.query.includeBuiltIn === "true";
    const page = parseLibraryPageQuery(req.query);
    if (page.hasPaging) {
      return storage.listPage({
        includeBuiltIn,
        limit: page.limit,
        offset: page.offset,
        search: page.search,
        sort: page.sort,
        favoriteFilter: page.favoriteFilter,
      });
    }
    const characters = await storage.list();
    if (includeBuiltIn) return characters;
    return characters.filter((character) => character.id !== PROFESSOR_MARI_ID);
  });

  app.post<{ Body: { ids?: unknown } }>("/summaries", async (req) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id): id is string => typeof id === "string") : [];
    return storage.listSummariesByIds(ids);
  });

  app.post("/avatar-generation/preview", async (req, reply) => {
    const body = req.body as AvatarGenerationBody;
    const resolved = await resolveAvatarGenerationConnection(app, body);
    if ("error" in resolved) return reply.status(400).send({ error: resolved.error });

    const imageSettings = await loadImageGenerationUserSettings(app.db);
    const isCharacterSheet = body.purpose === "character-sheet";
    const dimensions = validateAvatarGenerationDimensions(
      body.width ?? (isCharacterSheet ? imageSettings.background.width : imageSettings.portrait.width),
      body.height ?? (isCharacterSheet ? imageSettings.background.height : imageSettings.portrait.height),
    );
    if ("error" in dimensions) return reply.status(400).send({ error: dimensions.error });
    const { width, height } = dimensions;
    const imageDefaults = resolveConnectionImageDefaults(resolved.conn);
    const profileSubjectTags =
      findImageStyleProfile(
        imageSettings.styleProfiles,
        body.styleProfileId || imageDefaults?.styleProfileId || imageSettings.styleProfiles.defaultProfileId,
      ).subjectTags[isCharacterSheet ? "illustration" : "avatar"] ?? "";
    const compiled = compileImagePrompt({
      kind: isCharacterSheet ? "illustration" : "avatar",
      prompt: await buildAvatarGenerationPrompt(promptOverridesStorage, body, profileSubjectTags),
      styleProfiles: imageSettings.styleProfiles,
      styleProfileId: body.styleProfileId,
      imageDefaults,
      hardNegative: isCharacterSheet ? CHARACTER_SHEET_HARD_NEGATIVE_PROMPT : AVATAR_GENERATION_HARD_NEGATIVE_PROMPT,
    });
    const previewSize = resolveImagePromptReviewSize({
      connection: resolved.conn,
      prompt: compiled.prompt,
      width,
      height,
      imageDefaults,
    });

    return {
      items: [
        {
          id: avatarGenerationPromptId(body.name ?? "character", body.purpose),
          kind: isCharacterSheet ? "illustration" : "avatar",
          title: `${isCharacterSheet ? "Character sheet" : "Avatar"}: ${body.name?.trim() || "Character"}`,
          prompt: compiled.prompt,
          negativePrompt: compiled.negativePrompt,
          width: previewSize.width,
          height: previewSize.height,
        },
      ],
    };
  });

  app.post("/avatar-generation", async (req, reply) => {
    const body = req.body as AvatarGenerationBody;
    const resolved = await resolveAvatarGenerationConnection(app, body);
    if ("error" in resolved) return reply.status(400).send({ error: resolved.error });

    const conn = resolved.conn;
    const imageSettings = await loadImageGenerationUserSettings(app.db);
    const isCharacterSheet = body.purpose === "character-sheet";
    const dimensions = validateAvatarGenerationDimensions(
      body.width ?? (isCharacterSheet ? imageSettings.background.width : imageSettings.portrait.width),
      body.height ?? (isCharacterSheet ? imageSettings.background.height : imageSettings.portrait.height),
    );
    if ("error" in dimensions) return reply.status(400).send({ error: dimensions.error });
    const { width, height } = dimensions;
    const rawPromptOverrides: unknown[] = Array.isArray(body.promptOverrides) ? body.promptOverrides : [];
    const promptOverrideById = new Map(
      rawPromptOverrides.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const override = item as Record<string, unknown>;
        if (typeof override.id !== "string" || typeof override.prompt !== "string") return [];
        return [
          [
            override.id,
            {
              prompt: override.prompt.trim(),
              negativePrompt:
                typeof override.negativePrompt === "string" ? override.negativePrompt.trim() || undefined : undefined,
            },
          ] as const,
        ];
      }),
    );
    const promptOverride = promptOverrideById.get(avatarGenerationPromptId(body.name ?? "character", body.purpose));
    const referenceImages = (body.referenceImages ?? [])
      .map((image) => image.trim())
      .filter((image) => image.startsWith("data:image/") || /^[A-Za-z0-9+/=\s]+$/.test(image))
      .slice(0, 4);

    const imgModel = conn.model || "";
    const imgBaseUrl = conn.baseUrl || "https://image.pollinations.ai";
    const imgApiKey = conn.apiKey || "";
    const imgSource = conn.imageGenerationSource || imgModel;
    const imgServiceHint = conn.imageService || imgSource;
    const imageDefaults = resolveConnectionImageDefaults(conn);
    const profileSubjectTags =
      findImageStyleProfile(
        imageSettings.styleProfiles,
        body.styleProfileId || imageDefaults?.styleProfileId || imageSettings.styleProfiles.defaultProfileId,
      ).subjectTags[isCharacterSheet ? "illustration" : "avatar"] ?? "";
    const imageFallback = await resolveImageConnectionFallback(connections, conn.id);
    const compiled = promptOverride
      ? {
          prompt: promptOverride.prompt,
          negativePrompt: promptOverride.negativePrompt || "",
        }
      : compileImagePrompt({
          kind: isCharacterSheet ? "illustration" : "avatar",
          prompt: await buildAvatarGenerationPrompt(promptOverridesStorage, body, profileSubjectTags),
          styleProfiles: imageSettings.styleProfiles,
          styleProfileId: body.styleProfileId,
          imageDefaults,
          hardNegative: isCharacterSheet
            ? CHARACTER_SHEET_HARD_NEGATIVE_PROMPT
            : AVATAR_GENERATION_HARD_NEGATIVE_PROMPT,
        });

    const debugOverrideEnabled = body.debugMode === true || isDebugAgentsEnabled();
    logDebugOverride(
      debugOverrideEnabled,
      "[debug/characters/%s-generation] prompt:\n%s",
      isCharacterSheet ? "character-sheet" : "avatar",
      compiled.prompt,
    );
    if (compiled.negativePrompt) {
      logDebugOverride(
        debugOverrideEnabled,
        "[debug/characters/%s-generation] negative prompt:\n%s",
        isCharacterSheet ? "character-sheet" : "avatar",
        compiled.negativePrompt,
      );
    }

    try {
      const result = await generateImage(imgModel, imgBaseUrl, imgApiKey, imgServiceHint, {
        prompt: compiled.prompt,
        negativePrompt: compiled.negativePrompt || undefined,
        model: imgModel || undefined,
        width,
        height,
        referenceImage: referenceImages[0],
        referenceImages: referenceImages.length > 1 ? referenceImages : undefined,
        imageEndpointId: conn.imageEndpointId || undefined,
        comfyWorkflow: conn.comfyuiWorkflow || undefined,
        imageDefaults,
        quality: resolveConnectionImageQuality(conn),
        fallback: imageFallback,
        onFallback: createReplyFallbackNotifier(reply),
      });
      return {
        image: `data:${result.mimeType};base64,${result.base64}`,
        prompt: compiled.prompt,
      };
    } catch (err) {
      logger.error(err, "%s generation failed", isCharacterSheet ? "Character sheet" : "Avatar");
      return reply.status(500).send({
        error:
          err instanceof Error ? err.message : `${isCharacterSheet ? "Character sheet" : "Avatar"} generation failed`,
      });
    }
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const char = await storage.getById(req.params.id);
    if (!char) return reply.status(404).send({ error: "Character not found" });
    return char;
  });

  app.get<{ Params: { id: string } }>("/:id/versions", async (req, reply) => {
    const char = await storage.getById(req.params.id);
    if (!char) return reply.status(404).send({ error: "Character not found" });
    return storage.listVersions(req.params.id);
  });

  app.post<{ Params: { id: string; versionId: string } }>("/:id/versions/:versionId/restore", async (req, reply) => {
    const restored = await storage.restoreVersion(req.params.id, req.params.versionId);
    if (!restored) return reply.status(404).send({ error: "Character version not found" });
    return restored;
  });

  app.delete<{ Params: { id: string; versionId: string } }>("/:id/versions/:versionId", async (req, reply) => {
    const deleted = await storage.deleteVersion(req.params.id, req.params.versionId);
    if (!deleted) return reply.status(404).send({ error: "Character version not found" });
    return reply.status(204).send();
  });

  app.patch<{ Params: { id: string; versionId: string } }>("/:id/versions/:versionId", async (req, reply) => {
    const { version } = renameCardVersionSchema.parse(req.body);
    const renamed = await storage.renameVersion(req.params.id, req.params.versionId, version);
    if (!renamed) return reply.status(404).send({ error: "Character version not found" });
    return renamed;
  });

  app.post<{ Params: { id: string } }>("/:id/versions/reset", async (req, reply) => {
    const reset = await enqueueUpdate(characterUpdateQueues, req.params.id, () => storage.resetVersions(req.params.id));
    if (!reset) return reply.status(404).send({ error: "Character not found" });
    return reset;
  });

  app.post("/", async (req) => {
    const input = createCharacterSchema.parse(req.body);
    const body = req.body as Record<string, unknown>;
    const avatarPath = typeof body.avatarPath === "string" ? body.avatarPath : undefined;
    const comment = typeof body.comment === "string" ? body.comment : undefined;
    return storage.create(
      input.data,
      avatarPath,
      normalizeTimestampOverrides({
        createdAt: body.createdAt,
        updatedAt: body.updatedAt,
      }),
      comment,
    );
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req) => {
    const body = req.body as Record<string, unknown>;
    const update = updateCharacterSchema.parse(req.body);
    const avatarPath = typeof body.avatarPath === "string" ? body.avatarPath : undefined;
    const comment = typeof body.comment === "string" ? body.comment : undefined;
    const versionSource = typeof body.versionSource === "string" ? body.versionSource : undefined;
    const versionReason = typeof body.versionReason === "string" ? body.versionReason : undefined;
    const skipVersionSnapshot = body.skipVersionSnapshot === true;
    const characterDataUpdate = update.data ?? {};
    return enqueueUpdate(characterUpdateQueues, req.params.id, async () => {
      const validatedDataUpdate = await validateCharacterGalleryReferences(
        req.params.id,
        characterDataUpdate,
        (imageId) => characterGallery.getById(imageId),
      );
      return storage.update(req.params.id, validatedDataUpdate, avatarPath, {
        comment,
        versionSource,
        versionReason,
        skipVersionSnapshot,
      });
    });
  });

  app.patch<{ Params: { id: string }; Body: { paint?: unknown } }>("/:id/tracker-card-colors", async (req, reply) => {
    const body = req.body;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !Object.hasOwn(body, "paint") ||
      Object.keys(body).length !== 1 ||
      body.paint === null ||
      typeof body.paint !== "object" ||
      Array.isArray(body.paint)
    ) {
      return reply.status(400).send({ error: "Tracker-card paint must be a JSON object" });
    }

    const updated = await enqueueUpdate(characterUpdateQueues, req.params.id, async () => {
      const char = await storage.getById(req.params.id);
      if (!char) return null;
      const currentData = parseCharacterDataRecord(char.data);
      const currentExtensions =
        currentData.extensions && typeof currentData.extensions === "object" && !Array.isArray(currentData.extensions)
          ? (currentData.extensions as Record<string, unknown>)
          : {};

      const trackerCardColors = JSON.stringify(
        applyTrackerCardPaint(currentExtensions.trackerCardColors, body.paint as Record<string, unknown>),
      );
      const extensions: Record<string, unknown> = { trackerCardColors };
      return storage.update(req.params.id, { extensions } as Partial<CharacterData>, undefined, {
        skipVersionSnapshot: true,
        versionSource: "settings-tracker-card-colors",
        mergeExtensions: true,
      });
    });
    if (!updated) return reply.status(404).send({ error: "Character not found" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { id } = req.params;
    if (isUnsafePathSegment(id)) {
      return reply.status(400).send({ error: "Invalid character ID" });
    }
    if (id === PROFESSOR_MARI_ID) {
      return reply.status(403).send({ error: "Professor Mari is a built-in character and cannot be deleted" });
    }
    const galleryImages = await characterGallery.listByCharacterId(id);
    await mutateAvatarReferencesAndCleanup({
      db: app.db,
      collectAvatarPaths: () => collectCharacterAvatarPaths(app.db, [id]),
      mutateReferences: () => storage.remove(id),
    });
    // Cascade the character's Noodle presence, otherwise its account and posts stay
    // in the timeline forever as a ghost (issue #4295).
    try {
      await createNoodleStorage(app.db).deleteAccountByEntity("character", id);
    } catch (err) {
      logger.error(err, "Failed to clean up Noodle account for deleted character %s", id);
    }
    for (const image of galleryImages) {
      await unlinkGalleryFileIfUnreferenced({ db: app.db, filePath: image.filePath });
    }
    const localPathPrefix = `characters/${id}/`;
    const hasSharedLocalFile = (
      await Promise.all(
        galleryImages
          .filter((image) => image.filePath.replace(/\\/g, "/").startsWith(localPathPrefix))
          .map((image) => galleryFileHasReferences(app.db, image.filePath)),
      )
    ).some(Boolean);
    const galleryDir = assertInsideDir(CHARACTER_GALLERY_ROOT, join(CHARACTER_GALLERY_ROOT, id));
    if (!hasSharedLocalFile && existsSync(galleryDir)) {
      rmSync(galleryDir, { recursive: true, force: true });
    }
    return reply.status(204).send();
  });

  // ── Character Gallery ──

  app.get<{ Params: { id: string } }>("/:id/gallery", async (req, reply) => {
    const char = await storage.getById(req.params.id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const images = await characterGallery.listByCharacterId(req.params.id);
    return images.map((img) => ({
      ...img,
      url: `/api/characters/${req.params.id}/gallery/file/${encodeURIComponent(img.filePath.split("/").pop()!)}`,
    }));
  });

  app.get<{ Params: { id: string } }>("/:id/gallery/clips", async (req, reply) => {
    const char = await storage.getById(req.params.id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const characterName = readCharacterDisplayName(char.data, "Character");
    const callManifest = await getConversationCallCharacterVideoManifest({
      characterId: req.params.id,
      characterName,
      avatarPath: char.avatarPath ?? null,
    });
    const callClips = callManifest.clips.map((clip) => ({
      id: `call:${clip.kind}`,
      source: "conversation-call" as const,
      label: CALL_VIDEO_CLIP_LABELS[clip.kind] ?? clip.kind,
      prompt: "",
      status: clip.status,
      url: clip.url,
      createdAt: clip.updatedAt ?? null,
      updatedAt: clip.updatedAt,
      origin: clip.origin ?? null,
      durationSeconds: null,
      trimStartSeconds: clip.trimStartSeconds ?? null,
      trimEndSeconds: clip.trimEndSeconds ?? null,
      aspectRatio: "16:9",
      provider: "",
      model: "",
      chatId: null,
      chatName: null,
      clipKind: clip.kind,
    }));
    const customCallClips = callManifest.customClips.map((clip) => ({
      id: `custom-call:${clip.id}`,
      source: "conversation-call-custom" as const,
      label: clip.label,
      prompt: clip.prompt,
      status: clip.status,
      url: clip.url,
      createdAt: clip.createdAt,
      updatedAt: clip.updatedAt,
      origin: clip.origin ?? null,
      durationSeconds: null,
      trimStartSeconds: clip.trimStartSeconds ?? null,
      trimEndSeconds: clip.trimEndSeconds ?? null,
      aspectRatio: "16:9",
      provider: "",
      model: "",
      chatId: null,
      chatName: null,
      clipKind: "custom" as const,
    }));

    const chatsStorage = createChatsStorage(app.db);
    const sceneVideos = createGameSceneVideosStorage(app.db);
    const allChats = await chatsStorage.list();
    const relatedChats = allChats.filter((chat) => parseCharacterIdList(chat.characterIds).includes(req.params.id));
    const sceneVideoGroups = await Promise.all(
      relatedChats.map(async (chat) => ({
        chat,
        videos: await sceneVideos.listByChatId(chat.id),
      })),
    );
    const sceneClips = sceneVideoGroups.flatMap(({ chat, videos }) =>
      videos.map((video) => {
        const filename = video.filePath.split("/").pop() ?? "";
        const routePrefix = chat.mode === "game" ? "/api/game" : "/api/gallery";
        return {
          id: `scene:${video.id}`,
          source: chat.mode === "game" ? ("game-scene" as const) : ("scene-video" as const),
          label: chat.mode === "game" ? "Game scene" : "Scene video",
          prompt: video.prompt,
          status: "ready" as const,
          url: `${routePrefix}/scene-videos/file/${encodeURIComponent(chat.id)}/${encodeURIComponent(filename)}`,
          createdAt: video.createdAt,
          updatedAt: video.createdAt,
          durationSeconds: video.durationSeconds,
          trimStartSeconds: null,
          trimEndSeconds: null,
          aspectRatio: video.aspectRatio,
          provider: video.provider,
          model: video.model,
          chatId: chat.id,
          chatName: chat.name,
          clipKind: null,
        };
      }),
    );
    const uploadedVideoClips = await listGalleryVideoClips(CHARACTER_GALLERY_VIDEO_ROOT, req.params.id, "character");

    const clips = [...customCallClips, ...callClips, ...uploadedVideoClips, ...sceneClips].sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? "") || 0;
      const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? "") || 0;
      return rightTime - leftTime;
    });

    return { clips, callVideoGenerating: callManifest.generating };
  });

  app.post<{ Params: { id: string } }>("/:id/gallery/clips/upload", async (req, reply) => {
    const { id } = req.params;
    const char = await storage.getById(id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const data = await req.file({ limits: { fileSize: CALL_VIDEO_CLIP_UPLOAD_MAX_BYTES } });
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_CALL_VIDEO_CLIP_UPLOAD_EXTS.has(ext)) {
      return reply.status(400).send({ error: "Video call clips must be MP4 files." });
    }

    let buffer: Buffer;
    try {
      buffer = await readCallVideoClipUploadBuffer(data);
    } catch (error) {
      if (error instanceof CallVideoClipUploadTooLargeError) {
        return reply.status(413).send({ error: error.message });
      }
      throw error;
    }
    if (buffer.length > CALL_VIDEO_CLIP_UPLOAD_MAX_BYTES) {
      return reply.status(413).send({ error: "Video call clip uploads must be 250 MB or smaller." });
    }

    const fields = data.fields as Record<string, unknown>;
    const requestedKind = readMultipartStringField(fields, "kind");
    const kind = requestedKind ? parseConversationCallClipKind(requestedKind) : null;
    if (requestedKind && !kind) {
      return reply.status(400).send({ error: "Invalid call clip kind" });
    }

    const characterName = readCharacterDisplayName(char.data, "Character");
    const label = readMultipartStringField(fields, "label") || labelFromUploadedClipFilename(data.filename);
    try {
      return await uploadConversationCallCharacterVideoClip({
        characterId: id,
        characterName,
        avatarPath: char.avatarPath ?? null,
        buffer,
        label,
        kind,
      });
    } catch (error) {
      if (error instanceof ConversationCallVideoClipUploadError) {
        return reply.status(400).send({ error: error.message });
      }
      if (error instanceof ConversationCallVideoGenerationInProgressError) {
        return reply.status(409).send({ error: error.message });
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string; clipId: string } }>("/:id/gallery/clips/:clipId/trim", async (req, reply) => {
    const { id, clipId } = req.params;
    const char = await storage.getById(id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const characterName = readCharacterDisplayName(char.data, "Character");
    const body = parseRouteRecord(req.body);
    const { trimStartSeconds, trimEndSeconds } = body;
    if (!isRouteTrimSecondValue(trimStartSeconds) || !isRouteTrimSecondValue(trimEndSeconds)) {
      return reply.status(400).send({ error: "Clip trim values must be numbers, null, or omitted" });
    }

    try {
      if (clipId.startsWith("call:")) {
        const kind = parseConversationCallClipKind(clipId.slice("call:".length));
        if (!kind) return reply.status(400).send({ error: "Invalid call clip kind" });
        return await updateConversationCallCharacterVideoClipTrim({
          characterId: id,
          characterName,
          avatarPath: char.avatarPath ?? null,
          kind,
          trimStartSeconds,
          trimEndSeconds,
        });
      }

      if (clipId.startsWith("custom-call:")) {
        const customClipId = clipId.slice("custom-call:".length);
        if (!/^[A-Za-z0-9_-]{6,80}$/.test(customClipId)) {
          return reply.status(400).send({ error: "Invalid custom clip id" });
        }
        return await updateConversationCallCustomVideoClipTrim({
          characterId: id,
          characterName,
          avatarPath: char.avatarPath ?? null,
          clipId: customClipId,
          trimStartSeconds,
          trimEndSeconds,
        });
      }
    } catch (error) {
      if (error instanceof ConversationCallVideoClipNotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      if (error instanceof ConversationCallVideoClipTrimError) {
        return reply.status(400).send({ error: error.message });
      }
      if (error instanceof ConversationCallVideoClipAvatarMismatchError) {
        return reply.status(409).send({ error: error.message });
      }
      if (error instanceof ConversationCallVideoGenerationInProgressError) {
        return reply.status(409).send({ error: error.message });
      }
      throw error;
    }

    return reply.status(400).send({ error: "Unsupported clip type" });
  });

  app.delete<{ Params: { id: string; clipId: string } }>("/:id/gallery/clips/:clipId", async (req, reply) => {
    const { id, clipId } = req.params;
    const char = await storage.getById(id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const characterName = readCharacterDisplayName(char.data, "Character");

    if (clipId.startsWith("call:")) {
      const kind = parseConversationCallClipKind(clipId.slice("call:".length));
      if (!kind) return reply.status(400).send({ error: "Invalid call clip kind" });

      try {
        await deleteConversationCallCharacterVideoClip({
          characterId: id,
          characterName,
          avatarPath: char.avatarPath ?? null,
          kind,
        });
      } catch (error) {
        if (error instanceof ConversationCallVideoGenerationInProgressError) {
          return reply.status(409).send({ error: error.message });
        }
        throw error;
      }
      return { success: true };
    }

    if (clipId.startsWith("custom-call:")) {
      const customClipId = clipId.slice("custom-call:".length);
      if (!/^[A-Za-z0-9_-]{6,80}$/.test(customClipId)) {
        return reply.status(400).send({ error: "Invalid custom clip id" });
      }
      let deleted = false;
      try {
        deleted = await deleteConversationCallCustomVideoClip({
          characterId: id,
          characterName,
          avatarPath: char.avatarPath ?? null,
          clipId: customClipId,
        });
      } catch (error) {
        if (error instanceof ConversationCallVideoGenerationInProgressError) {
          return reply.status(409).send({ error: error.message });
        }
        throw error;
      }
      if (!deleted) return reply.status(404).send({ error: "Clip not found" });
      return { success: true };
    }

    if (clipId.startsWith("scene:")) {
      const sceneVideoId = clipId.slice("scene:".length);
      if (!sceneVideoId) return reply.status(400).send({ error: "Invalid scene clip id" });

      const chatsStorage = createChatsStorage(app.db);
      const sceneVideos = createGameSceneVideosStorage(app.db);
      const video = await sceneVideos.getById(sceneVideoId);
      if (!video) return reply.status(404).send({ error: "Clip not found" });

      const chat = await chatsStorage.getById(video.chatId);
      if (!chat || !parseCharacterIdList(chat.characterIds).includes(id)) {
        return reply.status(404).send({ error: "Clip not found" });
      }

      await removeSavedVideoFromDisk(video.filePath);
      await sceneVideos.remove(video.id);
      return { success: true };
    }

    if (clipId.startsWith("uploaded:")) {
      const deleted = await removeGalleryVideoClip(CHARACTER_GALLERY_VIDEO_ROOT, id, clipId);
      if (!deleted) return reply.status(404).send({ error: "Clip not found" });
      return { success: true };
    }

    return reply.status(400).send({ error: "Unsupported clip type" });
  });

  app.post<{ Params: { id: string } }>("/:id/gallery/videos/upload", async (req, reply) => {
    const { id } = req.params;
    const char = await storage.getById(id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const data = await req.file({ limits: { fileSize: CALL_VIDEO_CLIP_UPLOAD_MAX_BYTES } });
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_GALLERY_VIDEO_EXTS.has(ext)) {
      return reply.status(400).send({ error: `Unsupported video type: ${ext}` });
    }

    const dir = ensureGalleryVideoDir(CHARACTER_GALLERY_VIDEO_ROOT, id);
    await mkdir(dir, { recursive: true });
    const videoId = newId();
    const filename = `${videoId}${ext}`;
    const filePath = assertInsideDir(dir, join(dir, filename));
    await pipeline(data.file, createWriteStream(filePath));
    if (isMultipartFileTruncated(data)) {
      await unlink(filePath).catch(() => undefined);
      return reply.status(413).send({ error: "Gallery video uploads must be 250 MB or smaller." });
    }

    const fields = data.fields as Record<string, unknown>;
    const timestamp = new Date().toISOString();
    const manifest = await readGalleryVideoManifest(CHARACTER_GALLERY_VIDEO_ROOT, id);
    const entry: GalleryVideoEntry = {
      id: videoId,
      filename,
      label: readMultipartStringField(fields, "label") || labelFromUploadedClipFilename(data.filename),
      prompt: readMultipartStringField(fields, "prompt") || "",
      provider: readMultipartStringField(fields, "provider") || "upload",
      model: readMultipartStringField(fields, "model") || "",
      aspectRatio: readMultipartStringField(fields, "aspectRatio") || "video",
      durationSeconds: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await writeGalleryVideoManifest(CHARACTER_GALLERY_VIDEO_ROOT, id, {
      version: 1,
      videos: [entry, ...manifest.videos],
    });
    return toGalleryVideoClip({ entry, entityId: id, entityKind: "character" });
  });

  app.get<{ Params: { id: string; filename: string } }>("/:id/gallery/videos/file/:filename", async (req, reply) => {
    const { id, filename } = req.params;
    if (isUnsafePathSegment(id) || isUnsafePathSegment(filename)) {
      return reply.status(400).send({ error: "Invalid path" });
    }

    const dir = ensureGalleryVideoDir(CHARACTER_GALLERY_VIDEO_ROOT, id);
    const filePath = assertInsideDir(dir, join(dir, filename));
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    const video = await validateVideoAssetFile(filePath, filename);
    if (!video) return reply.status(404).send({ error: "Not found" });

    return sendValidatedMediaFile(reply, video, { method: req.method, rangeHeader: req.headers.range });
  });

  app.post<{ Params: { id: string } }>("/:id/gallery/upload", async (req, reply) => {
    const { id } = req.params;
    const char = await storage.getById(id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const data = await req.file({ limits: { fileSize: CALL_VIDEO_CLIP_UPLOAD_MAX_BYTES } });
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_GALLERY_EXTS.has(ext)) {
      return reply.status(400).send({ error: `Unsupported file type: ${ext}` });
    }

    const dir = await ensureCharacterGalleryDir(id);
    const filename = `${newId()}${ext}`;
    const filePath = join(dir, filename);

    await pipeline(data.file, createWriteStream(filePath));

    const fields = data.fields as Record<string, { value?: string } | undefined>;
    const prompt = fields?.prompt?.value ?? "";
    const provider = fields?.provider?.value ?? "";
    const model = fields?.model?.value ?? "";
    const width = fields?.width?.value ? parseInt(fields.width.value, 10) : undefined;
    const height = fields?.height?.value ? parseInt(fields.height.value, 10) : undefined;

    const image = await characterGallery.create({
      characterId: id,
      filePath: `characters/${id}/${filename}`,
      prompt,
      provider,
      model,
      width: Number.isFinite(width) ? width : undefined,
      height: Number.isFinite(height) ? height : undefined,
    });

    return {
      ...image,
      url: `/api/characters/${id}/gallery/file/${encodeURIComponent(filename)}`,
    };
  });

  app.get<{ Params: { id: string; filename: string } }>("/:id/gallery/file/:filename", async (req, reply) => {
    const { id, filename } = req.params;
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\") ||
      id.includes("..") ||
      id.includes("/") ||
      id.includes("\\")
    ) {
      return reply.status(400).send({ error: "Invalid path" });
    }

    const image = findGalleryRowByFilename(await characterGallery.listByCharacterId(id), filename);
    const storedFile = image ? resolveStoredGalleryFile(image.filePath) : null;
    if (!storedFile || !existsSync(storedFile.absolutePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    const validatedImage = await validateImageAssetFile(storedFile.absolutePath, storedFile.filename);
    if (!validatedImage) return reply.status(404).send({ error: "Not found" });

    return sendValidatedMediaFile(reply, validatedImage, { method: req.method, rangeHeader: req.headers.range });
  });

  app.delete<{ Params: { id: string; imageId: string } }>("/:id/gallery/:imageId", async (req, reply) => {
    const { id, imageId } = req.params;
    const image = await characterGallery.getById(imageId);
    if (!image || image.characterId !== id) {
      return reply.status(404).send({ error: "Not found" });
    }

    await characterGallery.remove(imageId);
    await enqueueUpdate(characterUpdateQueues, id, async () => {
      const character = await storage.getById(id);
      if (!character) return null;
      const characterData = parseCharacterDataRecord(character.data);
      const extensions = parseCharacterDataRecord(characterData.extensions);
      if (extensions.characterSheetImageId !== imageId) return character;
      return storage.update(
        id,
        {
          extensions: { characterSheetImageId: null, useCharacterSheetAsReference: false },
        } as Partial<CharacterData>,
        undefined,
        { skipVersionSnapshot: true, mergeExtensions: true },
      );
    });
    await unlinkGalleryFileIfUnreferenced({ db: app.db, filePath: image.filePath });
    return { success: true };
  });

  app.post<{ Params: { id: string; imageId: string } }>("/:id/gallery/:imageId/avatar", async (req, reply) => {
    const { id, imageId } = req.params;
    const image = await characterGallery.getById(imageId);
    if (!image || image.characterId !== id) {
      return reply.status(404).send({ error: "Gallery image not found" });
    }

    let avatarPath: string | null = null;
    try {
      avatarPath = await copyGalleryImageToAvatar("character", id, image.filePath);
      const updated = await storage.updateAvatar(id, avatarPath);
      if (!updated) {
        await removeUnattachedAvatarFile({ avatarPath });
        return reply.status(404).send({ error: "Character not found" });
      }
      return updated;
    } catch (error) {
      if (avatarPath) await removeUnattachedAvatarFile({ avatarPath });
      logger.warn(error, "Failed to set character %s avatar from gallery image %s", id, imageId);
      return reply.status(400).send({ error: "Gallery image could not be used as an avatar" });
    }
  });

  app.patch<{
    Params: { id: string; imageId: string };
    Body: { customKind?: string | null; customName?: string | null; width?: number; height?: number };
  }>("/:id/gallery/:imageId/tag", async (req, reply) => {
    const { id, imageId } = req.params;
    const image = await characterGallery.getById(imageId);
    if (!image || image.characterId !== id) {
      return reply.status(404).send({ error: "Not found" });
    }
    const kind = req.body?.customKind ?? null;
    if (kind !== null && kind !== "emoji" && kind !== "sticker") {
      return reply.status(400).send({ error: "Invalid customKind" });
    }
    const name = typeof req.body?.customName === "string" ? req.body.customName.trim() : "";
    const error = validateCustomTagPayload(kind, name, req.body?.width, req.body?.height);
    if (error) return reply.status(400).send({ error });

    return characterGallery.setTag(imageId, {
      customKind: kind,
      customName: kind === null ? null : name,
      width: kind !== null && typeof req.body?.width === "number" ? req.body.width : undefined,
      height: kind !== null && typeof req.body?.height === "number" ? req.body.height : undefined,
    });
  });

  // ── Duplicate ──
  app.post<{ Params: { id: string } }>("/:id/duplicate", async (req, reply) => {
    const result = await storage.duplicateCharacter(req.params.id);
    if (!result) return reply.status(404).send({ error: "Character not found" });
    return result;
  });

  // ── Export ──

  app.get<{ Params: { id: string }; Querystring: { format?: ExportFormat } }>("/:id/export", async (req, reply) => {
    const char = await storage.getById(req.params.id);
    if (!char) return reply.status(404).send({ error: "Character not found" });
    const charData = JSON.parse(char.data);
    const compatible = req.query.format === "compatible";
    const payload = compatible
      ? buildCompatibleCharacterExport(charData)
      : await buildNativeCharacterEnvelope(char, charData, characterGallery);
    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(charData.name || "character")}.${compatible ? "json" : "marinara.json"}"`,
      )
      .send(payload);
  });

  app.post("/export-bulk", async (req, reply) => {
    const { ids, format = "native" } = req.body as { ids?: string[]; format?: ExportFormat };
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ error: "ids array is required" });
    }

    const zip = new AdmZip();
    let exportedCount = 0;
    for (const id of ids) {
      const char = await storage.getById(id);
      if (!char) continue;
      const charData = JSON.parse(char.data);
      const payload =
        format === "compatible"
          ? buildCompatibleCharacterExport(charData)
          : await buildNativeCharacterEnvelope(char, charData, characterGallery);
      zip.addFile(
        `${toSafeExportName(String(charData.name ?? "character"), `character-${exportedCount + 1}`)}.${format === "compatible" ? "json" : "marinara.json"}`,
        Buffer.from(JSON.stringify(payload, null, 2), "utf-8"),
      );
      exportedCount++;
    }

    if (exportedCount === 0) {
      return reply.status(404).send({ error: "No characters found for the provided ids" });
    }

    return reply
      .header("Content-Type", "application/zip")
      .header(
        "Content-Disposition",
        `attachment; filename="${format === "compatible" ? "compatible-characters.zip" : "marinara-characters.zip"}"`,
      )
      .send(zip.toBuffer());
  });

  app.post<{ Params: { id: string } }>("/:id/embedded-lorebook/import", async (req, reply) => {
    const char = await storage.getById(req.params.id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const charData = JSON.parse(char.data) as Record<string, unknown>;
    const book = charData.character_book as { entries?: unknown[] } | null | undefined;
    const entries = Array.isArray(book?.entries) ? book.entries : [];
    if (entries.length === 0) {
      return reply.status(400).send({ error: "Character does not have an embedded lorebook" });
    }

    const extensions =
      charData.extensions && typeof charData.extensions === "object"
        ? ({ ...(charData.extensions as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const importMetadata =
      extensions.importMetadata && typeof extensions.importMetadata === "object"
        ? ({ ...(extensions.importMetadata as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const embeddedLorebookMetadata =
      importMetadata.embeddedLorebook && typeof importMetadata.embeddedLorebook === "object"
        ? ({ ...(importMetadata.embeddedLorebook as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    const result = await importSTLorebook(
      {
        name: String(charData.name ?? "Character Lorebook"),
        entries: book?.entries ?? [],
        extensions: (book as Record<string, unknown> | null | undefined)?.extensions ?? {},
      },
      app.db,
      {
        characterId: req.params.id,
        namePrefix: String(charData.name ?? "Character"),
        existingLorebookId:
          typeof embeddedLorebookMetadata.lorebookId === "string" ? embeddedLorebookMetadata.lorebookId : null,
      },
    );

    if (!result || "error" in result) {
      return reply.status(500).send({ error: result?.error ?? "Failed to import embedded lorebook" });
    }

    extensions.importMetadata = {
      ...importMetadata,
      embeddedLorebook: {
        ...embeddedLorebookMetadata,
        hasEmbeddedLorebook: true,
        lorebookId: result.lorebookId,
      },
    };

    await storage.update(req.params.id, {
      extensions: extensions as any,
    });

    return {
      success: true,
      lorebookId: result.lorebookId,
      entriesImported: result.entriesImported,
      reimported: result.reimported ?? false,
    };
  });

  // Remove the embedded lorebook from this character's card: drop
  // data.character_book and the embeddedLorebook pointer. The user-initiated
  // inverse of embed/import; the linked standalone lorebook (if any) is kept.
  app.delete<{ Params: { id: string } }>("/:id/embedded-lorebook", async (req, reply) => {
    const cleared = await clearEmbeddedLorebookFromCharacter(app.db, req.params.id);
    if (!cleared) return reply.status(404).send({ error: "Character not found" });
    return { success: true };
  });

  // Embed a standalone/linked character lorebook INTO this character's card
  // (data.character_book) so it exports with the card — the inverse of the
  // import above. Writes the lorebook's current entries and the forward
  // pointer; future /lorebooks edits then keep the embedded copy in sync.
  app.post<{ Params: { id: string }; Body: { lorebookId?: string } }>(
    "/:id/embedded-lorebook/embed",
    async (req, reply) => {
      const lorebookId = typeof req.body?.lorebookId === "string" ? req.body.lorebookId.trim() : "";
      if (!lorebookId) return reply.status(400).send({ error: "lorebookId is required" });

      const char = await storage.getById(req.params.id);
      if (!char) return reply.status(404).send({ error: "Character not found" });

      const lorebook = (await lorebooksStorage.getById(lorebookId)) as Record<string, unknown> | null;
      if (!lorebook) return reply.status(404).send({ error: "Lorebook not found" });

      // A character card only carries a character-scoped book. Persona
      // lorebooks are identified by persona links and have no card slot.
      const personaIds = Array.isArray(lorebook.personaIds) ? (lorebook.personaIds as unknown[]) : [];
      if (
        personaIds.length > 0 ||
        typeof lorebook.personaId === "string" ||
        (typeof lorebook.category === "string" && lorebook.category !== "character")
      ) {
        return reply.status(400).send({ error: "Only character lorebooks can be embedded into a character card." });
      }

      // A card has a single character_book slot. Allow only when the slot is
      // empty or already belongs to this lorebook (refresh); never clobber a
      // different embedded book or an unpointered baked snapshot.
      const charData = JSON.parse(char.data) as Record<string, unknown>;
      const currentEmbeddedId = getEmbeddedLorebookId(charData);
      const hasBook = charData.character_book !== null && charData.character_book !== undefined;
      const slotBelongsToThis = currentEmbeddedId === lorebookId;
      const slotEmpty = !currentEmbeddedId && !hasBook;
      if (!slotBelongsToThis && !slotEmpty) {
        return reply
          .status(409)
          .send({ error: "This character already has an embedded lorebook. Remove it first, then embed this one." });
      }

      // Ensure the book is linked to this character so it auto-activates and
      // stays live-syncable — additively (union), never replacing other links.
      const linkedIds = Array.isArray(lorebook.characterIds) ? (lorebook.characterIds as string[]) : [];
      const linkAdded = !linkedIds.includes(req.params.id);
      if (linkAdded) {
        await lorebooksStorage.update(lorebookId, {
          characterIds: Array.from(new Set([...linkedIds, req.params.id])),
        });
      }

      let result: Awaited<ReturnType<typeof embedLorebookIntoCharacter>>;
      try {
        result = await embedLorebookIntoCharacter(app.db, req.params.id, lorebookId);
      } catch (err) {
        if (linkAdded) {
          try {
            await lorebooksStorage.update(lorebookId, { characterIds: linkedIds });
          } catch (rollbackErr) {
            logger.error(rollbackErr, "Failed to roll back lorebook link after embedded lorebook write failed");
          }
        }
        throw err;
      }
      return {
        success: true,
        lorebookId,
        entriesEmbedded: result.entriesEmbedded,
        refreshed: result.refreshed,
        characterBook: result.characterBook,
      };
    },
  );

  // ── Export as PNG ──

  app.get<{ Params: { id: string } }>("/:id/export-png", async (req, reply) => {
    const char = await storage.getById(req.params.id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const charData = JSON.parse(char.data);
    const sprites = await readSpritesForId(char.id, true);
    if (!sprites) {
      return reply.status(413).send({ error: "Sprite collection exceeds compatible PNG export limits" });
    }
    const v2Envelope = buildCompatibleCharacterExport(charData, sprites);
    const charaBase64 = Buffer.from(JSON.stringify(v2Envelope), "utf-8").toString("base64");

    // Read avatar image or create a minimal 1x1 transparent PNG fallback
    let pngBuffer: Buffer;
    if (char.avatarPath) {
      // avatarPath is like /api/avatars/file/abc123.png — extract filename
      const filename = char.avatarPath.split("?")[0]!.split("/").pop()!;
      const avatarFile = join(DATA_DIR, "avatars", filename);
      if (existsSync(avatarFile)) {
        try {
          const avatarBuffer = await readFile(avatarFile);
          const imageInfo = isAllowedImageBuffer(avatarBuffer, extname(filename));
          if (imageInfo?.mimeType === "image/png") {
            pngBuffer = avatarBuffer;
          } else if (imageInfo) {
            const sharp = (await import("sharp")).default;
            pngBuffer = await sharp(avatarBuffer).png().toBuffer();
          } else {
            pngBuffer = createMinimalPng();
          }
        } catch (err) {
          logger.warn(err, "Failed to prepare avatar PNG for character card export");
          pngBuffer = createMinimalPng();
        }
      } else {
        pngBuffer = createMinimalPng();
      }
    } else {
      pngBuffer = createMinimalPng();
    }

    // Inject "chara" tEXt chunk into the PNG
    const resultPng = injectTextChunk(pngBuffer, "chara", charaBase64);

    const safeName = encodeURIComponent(charData.name || "character");
    return reply
      .header("Content-Type", "image/png")
      .header("Content-Disposition", `attachment; filename="${safeName}.png"`)
      .send(Buffer.from(resultPng));
  });

  // ── Avatar Upload ──

  app.post<{ Params: { id: string } }>("/:id/avatar", async (req, reply) => {
    const id = PATH_SAFE_ID_RE.exec(req.params.id)?.[0];
    if (!id) return reply.status(400).send({ error: "Invalid character ID" });
    const char = await storage.getById(id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const body = req.body as { avatar?: string; filename?: string; data?: unknown };
    if (!body.avatar) {
      return reply.status(400).send({ error: "No avatar data provided" });
    }

    // avatar is a base64 data URL or raw base64
    let base64 = body.avatar;
    let ext = "png";
    if (base64.startsWith("data:")) {
      const match = base64.match(/^data:image\/([\w+]+);base64,/);
      if (match?.[1]) {
        ext = match[1].replace("+xml", "");
        base64 = base64.slice(base64.indexOf(",") + 1);
      }
    }
    const imageBuffer = Buffer.from(base64, "base64");
    const imageInfo = isAllowedImageBuffer(imageBuffer, `.${ext}`);
    if (!imageInfo) return reply.status(400).send({ error: "Unsupported or invalid avatar image" });
    ext = extensionFromImageMime(imageInfo.mimeType);

    const avatarsDir = join(DATA_DIR, "avatars");
    const filename = `character-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filepath = assertInsideDir(avatarsDir, join(avatarsDir, filename));
    const avatarPath = `/api/avatars/file/${filename}`;
    try {
      await mkdir(avatarsDir, { recursive: true });
      await writeFile(filepath, imageBuffer);
      const characterData =
        body.data === undefined ? {} : (updateCharacterSchema.parse({ data: body.data }).data ?? {});
      const updated = await enqueueUpdate(characterUpdateQueues, id, async () => {
        const validatedData = await validateCharacterGalleryReferences(id, characterData, (imageId) =>
          characterGallery.getById(imageId),
        );
        return storage.update(id, validatedData, avatarPath, {
          versionReason: body.data === undefined ? "Avatar update" : "Character card and avatar update",
        });
      });
      if (!updated) {
        await removeUnattachedAvatarFile({ avatarPath });
        return reply.status(404).send({ error: "Character not found" });
      }
      return updated;
    } catch (error) {
      await removeUnattachedAvatarFile({ filePath: filepath });
      throw error;
    }
  });

  app.delete<{ Params: { id: string } }>("/:id/avatar", async (req, reply) => {
    const { id } = req.params;
    const char = await storage.getById(id);
    if (!char) return reply.status(404).send({ error: "Character not found" });

    const updated = await storage.updateAvatar(id, null);
    return updated ?? reply.status(404).send({ error: "Character not found" });
  });

  // ── Personas ──

  app.get<{ Querystring: { limit?: string; offset?: string; search?: string; sort?: string } }>(
    "/personas/list",
    async (req) => {
      const page = parseLibraryPageQuery(req.query);
      if (page.hasPaging) {
        const result = await storage.listPersonasPage({
          limit: page.limit,
          offset: page.offset,
          search: page.search,
          sort: page.sort,
        });
        return { ...result, items: result.items.map(projectPersona) };
      }
      return (await storage.listPersonas()).map(projectPersona);
    },
  );

  app.get("/personas/active", async () => {
    const personas = await storage.listPersonas();
    const active = personas.find((persona) => persona.isActive === "true");
    return active ? projectPersona(active) : null;
  });

  app.get<{ Params: { id: string } }>("/personas/:id", async (req, reply) => {
    const persona = await storage.getPersona(req.params.id);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });
    return projectPersona(persona);
  });

  app.get<{ Params: { id: string } }>("/personas/:id/versions", async (req, reply) => {
    const persona = await storage.getPersona(req.params.id);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });
    return storage.listPersonaVersions(req.params.id);
  });

  app.post<{ Params: { id: string; versionId: string } }>(
    "/personas/:id/versions/:versionId/restore",
    async (req, reply) => {
      const restored = await storage.restorePersonaVersion(req.params.id, req.params.versionId);
      if (!restored) return reply.status(404).send({ error: "Persona version not found" });
      return projectPersona(restored);
    },
  );

  app.delete<{ Params: { id: string; versionId: string } }>("/personas/:id/versions/:versionId", async (req, reply) => {
    const deleted = await storage.deletePersonaVersion(req.params.id, req.params.versionId);
    if (!deleted) return reply.status(404).send({ error: "Persona version not found" });
    return reply.status(204).send();
  });

  app.patch<{ Params: { id: string; versionId: string } }>("/personas/:id/versions/:versionId", async (req, reply) => {
    const { version } = renameCardVersionSchema.parse(req.body);
    const renamed = await storage.renamePersonaVersion(req.params.id, req.params.versionId, version);
    if (!renamed) return reply.status(404).send({ error: "Persona version not found" });
    return renamed;
  });

  app.post<{ Params: { id: string } }>("/personas/:id/versions/reset", async (req, reply) => {
    const reset = await enqueueUpdate(personaUpdateQueues, req.params.id, () =>
      storage.resetPersonaVersions(req.params.id),
    );
    if (!reset) return reply.status(404).send({ error: "Persona not found" });
    return projectPersona(reset);
  });

  app.post("/personas", async (req, reply) => {
    const parsed = personaCreateInputSchema.safeParse(canonicalizeLegacyPersonaInput(req.body));
    if (!parsed.success)
      return reply.status(400).send({ error: "Invalid persona payload", issues: parsed.error.issues });
    const { createdAt, updatedAt, ...input } = parsed.data;
    const { name, description, extra } = encodePersonaCreate(input);
    const created = await storage.createPersona(
      name,
      description,
      undefined,
      extra,
      normalizeTimestampOverrides({ createdAt, updatedAt }),
    );
    if (!created) return reply.status(500).send({ error: "Created persona could not be loaded" });
    return projectPersona(created);
  });

  app.patch<{ Params: { id: string } }>("/personas/:id", async (req, reply) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return reply.status(400).send({ error: "Persona update must be a JSON object" });
    }
    const rawBody = req.body as Record<string, unknown>;
    const rawTrackerCardColors = rawBody.trackerCardColors;
    const completeReset = rawTrackerCardColors === "";
    const hasCharacterSheetImageId = Object.hasOwn(rawBody, "characterSheetImageId");
    const hasUseCharacterSheetAsReference = Object.hasOwn(rawBody, "useCharacterSheetAsReference");
    const characterSheetImageId = rawBody.characterSheetImageId;
    if (hasCharacterSheetImageId && characterSheetImageId !== null && typeof characterSheetImageId !== "string") {
      return reply.status(400).send({ error: "characterSheetImageId must be a string or null" });
    }
    let useCharacterSheetAsReference: "true" | "false" | undefined;
    if (hasUseCharacterSheetAsReference) {
      const enabled = rawBody.useCharacterSheetAsReference;
      if (typeof enabled === "boolean") useCharacterSheetAsReference = String(enabled) as "true" | "false";
      else if (enabled === "true" || enabled === "false") useCharacterSheetAsReference = enabled;
      else return reply.status(400).send({ error: "useCharacterSheetAsReference must be a boolean" });
    }

    const parsed = personaUpdateInputSchema.safeParse(canonicalizeLegacyPersonaInput(rawBody));
    if (!parsed.success)
      return reply.status(400).send({ error: "Invalid persona update", issues: parsed.error.issues });
    const body = parsed.data;
    if (Object.keys(body).length === 0 && !hasCharacterSheetImageId && !hasUseCharacterSheetAsReference) {
      const current = await storage.getPersona(req.params.id);
      if (!current) return reply.status(404).send({ error: "Persona not found" });
      return projectPersona(current);
    }

    const updated = await enqueueUpdate(personaUpdateQueues, req.params.id, async () => {
      let galleryFields: {
        characterSheetImageId?: string | null;
        useCharacterSheetAsReference?: "true" | "false";
      } = hasUseCharacterSheetAsReference ? { useCharacterSheetAsReference } : {};
      if (hasCharacterSheetImageId) {
        const imageId = typeof characterSheetImageId === "string" ? characterSheetImageId : null;
        const image = imageId ? await personaGallery.getById(imageId) : null;
        galleryFields =
          image && image.personaId === req.params.id
            ? { ...galleryFields, characterSheetImageId: imageId }
            : { characterSheetImageId: null, useCharacterSheetAsReference: "false" };
      }
      if (!Object.hasOwn(body, "trackerCardColors") || completeReset) {
        return storage.updatePersona(req.params.id, { ...encodePersonaUpdate(body), ...galleryFields });
      }
      const current = await storage.getPersona(req.params.id);
      if (!current) return null;
      const trackerCardColors = isTrackerCardClear(body.trackerCardColors)
        ? buildTrackerCardPortraitClear(current.trackerCardColors)
        : mergePersonaTrackerCardColors(current.trackerCardColors, body.trackerCardColors as Record<string, unknown>);
      return storage.updatePersona(req.params.id, {
        ...encodePersonaUpdate({ ...body, trackerCardColors }),
        ...galleryFields,
      });
    });
    if (!updated) return reply.status(404).send({ error: "Persona not found" });
    return projectPersona(updated);
  });

  app.patch<{ Params: { id: string } }>("/personas/:id/tracker-card-colors", async (req, reply) => {
    const body = (req.body ?? {}) as { paint?: unknown; portrait?: unknown };
    const hasPaint = body.paint !== undefined,
      hasPortrait = body.portrait !== undefined;
    if (hasPaint === hasPortrait)
      return reply.status(400).send({ error: "Provide exactly one tracker-card paint or portrait update" });
    let paint: Record<string, unknown> | null = null;
    let portrait: Record<string, unknown> | null = null;
    if (hasPaint) {
      if (!body.paint || typeof body.paint !== "object" || Array.isArray(body.paint))
        return reply.status(400).send({ error: "Tracker-card paint must be a JSON object" });
      const parsed = trackerCardColorConfigSchema.safeParse(body.paint);
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: "Tracker-card paint contains invalid values", issues: parsed.error.issues });
      paint = parsed.data as Record<string, unknown>;
    } else {
      if (!body.portrait || typeof body.portrait !== "object" || Array.isArray(body.portrait))
        return reply.status(400).send({ error: "Tracker-card portrait values must be finite numbers" });
      const parsed = trackerCardColorConfigSchema.safeParse(body.portrait);
      if (
        !parsed.success ||
        parsed.data.portraitFocusX === undefined ||
        parsed.data.portraitFocusY === undefined ||
        parsed.data.portraitZoom === undefined
      ) {
        return reply.status(400).send({
          error: "Tracker-card portrait contains invalid values",
          ...(parsed.success ? {} : { issues: parsed.error.issues }),
        });
      }
      portrait = {
        portraitFocusX: parsed.data.portraitFocusX,
        portraitFocusY: parsed.data.portraitFocusY,
        portraitZoom: parsed.data.portraitZoom,
      };
    }
    const updated = await enqueueUpdate(personaUpdateQueues, req.params.id, async () => {
      const current = await storage.getPersona(req.params.id);
      if (!current) return null;
      const next = paint
        ? applyPersonaTrackerCardPaint(current.trackerCardColors, paint)
        : normalizeTrackerCardColorConfig({ ...parseCharacterDataRecord(current.trackerCardColors), ...portrait! });
      return storage.updatePersona(
        req.params.id,
        { trackerCardColors: JSON.stringify(next) },
        { skipVersionSnapshot: true },
      );
    });
    if (!updated) return reply.status(404).send({ error: "Persona not found" });
    return projectPersona(updated);
  });

  app.post<{ Params: { id: string } }>("/personas/:id/avatar", async (req, reply) => {
    const body = req.body as { avatar?: string; filename?: string };
    if (!body.avatar) return reply.status(400).send({ error: "No avatar data" });
    let base64 = body.avatar;
    let hintedExt = ".png";
    if (base64.startsWith("data:")) {
      const match = base64.match(/^data:image\/([\w+]+);base64,/);
      if (match?.[1]) hintedExt = `.${match[1].replace("+xml", "")}`;
    }
    if (base64.includes(",")) base64 = base64.split(",")[1]!;
    const imageBuffer = Buffer.from(base64, "base64");
    const imageInfo = isAllowedImageBuffer(imageBuffer, hintedExt);
    if (!imageInfo) return reply.status(400).send({ error: "Unsupported or invalid avatar image" });
    if (!(await storage.getPersona(req.params.id))) {
      return reply.status(404).send({ error: "Persona not found" });
    }
    const filename = `persona-${req.params.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${imageInfo.ext}`;
    const avatarsDir = join(DATA_DIR, "avatars");
    const avatarPath = `/api/avatars/file/${filename}`;
    try {
      await mkdir(avatarsDir, { recursive: true });
      const filepath = assertInsideDir(avatarsDir, join(avatarsDir, filename));
      await writeFile(filepath, imageBuffer);
      const updated = await enqueueUpdate(personaUpdateQueues, req.params.id, () =>
        storage.updatePersona(req.params.id, { avatarPath, avatarCrop: "" }, { versionReason: "Avatar update" }),
      );
      if (!updated) {
        await removeUnattachedAvatarFile({ avatarPath });
        return reply.status(404).send({ error: "Persona not found" });
      }
      return projectPersona(updated);
    } catch (error) {
      await removeUnattachedAvatarFile({ avatarPath });
      throw error;
    }
  });

  app.put<{ Params: { id: string } }>("/personas/:id/activate", async (req, reply) => {
    const { id } = req.params;
    if (isUnsafePathSegment(id)) {
      return reply.status(400).send({ error: "Invalid persona id" });
    }
    const activated = await storage.setActivePersona(id);
    if (!activated) return reply.status(404).send({ error: "Persona not found" });
    return { success: true };
  });

  app.delete<{ Params: { id: string } }>("/personas/:id", async (req, reply) => {
    const { id } = req.params;
    if (isUnsafePathSegment(id)) {
      return reply.status(400).send({ error: "Invalid persona id" });
    }
    const persona = await storage.getPersona(id);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });

    const galleryImages = await personaGallery.listByPersonaId(id);
    await mutateAvatarReferencesAndCleanup({
      db: app.db,
      collectAvatarPaths: () => collectPersonaAvatarPaths(app.db, [id]),
      mutateReferences: () => storage.removePersona(id),
    });
    for (const image of galleryImages) {
      await unlinkGalleryFileIfUnreferenced({ db: app.db, filePath: image.filePath });
    }
    const localPathPrefix = `personas/${id}/`;
    const hasSharedLocalFile = (
      await Promise.all(
        galleryImages
          .filter((image) => image.filePath.replace(/\\/g, "/").startsWith(localPathPrefix))
          .map((image) => galleryFileHasReferences(app.db, image.filePath)),
      )
    ).some(Boolean);
    const galleryDir = assertInsideDir(PERSONA_GALLERY_ROOT, join(PERSONA_GALLERY_ROOT, id));
    if (!hasSharedLocalFile && existsSync(galleryDir)) {
      rmSync(galleryDir, { recursive: true, force: true });
    }
    return reply.status(204).send();
  });

  // ── Persona Gallery ──

  app.get<{ Params: { id: string } }>("/personas/:id/gallery", async (req, reply) => {
    const persona = await storage.getPersona(req.params.id);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });

    const images = await personaGallery.listByPersonaId(req.params.id);
    return images.map((img) => ({
      ...img,
      url: `/api/characters/personas/${req.params.id}/gallery/file/${encodeURIComponent(img.filePath.split("/").pop()!)}`,
    }));
  });

  app.get<{ Params: { id: string } }>("/personas/:id/gallery/clips", async (req, reply) => {
    const persona = await storage.getPersona(req.params.id);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });

    const personaName = typeof persona.name === "string" && persona.name.trim() ? persona.name.trim() : "Persona";
    const callManifest = await getConversationCallCharacterVideoManifest({
      characterId: req.params.id,
      characterName: personaName,
      avatarPath: persona.avatarPath ?? null,
    });
    const callClips = callManifest.clips.map((clip) => ({
      id: `call:${clip.kind}`,
      source: "conversation-call" as const,
      label: CALL_VIDEO_CLIP_LABELS[clip.kind] ?? clip.kind,
      prompt: "",
      status: clip.status,
      url: clip.url,
      createdAt: clip.updatedAt ?? null,
      updatedAt: clip.updatedAt,
      origin: clip.origin ?? null,
      durationSeconds: null,
      trimStartSeconds: clip.trimStartSeconds ?? null,
      trimEndSeconds: clip.trimEndSeconds ?? null,
      aspectRatio: "16:9",
      provider: "",
      model: "",
      chatId: null,
      chatName: null,
      clipKind: clip.kind,
    }));
    const customCallClips = callManifest.customClips.map((clip) => ({
      id: `custom-call:${clip.id}`,
      source: "conversation-call-custom" as const,
      label: clip.label,
      prompt: clip.prompt,
      status: clip.status,
      url: clip.url,
      createdAt: clip.createdAt,
      updatedAt: clip.updatedAt,
      origin: clip.origin ?? null,
      durationSeconds: null,
      trimStartSeconds: clip.trimStartSeconds ?? null,
      trimEndSeconds: clip.trimEndSeconds ?? null,
      aspectRatio: "16:9",
      provider: "",
      model: "",
      chatId: null,
      chatName: null,
      clipKind: "custom" as const,
    }));

    const chatsStorage = createChatsStorage(app.db);
    const sceneVideos = createGameSceneVideosStorage(app.db);
    const allChats = await chatsStorage.list();
    const relatedChats = allChats.filter((chat) => chat.personaId === req.params.id);
    const sceneVideoGroups = await Promise.all(
      relatedChats.map(async (chat) => ({
        chat,
        videos: await sceneVideos.listByChatId(chat.id),
      })),
    );
    const sceneClips = sceneVideoGroups.flatMap(({ chat, videos }) =>
      videos.map((video) => {
        const filename = video.filePath.split("/").pop() ?? "";
        const routePrefix = chat.mode === "game" ? "/api/game" : "/api/gallery";
        return {
          id: `scene:${video.id}`,
          source: chat.mode === "game" ? ("game-scene" as const) : ("scene-video" as const),
          label: chat.mode === "game" ? "Game scene" : "Scene video",
          prompt: video.prompt,
          status: "ready" as const,
          url: `${routePrefix}/scene-videos/file/${encodeURIComponent(chat.id)}/${encodeURIComponent(filename)}`,
          createdAt: video.createdAt,
          updatedAt: video.createdAt,
          origin: null,
          durationSeconds: video.durationSeconds,
          trimStartSeconds: null,
          trimEndSeconds: null,
          aspectRatio: video.aspectRatio,
          provider: video.provider,
          model: video.model,
          chatId: chat.id,
          chatName: chat.name,
          clipKind: null,
        };
      }),
    );
    const uploadedVideoClips = await listGalleryVideoClips(PERSONA_GALLERY_VIDEO_ROOT, req.params.id, "persona");

    const clips = [...customCallClips, ...callClips, ...uploadedVideoClips, ...sceneClips].sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? "") || 0;
      const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? "") || 0;
      return rightTime - leftTime;
    });

    return { clips, callVideoGenerating: callManifest.generating };
  });

  app.patch<{ Params: { id: string; clipId: string } }>(
    "/personas/:id/gallery/clips/:clipId/trim",
    async (req, reply) => {
      const { id, clipId } = req.params;
      const persona = await storage.getPersona(id);
      if (!persona) return reply.status(404).send({ error: "Persona not found" });

      const body = parseRouteRecord(req.body);
      const { trimStartSeconds, trimEndSeconds } = body;
      if (!isRouteTrimSecondValue(trimStartSeconds) || !isRouteTrimSecondValue(trimEndSeconds)) {
        return reply.status(400).send({ error: "Clip trim values must be numbers, null, or omitted" });
      }

      const customClipId = clipId.slice("custom-call:".length);
      const personaName = typeof persona.name === "string" && persona.name.trim() ? persona.name.trim() : "Persona";
      try {
        if (clipId.startsWith("call:")) {
          const kind = parseConversationCallClipKind(clipId.slice("call:".length));
          if (!kind) return reply.status(400).send({ error: "Invalid call clip kind" });
          return await updateConversationCallCharacterVideoClipTrim({
            characterId: id,
            characterName: personaName,
            avatarPath: persona.avatarPath ?? null,
            kind,
            trimStartSeconds,
            trimEndSeconds,
          });
        }

        if (clipId.startsWith("custom-call:")) {
          if (!/^[A-Za-z0-9_-]{6,80}$/.test(customClipId)) {
            return reply.status(400).send({ error: "Invalid custom clip id" });
          }
          return await updateConversationCallCustomVideoClipTrim({
            characterId: id,
            characterName: personaName,
            avatarPath: persona.avatarPath ?? null,
            clipId: customClipId,
            trimStartSeconds,
            trimEndSeconds,
          });
        }
      } catch (error) {
        if (error instanceof ConversationCallVideoClipNotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        if (error instanceof ConversationCallVideoClipTrimError) {
          return reply.status(400).send({ error: error.message });
        }
        if (error instanceof ConversationCallVideoClipAvatarMismatchError) {
          return reply.status(409).send({ error: error.message });
        }
        if (error instanceof ConversationCallVideoGenerationInProgressError) {
          return reply.status(409).send({ error: error.message });
        }
        throw error;
      }

      return reply.status(400).send({ error: "Unsupported clip type" });
    },
  );

  app.delete<{ Params: { id: string; clipId: string } }>("/personas/:id/gallery/clips/:clipId", async (req, reply) => {
    const { id, clipId } = req.params;
    const persona = await storage.getPersona(id);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });

    if (clipId.startsWith("call:")) {
      const kind = parseConversationCallClipKind(clipId.slice("call:".length));
      if (!kind) return reply.status(400).send({ error: "Invalid call clip kind" });
      const personaName = typeof persona.name === "string" && persona.name.trim() ? persona.name.trim() : "Persona";
      try {
        await deleteConversationCallCharacterVideoClip({
          characterId: id,
          characterName: personaName,
          avatarPath: persona.avatarPath ?? null,
          kind,
        });
      } catch (error) {
        if (error instanceof ConversationCallVideoGenerationInProgressError) {
          return reply.status(409).send({ error: error.message });
        }
        throw error;
      }
      return { success: true };
    }

    if (clipId.startsWith("custom-call:")) {
      const customClipId = clipId.slice("custom-call:".length);
      if (!/^[A-Za-z0-9_-]{6,80}$/.test(customClipId)) {
        return reply.status(400).send({ error: "Invalid custom clip id" });
      }
      const personaName = typeof persona.name === "string" && persona.name.trim() ? persona.name.trim() : "Persona";
      let deleted = false;
      try {
        deleted = await deleteConversationCallCustomVideoClip({
          characterId: id,
          characterName: personaName,
          avatarPath: persona.avatarPath ?? null,
          clipId: customClipId,
        });
      } catch (error) {
        if (error instanceof ConversationCallVideoGenerationInProgressError) {
          return reply.status(409).send({ error: error.message });
        }
        throw error;
      }
      if (!deleted) return reply.status(404).send({ error: "Clip not found" });
      return { success: true };
    }

    if (!clipId.startsWith("scene:")) {
      if (clipId.startsWith("uploaded:")) {
        const deleted = await removeGalleryVideoClip(PERSONA_GALLERY_VIDEO_ROOT, id, clipId);
        if (!deleted) return reply.status(404).send({ error: "Clip not found" });
        return { success: true };
      }
      return reply.status(400).send({ error: "Unsupported clip type" });
    }

    const sceneVideoId = clipId.slice("scene:".length);
    if (!sceneVideoId) return reply.status(400).send({ error: "Invalid scene clip id" });

    const chatsStorage = createChatsStorage(app.db);
    const sceneVideos = createGameSceneVideosStorage(app.db);
    const video = await sceneVideos.getById(sceneVideoId);
    if (!video) return reply.status(404).send({ error: "Clip not found" });

    const chat = await chatsStorage.getById(video.chatId);
    if (!chat || chat.personaId !== id) {
      return reply.status(404).send({ error: "Clip not found" });
    }

    await removeSavedVideoFromDisk(video.filePath);
    await sceneVideos.remove(video.id);
    return { success: true };
  });

  app.post<{ Params: { id: string } }>("/personas/:id/gallery/videos/upload", async (req, reply) => {
    const { id } = req.params;
    const persona = await storage.getPersona(id);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });

    const data = await req.file({ limits: { fileSize: CALL_VIDEO_CLIP_UPLOAD_MAX_BYTES } });
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_GALLERY_VIDEO_EXTS.has(ext)) {
      return reply.status(400).send({ error: `Unsupported video type: ${ext}` });
    }

    const dir = ensureGalleryVideoDir(PERSONA_GALLERY_VIDEO_ROOT, id);
    await mkdir(dir, { recursive: true });
    const videoId = newId();
    const filename = `${videoId}${ext}`;
    const filePath = assertInsideDir(dir, join(dir, filename));
    await pipeline(data.file, createWriteStream(filePath));
    if (isMultipartFileTruncated(data)) {
      await unlink(filePath).catch(() => undefined);
      return reply.status(413).send({ error: "Gallery video uploads must be 250 MB or smaller." });
    }

    const fields = data.fields as Record<string, unknown>;
    const timestamp = new Date().toISOString();
    const manifest = await readGalleryVideoManifest(PERSONA_GALLERY_VIDEO_ROOT, id);
    const entry: GalleryVideoEntry = {
      id: videoId,
      filename,
      label: readMultipartStringField(fields, "label") || labelFromUploadedClipFilename(data.filename),
      prompt: readMultipartStringField(fields, "prompt") || "",
      provider: readMultipartStringField(fields, "provider") || "upload",
      model: readMultipartStringField(fields, "model") || "",
      aspectRatio: readMultipartStringField(fields, "aspectRatio") || "video",
      durationSeconds: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await writeGalleryVideoManifest(PERSONA_GALLERY_VIDEO_ROOT, id, {
      version: 1,
      videos: [entry, ...manifest.videos],
    });
    return toGalleryVideoClip({ entry, entityId: id, entityKind: "persona" });
  });

  app.get<{ Params: { id: string; filename: string } }>(
    "/personas/:id/gallery/videos/file/:filename",
    async (req, reply) => {
      const { id, filename } = req.params;
      if (isUnsafePathSegment(id) || isUnsafePathSegment(filename)) {
        return reply.status(400).send({ error: "Invalid path" });
      }

      const dir = ensureGalleryVideoDir(PERSONA_GALLERY_VIDEO_ROOT, id);
      const filePath = assertInsideDir(dir, join(dir, filename));
      if (!existsSync(filePath)) {
        return reply.status(404).send({ error: "Not found" });
      }

      const video = await validateVideoAssetFile(filePath, filename);
      if (!video) return reply.status(404).send({ error: "Not found" });

      return sendValidatedMediaFile(reply, video, { method: req.method, rangeHeader: req.headers.range });
    },
  );

  app.post<{ Params: { id: string } }>("/personas/:id/gallery/clips/upload", async (req, reply) => {
    const { id } = req.params;
    const persona = await storage.getPersona(id);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });

    const data = await req.file({ limits: { fileSize: CALL_VIDEO_CLIP_UPLOAD_MAX_BYTES } });
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_CALL_VIDEO_CLIP_UPLOAD_EXTS.has(ext)) {
      return reply.status(400).send({ error: "Video call clips must be MP4 files." });
    }

    let buffer: Buffer;
    try {
      buffer = await readCallVideoClipUploadBuffer(data);
    } catch (error) {
      if (error instanceof CallVideoClipUploadTooLargeError) {
        return reply.status(413).send({ error: error.message });
      }
      throw error;
    }
    if (buffer.length > CALL_VIDEO_CLIP_UPLOAD_MAX_BYTES) {
      return reply.status(413).send({ error: "Video call clip uploads must be 250 MB or smaller." });
    }

    const fields = data.fields as Record<string, unknown>;
    const requestedKind = readMultipartStringField(fields, "kind");
    const kind = requestedKind ? parseConversationCallClipKind(requestedKind) : null;
    if (requestedKind && !kind) {
      return reply.status(400).send({ error: "Invalid call clip kind" });
    }
    const personaName = typeof persona.name === "string" && persona.name.trim() ? persona.name.trim() : "Persona";
    const label = readMultipartStringField(fields, "label") || labelFromUploadedClipFilename(data.filename);
    try {
      return await uploadConversationCallCharacterVideoClip({
        characterId: id,
        characterName: personaName,
        avatarPath: persona.avatarPath ?? null,
        buffer,
        label,
        kind,
      });
    } catch (error) {
      if (error instanceof ConversationCallVideoClipUploadError) {
        return reply.status(400).send({ error: error.message });
      }
      if (error instanceof ConversationCallVideoGenerationInProgressError) {
        return reply.status(409).send({ error: error.message });
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>("/personas/:id/gallery/upload", async (req, reply) => {
    const { id } = req.params;
    const persona = await storage.getPersona(id);
    if (!persona) return reply.status(404).send({ error: "Persona not found" });

    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_GALLERY_EXTS.has(ext)) {
      return reply.status(400).send({ error: `Unsupported file type: ${ext}` });
    }

    const dir = await ensurePersonaGalleryDir(id);
    const filename = `${newId()}${ext}`;
    const filePath = join(dir, filename);

    await pipeline(data.file, createWriteStream(filePath));

    const fields = data.fields as Record<string, { value?: string } | undefined>;
    const prompt = fields?.prompt?.value ?? "";
    const provider = fields?.provider?.value ?? "";
    const model = fields?.model?.value ?? "";
    const width = fields?.width?.value ? parseInt(fields.width.value, 10) : undefined;
    const height = fields?.height?.value ? parseInt(fields.height.value, 10) : undefined;

    try {
      const image = await personaGallery.create({
        personaId: id,
        filePath: `personas/${id}/${filename}`,
        prompt,
        provider,
        model,
        width: Number.isFinite(width) ? width : undefined,
        height: Number.isFinite(height) ? height : undefined,
      });

      return {
        ...image,
        url: `/api/characters/personas/${id}/gallery/file/${encodeURIComponent(filename)}`,
      };
    } catch (err) {
      // Roll back the just-written file so a metadata failure can't strand an orphan on disk.
      if (existsSync(filePath)) unlinkSync(filePath);
      logger.error(err, "Failed to persist persona gallery image for %s", id);
      return reply.status(500).send({ error: "Failed to save image metadata" });
    }
  });

  app.get<{ Params: { id: string; filename: string } }>("/personas/:id/gallery/file/:filename", async (req, reply) => {
    const { id, filename } = req.params;
    if (isUnsafePathSegment(id) || isUnsafePathSegment(filename)) {
      return reply.status(400).send({ error: "Invalid path" });
    }

    const image = findGalleryRowByFilename(await personaGallery.listByPersonaId(id), filename);
    const storedFile = image ? resolveStoredGalleryFile(image.filePath) : null;
    if (!storedFile || !existsSync(storedFile.absolutePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    const validatedImage = await validateImageAssetFile(storedFile.absolutePath, storedFile.filename);
    if (!validatedImage) return reply.status(404).send({ error: "Not found" });

    return sendValidatedMediaFile(reply, validatedImage, { method: req.method, rangeHeader: req.headers.range });
  });

  app.delete<{ Params: { id: string; imageId: string } }>("/personas/:id/gallery/:imageId", async (req, reply) => {
    const { id, imageId } = req.params;
    const image = await personaGallery.getById(imageId);
    if (!image || image.personaId !== id) {
      return reply.status(404).send({ error: "Not found" });
    }

    await personaGallery.remove(imageId);
    await enqueueUpdate(personaUpdateQueues, id, async () => {
      const persona = await storage.getPersona(id);
      if (!persona || persona.characterSheetImageId !== imageId) return persona;
      return storage.updatePersona(
        id,
        { characterSheetImageId: null, useCharacterSheetAsReference: "false" },
        { skipVersionSnapshot: true },
      );
    });
    await unlinkGalleryFileIfUnreferenced({ db: app.db, filePath: image.filePath });
    return { success: true };
  });

  app.post<{ Params: { id: string; imageId: string } }>("/personas/:id/gallery/:imageId/avatar", async (req, reply) => {
    const { id, imageId } = req.params;
    const image = await personaGallery.getById(imageId);
    if (!image || image.personaId !== id) {
      return reply.status(404).send({ error: "Gallery image not found" });
    }

    let avatarPath: string | null = null;
    try {
      avatarPath = await copyGalleryImageToAvatar("persona", id, image.filePath);
      // The previous crop was normalized against the old image's framing, so
      // it must not carry over to the replacement avatar.
      const updated = await enqueueUpdate(personaUpdateQueues, id, () =>
        storage.updatePersona(id, { avatarPath, avatarCrop: "" }, { versionReason: "Avatar update" }),
      );
      if (!updated) {
        await removeUnattachedAvatarFile({ avatarPath });
        return reply.status(404).send({ error: "Persona not found" });
      }
      return projectPersona(updated);
    } catch (error) {
      if (avatarPath) await removeUnattachedAvatarFile({ avatarPath });
      logger.warn(error, "Failed to set persona %s avatar from gallery image %s", id, imageId);
      return reply.status(400).send({ error: "Gallery image could not be used as an avatar" });
    }
  });

  app.patch<{
    Params: { id: string; imageId: string };
    Body: { customKind?: string | null; customName?: string | null; width?: number; height?: number };
  }>("/personas/:id/gallery/:imageId/tag", async (req, reply) => {
    const { id, imageId } = req.params;
    const image = await personaGallery.getById(imageId);
    if (!image || image.personaId !== id) {
      return reply.status(404).send({ error: "Not found" });
    }
    const kind = req.body?.customKind ?? null;
    if (kind !== null && kind !== "emoji" && kind !== "sticker") {
      return reply.status(400).send({ error: "Invalid customKind" });
    }
    const name = typeof req.body?.customName === "string" ? req.body.customName.trim() : "";
    const error = validateCustomTagPayload(kind, name, req.body?.width, req.body?.height);
    if (error) return reply.status(400).send({ error });

    return personaGallery.setTag(imageId, {
      customKind: kind,
      customName: kind === null ? null : name,
      width: kind !== null && typeof req.body?.width === "number" ? req.body.width : undefined,
      height: kind !== null && typeof req.body?.height === "number" ? req.body.height : undefined,
    });
  });

  // ── Persona Duplicate ──
  app.post<{ Params: { id: string } }>("/personas/:id/duplicate", async (req, reply) => {
    const result = await storage.duplicatePersona(req.params.id);
    if (!result) return reply.status(404).send({ error: "Persona not found" });
    return projectPersona(result);
  });

  // ── Persona Export ──

  app.get<{ Params: { id: string }; Querystring: { format?: ExportFormat } }>(
    "/personas/:id/export",
    async (req, reply) => {
      const persona = await storage.getPersona(req.params.id);
      if (!persona) return reply.status(404).send({ error: "Persona not found" });
      const compatible = req.query.format === "compatible";
      const canonical = canonicalizePersonaForExport(persona as Record<string, unknown>);
      const payload = compatible
        ? buildCompatiblePersonaExport(canonical.row)
        : await buildNativePersonaEnvelope(canonical.row, personaGallery);
      return reply
        .header(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(toSafeExportName(canonical.usesFallbackName ? "" : String(canonical.row.name), "unnamed-persona"))}.${compatible ? "json" : "marinara.json"}"`,
        )
        .send(payload);
    },
  );

  app.post("/personas/export-bulk", async (req, reply) => {
    const { ids, format = "native" } = req.body as { ids?: string[]; format?: ExportFormat };
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ error: "ids array is required" });
    }

    const zip = new AdmZip();
    let exportedCount = 0;
    for (const id of ids) {
      const persona = await storage.getPersona(id);
      if (!persona) continue;
      const canonical = canonicalizePersonaForExport(persona as Record<string, unknown>);
      const payload =
        format === "compatible"
          ? buildCompatiblePersonaExport(canonical.row)
          : await buildNativePersonaEnvelope(canonical.row, personaGallery);
      zip.addFile(
        `${toSafeExportName(
          canonical.usesFallbackName ? "" : String(canonical.row.name),
          `unnamed-persona-${exportedCount + 1}`,
        )}.${format === "compatible" ? "json" : "marinara.json"}`,
        Buffer.from(JSON.stringify(payload, null, 2), "utf-8"),
      );
      exportedCount++;
    }

    if (exportedCount === 0) {
      return reply.status(404).send({ error: "No personas found for the provided ids" });
    }

    return reply
      .header("Content-Type", "application/zip")
      .header(
        "Content-Disposition",
        `attachment; filename="${format === "compatible" ? "compatible-personas.zip" : "marinara-personas.zip"}"`,
      )
      .send(zip.toBuffer());
  });

  // ── Character Groups ──

  app.get("/groups/list", async () => {
    return storage.listGroups();
  });

  app.get<{ Params: { id: string } }>("/groups/:id", async (req, reply) => {
    const group = await storage.getGroupById(req.params.id);
    if (!group) return reply.status(404).send({ error: "Group not found" });
    return group;
  });

  app.post("/groups", async (req) => {
    const input = createGroupSchema.parse(req.body);
    return storage.createGroup(input.name, input.description ?? "", input.characterIds ?? []);
  });

  app.patch<{ Params: { id: string } }>("/groups/:id", async (req) => {
    const input = updateGroupSchema.parse(req.body);
    return storage.updateGroup(req.params.id, input);
  });

  app.delete<{ Params: { id: string } }>("/groups/:id", async (req, reply) => {
    await storage.removeGroup(req.params.id);
    return reply.status(204).send();
  });

  // ── Persona Groups ──

  app.get("/persona-groups/list", async () => {
    return storage.listPersonaGroups();
  });

  app.get<{ Params: { id: string } }>("/persona-groups/:id", async (req, reply) => {
    const group = await storage.getPersonaGroupById(req.params.id);
    if (!group) return reply.status(404).send({ error: "Persona group not found" });
    return group;
  });

  app.post("/persona-groups", async (req) => {
    const input = createPersonaGroupSchema.parse(req.body);
    return storage.createPersonaGroup(input.name, input.description ?? "", input.personaIds ?? []);
  });

  app.patch<{ Params: { id: string } }>("/persona-groups/:id", async (req) => {
    const input = updatePersonaGroupSchema.parse(req.body);
    return storage.updatePersonaGroup(req.params.id, input);
  });

  app.delete<{ Params: { id: string } }>("/persona-groups/:id", async (req, reply) => {
    await storage.removePersonaGroup(req.params.id);
    return reply.status(204).send();
  });
}

// ── PNG helpers ──

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Create a minimal 1×1 transparent PNG (for characters without avatars). */
export function createMinimalPng(): Buffer {
  // IHDR chunk data: 1×1, 8-bit RGBA
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0); // width
  ihdrData.writeUInt32BE(1, 4); // height
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type (RGBA)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  // IDAT: deflate-compressed scanline (filter byte 0 + 4 zero bytes for transparent pixel)
  // Pre-computed deflate of [0, 0, 0, 0, 0]
  const idatData = Buffer.from([0x78, 0x01, 0x62, 0x60, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x05, 0x00, 0x01]);

  const chunks: Buffer[] = [
    PNG_SIGNATURE,
    buildChunk("IHDR", ihdrData),
    buildChunk("IDAT", idatData),
    buildChunk("IEND", Buffer.alloc(0)),
  ];
  return Buffer.concat(chunks);
}

/** Build a single PNG chunk (length + type + data + CRC). */
function buildChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput) >>> 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function readPngTextKeyword(chunkType: string, chunkData: Buffer): string | null {
  // zTXt keywords sit at the same null-terminated position; without it, a
  // re-exported Character Tavern card would keep stale compressed chara data
  // alongside the freshly injected tEXt chunk.
  if (chunkType !== "tEXt" && chunkType !== "iTXt" && chunkType !== "zTXt") return null;

  const nullIdx = chunkData.indexOf(0);
  if (nullIdx <= 0) return null;
  return chunkData.subarray(0, nullIdx).toString("latin1");
}

/** Inject a tEXt chunk into an existing PNG buffer, right before the first IDAT. */
export function injectTextChunk(png: Buffer, keyword: string, text: string): Buffer {
  // Validate PNG signature
  if (png.subarray(0, 8).compare(PNG_SIGNATURE) !== 0) {
    throw new Error("Invalid PNG signature");
  }

  // Build the tEXt chunk: keyword\0text
  const textData = Buffer.concat([Buffer.from(keyword, "latin1"), Buffer.from([0]), Buffer.from(text, "latin1")]);
  const textChunk = buildChunk("tEXt", textData);

  // Walk chunks, insert before first IDAT
  const parts: Buffer[] = [PNG_SIGNATURE];
  let offset = 8;
  let inserted = false;

  while (offset < png.length) {
    const chunkLen = png.readUInt32BE(offset);
    const chunkType = png.subarray(offset + 4, offset + 8).toString("ascii");
    const totalChunkSize = 4 + 4 + chunkLen + 4; // length + type + data + crc
    const chunkBuf = png.subarray(offset, offset + totalChunkSize);
    const chunkData = png.subarray(offset + 8, offset + 8 + chunkLen);
    const embeddedKeyword = readPngTextKeyword(chunkType, chunkData);

    if (embeddedKeyword && CHARACTER_CARD_PNG_KEYWORDS.has(embeddedKeyword)) {
      offset += totalChunkSize;
      continue;
    }

    if (chunkType === "IDAT" && !inserted) {
      parts.push(textChunk);
      inserted = true;
    }
    parts.push(chunkBuf);
    offset += totalChunkSize;
  }

  // If no IDAT found (shouldn't happen), append before end
  if (!inserted) {
    parts.splice(parts.length - 1, 0, textChunk);
  }

  return Buffer.concat(parts);
}

/** CRC-32 as used by PNG (ISO 3309 / ITU-T V.42). */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
