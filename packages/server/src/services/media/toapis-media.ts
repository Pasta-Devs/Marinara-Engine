// ToAPIs asynchronous media for the existing OpenAI-image and Seedance connections.
// Contract reference: https://docs.toapis.com/docs/cn/api-reference/tasks/video-status
// Adapted from ToAPIs-2025/lower-cost-marinara-media-toapis (AGPL-3.0).
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type {
  ImageGenRequest,
  ImageGenResult,
  VideoGenerationRequest,
  VideoGenerationResult,
} from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { safeFetch, resolveValidatedImage, validateOutboundUrl } from "../../utils/security.js";
import { logger, logDebugOverride, privateErrorLogFields } from "../../lib/logger.js";
import { logRateLimited } from "../../lib/log-rate-limit.js";
import { sanitizeApiError } from "../llm/base-provider.js";

export function isToAPIsMediaUrl(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl);
    return (
      u.protocol === "https:" &&
      ["toapis.com", "toapis.cn"].includes(u.hostname) &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.search &&
      !u.hash &&
      /^\/(?:v1\/?)?$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}

function apiUrl(base: string, path: string): string {
  if (!isToAPIsMediaUrl(base)) throw new Error("Use an HTTPS ToAPIs origin or /v1 base URL");
  return `${new URL(base).origin}/v1/${path}`;
}

const policy = { allowLocal: false, allowLoopback: false, allowMdns: false, allowedProtocols: ["https:"] };
type Task = { id?: string; status?: string; result?: { data?: Array<{ url?: string }> }; data?: { url?: string } };
export class ToAPIsHttpError extends Error {
  readonly [privateErrorLogFields]: { type: string; status: number; messageLength: number };
  constructor(
    public readonly status: number,
    resource: string,
    details = "",
  ) {
    super(`ToAPIs ${resource} HTTP ${status}${details ? `: ${details}` : ""}`);
    this[privateErrorLogFields] = { type: "ToAPIsHttpError", status, messageLength: this.message.length };
  }
}

/** A paid task may exist: callers must not submit an automatic replacement. */
export class ToAPIsSubmittedTaskError extends Error {
  readonly retryable = false;
  readonly [privateErrorLogFields]: {
    type: string;
    retryable: boolean;
    messageLength: number;
    localReceiptId?: string;
  };
  constructor(cause: unknown, localReceiptId?: string) {
    super(cause instanceof Error ? cause.message : "ToAPIs task interrupted", { cause });
    this.name = "ToAPIsSubmittedTaskError";
    this[privateErrorLogFields] = {
      type: this.name,
      retryable: false,
      messageLength: this.message.length,
      localReceiptId,
    };
  }
}
async function api(
  base: string,
  key: string,
  path: string,
  body?: Record<string, unknown> | FormData,
  signal?: AbortSignal,
): Promise<Task> {
  signal?.throwIfAborted();
  const response = await safeFetch(apiUrl(base, path), {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal,
    // Never replay a paid POST on redirect, or send provider credentials to another origin.
    policy: { ...policy, allowedOrigins: [new URL(base).origin], maxRedirects: 0 },
    maxResponseBytes: 2 * 1024 * 1024,
    decodeCompressedResponse: true,
  });
  if (!response.ok) {
    // safeFetch already buffered and capped this response (including decompression) at 2 MiB.
    let details = await response.text().catch(() => "");
    try {
      const parsed = JSON.parse(details);
      const message = parsed?.error?.message ?? parsed?.error ?? parsed?.message;
      details = typeof message === "string" ? message : "";
    } catch {
      // The shared sanitizer also handles plain-text and HTML proxy errors.
    }
    // Decode before redaction, and apply the display cap only after redacting complete private values.
    details = sanitizeApiError(details, details.length);
    for (const privateValue of [key, key.trim(), decodeURIComponent(path.split("/")[2] || "")]) {
      if (privateValue) details = details.replaceAll(privateValue, "[redacted]");
    }
    details = details
      .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted URL]")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
    logger.debug("[toapis] API HTTP %d rejection: %s", response.status, details);
    throw new ToAPIsHttpError(response.status, path.split("/")[0]!, details);
  }
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("ToAPIs returned an invalid response");
  }
  return result as Task;
}

function referenceBytes(base64: string, declaredType: string): Buffer {
  const encoded = base64.replace(/^data:[^,]+,/, "").replace(/\s/g, "");
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 === 1)
    throw new Error("Invalid reference image base64");
  const bytes = Buffer.from(encoded, "base64");
  const info = resolveValidatedImage(bytes);
  if (
    !info ||
    info.mimeType !== declaredType ||
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(info.mimeType) ||
    bytes.length > 10 * 1024 * 1024
  ) {
    throw new Error("Reference must be a PNG, JPEG, WebP or GIF of at most 10 MiB, with matching MIME type");
  }
  return bytes;
}

