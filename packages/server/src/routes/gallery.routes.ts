// ──────────────────────────────────────────────
// Routes: Chat Gallery (upload, list, delete, serve)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join, extname } from "path";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { createGalleryStorage } from "../services/storage/gallery.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";
import { newId } from "../utils/id-generator.js";
import { DATA_DIR } from "../utils/data-dir.js";

const GALLERY_DIR = join(DATA_DIR, "gallery");
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

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

export async function galleryRoutes(app: FastifyInstance) {
  const storage = createGalleryStorage(app.db);
  const chats = createChatsStorage(app.db);

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
    const filePath = join(dir, filename);

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

    // Remove file from disk
    const filePath = join(GALLERY_DIR, image.filePath);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    await storage.remove(id);
    return { success: true };
  });
}
