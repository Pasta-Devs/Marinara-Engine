// ──────────────────────────────────────────────
// Routes: Global Gallery (profile-wide images + flat folders)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, unlinkSync, createWriteStream } from "fs";
import { join, extname } from "path";
import { pipeline } from "stream/promises";
import { createGlobalGalleryStorage } from "../services/storage/global-gallery.storage.js";
import { newId } from "../utils/id-generator.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { assertInsideDir } from "../utils/security.js";
import { logger } from "../lib/logger.js";

const GLOBAL_GALLERY_ROOT = join(DATA_DIR, "gallery", "global");
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const CUSTOM_NAME_RE = /^[a-z0-9_]{1,32}$/;
const CUSTOM_KIND_MAX_DIMENSION = {
  emoji: 256,
  sticker: 512,
} as const;

function ensureDir() {
  if (!existsSync(GLOBAL_GALLERY_ROOT)) {
    mkdirSync(GLOBAL_GALLERY_ROOT, { recursive: true });
  }
  return GLOBAL_GALLERY_ROOT;
}

function buildUrl(filename: string) {
  return `/api/global-gallery/file/${encodeURIComponent(filename)}`;
}

function isValidCustomDimension(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max;
}

export async function globalGalleryRoutes(app: FastifyInstance) {
  const storage = createGlobalGalleryStorage(app.db);

  // ── Folders ──

  app.get("/folders", async () => {
    return storage.listFolders();
  });

  app.post<{ Body: { name?: string } }>("/folders", async (req, reply) => {
    const name = req.body?.name?.trim();
    if (!name) return reply.status(400).send({ error: "Name is required" });
    const folder = await storage.createFolder(name);
    if (!folder) return reply.status(500).send({ error: "Failed to create folder" });
    return folder;
  });

  app.patch<{ Params: { id: string }; Body: { name?: string } }>("/folders/:id", async (req, reply) => {
    const existing = await storage.getFolderById(req.params.id);
    if (!existing) return reply.status(404).send({ error: "Folder not found" });
    const name = req.body?.name?.trim();
    if (!name) return reply.status(400).send({ error: "Name is required" });
    return storage.renameFolder(req.params.id, name);
  });

  // Deleting a folder re-files its images to root (handled in storage).
  app.delete<{ Params: { id: string } }>("/folders/:id", async (req, reply) => {
    const existing = await storage.getFolderById(req.params.id);
    if (!existing) return reply.status(404).send({ error: "Folder not found" });
    await storage.removeFolder(req.params.id);
    return { success: true };
  });

  // ── Images ──

  // ?folderId=<id> filters to a folder; ?folderId=root (or empty) filters to unfiled; omitted = all
  app.get<{ Querystring: { folderId?: string } }>("/", async (req) => {
    const raw = req.query.folderId;
    const folderId = raw === undefined ? undefined : raw === "root" || raw === "" ? null : raw;
    const images = await storage.listImages(folderId);
    return images.map((img) => ({
      ...img,
      url: buildUrl(img.filePath.split("/").pop()!),
    }));
  });

  app.post<{ Querystring: { folderId?: string } }>("/upload", async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return reply.status(400).send({ error: `Unsupported file type: ${ext}` });
    }

    // Resolve the target folder BEFORE persisting bytes so a missing folder can't
    // strand an orphan file on disk. A missing folder coerces to root.
    const rawFolder = req.query.folderId;
    let folderId: string | null = rawFolder && rawFolder !== "root" ? rawFolder : null;
    if (folderId) {
      const folder = await storage.getFolderById(folderId);
      if (!folder) folderId = null;
    }

    const dir = ensureDir();
    const filename = `${newId()}${ext}`;
    let filePath: string;
    try {
      filePath = assertInsideDir(GLOBAL_GALLERY_ROOT, join(dir, filename));
    } catch {
      return reply.status(400).send({ error: "Invalid path" });
    }

    await pipeline(data.file, createWriteStream(filePath));

    const fields = data.fields as Record<string, { value?: string } | undefined>;
    const prompt = fields?.prompt?.value ?? "";
    const provider = fields?.provider?.value ?? "";
    const model = fields?.model?.value ?? "";
    const width = fields?.width?.value ? parseInt(fields.width.value, 10) : undefined;
    const height = fields?.height?.value ? parseInt(fields.height.value, 10) : undefined;

    try {
      const image = await storage.createImage({
        folderId,
        filePath: `global/${filename}`,
        prompt,
        provider,
        model,
        width: Number.isFinite(width) ? width : undefined,
        height: Number.isFinite(height) ? height : undefined,
      });

      return {
        ...image,
        url: buildUrl(filename),
      };
    } catch (err) {
      // Roll back the just-written file so a metadata failure can't strand an orphan on disk.
      if (existsSync(filePath)) unlinkSync(filePath);
      logger.error(err, "Failed to persist global gallery image %s", filename);
      return reply.status(500).send({ error: "Failed to save image metadata" });
    }
  });

  app.get<{ Params: { filename: string } }>("/file/:filename", async (req, reply) => {
    const { filename } = req.params;
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return reply.status(400).send({ error: "Invalid path" });
    }

    const filePath = join(GLOBAL_GALLERY_ROOT, filename);
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    return reply.sendFile(filename, GLOBAL_GALLERY_ROOT);
  });

  // Move an image into (or out of) a folder. folderId null = root.
  app.patch<{ Params: { id: string }; Body: { folderId?: string | null } }>("/:id", async (req, reply) => {
    const image = await storage.getImageById(req.params.id);
    if (!image) return reply.status(404).send({ error: "Not found" });

    const rawFolderId = req.body?.folderId;
    const folderId =
      rawFolderId === undefined || rawFolderId === null || rawFolderId === "" || rawFolderId === "root"
        ? null
        : rawFolderId;
    if (folderId) {
      const folder = await storage.getFolderById(folderId);
      if (!folder) return reply.status(404).send({ error: "Folder not found" });
    }

    return storage.moveImage(req.params.id, folderId);
  });

  // Tag (or untag) an image as a custom emoji/sticker.
  app.patch<{
    Params: { id: string };
    Body: { customKind?: string | null; customName?: string | null; width?: number; height?: number };
  }>("/:id/tag", async (req, reply) => {
    const image = await storage.getImageById(req.params.id);
    if (!image) return reply.status(404).send({ error: "Not found" });
    const kind = req.body?.customKind ?? null;
    if (kind !== null && kind !== "emoji" && kind !== "sticker") {
      return reply.status(400).send({ error: "Invalid customKind" });
    }
    const name = typeof req.body?.customName === "string" ? req.body.customName.trim() : "";
    if (kind !== null && !CUSTOM_NAME_RE.test(name)) {
      return reply.status(400).send({ error: "customName must use 1-32 lowercase letters, numbers, or underscores" });
    }
    if (kind !== null) {
      const max = CUSTOM_KIND_MAX_DIMENSION[kind];
      const { width, height } = req.body ?? {};
      if (width !== undefined && !isValidCustomDimension(width, max)) {
        return reply.status(400).send({ error: `width must be an integer from 1 to ${max}` });
      }
      if (height !== undefined && !isValidCustomDimension(height, max)) {
        return reply.status(400).send({ error: `height must be an integer from 1 to ${max}` });
      }
    }
    return storage.setTag(req.params.id, {
      customKind: kind,
      customName: kind === null ? null : name,
      width: kind !== null && typeof req.body?.width === "number" ? req.body.width : undefined,
      height: kind !== null && typeof req.body?.height === "number" ? req.body.height : undefined,
    });
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const image = await storage.getImageById(req.params.id);
    if (!image) {
      return reply.status(404).send({ error: "Not found" });
    }

    // Remove file from disk (assertInsideDir guards a poisoned stored filePath)
    try {
      const filePath = assertInsideDir(GLOBAL_GALLERY_ROOT, join(DATA_DIR, "gallery", image.filePath));
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (err) {
      logger.warn(err, "Skipped global gallery file unlink for %s: path escapes gallery dir", req.params.id);
    }

    await storage.removeImage(req.params.id);
    return { success: true };
  });
}