async function upload(
  base: string,
  key: string,
  bytes: Buffer,
  mimeType: string,
  signal?: AbortSignal,
): Promise<string> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: mimeType }),
    "reference." + (mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]),
  );
  const result = await api(base, key, "uploads/images", form, signal);
  const url = result.data?.url;
  if (typeof url !== "string") throw new Error("ToAPIs upload did not return an HTTPS URL");
  return (await validateOutboundUrl(url, policy)).toString();
}

async function runTask(
  base: string,
  key: string,
  kind: "images" | "videos",
  body: Record<string, unknown>,
  signal?: AbortSignal,
  onSubmissionStart?: () => void,
): Promise<string> {
  const localId = randomUUID();
  const dir = join(DATA_DIR, "toapis-tasks");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  // Keep the receipt across UI timeouts. Never automatically repeat a task POST.
  const receipt = {
    localId,
    kind,
    model: body.model,
    origin: new URL(base).origin,
    taskId: "",
    status: "submitting",
    createdAt: new Date().toISOString(),
  };
  const path = join(dir, `${localId}.json`);
  const save = () => writeFile(path, JSON.stringify(receipt, null, 2), { mode: 0o600 });
  // After a request might have reached the provider, a receipt I/O error must not hide its task ID.
  const saveAfterSubmission = () =>
    save().catch((error: unknown) => {
      logger.error(error, "[toapis] Could not save task receipt %s for task %s", localId, receipt.taskId || "unknown");
    });
  await save();
  // An abort before submission must leave an honest receipt and no late paid POST behind a fallback.
  try {
    signal?.throwIfAborted();
  } catch (error) {
    receipt.status = "not_submitted";
    await saveAfterSubmission();
    throw error;
  }
  onSubmissionStart?.();
  let task: Task;
  try {
    task = await api(base, key, `${kind}/generations`, body, signal);
  } catch (error) {
    if (error instanceof ToAPIsHttpError && error.status >= 400 && error.status < 500 && error.status !== 408) {
      receipt.status = "rejected";
      await saveAfterSubmission();
      throw error;
    }
    receipt.status = "submission_uncertain";
    await saveAfterSubmission();
    throw new ToAPIsSubmittedTaskError(
      signal?.aborted
        ? signal.reason
        : new Error(`ToAPIs submission unconfirmed. Inspect local receipt ${localId}; do not automatically resubmit.`),
      localId,
    );
  }
  receipt.taskId = typeof task.id === "string" ? task.id.trim() : "";
  receipt.status = typeof task.status === "string" ? task.status.slice(0, 80) : "submitted";
  await saveAfterSubmission();
  if (!receipt.taskId) {
    receipt.status = "submission_uncertain";
    await saveAfterSubmission();
    throw new ToAPIsSubmittedTaskError(
      new Error(`ToAPIs returned no task ID. Reconcile local receipt ${localId} before resubmitting.`),
      localId,
    );
  }
  let transientPollFailures = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
      if (task.status === "completed") {
        const url = task.result?.data?.[0]?.url;
        if (typeof url !== "string") throw new Error("ToAPIs completed without an HTTPS media URL");
        return (await validateOutboundUrl(url, policy)).toString();
      }
      if (["failed", "cancelled", "canceled", "expired"].includes(task.status || ""))
        throw new Error(`ToAPIs task ${task.status}; no replacement task submitted`);
      const interval = Number(process.env.TOAPIS_POLL_INTERVAL_MS || 5000);
      await delay(Number.isFinite(interval) && interval > 0 ? interval : 5000, undefined, { signal });
      try {
        task = await api(base, key, `${kind}/generations/${encodeURIComponent(receipt.taskId)}`, undefined, signal);
        transientPollFailures = 0;
      } catch (error) {
        const transient = !(error instanceof ToAPIsHttpError) || error.status === 429 || error.status >= 500;
        if (!signal?.aborted && !(error instanceof ToAPIsHttpError))
          logger.debug(error, "[toapis] Poll transport failed for local receipt %s", localId);
        if (signal?.aborted || !transient || ++transientPollFailures >= 30) throw error;
        logRateLimited(
          "warn",
          `toapis:poll:${localId}`,
          {
            errorType: error instanceof Error ? error.name : typeof error,
            status: error instanceof ToAPIsHttpError ? error.status : undefined,
            errorLength: error instanceof Error ? error.message.length : 0,
          },
          "[toapis] Poll for task %s failed; retrying (%d/30)",
          receipt.taskId,
          transientPollFailures,
        );
        continue;
      }
      receipt.status = typeof task.status === "string" ? task.status.slice(0, 80) : "unknown";
      await saveAfterSubmission();
    }
  } catch (error) {
    if (!["failed", "cancelled", "canceled", "expired", "completed"].includes(receipt.status)) {
      receipt.status = "interrupted";
      await saveAfterSubmission();
    }
    throw new ToAPIsSubmittedTaskError(error, localId);
  }
}

