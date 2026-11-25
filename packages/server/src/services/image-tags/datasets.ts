import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  IMAGE_TAG_CATEGORIES,
  IMAGE_TAG_LIMITS,
  type ImageTagCategory,
  type ImageTagDatasetSummary,
  type ImageTagRecord,
  type ImageTagSearchRequest,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { writeFileAtomic } from "../../utils/atomic-write.js";
import { parseImageTagCsv } from "./csv.js";
import { searchImageTagRecords } from "./search.js";

const MAX_STORED_BYTES = 128 * 1024 * 1024;
const sourceId = z.uuid();
const category = z.custom<ImageTagCategory>((value) => IMAGE_TAG_CATEGORIES.includes(value as ImageTagCategory));
const token = z
  .string()
  .min(1)
  .max(IMAGE_TAG_LIMITS.fieldCharacters)
  .regex(/^[^\x00-\x1f\x7f]+$/);
const recordSchema = z.object({
  name: token,
  category,
  postCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  aliases: z.array(token).max(IMAGE_TAG_LIMITS.aliasesPerRecord),
});
const importOptions = z
  .object({
    name: token.optional(),
    originalName: token,
    sourceUrl: z
      .url()
      .max(2048)
      .refine((value) => new URL(value).protocol === "https:")
      .optional(),
    category: category.optional(),
    replaceId: sourceId.optional(),
  })
  .strict();
const updateOptions = z
  .object({
    name: token.optional(),
    enabled: z.boolean().optional(),
    enabledCategories: z.array(category).max(IMAGE_TAG_CATEGORIES.length).optional(),
  })
  .strict();
const reportSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  acceptedRows: z.number().int().nonnegative(),
  blankRows: z.number().int().nonnegative(),
  invalidRows: z.number().int().nonnegative(),
  duplicateRows: z.number().int().nonnegative(),
  headerRows: z.number().int().min(0).max(1),
  issues: z
    .array(
      z.object({
        row: z.number().int().positive(),
        code: z.enum([
          "invalid_columns",
          "invalid_name",
          "invalid_category",
          "invalid_count",
          "invalid_aliases",
          "duplicate",
        ]),
      }),
    )
    .max(IMAGE_TAG_LIMITS.issueExamples),
  omittedIssues: z.number().int().nonnegative(),
});
const artifactSchema = z.object({
  version: z.literal(1),
  summary: z.object({
    id: sourceId,
    name: token,
    originalName: token,
    sourceUrl: importOptions.shape.sourceUrl,
    importedAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    scheme: z.literal("danbooru"),
    enabled: z.boolean(),
    enabledCategories: z.array(category).max(IMAGE_TAG_CATEGORIES.length),
    recordCount: z.number().int().positive().max(IMAGE_TAG_LIMITS.recordsPerSource),
    categoryCounts: z.record(z.string(), z.number().int().nonnegative()),
    report: reportSchema,
  }),
  records: z.array(recordSchema).min(1).max(IMAGE_TAG_LIMITS.recordsPerSource),
});

type Source = { summary: ImageTagDatasetSummary; records: ImageTagRecord[] };
type Artifact = Source & { version: 1 };
const queues = new Map<string, Promise<unknown>>();

/** Profile asset promotion and rollback must share the dataset writers' queue. */
export async function withImageTagDatasetMutation<T>(dataDir: string, task: () => Promise<T>): Promise<T> {
  const directory = resolve(dataDir, "image-tag-datasets");
  const previous = queues.get(directory) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(directory, next);
  try {
    return await next;
  } finally {
    if (queues.get(directory) === next) queues.delete(directory);
  }
}

export class ImageTagDatasetError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

