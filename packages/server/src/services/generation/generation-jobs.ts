// ──────────────────────────────────────────────
// Generation jobs store (feature switch `generationJobTracking`)
//
// With the switch on, media generations (gallery images, selfies, scene
// videos, backgrounds, character drafts, sprites) run through this store
// instead of being tied to the HTTP response. A job keeps running after the
// tab closes; its metadata and result JSON are written under
// DATA_DIR/generation-jobs so the result can be picked up later. A restart
// marks jobs that were still running as interrupted (they are never re-run).
//
// With the switch off nothing here is created: no folder, no timers, and the
// routes keep their response-bound behaviour (see runGenerationJob in
// generation-job-tracker.ts). See docs/development/generation-jobs.md.
// ──────────────────────────────────────────────
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { DATA_DIR } from "../../utils/data-dir.js";
import { logger } from "../../lib/logger.js";
import { runWithRootLogContext } from "../../lib/log-context.js";

export type GenerationJobStatus = "running" | "completed" | "failed" | "cancelled" | "interrupted";
export interface GenerationJobMetadata {
  id: string;
  kind: string;
  label: string;
  chatId: string | null;
  status: GenerationJobStatus;
  createdAt: string;
  updatedAt: string;
  error: string | null;
  /** Stable ME_* code for a job that did not complete. */
  errorCode?: string;
  /** Random id for this failure, shown to the user and logged with it. */
  errorId?: string;
  resultAvailable: boolean;
}
export interface GenerationJobRunOptions {
  /** Optional caller-owned id for idempotent scheduling and immediate status responses. */
  id?: string;
  kind: string;
  label: string;
  chatId?: string;
  timeoutMs: number;
}
export interface GenerationJobs {
  run<T>(options: GenerationJobRunOptions, work: (signal: AbortSignal) => Promise<T>): Promise<T>;
  list(chatId?: string): Promise<GenerationJobMetadata[]>;
  get(id: string): Promise<GenerationJobMetadata | null>;
  result(id: string): Promise<unknown>;
  cancel(id: string): Promise<boolean>;
}
/**
 * Lifecycle seam for job tracking (generation-job-tracker.ts). "accepted" and "running" fire once the
 * job is persisted and its work starts; "settled" fires once per job with its final status. Observers run
 * synchronously inside run() and must never throw or block; the store guards the call anyway.
 */
export type GenerationJobLifecycleEvent =
  | { type: "accepted" | "running"; metadata: Readonly<GenerationJobMetadata> }
  | { type: "settled"; metadata: Readonly<GenerationJobMetadata>; elapsedMs: number; result?: unknown };
export type GenerationJobObserver = (event: GenerationJobLifecycleEvent) => void;
export interface GenerationJobsOptions {
  dataDir?: string;
  /** Maximum time close waits for provider work to settle after aborting it. */
  shutdownWaitMs?: number;
}

/** Newest terminal jobs whose metadata is kept on disk; well above list()'s 50 so per-chat lists stay intact. */
const MAX_RETAINED_JOBS = 200;
/** Newest terminal jobs whose (possibly multi-MB) result file is kept; matches list()'s visible window. */
const MAX_RETAINED_RESULTS = 50;
/** Results and metadata touched more recently than this are never pruned, so fresh results stay recoverable. */
const PRUNE_MIN_AGE_MS = 24 * 60 * 60 * 1000;
/** Stray temp or orphaned result files older than this are treated as leftovers. */
const STRAY_FILE_MIN_AGE_MS = 10 * 60 * 1000;
/** Minimum gap between retention passes triggered by finished jobs. */
const PRUNE_INTERVAL_MS = 10 * 60 * 1000;
/** A job result above this size logs one warn line. */
const LARGE_RESULT_BYTES = 32 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GENERATION_JOB_ERROR_CODES = {
  timeout: "ME_TIMEOUT",
  cancelled: "ME_CANCELLED",
  interrupted: "ME_INTERRUPTED",
  storage: "ME_STORAGE",
  failed: "ME_GENERATION_FAILED",
} as const;

