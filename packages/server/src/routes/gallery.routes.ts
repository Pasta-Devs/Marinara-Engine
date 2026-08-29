// ──────────────────────────────────────────────
// Routes: Chat Gallery (upload, list, delete, serve)
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply } from "fastify";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from "fs";
import { writeFile } from "fs/promises";
import { basename, extname, join } from "path";
import { z } from "zod";
import {
  findImageStyleProfile,
  LOCAL_SIDECAR_CONNECTION_ID,
  resolveGameSetupArtStylePrompt,
  VIDEO_GENERATION_SETTINGS_KEY,
  normalizeVideoGenerationUserSettings,
  type GameSceneVideoAspectRatio,
  type GeneratedSceneVideo,
} from "@marinara-engine/shared";
import { createGalleryStorage } from "../services/storage/gallery.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createCharacterGalleryStorage } from "../services/storage/character-gallery.storage.js";
import { createPersonaGalleryStorage } from "../services/storage/persona-gallery.storage.js";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createAgentsStorage } from "../services/storage/agents.storage.js";
import { createGameSceneVideosStorage } from "../services/storage/game-scene-videos.storage.js";
import { createPromptOverridesStorage } from "../services/storage/prompt-overrides.storage.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import { loadGameVideoPrompt } from "../services/video/game-video-prompt.js";
import {
  generateVideo,
  removeSavedVideoFromDisk,
  saveVideoToDisk,
  type VideoReferenceImage,
} from "../services/video/video-generation.js";
import { resolveGameVideoRuntime } from "../services/video/game-video-runtime.js";
import { generateImage, removeSavedImageFromDisk, saveImageToDisk } from "../services/image/image-generation.js";
import { resolveGalleryImagePath } from "../services/image/gallery-image-path.js";
import {
  resolveConnectionImageDefaults,
  resolveConnectionImageQuality,
} from "../services/image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../services/image/image-generation-settings.js";
import {
  compileImagePrompt,
  formatImageStylePromptGuidance,
  resolveImageStyleGuidanceText,
} from "../services/image/image-prompt-compiler.js";
import {
  resolveImagePromptReviewSize,
  resolveReviewedImagePromptSubmission,
} from "../services/image/image-prompt-review.js";
import { buildBackgroundProviderPrompt } from "../services/game/game-asset-generation.js";
import { runImageGenerationRequest } from "../services/image/image-generation-queue.js";
import { generateIllustratorImageVariants } from "../services/image/illustrator-image-variants.js";
import { persistGeneratedImageToEntityGalleries } from "../services/image/generated-image-entity-gallery.js";
import { deleteChatGalleryImageEverywhere } from "../services/image/chat-gallery-cascade-deletion.js";
import {
  findGalleryRowByFilename,
  resolveStoredGalleryFile,
  storedGalleryFilename,
} from "../services/image/gallery-file-lifecycle.js";
import {
  resolveImageConnectionFallback,
  resolveVideoConnectionFallback,
} from "../services/generation/media-connection-fallback.js";
import { resolveIllustratorPromptRuntime } from "../services/generation/illustrator-prompt-runtime.js";
import { resolveIllustratorImageConnectionId } from "../services/generation/illustrator-background-generation.js";
import { resolveConversationSelfieSystemPrompt } from "../services/conversation/selfie-prompt.js";
import { appendImagePromptInstructions } from "../services/generation/image-prompt-instructions.js";
import {
  suppressesReferencePromptLine,
  resolveIllustratorCharacterReferences,
} from "./generate/illustrator-references.js";
import { resolveBaseUrl } from "./generate/generate-route-utils.js";
import {
  compactVideoPromptText,
  excerptIllustrationPromptForVideo,
  resolveGalleryVideoNarrationSummary,
  resolveGalleryVideoSourceExchange,
} from "../services/video/prompt-context.js";
import { resolveSceneVideoPrompt, SceneVideoPromptReviewError } from "../services/video/scene-video-prompt-review.js";
import {
  buildRoleplayVideoDirectionMessages,
  resolveRoleplayVideoDirection,
} from "../services/video/roleplay-video-direction.js";
import { isDebugAgentsEnabled } from "../config/runtime-config.js";
import { newId } from "../utils/id-generator.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { assertInsideDir, isAllowedImageBuffer } from "../utils/security.js";
import {
  sendValidatedMediaFile,
  validateImageAssetFile,
  validateVideoAssetFile,
} from "../utils/media-file-security.js";
import { logger, logDebugOverride } from "../lib/logger.js";

const GALLERY_DIR = join(DATA_DIR, "gallery");
const SPRITES_DIR = join(DATA_DIR, "sprites");
const GAME_SCENE_VIDEOS_ROOT = join(DATA_DIR, "game-scene-videos");
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const GALLERY_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const SPRITE_FILE_RE = /\.(png|jpg|jpeg|gif|webp|avif|svg)$/i;
const SCENE_VIDEO_FILENAME_RE = /^[A-Za-z0-9_-]+\.mp4$/;
const SCENE_VIDEO_GENERATION_TIMEOUT_MS = 31 * 60 * 1000;

type SceneVideoRow = NonNullable<Awaited<ReturnType<ReturnType<typeof createGameSceneVideosStorage>["getById"]>>>;
type ChatGalleryImageRow = NonNullable<Awaited<ReturnType<ReturnType<typeof createGalleryStorage>["getById"]>>>;
type ChatRow = NonNullable<Awaited<ReturnType<ReturnType<typeof createChatsStorage>["getById"]>>>;

interface ChatAssetBrowserItem {
  id: string;
  kind: "chat-gallery" | "character-gallery" | "persona-gallery" | "sprite";
  ownerType: "chat" | "character" | "persona";
  ownerId: string;
  ownerName: string;
  name: string;
  prompt: string;
  width: number | null;
  height: number | null;
  createdAt: string | null;
  url: string;
  cardUrl: string;
}

const generateSceneVideoSchema = z.object({
  chatId: z.string().min(1),
  galleryImageId: z.string().max(200).optional(),
  durationSeconds: z.number().int().min(1).max(60).optional(),
  aspectRatio: z.enum(["16:9", "9:16"]).optional(),
  promptOverride: z.string().trim().min(1).max(20_000).optional(),
  queueMediaGenerationRequests: z.boolean().optional().default(true),
  debugMode: z.boolean().optional().default(false),
});

type GenerateSceneVideoInput = z.infer<typeof generateSceneVideoSchema>;

class GallerySceneVideoRequestError extends Error {
  constructor(
    readonly statusCode: 400 | 404 | 502,
    message: string,
  ) {
    super(message);
    this.name = "GallerySceneVideoRequestError";
  }
}

const generateConversationSelfieSchema = z.object({
  characterId: z.string().min(1),
  context: z.string().max(2000).optional(),
  promptOverride: z.string().trim().min(1).max(200_000).optional(),
  negativePromptOverride: z.string().max(200_000).optional(),
  previewOnly: z.boolean().optional().default(false),
  queueImageGenerationRequests: z.boolean().optional().default(true),
  debugMode: z.boolean().optional().default(false),
});

const mapsArtworkContextSchema = z
  .object({
    locationName: z.string().trim().max(200),
    locationDescription: z.string().trim().max(7_000),
    locationType: z.string().trim().max(120),
    parentLocationName: z.string().trim().max(200),
    parentLocationDescription: z.string().trim().max(7_000),
    locationPath: z.string().trim().max(2_000),
  })
  .strict();

const generateGalleryImageSchema = z.object({
  prompt: z.string().trim().min(1).max(7_000),
  title: z.string().trim().min(1).max(200).optional(),
  mapsArtworkContext: mapsArtworkContextSchema.optional(),
  promptOverride: z.string().trim().min(1).max(200_000).optional(),
  negativePromptOverride: z.string().max(200_000).optional(),
  debugMode: z.boolean().optional().default(false),
});

const previewGalleryImagesSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(200),
        title: z.string().trim().min(1).max(200),
        prompt: z.string().trim().min(1).max(7_000),
        mapsArtworkContext: mapsArtworkContextSchema.optional(),
      }),
    )
    .min(1)
    .max(500),
  debugMode: z.boolean().optional().default(false),
});

class GalleryImageRequestError extends Error {
  constructor(
    readonly statusCode: 400 | 404,
    message: string,
  ) {
    super(message);
    this.name = "GalleryImageRequestError";
  }
}

function sceneVideoUrl(chatId: string, filePath: string): string {
  const filename = filePath.split(/[\\/]/).pop() ?? "";
  return `/api/gallery/scene-videos/file/${encodeURIComponent(chatId)}/${encodeURIComponent(filename)}`;
}

