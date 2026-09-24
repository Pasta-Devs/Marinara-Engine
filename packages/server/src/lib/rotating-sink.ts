// ──────────────────────────────────────────────
// Rotating file sink: bounded, append-only JSON line files
// ──────────────────────────────────────────────
// Writes are synchronous, so a line written right before process.exit is not
// lost. Each process writes <prefix>-<pid>-<runId>.log; past maxBytes the file
// is renamed with a timestamp suffix and a new one is opened. Files of
// processes that are no longer running are pruned beyond `keep` or after
// `retentionMs`. A record over 256 KiB is cut down to its identifying fields.
// A write failure never throws: it is reported on stderr at most every 30 s,
// and the next file that opens says how many records were lost.
// ──────────────────────────────────────────────
import {
  appendFileSync,
  closeSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";

const MAX_RECORD_BYTES = 256 * 1024;
const DEFAULT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
/** Fields a record keeps when it is too large to write whole. */
const COMPACT_KEYS = [
  "level",
  "time",
  "msg",
  "event",
  "errorCode",
  "code",
  "errorId",
  "requestId",
  "operationId",
  "operation",
  "stage",
  "jobId",
  "chatId",
  "bootId",
] as const;
let lastWarningAt = 0;
let suppressedFailures = 0;
let droppedRecords = 0;

export interface RotatingSinkOptions {
  directory: string;
  maxBytes: number;
  keep: number;
  retentionMs?: number;
  /** File name prefix. Each prefix prunes only its own files. Default "marinara". */
  prefix?: string;
  /** Run id in the file name. Default: random. The logger passes its bootId. */
  runId?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fileNamePattern(prefix: string): RegExp {
  return new RegExp(`^${escapeRegExp(prefix)}-(\\d+)-([a-z0-9]+)\\.log(?:\\.(\\d+)-([a-z0-9]+))?$`);
}

function warningText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return (
    raw
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 240) || "unknown error"
  );
}

function warn(error: unknown): void {
  const now = Date.now();
  if (now - lastWarningAt < 30_000) {
    suppressedFailures++;
    return;
  }
  lastWarningAt = now;
  const suppressedCount = suppressedFailures;
  suppressedFailures = 0;
  try {
    process.stderr.write(
      `${JSON.stringify({
        level: 40,
        time: now,
        errorCode: "ME_LOG_WRITE",
        event: "log.sink_failed",
        reason: warningText(error),
        suppressedCount,
        droppedRecords,
      })}\n`,
    );
  } catch {
    // stderr may be unavailable during shutdown; there is nowhere left to report to.
  }
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value) <= maxBytes) return value;
  return Buffer.from(value).subarray(0, maxBytes).toString("utf8");
}

function compactLimit(key: string, cap: number): number {
  return key === "msg" ? Math.min(cap, 1024) : cap;
}

function boundedRecord(input: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    parsed = { message: input };
  }
  const normal = `${JSON.stringify(parsed)}\n`;
  const originalBytes = Buffer.byteLength(normal);
  if (originalBytes <= MAX_RECORD_BYTES) return normal;
  const source =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};

  // First drop only the single largest value, which keeps every other field of the line.
  let largestKey: string | undefined;
  let largestBytes = 0;
  for (const [key, value] of Object.entries(source)) {
    const bytes = Buffer.byteLength(JSON.stringify(value) ?? "");
    if (bytes > largestBytes) {
      largestBytes = bytes;
      largestKey = key;
    }
  }
  if (largestKey !== undefined) {
    const trimmed = `${JSON.stringify({ ...source, [largestKey]: "[TRUNCATED]", originalBytes, truncated: true })}\n`;
    if (Buffer.byteLength(trimmed) <= MAX_RECORD_BYTES) return trimmed;
  }

  const compact: Record<string, unknown> = {};
  for (const key of COMPACT_KEYS) {
    const value = source[key];
    if (value === undefined) continue;
    if (typeof value === "string") compact[key] = truncateUtf8(value, compactLimit(key, 4096));
    else if (value === null || typeof value === "number" || typeof value === "boolean") compact[key] = value;
    else compact[key] = "[truncated]";
  }
  compact.originalBytes = originalBytes;
  compact.truncated = true;
  for (let cap = 4096; cap >= 1; cap = Math.floor(cap / 2)) {
    for (const key of COMPACT_KEYS) {
      if (typeof source[key] === "string") compact[key] = truncateUtf8(source[key] as string, compactLimit(key, cap));
    }
    const candidate = `${JSON.stringify(compact)}\n`;
    if (Buffer.byteLength(candidate) <= MAX_RECORD_BYTES) return candidate;
  }
  return `${JSON.stringify({ truncated: true, originalBytes, msg: "[truncated]" })}\n`;
}

