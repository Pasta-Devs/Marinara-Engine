// ──────────────────────────────────────────────
// Routes: Knowledge Sources (file uploads for Knowledge Retrieval agent)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { join, extname, basename } from "path";
import { mkdir, readFile, rename, unlink, writeFile, stat } from "fs/promises";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "fs";
import { pipeline } from "stream/promises";
import { nanoid } from "nanoid";
import { DATA_DIR } from "../utils/data-dir.js";
import { assertInsideDir } from "../utils/security.js";

const SOURCES_DIR = join(DATA_DIR, "knowledge-sources");
const META_FILE = join(SOURCES_DIR, "meta.json");

// Supported text-based formats (read as UTF-8)
const TEXT_EXTS = new Set([".txt", ".md", ".csv", ".json", ".xml", ".html", ".htm", ".log", ".yaml", ".yml", ".tsv"]);
// PDF support via pdf-parse
const PDF_EXTS = new Set([".pdf"]);
const ALLOWED_EXTS = new Set([...TEXT_EXTS, ...PDF_EXTS]);

interface SourceMeta {
  id: string;
  originalName: string;
  filename: string;
  size: number;
  uploadedAt: string;
}

type MetaStore = Record<string, SourceMeta>;

// In-process cache of extracted file text, keyed by source id. An entry is valid
// only while (size, uploadedAt) match the current meta, so a re-upload (which
// changes both) or a delete invalidates it. Avoids re-reading + re-parsing the
// file (a full PDF parse for PDFs) on every generation turn.
interface CacheEntry {
  size: number;
  uploadedAt: string;
  text: string;
}
// Bounded by total cached characters so a few large PDFs / many sources can't
// grow the process heap without limit. Map iteration order is insertion order,
// so eviction of the first key is an approximate-LRU (entries re-insert on
// refresh). All insert/delete paths route through the helpers below.
const textCache = new Map<string, CacheEntry>();
const MAX_TEXT_CACHE_CHARS = 25_000_000;
let textCacheChars = 0;

function deleteCachedText(fileId: string) {
  const existing = textCache.get(fileId);
  if (existing) textCacheChars -= existing.text.length;
  textCache.delete(fileId);
}

function setCachedText(fileId: string, entry: CacheEntry) {
  deleteCachedText(fileId);
  textCache.set(fileId, entry);
  textCacheChars += entry.text.length;
  while (textCacheChars > MAX_TEXT_CACHE_CHARS) {
    const oldestKey = textCache.keys().next().value;
    if (oldestKey === undefined) break;
    deleteCachedText(oldestKey);
  }
}

function ensureDir() {
  if (!existsSync(SOURCES_DIR)) {
    mkdirSync(SOURCES_DIR, { recursive: true });
  }
}

function readMetaStrict(): MetaStore {
  if (!existsSync(META_FILE)) return {};
  const parsed: unknown = JSON.parse(readFileSync(META_FILE, "utf-8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("knowledge-sources meta.json is not an object");
  }
  return parsed as MetaStore;
}

// Read-only callers keep the soft fallback; writers must use readMetaStrict so
// an unreadable meta.json is never overwritten with a view built from {}.
function readMeta(): MetaStore {
  try {
    return readMetaStrict();
  } catch {
    return {};
  }
}

function resolveSourcePath(filename: unknown): string | null {
  if (typeof filename !== "string" || !filename || filename.includes("\0")) return null;
  if (basename(filename) !== filename || filename.includes("/") || filename.includes("\\")) return null;
  if (!ALLOWED_EXTS.has(extname(filename).toLowerCase())) return null;
  try {
    return assertInsideDir(SOURCES_DIR, join(SOURCES_DIR, filename));
  } catch {
    return null;
  }
}

// Simple in-process queue to serialize writes to META_FILE and avoid
// concurrent write operations that could corrupt or overwrite metadata.
let metaWriteChain: Promise<void> = Promise.resolve();

type MetaStoreUpdater = (current: MetaStore) => MetaStore | Promise<MetaStore>;

async function writeMeta(mutator: MetaStoreUpdater) {
  // Re-read meta INSIDE the serialized critical section so each mutation observes
  // prior committed state — a pre-captured snapshot would let two overlapping
  // upload/delete calls each persist their own stale view (lost update / TOCTOU).
  const apply = async () => {
    let current: MetaStore;
    try {
      current = readMetaStrict();
    } catch (err) {
      // Keep the corrupt file for recovery instead of silently replacing it
      // (which would drop every previously uploaded source).
      if (existsSync(META_FILE)) {
        await rename(META_FILE, `${META_FILE}.corrupt-${Date.now()}`).catch(() => {});
      }
      throw err;
    }
    const next = await mutator(current);
    // Atomic write: a crash mid-write must not leave a truncated meta.json.
    const tmp = `${META_FILE}.tmp`;
    await writeFile(tmp, JSON.stringify(next, null, 2), "utf-8");
    await rename(tmp, META_FILE);
  };
  // Run the mutation whether the previous link resolved or rejected, but keep
  // propagating failures to this call's awaiter.
  metaWriteChain = metaWriteChain.then(apply, apply);

  await metaWriteChain;
}

/**
 * Look up a knowledge-source file by its ID. Returns its resolved path, original
 * name, and the size/uploadedAt used as the extracted-text cache key, or null if
 * not found.
 */
export function getSourceFilePath(
  id: string,
): { filePath: string; originalName: string; size: number; uploadedAt: string } | null {
  const meta = readMeta();
  const entry = meta[id];
  if (!entry) return null;
  const filePath = resolveSourcePath(entry.filename);
  if (!filePath) return null;
  return {
    filePath,
    originalName: entry.originalName,
    size: entry.size,
    uploadedAt: entry.uploadedAt,
  };
}

/**
 * Extract plain text from a file based on its extension.
 *
 * When `fileId` and `metadata` are supplied, the result is cached and reused
 * across calls while the file's (size, uploadedAt) are unchanged, so the
 * generation pipeline does not re-read/re-parse the same source every turn.
 */
export async function extractFileText(
  filePath: string,
  fileId?: string,
  metadata?: { size: number; uploadedAt: string },
): Promise<string> {
  // Ensure the resolved path is within SOURCES_DIR (defense-in-depth)
  const { resolve, sep } = await import("path");
  const resolved = resolve(filePath);
  const root = resolve(SOURCES_DIR);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    return "";
  }

  if (fileId && metadata) {
    const cached = textCache.get(fileId);
    if (cached && cached.size === metadata.size && cached.uploadedAt === metadata.uploadedAt) {
      // Refresh recency so eviction is LRU, not FIFO: re-inserting moves this id
      // to the end of the Map (same entry, so the char count is unchanged).
      textCache.delete(fileId);
      textCache.set(fileId, cached);
      return cached.text;
    }
  }

  const ext = extname(filePath).toLowerCase();
  let text = "";
  let extractionFailed = false;

  if (TEXT_EXTS.has(ext)) {
    text = await readFile(filePath, "utf-8");
  } else if (PDF_EXTS.has(ext)) {
    let pdf: { getText: () => Promise<{ text: string }>; destroy: () => Promise<void> | void } | undefined;
    try {
      const { PDFParse } = await import("pdf-parse");
      const buf = await readFile(filePath);
      pdf = new PDFParse({ data: new Uint8Array(buf) });
      const result = await pdf.getText();
      text = result.text;
    } catch {
      text = "[PDF text extraction failed]";
      extractionFailed = true;
    } finally {
      // Always free the parser's workers/memory, even on a getText() failure,
      // and never let a destroy() error mask a successful extraction.
      if (pdf) {
        try {
          await pdf.destroy();
        } catch {
          /* ignore cleanup failure */
        }
      }
    }
  }

  // Only cache a successful extraction. A transient parse failure must not poison
  // the source for the process lifetime — skip the cache so the next turn re-attempts.
  if (fileId && metadata && !extractionFailed) {
    setCachedText(fileId, { size: metadata.size, uploadedAt: metadata.uploadedAt, text });
  }

  return text;
}