function serializeSceneVideo(row: SceneVideoRow): GeneratedSceneVideo {
  const aspectRatio: GameSceneVideoAspectRatio = row.aspectRatio === "9:16" ? "9:16" : "16:9";
  return {
    id: row.id,
    chatId: row.chatId,
    filePath: row.filePath,
    url: sceneVideoUrl(row.chatId, row.filePath),
    sourceIllustrationTag: row.sourceIllustrationTag ?? null,
    sourceIllustrationPath: row.sourceIllustrationPath ?? null,
    prompt: row.prompt,
    provider: row.provider,
    model: row.model,
    durationSeconds: row.durationSeconds,
    aspectRatio,
    createdAt: row.createdAt,
  };
}

// Reject any chatId segment that could escape GALLERY_DIR (traversal, absolute
// path separators, empty, or NUL byte). Mirrors avatars.routes.ts isValidFilename
// but adds the empty/null-byte guards the gallery serve route omits.
export function isValidChatId(chatId: string): boolean {
  return (
    chatId.length > 0 &&
    !chatId.includes("..") &&
    !chatId.includes("/") &&
    !chatId.includes("\\") &&
    !chatId.includes("\0")
  );
}

function ensureDir(chatId: string) {
  const dir = join(GALLERY_DIR, chatId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function parseChatMetadata(raw: unknown): Record<string, unknown> {
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

function buildGalleryImageUrl(image: { chatId?: string; filePath: string }, fallbackChatId: string) {
  const ownerChatId = image.chatId || fallbackChatId;
  const filename = storedGalleryFilename(image.filePath);
  return `/api/gallery/file/${encodeURIComponent(ownerChatId)}/${encodeURIComponent(filename)}`;
}

function expectedImageExt(ext: string): string {
  return ext === ".jpeg" ? "jpg" : ext.slice(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseJsonRecord(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRecord(raw) ? raw : {};
}

function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((value): value is string => typeof value === "string" && value.length > 0);
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];
  } catch {
    return [];
  }
}

function isSafeAssetSegment(value: string): boolean {
  return (
    value.length > 0 && !value.includes("..") && !value.includes("/") && !value.includes("\\") && !value.includes("\0")
  );
}

function getStoredFilename(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}

function cardUrl(scope: string, ...segments: string[]): string {
  return `card://${scope}/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function getCharacterName(row: { data: unknown } | null, fallback: string): string {
  const data = parseJsonRecord(row?.data);
  return typeof data.name === "string" && data.name.trim() ? data.name.trim() : fallback;
}

function getPersonaName(row: { name?: string | null } | null, fallback: string): string {
  return typeof row?.name === "string" && row.name.trim() ? row.name.trim() : fallback;
}

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function resolveGalleryImageConnection(
  app: FastifyInstance,
  chatMode: string,
  metadata: Record<string, unknown>,
) {
  const agents = createAgentsStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const illustrator = await agents.getByType("illustrator").catch((err) => {
    logger.warn(err, "[gallery/generate-image] Failed to read Illustrator settings");
    return null;
  });
  const configuredId = resolveIllustratorImageConnectionId(
    chatMode,
    metadata,
    parseJsonRecord(illustrator?.settings).imageConnectionId,
  );
  let connection = configuredId ? await connections.getWithKey(configuredId) : null;
  if (configuredId && connection?.provider !== "image_generation") {
    connection = null;
  }
  if (configuredId && !connection) {
    logger.warn(
      "[gallery/generate-image] Image connection %s could not be resolved; using the default Images connection",
      configuredId,
    );
  }
  connection ??= await connections.getDefaultForImageGeneration();
  return { connection, connections };
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function getCharacterAppearance(data: Record<string, unknown>): string {
  const extensions = parseJsonRecord(data.extensions);
  const appearance =
    typeof extensions.appearance === "string"
      ? extensions.appearance
      : typeof data.appearance === "string"
        ? data.appearance
        : typeof data.description === "string"
          ? data.description
          : "";
  return appearance.trim();
}

function titleCaseSlug(value: string): string {
  return value
    .split(/[-_:\s]+/)
    .map((part) => (part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : ""))
    .filter(Boolean)
    .join(" ");
}

function sceneTitleFromGalleryImage(image: ChatGalleryImageRow): string {
  const promptTitle = excerptIllustrationPromptForVideo(image.prompt, 96);
  if (promptTitle) return promptTitle;
  const filename = basename(image.filePath).replace(/\.[^.]+$/, "");
  return titleCaseSlug(filename) || "Selected illustration";
}

function sourceGalleryImagePathForMetadata(image: ChatGalleryImageRow): string {
  return `gallery/${image.filePath.replace(/\\/g, "/")}`;
}

function imageMimeTypeForPath(path: string): VideoReferenceImage["mimeType"] | null {
  const ext = extname(path).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return null;
}

function readSceneVideoReferenceImage(path: string, url?: string | null): VideoReferenceImage {
  const mimeType = imageMimeTypeForPath(path);
  if (!mimeType) throw new Error("Scene videos require a PNG or JPEG gallery image");
  return { base64: readFileSync(path).toString("base64"), mimeType, url };
}

function buildRoleplayVideoSettingLine(chat: ChatRow, meta: Record<string, unknown>, maxPartLength: number): string {
  const parts = [
    readTrimmedString(meta.groupScenarioText),
    readTrimmedString(meta.scenario),
    readTrimmedString(meta.sceneInstructions),
    readTrimmedString(meta.background),
    chat.name,
  ].filter((part): part is string => Boolean(part));
  const setting = Array.from(new Set(parts.map((part) => compactVideoPromptText(part, maxPartLength)).filter(Boolean)));
  return setting.length ? setting.join("; ") : "Current roleplay scene";
}

async function resolveSceneVideoConnectionId(
  meta: Record<string, unknown>,
  connections: ReturnType<typeof createConnectionsStorage>,
): Promise<string | null> {
  const chatConnectionId =
    readTrimmedString(meta.sceneVideoConnectionId) ?? readTrimmedString(meta.gameVideoConnectionId);
  if (chatConnectionId) return chatConnectionId;

  const defaultConnection = await connections.getDefaultForVideoGeneration();
  return defaultConnection?.id ?? null;
}

function createResponseAbortSignal(reply: FastifyReply, timeoutMs: number, label: string): AbortSignal {
  const controller = new AbortController();
  let finished = false;
  const timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`));
    }
  }, timeoutMs);
  timeout.unref?.();

  const cleanup = () => {
    clearTimeout(timeout);
    reply.raw.off("finish", onFinish);
    reply.raw.off("close", onClose);
  };
  const onFinish = () => {
    finished = true;
    cleanup();
  };
  const onClose = () => {
    if (!finished && !controller.signal.aborted) {
      controller.abort(new Error(`${label} cancelled because the client disconnected`));
    }
    cleanup();
  };

  reply.raw.once("finish", onFinish);
  reply.raw.once("close", onClose);
  return controller.signal;
}

function buildSpriteAssets(
  ownerId: string,
  ownerName: string,
  ownerType: "character" | "persona",
): ChatAssetBrowserItem[] {
  const dir = join(SPRITES_DIR, ownerId);
  if (!existsSync(dir)) return [];

  try {
    return readdirSync(dir)
      .filter((filename) => SPRITE_FILE_RE.test(filename))
      .sort((a, b) => a.localeCompare(b))
      .map((filename) => {
        const ext = extname(filename);
        const expression = filename.slice(0, -ext.length);
        const cleanExpression = expression.replace(/^full[_-]/i, "");
        const mtime = statSync(join(dir, filename)).mtimeMs;
        return {
          id: `sprite:${ownerType}:${ownerId}:${filename}`,
          kind: "sprite" as const,
          ownerType,
          ownerId,
          ownerName,
          name: cleanExpression || filename,
          prompt: "",
          width: null,
          height: null,
          createdAt: null,
          url: `/api/sprites/${encodeURIComponent(ownerId)}/file/${encodeURIComponent(filename)}?v=${Math.floor(mtime)}`,
          cardUrl: cardUrl("sprites", ownerId, filename),
        };
      });
  } catch {
    return [];
  }
}

function spriteMatchesTarget(filename: string, category: "facial" | "fullbody", target: string): boolean {
  const ext = extname(filename);
  const expression = filename.slice(0, -ext.length).toLowerCase();
  const targetExt = extname(target);
  const targetBase = (targetExt ? target.slice(0, -targetExt.length) : target).toLowerCase();
  const targetFile = target.toLowerCase();

  if (targetExt && filename.toLowerCase() === targetFile) return true;

  if (category === "facial") {
    if (/^full[_-]/i.test(expression)) return false;
    return expression === targetBase;
  }

  return (
    expression === targetBase ||
    expression === `full_${targetBase}` ||
    expression.replace(/^full[_-]/, "") === targetBase
  );
}