function validId(id: string): boolean {
  return UUID_RE.test(id);
}
function validMetadata(value: unknown, id: string): value is GenerationJobMetadata {
  const item = value as Partial<GenerationJobMetadata>;
  return (
    !!item &&
    item.id === id &&
    validId(id) &&
    typeof item.kind === "string" &&
    typeof item.label === "string" &&
    (item.chatId === null || typeof item.chatId === "string") &&
    ["running", "completed", "failed", "cancelled", "interrupted"].includes(item.status ?? "") &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string" &&
    (item.error === null || typeof item.error === "string") &&
    (item.errorCode === undefined || typeof item.errorCode === "string") &&
    (item.errorId === undefined || typeof item.errorId === "string") &&
    typeof item.resultAvailable === "boolean"
  );
}

/**
 * Provider errors often echo the request back ("Provider rejected \"<prompt>\""), and job logs must never carry
 * prompt text. Keep the error's name, code, status and stack frames, but drop quoted spans from the message
 * (and the stack's first line, which repeats it) and cap what is left.
 */
const QUOTED_SPAN = /(["'`“‘])(?:(?!\1)[\s\S]){12,}?\1/gu;
const JOB_ERROR_MESSAGE_MAX = 300;
export function withoutEchoedPrompt(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  const message = error.message.replace(QUOTED_SPAN, "[quoted text removed]");
  const capped = message.length > JOB_ERROR_MESSAGE_MAX ? `${message.slice(0, JOB_ERROR_MESSAGE_MAX)}...` : message;
  if (capped === error.message) return error;
  const copy = new Error(capped, error.cause === undefined ? undefined : { cause: error.cause });
  copy.name = error.name;
  for (const key of ["code", "status", "statusCode", "errorCode"] as const) {
    const value = (error as unknown as Record<string, unknown>)[key];
    if (value !== undefined) (copy as unknown as Record<string, unknown>)[key] = value;
  }
  const frames = (error.stack ?? "").split("\n").filter((line) => /^\s+at /u.test(line));
  copy.stack = [`${error.name}: ${capped}`, ...frames].join("\n");
  return copy;
}

export type GenerationJobLogState =
  "accepted" | "running" | "completed" | "failed" | "cancelled" | "recovered" | "expired";

/**
 * Writes the one `job.state` line of a transition: info for accepted, running, completed, cancelled and
 * recovered; warn for failed and expired. Only ids, kinds, codes and timings are logged, never prompts.
 */
export function logJobState(
  metadata: GenerationJobMetadata,
  state: GenerationJobLogState,
  extra: Record<string, unknown> = {},
): void {
  const createdAt = Date.parse(metadata.createdAt);
  const fields: Record<string, unknown> = {
    event: "job.state",
    operation: "generation.job",
    state,
    jobId: metadata.id,
    jobKind: metadata.kind,
    ...(metadata.chatId ? { chatId: metadata.chatId } : {}),
    ...(Number.isFinite(createdAt) ? { elapsedMs: Math.max(0, Date.now() - createdAt) } : {}),
    ...extra,
  };
  if ("err" in extra) fields.err = withoutEchoedPrompt(extra.err);
  const level = state === "failed" || state === "expired" ? "warn" : "info";
  logger[level](fields, "Generation job %s", state);
}

function abortError(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

type JobRecord = {
  metadata: GenerationJobMetadata;
  controller: AbortController;
  timer?: ReturnType<typeof setTimeout>;
  settled: boolean;
  settledPromise: Promise<void>;
  resolveSettled: () => void;
  workSettledPromise: Promise<void>;
  resolveWorkSettled: () => void;
  workSettled: boolean;
  /** The cancel or shutdown status write, so the "settled" observer event fires after it is saved. */
  statusWrite?: Promise<void>;
};

export class GenerationJobsStore implements GenerationJobs {
  private root: string;
  private readonly shutdownWaitMs: number;
  private readonly jobs = new Map<string, JobRecord>();
  private closing = false;
  private ready: Promise<void>;
  private pruning: Promise<void> | null = null;
  private pruneAgain = false;
  private lastPruneAt = 0;
  private observer: GenerationJobObserver | null = null;

  constructor(app?: FastifyInstance, options: GenerationJobsOptions = {}) {
    // Tests may provide a complete isolated job directory.
    this.root = resolve(options.dataDir ?? join(DATA_DIR, "generation-jobs"));
    this.shutdownWaitMs = Math.max(0, options.shutdownWaitMs ?? 3_500);
    this.ready = this.initialize();
    if (app) app.addHook("onClose", async () => this.close());
  }

  private async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const entries = await readdir(this.root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name.endsWith(".result.json")) continue;
      const id = entry.name.slice(0, -5);
      if (!validId(id)) continue;
      try {
        const metadata = JSON.parse(await readFile(join(this.root, entry.name), "utf8")) as GenerationJobMetadata;
        if (!validMetadata(metadata, id)) continue;
        if (metadata.status === "running") {
          metadata.status = "interrupted";
          metadata.updatedAt = new Date().toISOString();
          metadata.error = "Generation was interrupted by server restart";
          metadata.errorCode = GENERATION_JOB_ERROR_CODES.interrupted;
          metadata.errorId = randomUUID();
          try {
            await this.persistMetadata(metadata);
          } catch (error) {
            logger.error(
              { event: "job.state", state: "failed", stage: "recovery", jobId: metadata.id, err: error },
              "Unable to persist interrupted generation job",
            );
            continue;
          }
          logJobState(metadata, "recovered", {
            outcome: "cancelled",
            errorCode: metadata.errorCode,
            errorId: metadata.errorId,
            reason: "restart",
          });
        }
      } catch (error) {
        logger.warn({ err: error, file: entry.name }, "Unable to recover generation job metadata");
      }
    }
    try {
      await this.prune();
    } catch (error) {
      logger.warn({ err: error }, "Unable to prune generation jobs");
    }
  }

  /** Throttled fire-and-forget retention pass; overlapping requests collapse into one follow-up run. */
  private schedulePrune(): void {
    if (this.closing) return;
    if (Date.now() - this.lastPruneAt < PRUNE_INTERVAL_MS) return;
    if (this.pruning) {
      this.pruneAgain = true;
      return;
    }
    this.pruning = (async () => {
      do {
        this.pruneAgain = false;
        try {
          await this.prune();
        } catch (error) {
          logger.warn({ err: error }, "Unable to prune generation jobs");
        }
      } while (this.pruneAgain && !this.closing);
    })().finally(() => {
      this.pruning = null;
    });
  }

  /**
   * Bounds disk use: drops metadata and results of old terminal jobs beyond MAX_RETAINED_JOBS, strips result
   * files beyond MAX_RETAINED_RESULTS, and removes stray temp files and orphaned results. Running jobs, jobs
   * still tracked in memory and anything updated within PRUNE_MIN_AGE_MS are never touched.
   */
  private async prune(): Promise<void> {
    this.lastPruneAt = Date.now();
    let entries;
    try {
      entries = await readdir(this.root, { withFileTypes: true });
    } catch (error: any) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    const now = Date.now();
    const metadataIds = new Set<string>();
    const resultIds = new Set<string>();
    const all: GenerationJobMetadata[] = [];
    const strays: string[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name.endsWith(".tmp")) {
        strays.push(entry.name);
        continue;
      }
      if (entry.name.endsWith(".result.json")) {
        resultIds.add(entry.name.slice(0, -".result.json".length));
        continue;
      }
      if (!entry.name.endsWith(".json")) continue;
      const id = entry.name.slice(0, -5);
      if (!validId(id)) continue;
      metadataIds.add(id);
      // Live jobs are never pruned; skipping their files also avoids holding a read handle while
      // atomicWrite renames over them, which fails with EPERM on Windows.
      if (this.jobs.has(id)) continue;
      try {
        const item = JSON.parse(await readFile(join(this.root, entry.name), "utf8"));
        if (validMetadata(item, id)) all.push(item);
      } catch (error) {
        logger.debug({ err: error, file: entry.name }, "Skipping unreadable generation job metadata");
      }
    }
    const removeFile = async (name: string) => {
      try {
        await unlink(join(this.root, name));
      } catch (error: any) {
        if (error?.code !== "ENOENT") throw error;
      }
    };
    const isOld = async (name: string) => {
      try {
        return now - (await stat(join(this.root, name))).mtimeMs > STRAY_FILE_MIN_AGE_MS;
      } catch {
        return false;
      }
    };
    for (const name of strays) {
      if (await isOld(name)) await removeFile(name);
    }
    for (const id of resultIds) {
      if (validId(id) && !metadataIds.has(id) && !this.jobs.has(id) && (await isOld(`${id}.result.json`))) {
        await removeFile(`${id}.result.json`);
      }
    }
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (let index = 0; index < all.length; index++) {
      const metadata = all[index]!;
      if (index < MAX_RETAINED_RESULTS) continue;
      if (metadata.status === "running" || this.jobs.has(metadata.id)) continue;
      const updatedAt = Date.parse(metadata.updatedAt);
      if (Number.isFinite(updatedAt) && now - updatedAt < PRUNE_MIN_AGE_MS) continue;
      if (index >= MAX_RETAINED_JOBS) {
        await removeFile(`${metadata.id}.result.json`);
        await removeFile(`${metadata.id}.json`);
        // An interrupted job nobody collected is dropped here; finished jobs age out silently.
        if (metadata.status === "interrupted") logJobState(metadata, "expired", { reason: "pruned" });
      } else if (resultIds.has(metadata.id) || metadata.resultAvailable) {
        await removeFile(`${metadata.id}.result.json`);
        if (metadata.resultAvailable) {
          metadata.resultAvailable = false;
          await this.persistMetadata(metadata);
        }
      }
    }
  }

  /** Installs (or with null removes) the single lifecycle observer. */
  setObserver(observer: GenerationJobObserver | null): void {
    this.observer = observer;
  }
  /** Whether a job is still owned by this process (running, or settling after cancel/shutdown). */
  isLive(id: string): boolean {
    return this.jobs.has(id);
  }
  private notify(event: GenerationJobLifecycleEvent): void {
    try {
      this.observer?.(event);
    } catch (error) {
      logger.warn({ err: error, jobId: event.metadata.id }, "Generation job observer failed");
    }
  }

  private async persistMetadata(metadata: GenerationJobMetadata): Promise<void> {
    await this.atomicWrite(join(this.root, `${metadata.id}.json`), JSON.stringify(metadata, null, 2));
  }
  private async atomicWrite(path: string, value: string): Promise<void> {
    const temp = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, value, "utf8");
      await rename(temp, path);
    } catch (error) {
      await unlink(temp).catch((cleanupError: unknown) => {
        logger.debug({ err: cleanupError, path: temp }, "Could not remove a generation job temp file");
      });
      throw error;
    }
  }
  private async readMetadata(id: string): Promise<GenerationJobMetadata | null> {
    if (!validId(id)) return null;
    try {
      const value = JSON.parse(await readFile(join(this.root, `${id}.json`), "utf8"));
      return validMetadata(value, id) ? value : null;
    } catch (error: any) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }
  private async update(
    record: JobRecord,
    status: GenerationJobStatus,
    error: string | null,
    resultAvailable = record.metadata.resultAvailable,
  ): Promise<void> {
    record.metadata.status = status;
    record.metadata.error = error;
    record.metadata.resultAvailable = resultAvailable;
    record.metadata.updatedAt = new Date().toISOString();
    await this.persistMetadata(record.metadata);
  }

  /** Stores the failure's code and a fresh error id on the metadata; the job.state line logs them. */
  private recordFailure(metadata: GenerationJobMetadata, code: string): { code: string; errorId: string } {
    metadata.errorCode = code;
    metadata.errorId = randomUUID();
    return { code, errorId: metadata.errorId };
  }

  async run<T>(options: GenerationJobRunOptions, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    await this.ready;
    if (this.closing) throw abortError("Generation job store is closing");
    const id = options.id ?? randomUUID();
    const now = new Date().toISOString();
    const metadata: GenerationJobMetadata = {
      id,
      kind: options.kind,
      label: options.label,
      chatId: options.chatId ?? null,
      status: "running",
      createdAt: now,
      updatedAt: now,
      error: null,
      resultAvailable: false,
    };
    let resolveSettled!: () => void;
    const settledPromise = new Promise<void>((resolve) => {
      resolveSettled = resolve;
    });
    let resolveWorkSettled!: () => void;
    const workSettledPromise = new Promise<void>((resolve) => {
      resolveWorkSettled = () => {
        record.workSettled = true;
        if (record.settled) this.jobs.delete(id);
        resolve();
      };
    });
    const record: JobRecord = {
      metadata,
      controller: new AbortController(),
      settled: false,
      settledPromise,
      resolveSettled,
      workSettledPromise,
      resolveWorkSettled: () => resolveWorkSettled(),
      workSettled: false,
    };
    this.jobs.set(id, record);
    const startedAt = Date.now();
    const timeout = Math.max(1, options.timeoutMs);
    logJobState(metadata, "accepted", { timeoutMs: timeout });
    try {
      await this.persistMetadata(metadata);
    } catch (error) {
      const failure = this.recordFailure(metadata, GENERATION_JOB_ERROR_CODES.storage);
      // Persistence failures are the one job failure logged at error.
      logger.error(
        {
          event: "job.state",
          state: "failed",
          outcome: "failed",
          jobId: id,
          jobKind: options.kind,
          ...failure,
          err: error,
        },
        "Unable to persist generation job start",
      );
      this.jobs.delete(id);
      throw error;
    }
    if (this.closing) {
      await this.update(record, "interrupted", "Generation was interrupted by server shutdown", false);
      this.jobs.delete(id);
      logJobState(metadata, "cancelled", { outcome: "cancelled", reason: "shutdown", timeoutMs: timeout });
      throw abortError("Generation job store is closing");
    }
    if (record.controller.signal.aborted || record.metadata.status !== "running") {
      await this.persistMetadata(record.metadata);
      this.jobs.delete(id);
      throw abortError(record.metadata.error ?? "Generation job cancelled");
    }
    this.notify({ type: "accepted", metadata });
    logJobState(metadata, "running", { timeoutMs: timeout });
    let timeoutTriggered = false;
    const abortPromise = new Promise<never>((_, reject) => {
      record.controller.signal.addEventListener(
        "abort",
        () =>
          reject(
            abortError(
              record.metadata.error ?? (timeoutTriggered ? "Generation job timed out" : "Generation job cancelled"),
            ),
          ),
        { once: true },
      );
    });
    abortPromise.catch(() => undefined);
    record.timer = setTimeout(() => {
      timeoutTriggered = true;
      record.controller.abort();
    }, timeout);
    // A root context: the job outlives the request that scheduled it, so its lines must not carry that requestId.
    const workPromise = Promise.resolve().then(() =>
      runWithRootLogContext({ operation: "generation.job", jobId: id }, () => work(record.controller.signal)),
    );
    workPromise.catch(() => undefined);
    workPromise.then(record.resolveWorkSettled, record.resolveWorkSettled);
    this.notify({ type: "running", metadata });
    let completedValue: unknown;
    return (async () => {
      try {
        const value = await Promise.race([workPromise, abortPromise]);
        if (record.metadata.status !== "running" || record.controller.signal.aborted)
          throw abortError(record.metadata.error ?? "Generation job cancelled");
        const serialized = value === undefined ? "null" : JSON.stringify(value);
        if (serialized === undefined) throw new Error("Generation result is not JSON serializable");
        const resultBytes = Buffer.byteLength(serialized);
        if (resultBytes > LARGE_RESULT_BYTES) {
          logger.warn(
            {
              event: "job.result.large",
              jobId: id,
              jobKind: options.kind,
              resultBytes,
              limitBytes: LARGE_RESULT_BYTES,
            },
            "Generation job result is large",
          );
        }
        await this.atomicWrite(join(this.root, `${id}.result.json`), serialized);
        if (record.metadata.status !== "running" || record.controller.signal.aborted)
          throw abortError(record.metadata.error ?? "Generation job cancelled");
        await this.update(record, "completed", null, true);
        completedValue = value;
        logJobState(metadata, "completed", { outcome: "ok", timeoutMs: timeout, resultBytes });
        return value;
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        if (record.metadata.status === "running") {
          const cancelled = !timeoutTriggered && record.controller.signal.aborted;
          const reference = this.recordFailure(
            record.metadata,
            timeoutTriggered
              ? GENERATION_JOB_ERROR_CODES.timeout
              : cancelled
                ? GENERATION_JOB_ERROR_CODES.cancelled
                : GENERATION_JOB_ERROR_CODES.failed,
          );
          await this.update(record, cancelled ? "cancelled" : "failed", failure.message, false);
          // The one line for this failure: it carries err, so outer layers only log a pointer.
          logJobState(metadata, cancelled ? "cancelled" : "failed", {
            outcome: cancelled ? "cancelled" : "failed",
            errorCode: reference.code,
            errorId: reference.errorId,
            timeoutMs: timeout,
            ...(cancelled ? {} : { err: failure }),
          });
        }
        throw failure;
      } finally {
        record.settled = true;
        if (record.timer) clearTimeout(record.timer);
        if (record.workSettled) this.jobs.delete(id);
        record.resolveSettled();
        const elapsedMs = Date.now() - startedAt;
        const notifySettled = () =>
          this.notify({ type: "settled", metadata: record.metadata, elapsedMs, result: completedValue });
        // A cancel or shutdown aborts first and saves its status after; announce the outcome once it is saved.
        if (record.statusWrite) void record.statusWrite.then(notifySettled, notifySettled);
        else notifySettled();
        this.schedulePrune();
      }
    })();
  }

  async list(chatId?: string): Promise<GenerationJobMetadata[]> {
    await this.ready;
    const entries = await readdir(this.root, { withFileTypes: true });
    const all: GenerationJobMetadata[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name.endsWith(".result.json")) continue;
      const id = entry.name.slice(0, -5);
      if (!validId(id)) continue;
      try {
        const item = JSON.parse(await readFile(join(this.root, entry.name), "utf8"));
        if (validMetadata(item, id) && (!chatId || item.chatId === chatId)) all.push(item);
      } catch (error) {
        logger.warn({ err: error, file: entry.name }, "Unable to read generation job metadata");
      }
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
  }
  async get(id: string): Promise<GenerationJobMetadata | null> {
    await this.ready;
    return this.readMetadata(id);
  }
  async result(id: string): Promise<unknown> {
    await this.ready;
    if (!validId(id)) throw new Error("Invalid generation job id");
    const metadata = await this.get(id);
    if (!metadata || metadata.status !== "completed" || !metadata.resultAvailable) {
      const error = new Error("Generation result not available");
      (error as any).code = "ENOENT";
      throw error;
    }
    return JSON.parse(await readFile(join(this.root, `${id}.result.json`), "utf8"));
  }
  async cancel(id: string): Promise<boolean> {
    await this.ready;
    const record = this.jobs.get(id);
    if (!record || record.metadata.status !== "running") return false;
    record.metadata.status = "cancelled";
    record.metadata.error = "Generation job cancelled";
    const reference = this.recordFailure(record.metadata, GENERATION_JOB_ERROR_CODES.cancelled);
    const statusWrite = this.update(record, "cancelled", "Generation job cancelled", false);
    record.statusWrite = statusWrite;
    record.controller.abort();
    await statusWrite;
    logJobState(record.metadata, "cancelled", {
      outcome: "cancelled",
      errorCode: reference.code,
      errorId: reference.errorId,
      reason: "user",
    });
    return true;
  }
  async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    await this.ready;
    if (this.pruning) await this.pruning;
    const records = [...this.jobs.values()];
    for (const record of records) {
      if (record.metadata.status !== "running") continue;
      record.controller.abort();
      try {
        const reference = this.recordFailure(record.metadata, GENERATION_JOB_ERROR_CODES.interrupted);
        record.statusWrite = this.update(record, "interrupted", "Generation was interrupted by server shutdown", false);
        await record.statusWrite;
        logJobState(record.metadata, "cancelled", {
          outcome: "cancelled",
          errorCode: reference.code,
          errorId: reference.errorId,
          reason: "shutdown",
        });
      } catch (error) {
        logger.error({ err: error, jobId: record.metadata.id }, "Unable to persist interrupted generation job");
      }
    }
    if (records.length === 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.all(records.flatMap((record) => [record.settledPromise, record.workSettledPromise])),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, this.shutdownWaitMs);
      }),
    ]);
    if (timer) clearTimeout(timer);
    const unsettled = records.filter((record) => !record.settled || !record.workSettled);
    if (unsettled.length > 0) {
      logger.warn(
        { count: unsettled.length, waitMs: this.shutdownWaitMs },
        "Generation jobs did not settle before shutdown wait expired",
      );
    }
  }
  get dataDir(): string {
    return this.root;
  }
}

export function createGenerationJobs(options: GenerationJobsOptions | string = {}): GenerationJobsStore {
  return new GenerationJobsStore(undefined, typeof options === "string" ? { dataDir: options } : options);
}
