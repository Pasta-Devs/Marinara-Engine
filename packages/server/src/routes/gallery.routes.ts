// ──────────────────────────────────────────────
// Routes: Chat Gallery (upload, list, delete, serve)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { join, extname } from "path";
import { pipeline } from "stream/promises";
import { createGalleryStorage } from "../services/storage/gallery.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createCharacterGalleryStorage } from "../services/storage/character-gallery.storage.js";
import { createPersonaGalleryStorage } from "../services/storage/persona-gallery.storage.js";
import { newId } from "../utils/id-generator.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { assertInsideDir } from "../utils/security.js";
import { logger } from "../lib/logger.js";

const GALLERY_DIR = join(DATA_DIR, "gallery");
const SPRITES_DIR = join(DATA_DIR, "sprites");
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const SPRITE_FILE_RE = /\.(png|jpg|jpeg|gif|webp|avif|svg)$/i;

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
  return value.length > 0 && !value.includes("..") && !value.includes("/") && !value.includes("\\") && !value.includes("\0");
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

  return expression === targetBase || expression === `full_${targetBase}` || expression.replace(/^full[_-]/, "") === targetBase;
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
    const data = await req.file();
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

    await pipeline(data.file, createWriteStream(filePath));

    // Parse optional metadata from fields
    const fields = data.fields as Record<string, { value?: string } | undefined>;
    const prompt = fields?.prompt?.value ?? "";
    const provider = fields?.provider?.value ?? "";
    const model = fields?.model?.value ?? "";
    const width = fields?.width?.value ? parseInt(fields.width.value, 10) : undefined;
    const height = fields?.height?.value ? parseInt(fields.height.value, 10) : undefined;

    const image = await storage.create({
      chatId,
      filePath: `${chatId}/${filename}`,
      prompt,
      provider,
      model,
      width: Number.isFinite(width) ? width : undefined,
      height: Number.isFinite(height) ? height : undefined,
    });

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

    // Remove file from disk (assertInsideDir guards a poisoned stored filePath)
    try {
      const filePath = assertInsideDir(GALLERY_DIR, join(GALLERY_DIR, image.filePath));
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (err) {
      logger.warn(err, "Skipped gallery file unlink for %s: path escapes gallery dir", id);
    }

    await storage.remove(id);
    return { success: true };
  });
}
