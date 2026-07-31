import { createHash } from "crypto";
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "fs";
import { dirname } from "path";
import { Readable } from "stream";
import { pipeline as streamPipeline } from "stream/promises";
import type { SidecarDownloadProgress } from "@marinara-engine/shared";
import { sanitizeApiError } from "../llm/base-provider.js";

const USER_AGENT = "MarinaraEngine";

export function isAbortError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /abort/i.test(message);
}

export interface DownloadFileOptions {
  url: string;
  destPath: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  expectedBytes?: number | null;
  expectedSha256?: string | null;
  progress: Omit<SidecarDownloadProgress, "downloaded" | "total" | "speed" | "status">;
  onProgress?: (progress: SidecarDownloadProgress) => void;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${sanitizeApiError(raw || response.statusText)}`);
  }

  return (await response.json()) as T;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries: number;
    baseDelayMs: number;
    shouldRetry?: (error: unknown) => boolean;
  },
): Promise<T> {
  const shouldRetry = options.shouldRetry ?? (() => true);
  let attempt = 0;
  let lastError: unknown;

  while (attempt < options.retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= options.retries || !shouldRetry(error)) {
        throw error;
      }
      const delayMs = options.baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Retry failed");
}

export async function downloadFileWithProgress(options: DownloadFileOptions): Promise<void> {
  const expectedSha256 = options.expectedSha256?.trim().toLowerCase() || null;
  if (expectedSha256 && !/^[a-f0-9]{64}$/u.test(expectedSha256)) {
    throw new Error("Expected download SHA-256 must contain exactly 64 hexadecimal characters.");
  }
  mkdirSync(dirname(options.destPath), { recursive: true });

  const tempPath = `${options.destPath}.download`;
  try {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  } catch {
    // Best-effort cleanup for stale temp files.
  }
  try {
    if (existsSync(options.destPath)) unlinkSync(options.destPath);
  } catch {
    // Best-effort cleanup for stale destination files.
  }

  const response = await fetch(options.url, {
    signal: options.signal,
    headers: {
      "User-Agent": USER_AGENT,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${sanitizeApiError(raw || response.statusText)}`);
  }

  if (!response.body) {
    throw new Error("Download response had no body");
  }

  const total = Number.parseInt(response.headers.get("content-length") || "0", 10) || 0;
  const contentEncoding = response.headers.get("content-encoding")?.trim().toLowerCase() ?? "";
  const expectedBytes =
    typeof options.expectedBytes === "number" && options.expectedBytes > 0 ? options.expectedBytes : total;
  const canValidateSize = expectedBytes > 0 && (!contentEncoding || contentEncoding === "identity");
  const sha256 = expectedSha256 ? createHash("sha256") : null;
  let downloaded = 0;
  let lastReportTime = Date.now();
  let lastReportBytes = 0;

  const reader = response.body.getReader();
  const writable = createWriteStream(tempPath);

  const readable = new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
          return;
        }

        downloaded += value.byteLength;
        sha256?.update(value);
        const now = Date.now();
        if (now - lastReportTime >= 250) {
          const elapsedSeconds = (now - lastReportTime) / 1000;
          const speed = elapsedSeconds > 0 ? (downloaded - lastReportBytes) / elapsedSeconds : 0;
          options.onProgress?.({
            ...options.progress,
            status: "downloading",
            downloaded,
            total: total || expectedBytes,
            speed,
          });
          lastReportTime = now;
          lastReportBytes = downloaded;
        }

        this.push(value);
      } catch (error) {
        this.destroy(error as Error);
      }
    },
  });

  try {
    await streamPipeline(readable, writable);
    const writtenBytes = statSync(tempPath).size;
    if (canValidateSize && writtenBytes !== expectedBytes) {
      throw new Error(`Downloaded file size mismatch: expected ${expectedBytes} bytes, received ${writtenBytes} bytes.`);
    }
    if (expectedSha256) {
      const actualSha256 = sha256!.digest("hex");
      if (actualSha256 !== expectedSha256) {
        throw new Error(`Downloaded file SHA-256 mismatch: expected ${expectedSha256}, received ${actualSha256}.`);
      }
    }
    renameSync(tempPath, options.destPath);
    options.onProgress?.({
      ...options.progress,
      status: "complete",
      downloaded: expectedBytes || writtenBytes || downloaded,
      total: expectedBytes || writtenBytes || downloaded,
      speed: 0,
    });
  } catch (error) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {
      // Best-effort cleanup on failure.
    }
    throw error;
  }
}
