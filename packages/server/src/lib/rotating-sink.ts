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
import { sanitizeDiagnosticText } from "./diagnostics.js";

const MAX_RECORD_BYTES = 256 * 1024;
const DEFAULT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const FILE_NAME = /^marinara-(\d+)-([a-z0-9]+)\.log(?:\.(\d+)-([a-z0-9]+))?$/;
let lastWarningAt = 0;

export interface RotatingSinkOptions {
  directory: string;
  maxBytes: number;
  keep: number;
  retentionMs?: number;
}

function warningText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return (
    sanitizeDiagnosticText(raw)
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 240) || "unknown error"
  );
}

function warn(error: unknown): void {
  const now = Date.now();
  if (now - lastWarningAt < 30_000) return;
  lastWarningAt = now;
  try {
    process.stderr.write(`[ME_LOG_WRITE] ${warningText(error)}\n`);
  } catch {
    /* stderr may be unavailable during shutdown */
  }
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value) <= maxBytes) return value;
  return Buffer.from(value).subarray(0, maxBytes).toString("utf8");
}

function boundedRecord(input: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    parsed = { message: input };
  }
  const normal = `${JSON.stringify(parsed)}\n`;
  if (Buffer.byteLength(normal) <= MAX_RECORD_BYTES) return normal;
  const source =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  const compact: Record<string, unknown> = { truncated: true };
  for (const key of ["code", "errorId", "requestId"] as const) {
    const value = source[key];
    if (value === undefined) continue;
    if (typeof value === "string") compact[key] = truncateUtf8(value, 4096);
    else if (value === null || typeof value === "number" || typeof value === "boolean") compact[key] = value;
    else compact[key] = "[truncated]";
  }
  compact.message = "[truncated]";
  for (let cap = 4096; cap >= 1; cap = Math.floor(cap / 2)) {
    for (const key of ["code", "errorId", "requestId"] as const) {
      if (typeof source[key] === "string") compact[key] = truncateUtf8(source[key] as string, cap);
    }
    const candidate = `${JSON.stringify(compact)}\n`;
    if (Buffer.byteLength(candidate) <= MAX_RECORD_BYTES) return candidate;
  }
  return `${JSON.stringify({ truncated: true, message: "[truncated]" })}\n`;
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
  constructor(private readonly options: RotatingSinkOptions) {}

  private ensureOpen(): boolean {
    if (this.fd !== undefined) return true;
    const directory = resolve(this.options.directory);
    try {
      mkdirSync(directory, { recursive: true });
      const directoryStat = lstatSync(directory);
      if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink())
        throw new Error("refusing non-directory or symlink log path");
      const run = randomBytes(6).toString("hex");
      this.path = join(directory, `marinara-${process.pid}-${run}.log`);
      this.fd = openSync(this.path, "a", 0o600);
      this.bytes = fstatSync(this.fd).size;
      this.prune();
      return true;
    } catch (error) {
      this.path = "";
      this.fd = undefined;
      warn(error);
      return false;
    }
  }

  write(input: string): boolean {
    const record = boundedRecord(input);
    const size = Buffer.byteLength(record);
    if (!this.ensureOpen() || this.fd === undefined) return false;
    try {
      if (this.bytes > 0 && this.bytes + size > this.options.maxBytes && !this.rotate()) return false;
      appendFileSync(this.fd, record);
      this.bytes += size;
      return true;
    } catch (error) {
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
        const match = name.match(FILE_NAME);
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
          /* race */
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
          /* race or permissions */
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
        /* shutdown */
      }
      this.fd = undefined;
    }
  }
}
