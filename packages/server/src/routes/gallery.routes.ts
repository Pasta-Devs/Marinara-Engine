// ──────────────────────────────────────────────
// Routes: Chat Gallery (upload, list, delete, serve)
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply } from "fastify";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from "fs";
import { writeFile } from "fs/promises";
import { basename, extname, join } from "path";
import { z } from "zod";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
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
import { generateImage, saveImageToDisk } from "../services/image/image-generation.js";
import { resolveConnectionImageDefaults } from "../services/image/image-generation-defaults.js";
import { loadImageGenerationUserSettings } from "../services/image/image-generation-settings.js";
import { compileImagePrompt } from "../services/image/image-prompt-compiler.js";
import {
  resolveImagePromptReviewSize,
  resolveReviewedImagePromptSubmission,
} from "../services/image/image-prompt-review.js";
import { runImageGenerationRequest } from "../services/image/image-generation-queue.js";
import { persistGeneratedImageToEntityGalleries } from "../services/image/generated-image-entity-gallery.js";
import {
  resolveImageConnectionFallback,
  resolveVideoConnectionFallback,
} from "../services/generation/media-connection-fallback.js";
import { resolveIllustratorPromptRuntime } from "../services/generation/illustrator-prompt-runtime.js";
import { resolveConversationSelfieSystemPrompt } from "../services/conversation/selfie-prompt.js";
import { suppressesReferencePromptLine, resolveIllustratorCharacterReferences } from "./generate/illustrator-references.js";
import { resolveBaseUrl } from "./generate/generate-route-utils.js";
import {
  compactVideoPromptText,
  excerptIllustrationPromptForVideo,
  summarizeVideoNarration,
} from "../services/video/prompt-context.js";
import { resolveSceneVideoPrompt, SceneVideoPromptReviewError } from "../services/video/scene-video-prompt-review.js";
import { isDebugAgentsEnabled } from "../config/runtime-config.js";
import { newId } from "../utils/id-generator.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { assertInsideDir, isAllowedImageBuffer } from "../utils/security.js";
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
    readonly statusCode: 400 | 404,
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