/** One artifact commits metadata and records together. Caches follow filesystem identity, including profile restores. */
export function createImageTagDatasetStore(dataDir: string, write: typeof writeFileAtomic = writeFileAtomic) {
  const directory = resolve(dataDir, "image-tag-datasets");
  const cache = new Map<string, { signature: string; source: Source }>();

  function pathFor(id: string) {
    if (!sourceId.safeParse(id).success) throw new ImageTagDatasetError("Invalid image tag dataset ID");
    return join(directory, `${id}.json`);
  }

  async function ensureDirectory() {
    await mkdir(directory, { recursive: true });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("Image tag dataset directory must not be a symlink");
  }

  async function locked<T>(task: () => Promise<T>): Promise<T> {
    return withImageTagDatasetMutation(dataDir, task);
  }

  async function load() {
    await ensureDirectory();
    const sources: Source[] = [];
    const unavailableSources: string[] = [];
    const names = (await readdir(directory))
      .filter((name) => name.endsWith(".json") && sourceId.safeParse(name.slice(0, -5)).success)
      .sort();
    let bytes = 0;
    let recordCount = 0;
    const present = new Set(names.map((name) => name.slice(0, -5)));
    for (const id of cache.keys()) if (!present.has(id)) cache.delete(id);
    for (const filename of names) {
      const id = filename.slice(0, -5);
      let observedSize = 0;
      try {
        const info = await lstat(pathFor(id));
        observedSize = info.size;
        bytes += info.size;
        if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_STORED_BYTES)
          throw new Error("Invalid image tag dataset file");
        if (bytes > MAX_STORED_BYTES || sources.length >= IMAGE_TAG_LIMITS.sources)
          throw new Error("Installed image tag dataset size limit exceeded");
        const signature = `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
        let source = cache.get(id)?.signature === signature ? cache.get(id)!.source : undefined;
        if (!source) {
          const parsed = artifactSchema.parse(JSON.parse(await readFile(pathFor(id), "utf8")));
          if (
            parsed.summary.id !== id ||
            parsed.summary.recordCount !== parsed.records.length ||
            parsed.summary.report.acceptedRows !== parsed.records.length
          ) {
            throw new Error("Image tag dataset metadata does not match records");
          }
          source = { summary: parsed.summary, records: parsed.records };
          cache.set(id, { signature, source });
        }
        recordCount += source.records.length;
        if (recordCount > IMAGE_TAG_LIMITS.installedRecords)
          throw new Error("Installed image tag record limit exceeded");
        sources.push(source);
      } catch (error) {
        cache.delete(id);
        // Removal can race a listing or an uncached read; a vanished source is not corrupt.
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          bytes -= observedSize;
          continue;
        }
        unavailableSources.push(id);
        logger.warn(error, "Unable to load image tag dataset %s", id);
      }
    }
    return { sources, unavailableSources, bytes };
  }

  async function save(source: Source) {
    const artifact: Artifact = { version: 1, ...source };
    await write(pathFor(source.summary.id), JSON.stringify(artifact));
    cache.delete(source.summary.id);
  }

  return {
    async list() {
      const { sources, unavailableSources } = await load();
      return { sources: sources.map((source) => structuredClone(source.summary)), unavailableSources };
    },
    async importCsv(bytes: Uint8Array, options: z.input<typeof importOptions>) {
      const checked = importOptions.safeParse(options);
      if (!checked.success) throw new ImageTagDatasetError("Invalid image tag import options");
      if (bytes.byteLength > IMAGE_TAG_LIMITS.uploadBytes)
        throw new ImageTagDatasetError("Image tag CSV exceeds the upload limit", 413);
      // The caller may reuse its buffer while this import waits behind another writer.
      const snapshot = Buffer.from(bytes);
      const fingerprint = createHash("sha256").update(snapshot).digest("hex");
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(snapshot);
      } catch {
        throw new ImageTagDatasetError("Image tag CSV must use UTF-8 encoding");
      }
      let parsed: ReturnType<typeof parseImageTagCsv>;
      try {
        parsed = parseImageTagCsv(text, { category: checked.data.category });
      } catch (error) {
        throw new ImageTagDatasetError(error instanceof Error ? error.message : "Invalid image tag CSV");
      }
      return locked(async () => {
        const { sources, unavailableSources, bytes: storedBytes } = await load();
        const old = checked.data.replaceId
          ? sources.find((source) => source.summary.id === checked.data.replaceId)
          : undefined;
        if (checked.data.replaceId && !old && !unavailableSources.includes(checked.data.replaceId))
          throw new ImageTagDatasetError("Image tag dataset not found", 404);
        // Category is part of a split CSV's meaning even when the original bytes are identical.
        const duplicate = sources.find(
          (source) =>
            source.summary.fingerprint === fingerprint &&
            source.summary.id !== checked.data.replaceId &&
            source.records.length === parsed.records.length &&
            source.records.every((record, index) => record.category === parsed.records[index]!.category),
        );
        if (duplicate)
          throw new ImageTagDatasetError("This CSV is already imported; replace the existing dataset instead", 409);
        if (!checked.data.replaceId && sources.length + unavailableSources.length >= IMAGE_TAG_LIMITS.sources)
          throw new ImageTagDatasetError("Too many image tag datasets");
        const installed = sources.reduce((count, source) => count + (source === old ? 0 : source.records.length), 0);
        if (installed + parsed.records.length > IMAGE_TAG_LIMITS.installedRecords)
          throw new ImageTagDatasetError("Installed image tag record limit exceeded");
        const now = new Date().toISOString();
        const categoryCounts: ImageTagDatasetSummary["categoryCounts"] = {};
        for (const record of parsed.records)
          categoryCounts[record.category] = (categoryCounts[record.category] ?? 0) + 1;
        const source: Source = {
          summary: {
            id: checked.data.replaceId ?? randomUUID(),
            name: checked.data.name ?? old?.summary.name ?? checked.data.originalName,
            originalName: checked.data.originalName,
            sourceUrl: checked.data.sourceUrl ?? old?.summary.sourceUrl,
            importedAt: old?.summary.importedAt ?? now,
            updatedAt: now,
            fingerprint,
            scheme: "danbooru",
            enabled: old?.summary.enabled ?? true,
            enabledCategories: old?.summary.enabledCategories ?? [...IMAGE_TAG_CATEGORIES],
            recordCount: parsed.records.length,
            categoryCounts,
            report: parsed.report,
          },
          records: parsed.records,
        };
        if (source.summary.sourceUrl === undefined) delete source.summary.sourceUrl;
        const size = Buffer.byteLength(JSON.stringify({ version: 1, ...source }));
        const oldSize = checked.data.replaceId ? (await lstat(pathFor(checked.data.replaceId))).size : 0;
        if (storedBytes - oldSize + size > MAX_STORED_BYTES)
          throw new ImageTagDatasetError("Installed image tag dataset size limit exceeded");
        await save(source);
        return structuredClone(source.summary);
      });
    },
    async update(id: string, changes: z.input<typeof updateOptions>) {
      pathFor(id);
      const checked = updateOptions.safeParse(changes);
      if (!checked.success) throw new ImageTagDatasetError("Invalid image tag dataset settings");
      return locked(async () => {
        const { sources, bytes: storedBytes } = await load();
        const source = sources.find((candidate) => candidate.summary.id === id);
        if (!source) throw new ImageTagDatasetError("Image tag dataset not found", 404);
        const summary = { ...source.summary, updatedAt: new Date().toISOString() };
        if (checked.data.name !== undefined) summary.name = checked.data.name;
        if (checked.data.enabled !== undefined) summary.enabled = checked.data.enabled;
        if (checked.data.enabledCategories !== undefined)
          summary.enabledCategories = [...new Set(checked.data.enabledCategories)];
        const updated = { summary, records: source.records };
        const oldSize = (await lstat(pathFor(id))).size;
        if (storedBytes - oldSize + Buffer.byteLength(JSON.stringify({ version: 1, ...updated })) > MAX_STORED_BYTES) {
          throw new ImageTagDatasetError("Installed image tag dataset size limit exceeded");
        }
        await save(updated);
        return structuredClone(summary);
      });
    },
    async remove(id: string) {
      const path = pathFor(id);
      return locked(async () => {
        await ensureDirectory();
        try {
          await unlink(path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT")
            throw new ImageTagDatasetError("Image tag dataset not found", 404);
          throw error;
        }
        cache.delete(id);
      });
    },
    async search(request: ImageTagSearchRequest) {
      const { sources, unavailableSources } = await load();
      if (unavailableSources.length)
        throw new ImageTagDatasetError("Some image tag datasets are unavailable; check the dataset manager", 503);
      try {
        return searchImageTagRecords(sources, request);
      } catch (error) {
        throw new ImageTagDatasetError(error instanceof Error ? error.message : "Invalid image tag search");
      }
    },
  };
}