async function download(url: string, maxResponseBytes: number, signal?: AbortSignal): Promise<Buffer> {
  const response = await safeFetch(url, {
    signal,
    policy,
    maxResponseBytes,
    decodeCompressedResponse: true,
  });
  // Provider credentials are deliberately never forwarded to media storage.
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`ToAPIs media download HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function generateToAPIsImage(
  base: string,
  key: string,
  request: ImageGenRequest,
  references: Array<{ base64: string; mimeType: string }>,
  maxResponseBytes: number,
  onSubmissionStart?: () => void,
): Promise<ImageGenResult> {
  if (!key.trim()) throw new Error("ToAPIs API key is required");
  if (request.model !== "gpt-image-2")
    throw new Error("This ToAPIs adapter currently supports ordinary gpt-image-2 only");
  if (!request.prompt.trim()) throw new Error("ToAPIs image prompt is required");
  if (request.transparentBackground) throw new Error("Transparent backgrounds are not verified by this ToAPIs adapter");
  if (request.quality && request.quality !== "auto")
    throw new Error("Leave ToAPIs image quality at Auto; this adapter uses the verified 1k preset");
  if (request.imageDefaults?.customParameters && Object.keys(request.imageDefaults.customParameters).length)
    throw new Error("ToAPIs custom image parameters are not mapped");
  const w = request.width ?? 1024,
    h = request.height ?? 1024;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0)
    throw new Error("Positive image dimensions are required");
  // ponytail: support exact common ratios only; extend after contract verification.
  const ratios = [
    ["1:1", 1],
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
    ["3:2", 1.5],
    ["2:3", 2 / 3],
  ] as const;
  const ratio = ratios.find(([, value]) => Math.abs(w / h - value) < 0.025)?.[0];
  if (!ratio) throw new Error("ToAPIs adapter supports 1:1, 16:9, 9:16, 3:2 and 2:3 image ratios");
  if (references.length > 1) throw new Error("This ToAPIs adapter currently supports one reference image");
  const validated = references.map((ref) => ({ ...ref, bytes: referenceBytes(ref.base64, ref.mimeType) }));
  const body: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
    size: ratio,
    resolution: "1k",
    n: 1,
  };
  if (validated.length)
    body.reference_images = [await upload(base, key, validated[0]!.bytes, validated[0]!.mimeType, request.signal)];
  logDebugOverride(
    request.debugMode === true || isDebugAgentsEnabled(),
    "[image-gen/toapis] prompt: %s",
    request.prompt,
  );
  const outputUrl = await runTask(base, key, "images", body, request.signal, onSubmissionStart);
  try {
    const raw = await download(outputUrl, maxResponseBytes, request.signal);
    const info = resolveValidatedImage(raw);
    if (!info) throw new Error("ToAPIs returned an invalid image payload");
    const ext = info.mimeType === "image/jpeg" ? "jpg" : info.mimeType.split("/")[1]!;
    return { base64: raw.toString("base64"), mimeType: info.mimeType, ext };
  } catch (error) {
    throw new ToAPIsSubmittedTaskError(error);
  }
}

export async function generateToAPIsVideo(
  base: string,
  key: string,
  request: VideoGenerationRequest,
  maxResponseBytes: number,
): Promise<VideoGenerationResult> {
  if (!key.trim()) throw new Error("ToAPIs API key is required");
  if (request.model !== "seedance-2-mini")
    throw new Error("This ToAPIs adapter currently supports seedance-2-mini only");
  if (!request.prompt.trim()) throw new Error("ToAPIs video prompt is required");
  // ponytail: keep the initial acceptance preset; expand after contract and application proof.
  if (request.durationSeconds !== 4 || (request.resolution || "480p") !== "480p" || request.aspectRatio !== "16:9")
    throw new Error("This ToAPIs adapter currently supports 4-second, 480p, 16:9 video only");
  if (request.lastFrameImage) throw new Error("Last-frame input is not verified by this ToAPIs adapter");
  const body: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
    duration: request.durationSeconds,
    resolution: request.resolution || "480p",
    aspect_ratio: request.aspectRatio,
    generate_audio: false,
  };
  if (request.referenceImage) {
    const ref = request.referenceImage;
    const bytes = referenceBytes(ref.base64, ref.mimeType);
    body.image_with_roles = [
      { url: await upload(base, key, bytes, ref.mimeType, request.signal), role: "first_frame" },
    ];
  }
  logDebugOverride(
    request.debugMode === true || isDebugAgentsEnabled(),
    "[video-gen/toapis] prompt: %s",
    request.prompt,
  );
  const outputUrl = await runTask(base, key, "videos", body, request.signal);
  try {
    const raw = await download(outputUrl, maxResponseBytes, request.signal);
    if (raw.length < 12 || raw.subarray(4, 8).toString("ascii") !== "ftyp")
      throw new Error("ToAPIs returned a non-MP4 payload");
    return { base64: raw.toString("base64"), mimeType: "video/mp4", ext: "mp4" };
  } catch (error) {
    throw new ToAPIsSubmittedTaskError(error);
  }
}