export async function galleryRoutes(app: FastifyInstance) {
  const storage = createGalleryStorage(app.db);
  const chats = createChatsStorage(app.db);
  const characters = createCharactersStorage(app.db);
  const characterGallery = createCharacterGalleryStorage(app.db);
  const personaGallery = createPersonaGalleryStorage(app.db);

  async function resolveGalleryImageGenerationContext(chatId: string, debugMode: boolean) {
    const chat = await chats.getById(chatId);
    if (!chat) throw new GalleryImageRequestError(404, "Chat not found");
    if (!new Set(["roleplay", "game"]).has(chat.mode)) {
      throw new GalleryImageRequestError(400, "Gallery image generation is available in Roleplay and Game modes.");
    }

    const metadata = parseChatMetadata(chat.metadata);
    if (chat.mode === "game" && metadata.enableSpriteGeneration !== true) {
      throw new GalleryImageRequestError(400, "Enable Game Illustrator in Chat Settings before creating map artwork.");
    }
    if (chat.mode === "game" && !readTrimmedString(metadata.gameImageConnectionId)) {
      throw new GalleryImageRequestError(400, "Choose the Game Illustrator image connection in Chat Settings first.");
    }
    const { connection: imageConnection, connections } = await resolveGalleryImageConnection(app, chat.mode, metadata);
    if (!imageConnection) {
      throw new GalleryImageRequestError(
        400,
        "Choose an image connection for Illustrator or set a default Images connection first.",
      );
    }

    const debugOverrideEnabled = debugMode || isDebugAgentsEnabled();
    const debugLog = (message: string, ...args: unknown[]) => {
      logDebugOverride(debugOverrideEnabled, message, ...args);
    };
    const imageSettings = await loadImageGenerationUserSettings(app.db);
    const imageDefaults = resolveConnectionImageDefaults(imageConnection);
    const setupConfig = parseJsonRecord(metadata.gameSetupConfig);
    const styleProfileId =
      readTrimmedString(setupConfig.imageStyleProfileId) ??
      readTrimmedString(metadata.imageStyleProfileId) ??
      imageDefaults?.styleProfileId ??
      imageSettings.styleProfiles.defaultProfileId;
    const styleProfile = findImageStyleProfile(imageSettings.styleProfiles, styleProfileId);
    const artStyle = resolveGameSetupArtStylePrompt(setupConfig);
    const genre = readTrimmedString(setupConfig.genre);
    const setting = readTrimmedString(setupConfig.setting);
    const worldOverview = readTrimmedString(metadata.gameWorldOverview);
    const imagePromptInstructions = readTrimmedString(metadata.gameImagePromptInstructions);
    const imageModel = imageConnection.model || "";
    const imageBaseUrl = imageConnection.baseUrl || "https://image.pollinations.ai";
    const imageSource = imageConnection.imageGenerationSource || imageModel;
    const imageServiceHint = imageConnection.imageService || imageSource;
    const imageFallback = await resolveImageConnectionFallback(connections, imageConnection.id);

    return {
      chat,
      imageConnection,
      imageSettings,
      imageDefaults,
      styleProfileId,
      styleProfile,
      artStyle,
      genre,
      setting,
      worldOverview,
      imagePromptInstructions,
      imageModel,
      imageBaseUrl,
      imageSource,
      imageServiceHint,
      imageFallback,
      debugLog,
      promptOverridesStorage: createPromptOverridesStorage(app.db),
    };
  }

  async function compileGalleryImageRequest(
    context: Awaited<ReturnType<typeof resolveGalleryImageGenerationContext>>,
    input: {
      title?: string;
      prompt: string;
      mapsArtworkContext?: z.infer<typeof mapsArtworkContextSchema>;
      promptOverride?: string;
      negativePromptOverride?: string;
    },
  ) {
    const compiled = await buildBackgroundProviderPrompt({
      chatId: context.chat.id,
      locationSlug: input.title?.trim() || "Gallery image",
      sceneDescription: input.prompt.trim(),
      mapsArtworkContext: {
        locationName: input.mapsArtworkContext?.locationName || input.title?.trim() || "Gallery image",
        locationDescription: input.mapsArtworkContext?.locationDescription || input.prompt.trim(),
        locationType: input.mapsArtworkContext?.locationType || "Location",
        parentLocationName: input.mapsArtworkContext?.parentLocationName || "",
        parentLocationDescription: input.mapsArtworkContext?.parentLocationDescription || "",
        locationPath:
          input.mapsArtworkContext?.locationPath || input.mapsArtworkContext?.locationName || input.title?.trim() || "",
        genre: context.genre ?? "",
        campaignArtStyle: context.artStyle,
        imageInstructions: context.imagePromptInstructions ?? "",
      },
      imgModel: context.imageModel,
      imgBaseUrl: context.imageBaseUrl,
      imgApiKey: context.imageConnection.apiKey || "",
      imgSource: context.imageSource,
      imgService: context.imageServiceHint,
      imgEndpointId: context.imageConnection.imageEndpointId || undefined,
      imgComfyWorkflow: context.imageConnection.comfyuiWorkflow || undefined,
      imgDefaults: context.imageDefaults,
      imgFallback: context.imageFallback,
      styleProfiles: context.imageSettings.styleProfiles,
      styleProfileId: context.styleProfileId,
      promptOverridesStorage: context.promptOverridesStorage,
      size: context.imageSettings.background,
      preserveFullBackgroundPrompt: true,
    });
    const reviewed = resolveReviewedImagePromptSubmission({
      generatedPrompt: compiled.prompt,
      generatedNegativePrompt: compiled.negativePrompt,
      promptOverride: input.promptOverride,
      negativePromptOverride: input.negativePromptOverride,
    });
    const size = resolveImagePromptReviewSize({
      connection: context.imageConnection,
      prompt: reviewed.prompt,
      width: context.imageSettings.background.width,
      height: context.imageSettings.background.height,
      imageDefaults: context.imageDefaults,
    });
    return { ...compiled, ...reviewed, ...size };
  }

  async function collectChatAssetParticipants(chat: { id: string; characterIds?: unknown; personaId?: string | null }) {
    const characterIds = new Set(parseStringArray(chat.characterIds));
    const personaIds = new Set<string>();
    if (chat.personaId) personaIds.add(chat.personaId);

    const messages = await chats.listMessages(chat.id);
    for (const message of messages) {
      if (typeof message.characterId === "string" && message.characterId.trim()) {
        characterIds.add(message.characterId);
      }
      const extra = parseJsonRecord(message.extra);
      const personaSnapshot = isRecord(extra.personaSnapshot) ? extra.personaSnapshot : null;
      if (typeof personaSnapshot?.personaId === "string" && personaSnapshot.personaId.trim()) {
        personaIds.add(personaSnapshot.personaId);
      }
    }

    return {
      characterIds: Array.from(characterIds),
      personaIds: Array.from(personaIds),
    };
  }

  async function collectChatSceneCharacterNames(chat: {
    id: string;
    characterIds?: unknown;
    personaId?: string | null;
  }): Promise<string[]> {
    const names = new Set<string>();
    const { characterIds, personaIds } = await collectChatAssetParticipants(chat);
    for (const characterId of characterIds.slice(0, 8)) {
      const character = await characters.getById(characterId);
      const name = getCharacterName(character, "");
      if (name) names.add(name);
    }
    for (const personaId of personaIds.slice(0, 2)) {
      const persona = await characters.getPersona(personaId);
      const name = getPersonaName(persona, "");
      if (name) names.add(name);
    }
    return Array.from(names).slice(0, 10);
  }

  async function prepareGallerySceneVideoRequest(input: GenerateSceneVideoInput, signal?: AbortSignal) {
    if (!isValidChatId(input.chatId)) {
      throw new GallerySceneVideoRequestError(400, "Invalid chatId");
    }

    const connections = createConnectionsStorage(app.db);
    const promptOverridesStorage = createPromptOverridesStorage(app.db);
    const chat = await chats.getById(input.chatId);
    if (!chat) throw new GallerySceneVideoRequestError(404, "Chat not found");

    const meta = parseChatMetadata(chat.metadata);
    const videoConnectionId = await resolveSceneVideoConnectionId(meta, connections);
    if (!videoConnectionId) {
      throw new GallerySceneVideoRequestError(400, "No video generation connection is configured for this chat.");
    }

    const videoConn = await connections.getWithKey(videoConnectionId);
    if (!videoConn) throw new GallerySceneVideoRequestError(404, "Video generation connection not found");
    if (videoConn.provider !== "video_generation") {
      throw new GallerySceneVideoRequestError(400, "The selected connection is not a video generation connection.");
    }

    const requestedGalleryImageId = input.galleryImageId?.trim();
    const galleryImages = requestedGalleryImageId ? [] : await storage.listByChatId(input.chatId);
    const galleryImage = requestedGalleryImageId
      ? await storage.getById(requestedGalleryImageId, input.chatId)
      : (galleryImages[0] ?? null);
    if (!galleryImage || galleryImage.chatId !== input.chatId) {
      throw new GallerySceneVideoRequestError(
        404,
        requestedGalleryImageId
          ? "Gallery illustration not found"
          : "Add or generate a gallery image before generating a scene video.",
      );
    }

    const videoRuntime = resolveGameVideoRuntime(videoConn);
    const videoSettings = normalizeVideoGenerationUserSettings(
      await createAppSettingsStorage(app.db).get(VIDEO_GENERATION_SETTINGS_KEY),
    );
    const fallbackDurationSeconds = videoRuntime.hasStoredDefaults
      ? videoRuntime.activeDefaults.durationSeconds
      : videoSettings.sceneVideoDurationSeconds;
    const durationSeconds = Math.min(
      videoRuntime.maxDurationSeconds,
      Math.max(videoRuntime.minDurationSeconds, Math.trunc(input.durationSeconds ?? fallbackDurationSeconds)),
    );
    const aspectRatio = input.aspectRatio ?? videoRuntime.activeDefaults.aspectRatio;
    const messages = await chats.listMessages(input.chatId);
    const swipes = await chats.listSwipesByMessageIds(messages.map((message) => message.id));
    const characterNames = await collectChatSceneCharacterNames(chat);
    let promptDraft = input.promptOverride?.trim() ?? "";
    if (!promptDraft && chat.mode === "roleplay") {
      const defaultPromptConnection =
        chat.connectionId && chat.connectionId !== LOCAL_SIDECAR_CONNECTION_ID
          ? await connections.getWithKey(chat.connectionId)
          : null;
      let promptRuntime;
      try {
        promptRuntime = await resolveIllustratorPromptRuntime({
          chatMetadata: meta,
          defaultConnection: defaultPromptConnection,
          defaultConnectionId: chat.connectionId,
          connections,
          resolveBaseUrl,
        });
      } catch (err) {
        logger.warn(err, "[gallery/roleplay-video-director] Prompt Model is unavailable for chat %s", input.chatId);
        throw new GallerySceneVideoRequestError(
          400,
          "Choose a text Prompt Model or main chat connection before planning a Roleplay animation.",
        );
      }
      const sourceExchange = resolveGalleryVideoSourceExchange(messages, swipes, galleryImage.id);
      const directionMessages = await buildRoleplayVideoDirectionMessages(promptOverridesStorage, {
        durationSeconds,
        aspectRatio,
        sourceExchange:
          sourceExchange.content || "Animate the illustrated Roleplay scene without advancing into a new story beat.",
        referenceImagePrompt: galleryImage.prompt ?? "",
        characterNames,
        setting: buildRoleplayVideoSettingLine(chat, meta, videoRuntime.promptLimits.artStyle),
      });
      const [systemMessage, userMessage] = directionMessages;
      const debugOverrideEnabled = input.debugMode === true || isDebugAgentsEnabled();
      logDebugOverride(
        debugOverrideEnabled,
        "[debug/gallery/roleplay-video-director] system:\n%s\nuser:\n%s",
        systemMessage.content,
        userMessage.content,
      );
      try {
        const result = await promptRuntime.provider.chatComplete(directionMessages, {
          model: promptRuntime.model,
          ...(promptRuntime.suppressModelParameters ? {} : { temperature: 0.5, maxTokens: 1_200 }),
          suppressModelParameters: promptRuntime.suppressModelParameters,
          signal,
          enableCaching: promptRuntime.enableCaching,
          anthropicExtendedCacheTtl: promptRuntime.anthropicExtendedCacheTtl,
        });
        promptDraft = resolveRoleplayVideoDirection(result.content, videoRuntime.promptLimits.finalPrompt);
      } catch (err) {
        logger.warn(err, "[gallery/roleplay-video-director] Failed to plan animation for chat %s", input.chatId);
        const message =
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : "The Roleplay animation Prompt Model failed to plan this clip.";
        throw new GallerySceneVideoRequestError(502, message);
      }
      if (!promptDraft) {
        throw new GallerySceneVideoRequestError(
          502,
          "The Roleplay animation Prompt Model returned an empty direction.",
        );
      }
      logDebugOverride(debugOverrideEnabled, "[debug/gallery/roleplay-video-director] final prompt:\n%s", promptDraft);
    } else if (!promptDraft) {
      promptDraft = await loadGameVideoPrompt({
        promptOverridesStorage,
        meta,
        debugMode: input.debugMode,
        ctx: {
          sceneTitle: compactVideoPromptText(sceneTitleFromGalleryImage(galleryImage), videoRuntime.promptLimits.title),
          narrationSummary: resolveGalleryVideoNarrationSummary(
            messages,
            swipes,
            galleryImage.id,
            videoRuntime.promptLimits.narrationSummary,
          ),
          illustrationPrompt:
            excerptIllustrationPromptForVideo(galleryImage.prompt, videoRuntime.promptLimits.illustrationPrompt) ||
            "Use the supplied first-frame gallery image as the visual source.",
          charactersLine: characterNames.length
            ? characterNames.join(", ")
            : "preserve any visible characters from the supplied image",
          settingLine: buildRoleplayVideoSettingLine(chat, meta, videoRuntime.promptLimits.artStyle),
          artStyleLine: "match the supplied gallery image",
          durationSeconds,
          aspectRatio,
          sourceIllustrationLine: `Use the selected gallery image (${galleryImage.id}) as the first frame/reference image.`,
        },
      });
    }
    const prompt = resolveSceneVideoPrompt({
      generatedPrompt: promptDraft,
      promptOverride: input.promptOverride,
      maxPromptLength: videoRuntime.promptLimits.finalPrompt,
    });
    const videoFallback = await resolveVideoConnectionFallback(connections, videoConnectionId);

    return {
      videoConnectionId,
      galleryImage,
      videoRuntime,
      durationSeconds,
      aspectRatio,
      prompt,
      videoFallback,
    };
  }

  async function findContextualSprite(
    chat: { id: string; characterIds?: unknown; personaId?: string | null },
    category: "facial" | "fullbody",
    target: string,
  ) {
    const { characterIds, personaIds } = await collectChatAssetParticipants(chat);
    const ownerIds = [...characterIds, ...personaIds];
    for (const ownerId of ownerIds) {
      if (!isSafeAssetSegment(ownerId)) continue;
      const dir = join(SPRITES_DIR, ownerId);
      if (!existsSync(dir)) continue;
      try {
        const filename = readdirSync(dir)
          .filter((candidate) => SPRITE_FILE_RE.test(candidate))
          .sort((a, b) => a.localeCompare(b))
          .find((candidate) => spriteMatchesTarget(candidate, category, target));
        if (filename) return { ownerId, filename };
      } catch {
        // Ignore unreadable sprite folders and continue to the next participant.
      }
    }
    return null;
  }

  // Resolve short chat-scoped card:// links such as card://gallery/foo.png or card://sprites/facial/happy.png.
  app.get<{ Params: { chatId: string; "*": string } }>("/asset/:chatId/*", async (req, reply) => {
    const { chatId } = req.params;
    if (!isValidChatId(chatId)) return reply.status(400).send({ error: "Invalid chatId" });

    const chat = await chats.getById(chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const parts = req.params["*"].split("/").filter(Boolean);
    if (parts[0] === "gallery" && parts[1] && isSafeAssetSegment(parts[1])) {
      const filename = parts[1];
      if (!ALLOWED_EXTS.has(extname(filename).toLowerCase())) {
        return reply.status(400).send({ error: "Unsupported file type" });
      }
      const image = findGalleryRowByFilename(await storage.listByChatId(chatId), filename);
      const storedFile = image ? resolveStoredGalleryFile(image.filePath, GALLERY_DIR) : null;
      if (!storedFile || !existsSync(storedFile.absolutePath)) {
        return reply.status(404).send({ error: "Not found" });
      }
      const validatedImage = await validateImageAssetFile(storedFile.absolutePath, storedFile.filename);
      if (!validatedImage) return reply.status(404).send({ error: "Not found" });
      return sendValidatedMediaFile(reply, validatedImage, { method: req.method, rangeHeader: req.headers.range });
    }

    if (parts[0] === "sprites" && (parts[1] === "facial" || parts[1] === "fullbody") && parts[2]) {
      const target = parts[2];
      if (!isSafeAssetSegment(target)) return reply.status(400).send({ error: "Invalid sprite target" });
      const match = await findContextualSprite(chat, parts[1], target);
      if (!match) return reply.status(404).send({ error: "Sprite not found" });
      const spritePath = assertInsideDir(SPRITES_DIR, join(SPRITES_DIR, match.ownerId, match.filename));
      const validatedImage = await validateImageAssetFile(spritePath, match.filename, { allowSvg: true });
      if (!validatedImage) return reply.status(404).send({ error: "Sprite not found" });
      if (validatedImage.isSvg) reply.header("Content-Security-Policy", "sandbox; default-src 'none'");
      return sendValidatedMediaFile(reply, validatedImage, { method: req.method, rangeHeader: req.headers.range });
    }

    return reply.status(404).send({ error: "Asset not found" });
  });

  // List all local assets relevant to a chat: chat gallery, participant card galleries, and sprites.
  app.get<{ Params: { chatId: string } }>("/assets/:chatId", async (req, reply) => {
    const { chatId } = req.params;
    if (!isValidChatId(chatId)) return reply.status(400).send({ error: "Invalid chatId" });

    const chat = await chats.getById(chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const assets: ChatAssetBrowserItem[] = [];
    const chatImages = await storage.listByChatId(chatId);
    for (const image of chatImages) {
      const filename = getStoredFilename(image.filePath);
      assets.push({
        id: `chat-gallery:${image.id}`,
        kind: "chat-gallery" as const,
        ownerType: "chat" as const,
        ownerId: chatId,
        ownerName: chat.name,
        name: filename,
        prompt: image.prompt ?? "",
        width: image.width,
        height: image.height,
        createdAt: image.createdAt,
        url: buildGalleryImageUrl(image, chatId),
        cardUrl: cardUrl("gallery", chatId, filename),
      });
    }

    const { characterIds, personaIds } = await collectChatAssetParticipants(chat);
    for (const characterId of characterIds) {
      if (!isSafeAssetSegment(characterId)) continue;
      const character = await characters.getById(characterId);
      if (!character) continue;
      const ownerName = getCharacterName(character, "Character");
      const images = await characterGallery.listByCharacterId(characterId);
      for (const image of images) {
        const filename = getStoredFilename(image.filePath);
        assets.push({
          id: `character-gallery:${image.id}`,
          kind: "character-gallery" as const,
          ownerType: "character" as const,
          ownerId: characterId,
          ownerName,
          name: filename,
          prompt: image.prompt ?? "",
          width: image.width,
          height: image.height,
          createdAt: image.createdAt,
          url: `/api/characters/${encodeURIComponent(characterId)}/gallery/file/${encodeURIComponent(filename)}`,
          cardUrl: cardUrl("characters", characterId, "gallery", filename),
        });
      }
      assets.push(...buildSpriteAssets(characterId, ownerName, "character"));
    }

    for (const personaId of personaIds) {
      if (!isSafeAssetSegment(personaId)) continue;
      const persona = await characters.getPersona(personaId);
      if (!persona) continue;
      const ownerName = getPersonaName(persona, "Persona");
      const images = await personaGallery.listByPersonaId(personaId);
      for (const image of images) {
        const filename = getStoredFilename(image.filePath);
        assets.push({
          id: `persona-gallery:${image.id}`,
          kind: "persona-gallery" as const,
          ownerType: "persona" as const,
          ownerId: personaId,
          ownerName,
          name: filename,
          prompt: image.prompt ?? "",
          width: image.width,
          height: image.height,
          createdAt: image.createdAt,
          url: `/api/characters/personas/${encodeURIComponent(personaId)}/gallery/file/${encodeURIComponent(filename)}`,
          cardUrl: cardUrl("personas", personaId, "gallery", filename),
        });
      }
      assets.push(...buildSpriteAssets(personaId, ownerName, "persona"));
    }

    return assets;
  });

  app.get<{ Params: { chatId: string } }>("/scene-videos/:chatId", async (req, reply) => {
    const { chatId } = req.params;
    if (!isValidChatId(chatId)) return reply.status(400).send({ error: "Invalid chatId" });

    const chat = await chats.getById(chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });

    const videos = await createGameSceneVideosStorage(app.db).listByChatId(chatId);
    return { videos: videos.map((video) => serializeSceneVideo(video)) };
  });

  app.delete<{ Params: { chatId: string; id: string } }>("/scene-videos/:chatId/:id", async (req, reply) => {
    const { chatId, id } = req.params;
    if (!isValidChatId(chatId)) return reply.status(400).send({ error: "Invalid chatId" });

    const sceneVideos = createGameSceneVideosStorage(app.db);
    const video = await sceneVideos.getById(id, chatId);
    if (!video || video.chatId !== chatId) return reply.status(404).send({ error: "Scene video not found" });

    await sceneVideos.remove(video.id, video.chatId);
    await removeSavedVideoFromDisk(video.filePath).catch((error) => {
      logger.warn(error, "[gallery/scene-videos] Failed to remove video file %s", video.filePath);
    });
    return { success: true };
  });

  app.get<{ Params: { chatId: string; filename: string } }>(
    "/scene-videos/file/:chatId/:filename",
    async (req, reply) => {
      const { chatId, filename } = req.params;
      if (!isValidChatId(chatId) || !SCENE_VIDEO_FILENAME_RE.test(filename)) {
        return reply.status(400).send({ error: "Invalid scene video path" });
      }

      const normalizedFilePath = `${chatId}/${filename}`;
      const sceneVideos = createGameSceneVideosStorage(app.db);
      const videos = await sceneVideos.listByChatId(chatId);
      const matchingRow = videos.find((video) => video.filePath.replace(/\\/g, "/") === normalizedFilePath);
      if (!matchingRow) return reply.status(404).send({ error: "Scene video not found" });

      const filePath = assertInsideDir(GAME_SCENE_VIDEOS_ROOT, join(GAME_SCENE_VIDEOS_ROOT, chatId, filename));
      if (!existsSync(filePath)) return reply.status(404).send({ error: "Scene video file not found" });
      const video = await validateVideoAssetFile(filePath, filename);
      if (!video) return reply.status(404).send({ error: "Scene video file not found" });

      return sendValidatedMediaFile(reply, video, {
        method: req.method,
        rangeHeader: req.headers.range,
        cacheControl: "public, max-age=31536000, immutable",
      });
    },
  );

  app.post("/generate-scene-video/preview", async (req, reply) => {
    const input = generateSceneVideoSchema.parse(req.body);
    const signal = createResponseAbortSignal(reply, SCENE_VIDEO_GENERATION_TIMEOUT_MS, "Scene video prompt preview");
    try {
      const prepared = await prepareGallerySceneVideoRequest(input, signal);
      return {
        prompt: prepared.prompt,
        galleryImageId: prepared.galleryImage.id,
        durationSeconds: prepared.durationSeconds,
        aspectRatio: prepared.aspectRatio,
        resolution: prepared.videoRuntime.resolution ?? null,
        maxPromptLength: prepared.videoRuntime.promptLimits.finalPrompt,
      };
    } catch (err) {
      if (err instanceof GallerySceneVideoRequestError || err instanceof SceneVideoPromptReviewError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      logger.warn(err, "[gallery/generate-scene-video/preview] Failed to prepare scene video prompt");
      return reply.status(500).send({ error: "Scene video prompt preview failed" });
    }
  });

  app.post("/generate-scene-video", async (req, reply) => {
    const input = generateSceneVideoSchema.parse(req.body);
    const sceneVideoAbortSignal = createResponseAbortSignal(
      reply,
      SCENE_VIDEO_GENERATION_TIMEOUT_MS,
      "Scene video generation",
    );
    let prepared: Awaited<ReturnType<typeof prepareGallerySceneVideoRequest>>;
    try {
      prepared = await prepareGallerySceneVideoRequest(input, sceneVideoAbortSignal);
    } catch (err) {
      if (err instanceof GallerySceneVideoRequestError || err instanceof SceneVideoPromptReviewError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }

    const requestDebug = input.debugMode === true;
    const debugOverrideEnabled = requestDebug || isDebugAgentsEnabled();
    const debugLogsEnabled = debugOverrideEnabled || logger.isLevelEnabled("debug");
    const debugLog = (message: string, ...args: unknown[]) => {
      logDebugOverride(debugOverrideEnabled, message, ...args);
    };
    const sceneVideos = createGameSceneVideosStorage(app.db);
    const { videoConnectionId, galleryImage, videoRuntime, durationSeconds, aspectRatio, prompt, videoFallback } =
      prepared;
    const {
      source,
      serviceHint,
      baseUrl,
      apiKey,
      model,
      resolution,
      publicReferenceUpload,
      comfyWorkflow,
      comfyLoras,
      comfyFps,
    } = videoRuntime;

    const galleryImagePath = resolveGalleryImagePath(galleryImage);
    if (!galleryImagePath) {
      return reply.status(400).send({ error: "The selected gallery image file could not be found." });
    }

    let referenceImage: VideoReferenceImage;
    try {
      referenceImage = readSceneVideoReferenceImage(galleryImagePath, sourceGalleryImagePathForMetadata(galleryImage));
    } catch (err) {
      const message = err instanceof Error ? err.message : "The selected gallery image cannot be used.";
      return reply.status(400).send({ error: message });
    }

    logger.info(
      "[gallery/generate-scene-video] request: chatId=%s connection=%s source=%s model=%s duration=%d aspect=%s image=%s",
      input.chatId,
      videoConnectionId,
      source,
      model,
      durationSeconds,
      aspectRatio,
      galleryImage.id,
    );
    if (debugLogsEnabled) {
      debugLog("[debug/gallery/scene-video] prompt:\n%s", prompt);
    }

    let savedFilePath: string | null = null;
    let metadataSaved = false;
    try {
      const generated = await generateVideo(source, baseUrl, apiKey, serviceHint, {
        prompt,
        model,
        durationSeconds,
        aspectRatio,
        resolution,
        comfyWorkflow,
        comfyLoras,
        fps: comfyFps,
        referenceImage,
        publicReferenceUpload,
        queue: input.queueMediaGenerationRequests,
        connectionKey: videoConnectionId,
        signal: sceneVideoAbortSignal,
        fallback: videoFallback,
      });
      const filePath = await saveVideoToDisk(input.chatId, generated.base64);
      savedFilePath = filePath;
      const row = await sceneVideos.create({
        chatId: input.chatId,
        filePath,
        sourceIllustrationTag: `gallery:${galleryImage.id}`,
        sourceIllustrationPath: sourceGalleryImagePathForMetadata(galleryImage),
        prompt,
        provider: source,
        model,
        durationSeconds,
        aspectRatio,
      });
      if (!row) throw new Error("Scene video metadata could not be saved");
      metadataSaved = true;

      await chats.patchMetadata(input.chatId, () => ({ sceneLastVideoId: row.id }));
      logger.info("[gallery/generate-scene-video] saved video %s for chat %s", row.id, input.chatId);
      return { video: serializeSceneVideo(row) };
    } catch (err) {
      if (savedFilePath && !metadataSaved) {
        await removeSavedVideoFromDisk(savedFilePath).catch((cleanupErr) => {
          logger.warn(
            cleanupErr,
            "[gallery/generate-scene-video] Failed to clean up orphaned video file %s",
            savedFilePath,
          );
        });
      }
      logger.warn(err, "[gallery/generate-scene-video] Scene video generation failed for chat %s", input.chatId);
      const message = err instanceof Error ? err.message : "Scene video generation failed";
      return reply.status(502).send({ error: message });
    }
  });

  app.post<{ Params: { chatId: string } }>("/:chatId/selfie", async (req, reply) => {
    const { chatId } = req.params;
    if (!isValidChatId(chatId)) return reply.status(400).send({ error: "Invalid chatId" });

    const input = generateConversationSelfieSchema.parse(req.body);
    const requestDebug = input.debugMode === true;
    const debugOverrideEnabled = requestDebug || isDebugAgentsEnabled();
    const debugLogsEnabled = debugOverrideEnabled || logger.isLevelEnabled("debug");
    const debugLog = (message: string, ...args: unknown[]) => {
      logDebugOverride(debugOverrideEnabled, message, ...args);
    };

    const chat = await chats.getById(chatId);
    if (!chat) return reply.status(404).send({ error: "Chat not found" });
    if (chat.mode !== "conversation") {
      return reply.status(400).send({ error: "Selfies from Gallery are only available in Conversation mode." });
    }

    const chatCharacterIds = parseStringArray(chat.characterIds);
    if (!chatCharacterIds.includes(input.characterId)) {
      return reply.status(400).send({ error: "Selected character is not in this conversation." });
    }

    const character = await characters.getById(input.characterId);
    if (!character) return reply.status(404).send({ error: "Character not found" });

    const meta = parseChatMetadata(chat.metadata);
    const imageConnectionId = readTrimmedString(meta.imageGenConnectionId);
    if (!imageConnectionId) {
      return reply.status(400).send({
        error: "No image generation connection configured for this chat. Set one in Conversation Chat Settings.",
      });
    }
    const connections = createConnectionsStorage(app.db);
    const imageConn = await connections.getWithKey(imageConnectionId);
    if (!imageConn) return reply.status(404).send({ error: "Image generation connection not found." });
    if (imageConn.provider !== "image_generation") {
      return reply.status(400).send({ error: "Selected selfie connection is not an image generation connection." });
    }

    const defaultPromptConnection =
      chat.connectionId && chat.connectionId !== LOCAL_SIDECAR_CONNECTION_ID
        ? await connections.getWithKey(chat.connectionId)
        : null;

    const characterData = parseJsonRecord(character.data);
    const characterName = readTrimmedString(characterData.name) ?? "character";
    const appearance = getCharacterAppearance(characterData);
    const selfiePromptTemplate = readTrimmedString(meta.selfiePrompt) ?? "";
    const selfieTags = readStringArray(meta.selfieTags);
    const selfiePositivePrompt = readTrimmedString(meta.selfiePositivePrompt) ?? selfieTags.join(", ").trim();
    const selfieNegativePrompt = readTrimmedString(meta.selfieNegativePrompt) ?? "";
    const promptOverridesStorage = createPromptOverridesStorage(app.db);
    const imageDefaults = resolveConnectionImageDefaults(imageConn);
    const imageSettings = await loadImageGenerationUserSettings(app.db);
    const configuredStyleProfileId =
      ((meta.gameSetupConfig as Record<string, unknown> | undefined)?.imageStyleProfileId as string | undefined) ??
      (meta.imageStyleProfileId as string | undefined) ??
      null;
    const styleProfileId =
      (typeof configuredStyleProfileId === "string" && configuredStyleProfileId.trim()
        ? configuredStyleProfileId.trim()
        : undefined) ??
      imageDefaults?.styleProfileId ??
      imageSettings.styleProfiles.defaultProfileId;
    // Style feeds the prompt-building model as guidance rather than being pasted
    // verbatim into the final image prompt (#4028).
    const styleGuidance = resolveImageStyleGuidanceText(imageSettings.styleProfiles, styleProfileId);
    const baseSelfieSystemPrompt = await resolveConversationSelfieSystemPrompt({
      promptOverridesStorage,
      chatPromptTemplate: selfiePromptTemplate,
      appearance,
      charName: characterName,
    });
    const selfieSystemPrompt = styleGuidance
      ? `${baseSelfieSystemPrompt}${formatImageStylePromptGuidance(styleGuidance)}`
      : baseSelfieSystemPrompt;
    const selfieSystemPromptWithImageInstructions = appendImagePromptInstructions(
      selfieSystemPrompt,
      imageConn.imagePromptInstructions,
    );

    const selfieAbortSignal = createResponseAbortSignal(reply, SCENE_VIDEO_GENERATION_TIMEOUT_MS, "Selfie generation");
    let promptRuntime;
    try {
      promptRuntime = await resolveIllustratorPromptRuntime({
        chatMetadata: meta,
        defaultConnection: defaultPromptConnection,
        defaultConnectionId: chat.connectionId,
        connections,
        resolveBaseUrl,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Selfie Prompt Model connection is unavailable.";
      return reply.status(400).send({ error: message });
    }
    const promptBuilder = promptRuntime.provider;
    const promptContext = input.context?.trim()
      ? `Context for the selfie: ${input.context.trim()}`
      : `Generate a casual selfie of ${characterName} based on the current conversation context.`;

    if (debugLogsEnabled) {
      debugLog("[debug/gallery/selfie] prompt-builder system:\n%s", selfieSystemPromptWithImageInstructions);
      debugLog("[debug/gallery/selfie] prompt-builder user:\n%s", promptContext);
    }

    let imagePrompt = input.promptOverride?.trim() ?? "";
    if (!imagePrompt) {
      try {
        const promptResult = await promptBuilder.chatComplete(
          [
            { role: "system", content: selfieSystemPromptWithImageInstructions },
            { role: "user", content: promptContext },
          ],
          {
            model: promptRuntime.model,
            ...(promptRuntime.suppressModelParameters ? {} : { temperature: 0.7, maxTokens: 8196 }),
            suppressModelParameters: promptRuntime.suppressModelParameters,
            signal: selfieAbortSignal,
            enableCaching: promptRuntime.enableCaching,
            anthropicExtendedCacheTtl: promptRuntime.anthropicExtendedCacheTtl,
          },
        );
        imagePrompt = (promptResult.content ?? "").trim();
      } catch (err) {
        logger.warn(err, "[gallery/selfie] Failed to build selfie image prompt for chat %s", chatId);
        const message = err instanceof Error ? err.message : "Failed to build selfie prompt";
        return reply.status(502).send({ error: message });
      }
    }

    if (!imagePrompt) {
      return reply.status(502).send({ error: "The conversation model returned an empty selfie prompt." });
    }

    const imageFallback = await resolveImageConnectionFallback(connections, imageConn.id);
    const suppressReferencePromptLine = suppressesReferencePromptLine(
      {
        model: imageConn.model,
        baseUrl: imageConn.baseUrl,
        imageService: imageConn.imageService,
        imageGenerationSource: imageConn.imageGenerationSource,
      },
      imageFallback,
    );
    let finalPrompt = selfiePositivePrompt ? `${imagePrompt}, ${selfiePositivePrompt}` : imagePrompt;
    let referenceImages: string[] | undefined;
    const selfieUseAvatarReferences = meta.selfieUseAvatarReferences === true;
    const selfieIncludeCharacterAppearance = meta.selfieIncludeCharacterAppearance === true;
    if (selfieUseAvatarReferences || selfieIncludeCharacterAppearance) {
      const referenceResolution = await resolveIllustratorCharacterReferences({
        charactersStore: characters,
        characterGallery,
        chatCharacters: [
          {
            id: character.id,
            name: characterName,
            avatarPath: character.avatarPath ?? null,
            appearance,
          },
        ],
        persona: null,
        requestedNames: [characterName],
        promptText: [characterName, input.context ?? "", imagePrompt].join("\n"),
        fallbackToChatCharacters: false,
        maxReferences: 1,
      });
      if (selfieIncludeCharacterAppearance && referenceResolution.appearanceBlock) {
        finalPrompt += `\n\n${referenceResolution.appearanceBlock}`;
        logger.debug(
          "[gallery/selfie] Added character appearance notes for: %s",
          referenceResolution.appearanceNames.join(", "),
        );
      }
      if (selfieUseAvatarReferences && referenceResolution.referenceImages.length > 0) {
        referenceImages = referenceResolution.referenceImages;
        if (referenceResolution.referenceLine && !suppressReferencePromptLine) {
          finalPrompt += `\n\n${referenceResolution.referenceLine}`;
        }
        logger.debug(
          "[gallery/selfie] Sending character reference for: %s",
          referenceResolution.referenceNames.join(", "),
        );
      }
    }

    const selfieResolution = readTrimmedString(meta.selfieResolution) ?? "";
    const [selfieWidth, selfieHeight] = selfieResolution.split("x").map(Number) as [number, number];
    const width = Number.isSafeInteger(selfieWidth) && selfieWidth > 0 ? selfieWidth : imageSettings.selfie.width;
    const height = Number.isSafeInteger(selfieHeight) && selfieHeight > 0 ? selfieHeight : imageSettings.selfie.height;
    const compiledPrompt = compileImagePrompt({
      kind: "selfie",
      prompt: finalPrompt,
      negativePrompt: selfieNegativePrompt || undefined,
      styleProfiles: imageSettings.styleProfiles,
      styleProfileId,
      imageDefaults,
      omitProfileStyleText: true,
      omitProfileSubjectTags: true,
    });
    const imageModel = imageConn.model || "";
    const imageBaseUrl = imageConn.baseUrl || "https://image.pollinations.ai";
    const imageSource = imageConn.imageGenerationSource || imageModel;
    const imageServiceHint = imageConn.imageService || imageSource;
    const promptSubmission = resolveReviewedImagePromptSubmission({
      generatedPrompt: compiledPrompt.prompt,
      generatedNegativePrompt: compiledPrompt.negativePrompt ?? "",
      promptOverride: input.promptOverride,
      negativePromptOverride: input.negativePromptOverride,
    });
    const providerPrompt = promptSubmission.prompt;
    const providerNegativePrompt = promptSubmission.negativePrompt;

    if (input.previewOnly) {
      const previewSize = resolveImagePromptReviewSize({
        connection: imageConn,
        prompt: providerPrompt,
        width,
        height,
        imageDefaults,
      });
      return {
        items: [
          {
            id: "conversation-selfie",
            kind: "selfie",
            title: `${characterName} selfie`,
            prompt: providerPrompt,
            ...(providerNegativePrompt ? { negativePrompt: providerNegativePrompt } : {}),
            width: previewSize.width,
            height: previewSize.height,
          },
        ],
      };
    }

    if (debugLogsEnabled) {
      debugLog("[debug/gallery/selfie] final image prompt:\n%s", providerPrompt);
      if (providerNegativePrompt) {
        debugLog("[debug/gallery/selfie] negative prompt:\n%s", providerNegativePrompt);
      }
    }

    try {
      const imageConnectionQueueKey = imageConn.id?.trim() || `${imageServiceHint}:${imageBaseUrl}:${imageModel}`;
      const imageResults = await generateIllustratorImageVariants({
        count: meta.illustratorImagesPerGeneration,
        generate: () =>
          runImageGenerationRequest({
            connectionKey: imageConnectionQueueKey,
            queue: input.queueImageGenerationRequests,
            signal: selfieAbortSignal,
            task: () =>
              generateImage(imageSource, imageBaseUrl, imageConn.apiKey || "", imageServiceHint, {
                prompt: providerPrompt,
                negativePrompt: providerNegativePrompt || undefined,
                model: imageModel,
                width,
                height,
                imageEndpointId: imageConn.imageEndpointId || undefined,
                comfyWorkflow: imageConn.comfyuiWorkflow || undefined,
                imageDefaults,
                quality: resolveConnectionImageQuality(imageConn),
                referenceImages,
                signal: selfieAbortSignal,
                fallback: imageFallback,
              }),
          }),
        onVariantError: (error, index) =>
          logger.warn(error, "[gallery/selfie] Variant %d failed for chat %s", index + 1, chatId),
      });
      const savedImages = [];
      for (const imageResult of imageResults) {
        const filePath = saveImageToDisk(chatId, imageResult.base64, imageResult.ext, { shared: true });
        const image = await storage.create({
          chatId,
          filePath,
          prompt: providerPrompt,
          provider: imageConn.provider ?? "image_generation",
          model: imageModel || "unknown",
          width,
          height,
        });
        if (!image) throw new Error("Generated selfie metadata could not be saved");
        await persistGeneratedImageToEntityGalleries({
          sourceFilePath: filePath,
          sourceChatImageId: image.id,
          characterIds: [character.id],
          characterGallery,
          personaGallery,
          prompt: providerPrompt,
          provider: imageConn.provider ?? "image_generation",
          model: imageModel || "unknown",
          width,
          height,
        });
        savedImages.push(image);
      }
      const image = savedImages[0];
      if (!image) throw new Error("Image provider did not return a selfie");
      logger.info(
        "[gallery/selfie] Generated %d selfie image(s) for %s in chat %s",
        savedImages.length,
        characterName,
        chatId,
      );
      return {
        ...image,
        url: buildGalleryImageUrl(image, chatId),
      };
    } catch (err) {
      logger.warn(err, "[gallery/selfie] Selfie generation failed for chat %s", chatId);
      const message = err instanceof Error ? err.message : "Selfie generation failed";
      return reply.status(502).send({ error: message });
    }
  });

  app.post<{ Params: { chatId: string } }>("/:chatId/generate-image/preview", async (req, reply) => {
    const { chatId } = req.params;
    if (!isValidChatId(chatId)) return reply.status(400).send({ error: "Invalid chatId" });

    const input = previewGalleryImagesSchema.parse(req.body);
    try {
      const context = await resolveGalleryImageGenerationContext(chatId, input.debugMode);
      const items = await Promise.all(
        input.items.map(async (item) => {
          const compiled = await compileGalleryImageRequest(context, item);
          return {
            id: item.id,
            kind: "background" as const,
            title: item.title,
            sourcePrompt: item.prompt,
            prompt: compiled.prompt,
            negativePrompt: compiled.negativePrompt,
            width: compiled.width,
            height: compiled.height,
          };
        }),
      );
      return {
        requestCount: items.length,
        connection: {
          id: context.imageConnection.id,
          name: context.imageConnection.name,
          model: context.imageModel || "Default model",
          source:
            context.imageConnection.imageService ||
            context.imageConnection.imageGenerationSource ||
            context.imageConnection.provider,
        },
        styleProfile: {
          id: context.styleProfile.id,
          name: context.styleProfile.name,
        },
        campaign: {
          included: Boolean(context.artStyle),
          artStyleIncluded: Boolean(context.artStyle),
        },
        chatSettings: {
          imageInstructionsIncluded: Boolean(context.imagePromptInstructions),
        },
        width: items[0]?.width ?? context.imageSettings.background.width,
        height: items[0]?.height ?? context.imageSettings.background.height,
        items,
      };
    } catch (err) {
      if (err instanceof GalleryImageRequestError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      logger.warn(err, "[gallery/generate-image] Failed to preview Gallery image requests for chat %s", chatId);
      return reply.status(500).send({ error: "Gallery image prompt preview failed" });
    }
  });

  app.post<{ Params: { chatId: string } }>("/:chatId/generate-image", async (req, reply) => {
    const { chatId } = req.params;
    if (!isValidChatId(chatId)) return reply.status(400).send({ error: "Invalid chatId" });

    const input = generateGalleryImageSchema.parse(req.body);
    let context: Awaited<ReturnType<typeof resolveGalleryImageGenerationContext>>;
    let compiledPrompt: Awaited<ReturnType<typeof compileGalleryImageRequest>>;
    try {
      context = await resolveGalleryImageGenerationContext(chatId, input.debugMode);
      compiledPrompt = await compileGalleryImageRequest(context, input);
    } catch (err) {
      if (err instanceof GalleryImageRequestError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      logger.warn(err, "[gallery/generate-image] Failed to compile Gallery image request for chat %s", chatId);
      return reply.status(500).send({ error: "Gallery image prompt compilation failed" });
    }

    const signal = createResponseAbortSignal(reply, SCENE_VIDEO_GENERATION_TIMEOUT_MS, "Gallery image generation");

    context.debugLog("[debug/gallery/generate-image] prompt:\n%s", compiledPrompt.prompt);
    if (compiledPrompt.negativePrompt) {
      context.debugLog("[debug/gallery/generate-image] negative prompt:\n%s", compiledPrompt.negativePrompt);
    }

    let savedFilePath: string | null = null;
    let metadataSaved = false;
    try {
      const connectionKey =
        context.imageConnection.id?.trim() ||
        `${context.imageServiceHint}:${context.imageBaseUrl}:${context.imageModel}`;
      const generated = await runImageGenerationRequest({
        connectionKey,
        queue: true,
        signal,
        task: () =>
          generateImage(
            context.imageSource,
            context.imageBaseUrl,
            context.imageConnection.apiKey || "",
            context.imageServiceHint,
            {
              prompt: compiledPrompt.prompt,
              negativePrompt: compiledPrompt.negativePrompt || undefined,
              model: context.imageModel,
              width: compiledPrompt.width,
              height: compiledPrompt.height,
              imageEndpointId: context.imageConnection.imageEndpointId || undefined,
              comfyWorkflow: context.imageConnection.comfyuiWorkflow || undefined,
              imageDefaults: context.imageDefaults,
              quality: resolveConnectionImageQuality(context.imageConnection),
              signal,
              fallback: context.imageFallback,
            },
          ),
      });
      const filePath = saveImageToDisk(chatId, generated.base64, generated.ext);
      savedFilePath = filePath;
      const image = await storage.create({
        chatId,
        filePath,
        prompt: compiledPrompt.prompt,
        provider: context.imageConnection.provider ?? "image_generation",
        model: context.imageModel || "unknown",
        width: compiledPrompt.width,
        height: compiledPrompt.height,
      });
      if (!image) throw new Error("Generated Gallery image metadata could not be saved");
      metadataSaved = true;
      logger.info("[gallery/generate-image] Generated Gallery image for chat %s", chatId);
      return { ...image, url: buildGalleryImageUrl(image, chatId) };
    } catch (err) {
      if (savedFilePath && !metadataSaved) {
        try {
          removeSavedImageFromDisk(savedFilePath);
        } catch (cleanupErr) {
          logger.warn(cleanupErr, "[gallery/generate-image] Failed to clean up orphaned image file %s", savedFilePath);
        }
      }
      logger.warn(err, "[gallery/generate-image] Image generation failed for chat %s", chatId);
      return reply.status(502).send({
        error: err instanceof Error ? err.message : "Gallery image generation failed",
      });
    }
  });

  // List all images for a chat
  app.get<{ Params: { chatId: string } }>("/:chatId", async (req) => {
    const { chatId } = req.params;
    const chat = await chats.getById(chatId);
    const meta = parseChatMetadata(chat?.metadata);
    const gameId = typeof meta.gameId === "string" && meta.gameId.trim() ? meta.gameId.trim() : chat?.groupId;
    const gameSessionIds =
      chat?.mode === "game" && gameId
        ? (await chats.listByGroup(gameId)).filter((session) => session.mode === "game").map((session) => session.id)
        : [chatId];
    const imageChatIds = Array.from(new Set([...gameSessionIds, chatId]));
    const images =
      imageChatIds.length > 1 ? await storage.listByChatIds(imageChatIds) : await storage.listByChatId(chatId);
    return images.map((img) => ({
      ...img,
      url: buildGalleryImageUrl(img, chatId),
    }));
  });

  // Upload an image to a chat's gallery
  app.post<{ Params: { chatId: string } }>("/:chatId/upload", async (req, reply) => {
    const { chatId } = req.params;
    if (!isValidChatId(chatId)) {
      return reply.status(400).send({ error: "Invalid chatId" });
    }
    if (!(await chats.getById(chatId))) {
      return reply.status(404).send({ error: "Chat not found" });
    }

    const data = await req.file({ limits: { fileSize: GALLERY_UPLOAD_MAX_BYTES } });
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return reply.status(400).send({ error: `Unsupported file type: ${ext}` });
    }

    const dir = ensureDir(chatId);
    const filename = `${newId()}${ext}`;
    let filePath: string;
    try {
      filePath = assertInsideDir(GALLERY_DIR, join(dir, filename));
    } catch {
      return reply.status(400).send({ error: "Invalid path" });
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch (err) {
      const truncated = (data.file as typeof data.file & { truncated?: boolean }).truncated === true;
      const tooLarge = truncated || (err as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE";
      logger.warn(err, "Failed to receive chat gallery upload %s", data.filename);
      return reply.status(tooLarge ? 413 : 400).send({
        error: tooLarge ? "Gallery image is too large" : "Failed to read uploaded image",
      });
    }
    const detectedImage = isAllowedImageBuffer(buffer, ext);
    if (!detectedImage || detectedImage.ext !== expectedImageExt(ext)) {
      return reply.status(400).send({ error: "Unsupported or invalid image file" });
    }
    try {
      await writeFile(filePath, buffer);
    } catch (err) {
      if (existsSync(filePath)) unlinkSync(filePath);
      throw err;
    }

    // Parse optional metadata from fields
    const fields = data.fields as Record<string, { value?: string } | undefined>;
    const prompt = fields?.prompt?.value ?? "";
    const provider = fields?.provider?.value ?? "";
    const model = fields?.model?.value ?? "";
    const width = fields?.width?.value ? parseInt(fields.width.value, 10) : undefined;
    const height = fields?.height?.value ? parseInt(fields.height.value, 10) : undefined;

    let image;
    try {
      image = await storage.create({
        chatId,
        filePath: `${chatId}/${filename}`,
        prompt,
        provider,
        model,
        width: Number.isFinite(width) ? width : undefined,
        height: Number.isFinite(height) ? height : undefined,
      });
    } catch (err) {
      if (existsSync(filePath)) unlinkSync(filePath);
      logger.error(err, "Failed to persist chat gallery image %s", filename);
      return reply.status(500).send({ error: "Failed to save image metadata" });
    }

    return {
      ...image,
      url: buildGalleryImageUrl({ filePath: `${chatId}/${filename}` }, chatId),
    };
  });

  // Serve a gallery image
  app.get<{ Params: { chatId: string; filename: string } }>("/file/:chatId/:filename", async (req, reply) => {
    const { chatId, filename } = req.params;
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\") ||
      chatId.includes("..") ||
      chatId.includes("/") ||
      chatId.includes("\\")
    ) {
      return reply.status(400).send({ error: "Invalid path" });
    }

    let image = findGalleryRowByFilename(await storage.listByChatId(chatId), filename);
    if (!image) {
      image = (await storage.listByChatAndFilePath(chatId, `${chatId}/${filename}`))[0] ?? null;
    }
    const storedFile = image ? resolveStoredGalleryFile(image.filePath, GALLERY_DIR) : null;
    if (!storedFile || !existsSync(storedFile.absolutePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    const validatedImage = await validateImageAssetFile(storedFile.absolutePath, storedFile.filename);
    if (!validatedImage) return reply.status(404).send({ error: "Not found" });

    return sendValidatedMediaFile(reply, validatedImage, { method: req.method, rangeHeader: req.headers.range });
  });

  // Delete a gallery image
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { id } = req.params;
    // Optional chatId keeps the lazy store from loading the whole table for a bare-id lookup.
    const { chatId } = req.query as { chatId?: string };
    const image = await storage.getById(id, typeof chatId === "string" && chatId ? chatId : undefined);
    if (!image) {
      return reply.status(404).send({ error: "Not found" });
    }

    const deleted = await deleteChatGalleryImageEverywhere({ db: app.db, image });
    return { success: true, ...deleted };
  });
}