function isRegularFile(path: string): boolean {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

export class RotatingFileSink {
  private path = "";
  private fd: number | undefined;
  private bytes = 0;
  private readonly prefix: string;
  private readonly runId: string;
  private readonly fileName: RegExp;
  constructor(private readonly options: RotatingSinkOptions) {
    this.prefix = options.prefix ?? "marinara";
    this.runId = options.runId ?? randomBytes(6).toString("hex");
    this.fileName = fileNamePattern(this.prefix);
  }

  private ensureOpen(): boolean {
    if (this.fd !== undefined) return true;
    const directory = resolve(this.options.directory);
    try {
      mkdirSync(directory, { recursive: true });
      const directoryStat = lstatSync(directory);
      if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink())
        throw new Error("refusing non-directory or symlink log path");
      this.path = join(directory, `${this.prefix}-${process.pid}-${this.runId}.log`);
      this.fd = openSync(this.path, "a", 0o600);
      this.bytes = fstatSync(this.fd).size;
      this.prune();
      this.writeDroppedMarker();
      return true;
    } catch (error) {
      this.path = "";
      this.fd = undefined;
      warn(error);
      return false;
    }
  }

  /** After failures, the first record of a newly opened file says how many records were lost. */
  private writeDroppedMarker(): void {
    if (droppedRecords === 0 || this.fd === undefined) return;
    const count = droppedRecords;
    try {
      const marker = `${JSON.stringify({
        level: 40,
        time: Date.now(),
        event: "log.dropped",
        count,
        msg: "Log records were dropped after a write failure",
      })}\n`;
      appendFileSync(this.fd, marker);
      this.bytes += Buffer.byteLength(marker);
      droppedRecords = 0;
    } catch {
      // The count stays pending: the next write reports the failure and the next file carries the marker.
    }
  }

  write(input: string): boolean {
    const record = boundedRecord(input);
    const size = Buffer.byteLength(record);
    if (!this.ensureOpen() || this.fd === undefined) {
      droppedRecords++;
      return false;
    }
    try {
      if (this.bytes > 0 && this.bytes + size > this.options.maxBytes && !this.rotate()) {
        droppedRecords++;
        return false;
      }
      appendFileSync(this.fd, record);
      this.bytes += size;
      return true;
    } catch (error) {
      droppedRecords++;
      warn(error);
      return false;
    }
  }

  private rotate(): boolean {
    if (this.fd === undefined || !this.path) return false;
    const oldPath = this.path;
    try {
      closeSync(this.fd);
      this.fd = undefined;
      renameSync(oldPath, `${oldPath}.${Date.now()}-${randomBytes(3).toString("hex")}`);
      this.fd = openSync(oldPath, "a", 0o600);
      this.bytes = 0;
      this.prune();
      this.writeDroppedMarker();
      return true;
    } catch (error) {
      this.fd = undefined;
      warn(error);
      return false;
    }
  }

  private prune(): void {
    if (!this.path) return;
    try {
      const directory = dirname(this.path);
      const currentName = this.path.slice(directory.length + 1);
      const now = Date.now();
      const inactive: Array<{ name: string; mtimeMs: number }> = [];
      for (const name of readdirSync(directory)) {
        const match = name.match(this.fileName);
        if (!match || name === currentName) continue;
        const target = join(directory, name);
        if (!isRegularFile(target)) continue;
        const pid = Number(match[1]);
        const isOwn = pid === process.pid;
        if (!isOwn) {
          try {
            process.kill(pid, 0);
            continue;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") continue;
          }
        }
        try {
          inactive.push({ name, mtimeMs: statSync(target).mtimeMs });
        } catch {
          // The file went away between readdir and stat (another process pruned it).
        }
      }
      inactive.sort((a, b) => b.mtimeMs - a.mtimeMs);
      const keep = Math.max(0, Math.floor(this.options.keep));
      const retention = this.options.retentionMs ?? DEFAULT_RETENTION_MS;
      for (const [index, item] of inactive.entries()) {
        if (index < keep && now - item.mtimeMs <= retention) continue;
        const target = join(directory, item.name);
        try {
          if (isRegularFile(target)) unlinkSync(target);
        } catch {
          // Another process pruned it first, or it is not ours to delete; pruning is best effort.
        }
      }
    } catch (error) {
      warn(error);
    }
  }

  end(): void {
    if (this.fd !== undefined) {
      try {
        closeSync(this.fd);
      } catch {
        // Closing at shutdown: the descriptor may already be gone.
      }
      this.fd = undefined;
    }
  }
}