export async function knowledgeSourcesRoutes(app: FastifyInstance) {
  // ── List all uploaded sources ──
  app.get("/", async () => {
    ensureDir();
    const meta = readMeta();
    return Object.values(meta).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  });

  // ── Upload a new source file ──
  app.post("/upload", async (req, reply) => {
    await mkdir(SOURCES_DIR, { recursive: true });
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return reply.status(400).send({
        error: `Unsupported file type: ${ext}. Supported: ${[...ALLOWED_EXTS].join(", ")}`,
      });
    }

    const id = nanoid();
    const filename = `${id}${ext}`;
    const filePath = join(SOURCES_DIR, filename);

    try {
      await pipeline(data.file, createWriteStream(filePath));
    } catch (err) {
      // Remove the partial file; the global error handler maps the multipart
      // size-limit error (statusCode 413) to a 413 response.
      await unlink(filePath).catch(() => {});
      throw err;
    }
    // @fastify/multipart ends (rather than errors) the stream at the size limit
    // and flags it as truncated; never keep a cut-off source.
    if (data.file.truncated) {
      await unlink(filePath).catch(() => {});
      return reply.status(413).send({ error: "File too large" });
    }

    const fileInfo = await stat(filePath);
    const entry: SourceMeta = {
      id,
      originalName: basename(data.filename),
      filename,
      size: fileInfo.size,
      uploadedAt: new Date().toISOString(),
    };
    try {
      await writeMeta((current) => {
        current[id] = entry;
        return current;
      });
    } catch (err) {
      // Without a meta entry the file is unreachable, so do not leave it behind.
      await unlink(filePath).catch(() => {});
      throw err;
    }
    // No cache invalidation needed: each upload mints a fresh nanoid, so there is
    // never a prior extracted-text entry for this id. (Delete invalidates on removal.)

    return entry;
  });

  // ── Delete a source file ──
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { id } = req.params;
    const meta = readMeta();
    const entry = meta[id];
    if (!entry) {
      return reply.status(404).send({ error: "Source not found" });
    }

    const filePath = resolveSourcePath(entry.filename);
    if (!filePath) {
      await writeMeta((current) => {
        delete current[id];
        return current;
      });
      deleteCachedText(id);
      return { success: true };
    }
    try {
      await unlink(filePath);
    } catch {
      /* file may already be gone */
    }
    await writeMeta((current) => {
      delete current[id];
      return current;
    });
    deleteCachedText(id);
    return { success: true };
  });

  // ── Get text content of a source (for preview / debugging) ──
  app.get<{ Params: { id: string } }>("/:id/text", async (req, reply) => {
    const { id } = req.params;
    const meta = readMeta();
    const entry = meta[id];
    if (!entry) {
      return reply.status(404).send({ error: "Source not found" });
    }

    const filePath = resolveSourcePath(entry.filename);
    if (!filePath || !existsSync(filePath)) {
      return reply.status(404).send({ error: "File not found on disk" });
    }

    const text = await extractFileText(filePath, id, { size: entry.size, uploadedAt: entry.uploadedAt });
    return { id, originalName: entry.originalName, text };
  });
}