function buildGalleryImageUrl(image: { filePath: string }, fallbackChatId: string) {
  const parts = image.filePath.split("/").filter(Boolean);
  const ownerChatId = parts.length > 1 ? parts[0]! : fallbackChatId;
  const filename = parts[parts.length - 1] ?? image.filePath;
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

function resolveGalleryImagePath(image: ChatGalleryImageRow): string | null {
  const normalizedPath = image.filePath.replace(/\\/g, "/");
  const filename = basename(normalizedPath);
  const candidates = new Set([normalizedPath, `${image.chatId}/${filename}`]);
  for (const candidate of candidates) {
    if (!candidate || candidate.includes("..") || candidate.includes("\0")) continue;
    try {
      const resolved = assertInsideDir(GALLERY_DIR, join(GALLERY_DIR, candidate));
      if (existsSync(resolved)) return resolved;
    } catch {
      // Ignore invalid gallery path candidates and try the next one.
    }
  }
  return null;
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

function latestNarrationSummary(
  messages: Array<{ role?: string | null; content?: string | null }>,
  maxLength: number,
): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role === "user") continue;
    const summary = summarizeVideoNarration(message.content, maxLength);
    if (summary) return summary;
  }
  return "Animate the latest illustrated roleplay scene with motion that fits the reference image.";
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

  async function prepareGallerySceneVideoRequest(input: GenerateSceneVideoInput) {
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
      ? await storage.getById(requestedGalleryImageId)
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
    const characterNames = await collectChatSceneCharacterNames(chat);
    const promptDraft = await loadGameVideoPrompt({
      promptOverridesStorage,
      meta,
      debugMode: input.debugMode,
      ctx: {
        sceneTitle: compactVideoPromptText(sceneTitleFromGalleryImage(galleryImage), videoRuntime.promptLimits.title),
        narrationSummary: latestNarrationSummary(messages, videoRuntime.promptLimits.narrationSummary),
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
      const filePath = join(GALLERY_DIR, chatId, filename);
      if (!existsSync(filePath)) return reply.status(404).send({ error: "Not found" });
      return reply.sendFile(filename, join(GALLERY_DIR, chatId));
    }

    if (parts[0] === "sprites" && (parts[1] === "facial" || parts[1] === "fullbody") && parts[2]) {
      const target = parts[2];
      if (!isSafeAssetSegment(target)) return reply.status(400).send({ error: "Invalid sprite target" });
      const match = await findContextualSprite(chat, parts[1], target);
      if (!match) return reply.status(404).send({ error: "Sprite not found" });
      return reply.sendFile(match.filename, join(SPRITES_DIR, match.ownerId));
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

      return reply
        .header("Content-Type", "video/mp4")
        .sendFile(filename, join(GAME_SCENE_VIDEOS_ROOT, chatId), { maxAge: "1y", immutable: true });
    },
  );

  app.post("/generate-scene-video/preview", async (req, reply) => {
    const input = generateSceneVideoSchema.parse(req.body);
    try {
      const prepared = await prepareGallerySceneVideoRequest(input);
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
    let prepared: Awaited<ReturnType<typeof prepareGallerySceneVideoRequest>>;
    try {
      prepared = await prepareGallerySceneVideoRequest(input);
    } catch (err) {
      if (err instanceof GallerySceneVideoRequestError || err instanceof SceneVideoPromptReviewError) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      throw err;
    }

    const sceneVideoAbortSignal = createResponseAbortSignal(
      reply,
      SCENE_VIDEO_GENERATION_TIMEOUT_MS,
      "Scene video generation",
    );
    const requestDebug = input.debugMode === true;
    const debugOverrideEnabled = requestDebug || isDebugAgentsEnabled();
    const debugLogsEnabled = debugOverrideEnabled || logger.isLevelEnabled("debug");
    const debugLog = (message: string, ...args: unknown[]) => {
      logDebugOverride(debugOverrideEnabled, message, ...args);
    };
    const sceneVideos = createGameSceneVideosStorage(app.db);
    const { videoConnectionId, galleryImage, videoRuntime, durationSeconds, aspectRatio, prompt, videoFallback } =
      prepared;
    const { source, serviceHint, baseUrl, apiKey, model, resolution, publicReferenceUpload, comfyWorkflow } =
      videoRuntime;

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
    const selfieSystemPrompt = await resolveConversationSelfieSystemPrompt({
      promptOverridesStorage,
      chatPromptTemplate: selfiePromptTemplate,
      appearance,
      charName: characterName,
    });

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
      debugLog("[debug/gallery/selfie] prompt-builder system:\n%s", selfieSystemPrompt);
      debugLog("[debug/gallery/selfie] prompt-builder user:\n%s", promptContext);
    }

    let imagePrompt = input.promptOverride?.trim() ?? "";
    if (!imagePrompt) {
      try {
        const promptResult = await promptBuilder.chatComplete(
          [
            { role: "system", content: selfieSystemPrompt },
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

    const imageDefaults = resolveConnectionImageDefaults(imageConn);
    const imageSettings = await loadImageGenerationUserSettings(app.db);
    const configuredStyleProfileId =
      ((meta.gameSetupConfig as Record<string, unknown> | undefined)?.imageStyleProfileId as string | undefined) ??
      (meta.imageStyleProfileId as string | undefined) ??
      null;
    const styleProfileId =
      typeof configuredStyleProfileId === "string" && configuredStyleProfileId.trim()
        ? configuredStyleProfileId.trim()
        : imageSettings.styleProfiles.defaultProfileId;
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
      const imageResult = await runImageGenerationRequest({
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
            referenceImages,
            signal: selfieAbortSignal,
            fallback: imageFallback,
          }),
      });
      const filePath = saveImageToDisk(chatId, imageResult.base64, imageResult.ext);
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
        characterIds: [character.id],
        characterGallery,
        personaGallery,
        prompt: providerPrompt,
        provider: imageConn.provider ?? "image_generation",
        model: imageModel || "unknown",
        width,
        height,
      });
      logger.info("[gallery/selfie] Generated selfie for %s in chat %s", characterName, chatId);
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
    if (filename.includes("..") || filename.includes("/") || chatId.includes("..") || chatId.includes("/")) {
      return reply.status(400).send({ error: "Invalid path" });
    }

    const filePath = join(GALLERY_DIR, chatId, filename);
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    return reply.sendFile(filename, join(GALLERY_DIR, chatId));
  });

  // Delete a gallery image
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { id } = req.params;
    const image = await storage.getById(id);
    if (!image) {
      return reply.status(404).send({ error: "Not found" });
    }

    const filename = getStoredFilename(image.filePath);
    const fallbackFilePath = `${image.chatId}/${filename}`;
    const filePathCandidates = new Set([image.filePath, fallbackFilePath]);

    for (const candidate of filePathCandidates) {
      try {
        const filePath = assertInsideDir(GALLERY_DIR, join(GALLERY_DIR, candidate));
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      } catch (err) {
        logger.warn(err, "Skipped gallery file unlink for %s (%s): path escapes gallery dir", id, candidate);
      }
    }

    await storage.removeByChatAndFilePath(image.chatId, image.filePath);
    if (fallbackFilePath !== image.filePath) {
      await storage.removeByChatAndFilePath(image.chatId, fallbackFilePath);
    }
    await storage.remove(id);
    return { success: true };
  });
}
