// ──────────────────────────────────────────────
// Routes: Custom Stickers (global pool, managed in the sticker selector)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, unlinkSync, createWriteStream } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join, extname } from "path";
import { pipeline } from "stream/promises";
import { createCustomStickersStorage } from "../services/storage/custom-stickers.storage.js";
import { newId } from "../utils/id-generator.js";
import { DATA_DIR } from "../utils/data-dir.js";
import { assertInsideDir } from "../utils/security.js";
import {
  resolveFlatMediaFile,
  sendValidatedMediaFile,
  validateImageAssetBuffer,
  validateImageAssetFile,
} from "../utils/media-file-security.js";
import { readImageDimensionsFromBuffer, readImageDimensionsFromFile } from "../utils/image-metadata.js";
import { logger } from "../lib/logger.js";
import { isFileUniqueConstraintError } from "../db/file-schema.js";
import {
  CUSTOM_STICKER_NAME_PATTERN,
  CUSTOM_STICKER_MAX_DIMENSION,
  updateCustomStickerSchema,
} from "@marinara-engine/shared";

const CUSTOM_STICKERS_ROOT = join(DATA_DIR, "custom-stickers");
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
};
const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

type CustomStickerRow = { id: string; name: string; filePath: string; width: number | null; height: number | null };

function ensureDir() {
  if (!existsSync(CUSTOM_STICKERS_ROOT)) {
    mkdirSync(CUSTOM_STICKERS_ROOT, { recursive: true });
  }
  return CUSTOM_STICKERS_ROOT;
}

function buildUrl(filename: string) {
  return `/api/custom-stickers/file/${encodeURIComponent(filename)}`;
}

function withUrl<T extends { filePath: string }>(row: T) {
  return { ...row, url: buildUrl(row.filePath) };
}

function readDimension(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function dimensionTooLarge(value: number | null): boolean {
  return value !== null && value > CUSTOM_STICKER_MAX_DIMENSION;
}

function isUniqueNameError(error: unknown): boolean {
  return isFileUniqueConstraintError(error, "custom_stickers", ["name"]);
}

export async function customStickersRoutes(app: FastifyInstance) {
  const storage = createCustomStickersStorage(app.db);

  // ── List ──
  app.get("/", async () => {
    const rows = (await storage.list()) as CustomStickerRow[];
    return rows.map(withUrl);
  });

  // ── Upload (multipart: file + name [+ width, height]) ──
  app.post("/upload", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "No file uploaded" });

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return reply.status(400).send({ error: `Unsupported file type: ${ext}` });
    }

    const dir = ensureDir();
    const filename = `${newId()}${ext}`;
    let filePath: string;
    try {
      filePath = assertInsideDir(CUSTOM_STICKERS_ROOT, join(dir, filename));
    } catch {
      return reply.status(400).send({ error: "Invalid path" });
    }

    const cleanup = () => {
      if (existsSync(filePath)) unlinkSync(filePath);
    };
    // Write the bytes, then validate the fields (fields after the file part are only
    // available once the stream is consumed). Roll the file back on any rejection.
    try {
      await pipeline(data.file, createWriteStream(filePath));
    } catch (err) {
      cleanup();
      logger.warn(err, "Failed to receive custom sticker upload %s", filename);
      return reply.status(400).send({ error: "Failed to read uploaded sticker image." });
    }

    const fields = data.fields as Record<string, { value?: string } | undefined>;
    const name = (fields?.name?.value ?? "").trim().toLowerCase();
    let width = readDimension(fields?.width?.value);
    let height = readDimension(fields?.height?.value);

    if (!CUSTOM_STICKER_NAME_PATTERN.test(name)) {
      cleanup();
      return reply.status(400).send({ error: "Name must be 1-32 lowercase letters, numbers, or underscores." });
    }
    if (dimensionTooLarge(width) || dimensionTooLarge(height)) {
      cleanup();
      return reply.status(400).send({
        error: `Custom stickers must be at most ${CUSTOM_STICKER_MAX_DIMENSION}x${CUSTOM_STICKER_MAX_DIMENSION}px.`,
      });
    }
    try {
      const dimensions = await readImageDimensionsFromFile(filePath);
      width = dimensions.width;
      height = dimensions.height;
    } catch (err) {
      cleanup();
      logger.warn(err, "Failed to validate custom sticker dimensions for %s", filename);
      return reply.status(400).send({ error: "Could not read sticker image dimensions." });
    }
    if (dimensionTooLarge(width) || dimensionTooLarge(height)) {
      cleanup();
      return reply.status(400).send({
        error: `Custom stickers must be at most ${CUSTOM_STICKER_MAX_DIMENSION}x${CUSTOM_STICKER_MAX_DIMENSION}px.`,
      });
    }
    if (await storage.getByName(name)) {
      cleanup();
      return reply.status(409).send({ error: `A sticker named "sticker:${name}:" already exists.` });
    }

    try {
      const sticker = await storage.create({ name, filePath: filename, width, height });
      if (!sticker) throw new Error("create returned no row");
      return withUrl(sticker as CustomStickerRow);
    } catch (err) {
      cleanup();
      if (isUniqueNameError(err)) {
        return reply.status(409).send({ error: `A sticker named "sticker:${name}:" already exists.` });
      }
      logger.error(err, "Failed to persist custom sticker %s", filename);
      return reply.status(500).send({ error: "Failed to save custom sticker" });
    }
  });

  // ── Serve the image ──
  app.get<{ Params: { filename: string } }>("/file/:filename", async (req, reply) => {
    const { filename } = req.params;
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return reply.status(400).send({ error: "Invalid path" });
    }
    const filePath = resolveFlatMediaFile(CUSTOM_STICKERS_ROOT, filename);
    if (!filePath || !existsSync(filePath)) return reply.status(404).send({ error: "Not found" });
    const image = await validateImageAssetFile(filePath, filename);
    if (!image) return reply.status(404).send({ error: "Not found" });
    return sendValidatedMediaFile(reply, image, { method: req.method, rangeHeader: req.headers.range });
  });

  // ── Rename ──
  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const existing = (await storage.getById(req.params.id)) as CustomStickerRow | null;
    if (!existing) return reply.status(404).send({ error: "Custom sticker not found" });
    const data = updateCustomStickerSchema.parse(req.body);
    const name = data.name.toLowerCase();
    const dup = await storage.getByName(name);
    if (dup && dup.id !== req.params.id) {
      return reply.status(409).send({ error: `A sticker named "sticker:${name}:" already exists.` });
    }
    try {
      const updated = (await storage.update(req.params.id, { name })) as CustomStickerRow | null;
      if (!updated) return reply.status(404).send({ error: "Custom sticker not found" });
      return withUrl(updated);
    } catch (err) {
      if (isUniqueNameError(err)) {
        return reply.status(409).send({ error: `A sticker named "sticker:${name}:" already exists.` });
      }
      logger.error(err, "Failed to rename custom sticker %s", existing.id);
      return reply.status(500).send({ error: "Failed to rename custom sticker" });
    }
  });

  // ── Delete (+ remove the file) ──
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const existing = (await storage.getById(req.params.id)) as CustomStickerRow | null;
    if (!existing) return reply.status(404).send({ error: "Custom sticker not found" });
    await storage.remove(req.params.id);
    try {
      const fp = resolveFlatMediaFile(CUSTOM_STICKERS_ROOT, existing.filePath);
      if (fp && existsSync(fp)) unlinkSync(fp);
    } catch (err) {
      logger.warn(err, "Failed to remove custom sticker file %s", existing.filePath);
    }
    return { success: true };
  });

  // ── Export a set (all, or a selected subset) as a portable JSON bundle ──
  app.post<{ Body: { ids?: string[] } }>("/export", async (req) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    const rows = (await storage.list()) as CustomStickerRow[];
    const selected = ids ? rows.filter((row) => ids.includes(row.id)) : rows;

    const stickers: Array<{ name: string; width: number | null; height: number | null; dataUrl: string }> = [];
    for (const row of selected) {
      const filePath = resolveFlatMediaFile(CUSTOM_STICKERS_ROOT, row.filePath);
      const mime = MIME_BY_EXT[extname(row.filePath).toLowerCase()];
      if (!mime || !filePath) continue;
      try {
        const buf = await readFile(filePath);
        if (!validateImageAssetBuffer(buf, row.filePath)) continue;
        stickers.push({
          name: row.name,
          width: row.width,
          height: row.height,
          dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
        });
      } catch (err) {
        logger.warn(err, "Skipping custom sticker %s during export (file unreadable)", row.name);
      }
    }

    return { kind: "marinara.custom-stickers", version: 1, exportedAt: new Date().toISOString(), stickers };
  });

  // ── Import a set (JSON bundle of base64 images); duplicates are skipped ──
  app.post<{
    Body: { stickers?: Array<{ name?: unknown; dataUrl?: unknown; width?: unknown; height?: unknown }> };
  }>("/import", async (req) => {
    const entries = Array.isArray(req.body?.stickers) ? req.body.stickers : [];
    let imported = 0;
    let skipped = 0;

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") {
        skipped++;
        continue;
      }
      const name = typeof entry.name === "string" ? entry.name.trim().toLowerCase() : "";
      const dataUrl = typeof entry.dataUrl === "string" ? entry.dataUrl : "";
      const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
      const mime = (match?.[1] ?? "").toLowerCase();
      const base64 = match?.[2] ?? "";
      const ext = EXT_BY_MIME[mime];

      if (!CUSTOM_STICKER_NAME_PATTERN.test(name) || !ext || !base64) {
        skipped++;
        continue;
      }
      if (await storage.getByName(name)) {
        skipped++;
        continue;
      }

      const buffer = Buffer.from(base64, "base64");
      if (!validateImageAssetBuffer(buffer, `sticker${ext}`)) {
        skipped++;
        continue;
      }
      const dimensions = readImageDimensionsFromBuffer(buffer);
      if (!dimensions) {
        skipped++;
        continue;
      }
      const width = dimensions.width;
      const height = dimensions.height;
      if (dimensionTooLarge(width) || dimensionTooLarge(height)) {
        skipped++;
        continue;
      }

      const dir = ensureDir();
      const filename = `${newId()}${ext}`;
      let filePath: string;
      try {
        filePath = assertInsideDir(CUSTOM_STICKERS_ROOT, join(dir, filename));
      } catch {
        skipped++;
        continue;
      }

      try {
        await writeFile(filePath, buffer);
        await storage.create({ name, filePath: filename, width, height });
        imported++;
      } catch (err) {
        if (existsSync(filePath)) unlinkSync(filePath);
        logger.warn(err, "Skipping custom sticker %s during import", name);
        skipped++;
      }
    }

    return { success: true, imported, skipped };
  });
}
