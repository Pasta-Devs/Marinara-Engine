import { mkdir, rename, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { DATA_DIR } from "../../utils/data-dir.js";
import { newId } from "../../utils/id-generator.js";
import { logger } from "../../lib/logger.js";
import { assertInsideDir, safeFetch } from "../../utils/security.js";

export interface VideoReferenceImage {
  base64: string;
  mimeType: "image/png" | "image/jpeg";
  url?: string | null;
}

export type VideoReferencePublicUploadExpiry = "1h" | "12h" | "24h" | "72h";

export interface VideoReferencePublicUploadOptions {
  enabled?: boolean;
  expiry?: VideoReferencePublicUploadExpiry | string | null;
}

export interface VideoGenerationRequest {
  prompt: string;
  model?: string;
  // Gemini Omni currently takes duration guidance through the prompt, not video_config.
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16";
  resolution?: "480p" | "720p" | "1080p";
  referenceImage?: VideoReferenceImage | null;
  lastFrameImage?: VideoReferenceImage | null;
  publicReferenceUpload?: VideoReferencePublicUploadOptions | null;
  signal?: AbortSignal;
}

export interface VideoGenerationResult {
  base64: string;
  mimeType: "video/mp4";
  ext: "mp4";
}

const GAME_SCENE_VIDEOS_DIR = join(DATA_DIR, "game-scene-videos");
const VIDEO_GEN_TIMEOUT = Number(process.env.VIDEO_GEN_TIMEOUT_MS ?? 1_800_000);
const MAX_VIDEO_RESPONSE_BYTES = Number(process.env.VIDEO_GEN_MAX_RESPONSE_BYTES ?? 160 * 1024 * 1024);
const DEFAULT_GEMINI_OMNI_MODEL = "gemini-omni-flash-preview";
const DEFAULT_GOOGLE_VEO_MODEL = "veo-3.1-generate-preview";
const DEFAULT_XAI_VIDEO_MODEL = "grok-imagine-video-1.5";
const DEFAULT_OPENROUTER_VIDEO_MODEL = "google/veo-3.1";
const DEFAULT_SEEDANCE_VIDEO_MODEL = "seedance-2-0";
const DEFAULT_GOOGLE_VEO_RESOLUTION = "720p";
const DEFAULT_XAI_VIDEO_RESOLUTION = "720p";
const DEFAULT_SEEDANCE_VIDEO_RESOLUTION = "720p";
const LITTERBOX_UPLOAD_URL = "https://litterbox.catbox.moe/resources/internals/api.php";
const LITTERBOX_EXPIRY_VALUES = new Set<VideoReferencePublicUploadExpiry>(["1h", "12h", "24h", "72h"]);

function readPositiveIntervalEnv(name: string, fallbackMs: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallbackMs;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallbackMs;
}

const GOOGLE_VEO_POLL_INTERVAL_MS = readPositiveIntervalEnv("GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS", 10_000);
const XAI_POLL_INTERVAL_MS = readPositiveIntervalEnv("XAI_VIDEO_POLL_INTERVAL_MS", 5_000);
const OPENROUTER_POLL_INTERVAL_MS = readPositiveIntervalEnv("OPENROUTER_VIDEO_POLL_INTERVAL_MS", 10_000);
const SEEDANCE_POLL_INTERVAL_MS = readPositiveIntervalEnv("SEEDANCE_VIDEO_POLL_INTERVAL_MS", 10_000);

type GoogleVeoImageEncoding = "inlineData" | "bytesBase64Encoded";
type GoogleVeoResolution = "720p" | "1080p";
type GoogleVeoDuration = 4 | 6 | 8;

class VideoGenerationDeadlineError extends Error {
  constructor(timeoutMs: number) {
    super(`Video generation timed out after ${Math.round(timeoutMs / 1000)} seconds`);
    this.name = "VideoGenerationDeadlineError";
  }
}

export async function generateVideo(
  source: string,
  baseUrl: string,
  apiKey: string,
  serviceHint: string,
  request: VideoGenerationRequest,
): Promise<VideoGenerationResult> {
  const resolvedService = normalizeVideoService(serviceHint || source);
  if (resolvedService === "gemini_omni") {
    return withVideoGenerationDeadline(request.signal, VIDEO_GEN_TIMEOUT, (signal) =>
      generateGeminiOmniVideo(baseUrl, apiKey, { ...request, signal }),
    );
  }
  if (resolvedService === "google_veo") {
    return withVideoGenerationDeadline(request.signal, VIDEO_GEN_TIMEOUT, (signal) =>
      generateGoogleVeoVideo(baseUrl, apiKey, { ...request, signal }),
    );
  }
  if (resolvedService === "xai") {
    return withVideoGenerationDeadline(request.signal, VIDEO_GEN_TIMEOUT, (signal) =>
      generateXaiVideo(baseUrl, apiKey, { ...request, signal }),
    );
  }
  if (resolvedService === "openrouter") {
    return withVideoGenerationDeadline(request.signal, VIDEO_GEN_TIMEOUT, (signal) =>
      generateOpenRouterVideo(baseUrl, apiKey, { ...request, signal }),
    );
  }
  if (resolvedService === "seedance") {
    return withVideoGenerationDeadline(request.signal, VIDEO_GEN_TIMEOUT, (signal) =>
      generateSeedanceVideo(baseUrl, apiKey, { ...request, signal }),
    );
  }
  throw new Error(`Unsupported video generation service: ${resolvedService || serviceHint || source}`);
}

export function resolveVideoReferencePublicUploadOptions(
  enabled: boolean,
  seedanceDefaults:
    | {
        temporaryPublicReferenceUploadEnabled?: boolean | null;
        temporaryPublicReferenceUploadExpiry?: string | null;
      }
    | null
    | undefined,
): VideoReferencePublicUploadOptions | null {
  if (!enabled || !seedanceDefaults?.temporaryPublicReferenceUploadEnabled) return null;
  return {
    enabled: true,
    expiry: normalizeReferenceUploadExpiry(seedanceDefaults.temporaryPublicReferenceUploadExpiry),
  };
}

export function resolveVideoRequestDuration(
  source: string,
  serviceHint: string,
  request: Pick<VideoGenerationRequest, "durationSeconds" | "referenceImage" | "resolution">,
): number {
  const resolvedService = normalizeVideoService(serviceHint || source);
  const durationSeconds = Math.max(1, Math.trunc(request.durationSeconds));
  if (resolvedService === "google_veo") {
    return normalizeGoogleVeoDuration(
      durationSeconds,
      !!request.referenceImage,
      normalizeGoogleVeoResolution(request.resolution),
    );
  }
  if (resolvedService === "xai") {
    return Math.min(15, durationSeconds);
  }
  if (resolvedService === "seedance") {
    return Math.min(15, Math.max(4, durationSeconds));
  }
  return durationSeconds;
}

export async function saveVideoToDisk(chatId: string, base64: string): Promise<string> {
  const dir = assertInsideDir(GAME_SCENE_VIDEOS_DIR, join(GAME_SCENE_VIDEOS_DIR, chatId));
  await mkdir(dir, { recursive: true });
  const filename = `${newId()}.mp4`;
  const filePath = assertInsideDir(GAME_SCENE_VIDEOS_DIR, join(dir, filename));
  const tempPath = assertInsideDir(GAME_SCENE_VIDEOS_DIR, `${filePath}.${process.pid}.${Date.now()}.tmp`);
  try {
    const buffer = Buffer.from(base64, "base64");
    if (!isMp4Buffer(buffer)) throw new Error("Provider returned data that is not a valid MP4 file");
    await writeFile(tempPath, buffer);
    await rename(tempPath, filePath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
  return `${chatId}/${filename}`;
}

export async function removeSavedVideoFromDisk(filePath: string): Promise<void> {
  const fullPath = assertInsideDir(GAME_SCENE_VIDEOS_DIR, join(GAME_SCENE_VIDEOS_DIR, filePath));
  await unlink(fullPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

function normalizeVideoService(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    !normalized ||
    normalized === "google_ai_studio" ||
    normalized === "google-ai-studio" ||
    normalized === "omni" ||
    normalized === "gemini" ||
    normalized === "gemini-omni"
  ) {
    return "gemini_omni";
  }
  if (normalized === "google_veo" || normalized === "google-veo" || normalized === "veo") {
    return "google_veo";
  }
  if (normalized === "grok" || normalized === "xai" || normalized === "x-ai" || normalized === "grok-imagine") {
    return "xai";
  }
  if (normalized === "openrouter" || normalized === "open-router") {
    return "openrouter";
  }
  if (normalized === "seedance" || normalized === "seedance2" || normalized === "seedance-2") {
    return "seedance";
  }
  return normalized;
}

async function generateGeminiOmniVideo(
  baseUrl: string,
  apiKey: string,
  request: VideoGenerationRequest,
): Promise<VideoGenerationResult> {
  if (!apiKey.trim()) throw new Error("Gemini Omni requires a Google AI Studio API key");
  const endpoint = buildGeminiInteractionsUrl(baseUrl);
  const model = request.model?.trim() || DEFAULT_GEMINI_OMNI_MODEL;
  const input = request.referenceImage
    ? [
        {
          type: "image",
          data: stripDataUrl(request.referenceImage.base64),
          mime_type: request.referenceImage.mimeType,
        },
        { type: "text", text: request.prompt },
      ]
    : request.prompt;

  const body = {
    model,
    input,
    response_format: {
      type: "video",
      aspect_ratio: request.aspectRatio,
    },
    generation_config: {
      video_config: {
        task: request.referenceImage ? "image_to_video" : "text_to_video",
      },
    },
  };

  const res = await safeFetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal: request.signal,
    policy: {
      allowLocal: false,
      allowLoopback: false,
      allowMdns: false,
      allowedProtocols: ["https:"],
    },
    maxResponseBytes: MAX_VIDEO_RESPONSE_BYTES,
    decodeCompressedResponse: true,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini Omni returned ${res.status}: ${formatProviderError(text)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Gemini Omni returned non-JSON response: ${text.slice(0, 300)}`);
  }

  const video = extractMp4(json);
  if (!video) {
    logger.debug("[video-gen/gemini-omni] response without MP4: %s", text.slice(0, 2000));
    throw new Error("Gemini Omni response did not include a video/mp4 payload");
  }
  const buffer = Buffer.from(stripDataUrl(video), "base64");
  if (!isMp4Buffer(buffer)) throw new Error("Gemini Omni returned a non-MP4 video payload");
  return { base64: buffer.toString("base64"), mimeType: "video/mp4", ext: "mp4" };
}

async function generateGoogleVeoVideo(
  baseUrl: string,
  apiKey: string,
  request: VideoGenerationRequest,
): Promise<VideoGenerationResult> {
  if (!apiKey.trim()) throw new Error("Google Veo requires a Google AI Studio API key");
  const model = request.model?.trim() || DEFAULT_GOOGLE_VEO_MODEL;
  const endpoint = buildGoogleVeoPredictUrl(baseUrl, model);
  const resolution = normalizeGoogleVeoResolution(request.resolution);
  const durationSeconds = normalizeGoogleVeoDuration(request.durationSeconds, !!request.referenceImage, resolution);

  let start = await startGoogleVeoGeneration(
    endpoint,
    apiKey,
    buildGoogleVeoStartBody(request, durationSeconds, resolution, "inlineData"),
    request.signal,
  );

  if (!start.ok && request.referenceImage && shouldRetryGoogleVeoBytesPayload(start.status, start.text)) {
    logger.info(
      "[video-gen/google-veo] Retrying model %s with bytesBase64Encoded image payload after inlineData was rejected",
      model,
    );
    start = await startGoogleVeoGeneration(
      endpoint,
      apiKey,
      buildGoogleVeoStartBody(request, durationSeconds, resolution, "bytesBase64Encoded"),
      request.signal,
    );
  }

  if (!start.ok) {
    throw new Error(`Google Veo returned ${start.status}: ${formatProviderError(start.text)}`);
  }
  let startJson: unknown;
  try {
    startJson = JSON.parse(start.text) as unknown;
  } catch {
    throw new Error(`Google Veo returned non-JSON response: ${start.text.slice(0, 300)}`);
  }
  const operationName = readString(asRecord(startJson).name);
  if (!operationName) {
    throw new Error("Google Veo response did not include an operation name");
  }
  const pollUrl = buildGoogleVeoOperationUrl(baseUrl, operationName);

  while (true) {
    await delayWithSignal(GOOGLE_VEO_POLL_INTERVAL_MS, request.signal);
    const polled = await safeFetch(pollUrl, {
      method: "GET",
      headers: googleVeoHeaders(apiKey),
      signal: request.signal,
      policy: {
        allowLocal: false,
        allowLoopback: false,
        allowMdns: false,
        allowedProtocols: ["https:"],
      },
      maxResponseBytes: 2 * 1024 * 1024,
      decodeCompressedResponse: true,
    });
    const pollText = await polled.text();
    if (!polled.ok) {
      throw new Error(`Google Veo polling returned ${polled.status}: ${formatProviderError(pollText)}`);
    }
    let pollJson: unknown;
    try {
      pollJson = JSON.parse(pollText) as unknown;
    } catch {
      throw new Error(`Google Veo polling returned non-JSON response: ${pollText.slice(0, 300)}`);
    }
    const pollRecord = asRecord(pollJson);
    if (pollRecord.done !== true) continue;
    const operationError = pollRecord.error;
    if (operationError) {
      throw new Error(`Google Veo generation failed: ${formatOperationError(operationError)}`);
    }
    const inlineVideo = extractMp4(pollJson);
    if (inlineVideo) {
      const buffer = Buffer.from(stripDataUrl(inlineVideo), "base64");
      if (!isMp4Buffer(buffer)) throw new Error("Google Veo returned a non-MP4 video payload");
      return { base64: buffer.toString("base64"), mimeType: "video/mp4", ext: "mp4" };
    }
    const videoUri = findVideoUri(pollJson);
    if (!videoUri) {
      const reason = summarizeGoogleVeoMissingVideoReason(pollJson);
      logger.warn("[video-gen/google-veo] completed response without video URI: %s", pollText.slice(0, 2000));
      throw new Error(
        reason
          ? `Google Veo completed without a downloadable video: ${reason}`
          : "Google Veo response did not include a downloadable video",
      );
    }
    return downloadGoogleVeoVideo(videoUri, apiKey, request.signal);
  }
}

async function generateXaiVideo(
  baseUrl: string,
  apiKey: string,
  request: VideoGenerationRequest,
): Promise<VideoGenerationResult> {
  if (!apiKey.trim()) throw new Error("xAI video generation requires an xAI API key");
  const model = request.model?.trim() || DEFAULT_XAI_VIDEO_MODEL;
  const startUrl = buildXaiVideosUrl(baseUrl, "videos/generations");
  const body: Record<string, unknown> = {
    model,
    prompt: request.prompt,
    duration: Math.min(15, Math.max(1, Math.trunc(request.durationSeconds))),
    aspect_ratio: request.aspectRatio,
    resolution: request.resolution || DEFAULT_XAI_VIDEO_RESOLUTION,
  };
  if (request.referenceImage) {
    body.image = { url: referenceImageToDataUri(request.referenceImage) };
  }

  const started = await safeFetch(startUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: request.signal,
    policy: {
      allowLocal: false,
      allowLoopback: false,
      allowMdns: false,
      allowedProtocols: ["https:"],
    },
    maxResponseBytes: 2 * 1024 * 1024,
    decodeCompressedResponse: true,
  });

  const startText = await started.text();
  if (!started.ok) {
    throw new Error(`xAI video generation returned ${started.status}: ${formatProviderError(startText)}`);
  }
  let startJson: unknown;
  try {
    startJson = JSON.parse(startText) as unknown;
  } catch {
    throw new Error(`xAI video generation returned non-JSON response: ${startText.slice(0, 300)}`);
  }
  const startRecord = asRecord(startJson);
  const requestId = readString(startRecord.request_id);
  if (!requestId) {
    throw new Error("xAI video generation response did not include a request_id");
  }

  const pollUrl = buildXaiVideosUrl(baseUrl, `videos/${encodeURIComponent(requestId)}`);
  while (true) {
    await delayWithSignal(XAI_POLL_INTERVAL_MS, request.signal);
    const polled = await safeFetch(pollUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: request.signal,
      policy: {
        allowLocal: false,
        allowLoopback: false,
        allowMdns: false,
        allowedProtocols: ["https:"],
      },
      maxResponseBytes: 2 * 1024 * 1024,
      decodeCompressedResponse: true,
    });
    const pollText = await polled.text();
    if (!polled.ok) {
      throw new Error(`xAI video polling returned ${polled.status}: ${formatProviderError(pollText)}`);
    }
    let pollJson: unknown;
    try {
      pollJson = JSON.parse(pollText) as unknown;
    } catch {
      throw new Error(`xAI video polling returned non-JSON response: ${pollText.slice(0, 300)}`);
    }
    const pollRecord = asRecord(pollJson);
    const status = readString(pollRecord.status)?.toLowerCase();
    if (status === "done") {
      const video = pollRecord.video;
      const url = video && typeof video === "object" ? readString((video as Record<string, unknown>).url) : null;
      if (!url) throw new Error("xAI video response did not include a video URL");
      return downloadXaiVideo(url, request.signal);
    }
    if (status === "failed" || status === "expired") {
      throw new Error(`xAI video generation ${status}`);
    }
    if (status && status !== "pending") {
      logger.debug("[video-gen/xai] continuing after unknown status: %s", status);
    }
  }
}

async function generateOpenRouterVideo(
  baseUrl: string,
  apiKey: string,
  request: VideoGenerationRequest,
): Promise<VideoGenerationResult> {
  if (!apiKey.trim()) throw new Error("OpenRouter video generation requires an OpenRouter API key");
  const model = request.model?.trim() || DEFAULT_OPENROUTER_VIDEO_MODEL;
  const startUrl = buildOpenRouterVideosUrl(baseUrl, "videos");
  const body: Record<string, unknown> = {
    model,
    prompt: request.prompt,
    duration: Math.max(1, Math.trunc(request.durationSeconds)),
    aspect_ratio: request.aspectRatio,
    generate_audio: false,
  };
  if (request.resolution) body.resolution = request.resolution;
  if (request.referenceImage) {
    const frameImages = [
      {
        type: "image_url",
        image_url: { url: referenceImageToDataUri(request.referenceImage) },
        frame_type: "first_frame",
      },
    ];
    if (request.lastFrameImage) {
      frameImages.push({
        type: "image_url",
        image_url: { url: referenceImageToDataUri(request.lastFrameImage) },
        frame_type: "last_frame",
      });
    }
    body.frame_images = frameImages;
  }

  const started = await safeFetch(startUrl, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify(body),
    signal: request.signal,
    policy: {
      allowLocal: false,
      allowLoopback: false,
      allowMdns: false,
      allowedProtocols: ["https:"],
    },
    maxResponseBytes: 2 * 1024 * 1024,
    decodeCompressedResponse: true,
  });

  const startText = await started.text();
  if (!started.ok) {
    throw new Error(`OpenRouter video generation returned ${started.status}: ${formatProviderError(startText)}`);
  }
  let startJson: unknown;
  try {
    startJson = JSON.parse(startText) as unknown;
  } catch {
    throw new Error(`OpenRouter video generation returned non-JSON response: ${startText.slice(0, 300)}`);
  }
  const startRecord = asRecord(startJson);
  const jobId = readString(startRecord.id);
  const pollingUrl =
    readString(startRecord.polling_url) ?? (jobId ? buildOpenRouterVideosUrl(baseUrl, `videos/${jobId}`) : null);
  if (!jobId || !pollingUrl) {
    throw new Error("OpenRouter video generation response did not include a job id");
  }

  while (true) {
    await delayWithSignal(OPENROUTER_POLL_INTERVAL_MS, request.signal);
    const polled = await safeFetch(pollingUrl, {
      method: "GET",
      headers: openRouterHeaders(apiKey),
      signal: request.signal,
      policy: {
        allowLocal: false,
        allowLoopback: false,
        allowMdns: false,
        allowedProtocols: ["https:"],
      },
      maxResponseBytes: 2 * 1024 * 1024,
      decodeCompressedResponse: true,
    });
    const pollText = await polled.text();
    if (!polled.ok) {
      throw new Error(`OpenRouter video polling returned ${polled.status}: ${formatProviderError(pollText)}`);
    }
    let pollJson: unknown;
    try {
      pollJson = JSON.parse(pollText) as unknown;
    } catch {
      throw new Error(`OpenRouter video polling returned non-JSON response: ${pollText.slice(0, 300)}`);
    }
    const pollRecord = asRecord(pollJson);
    const status = readString(pollRecord.status)?.toLowerCase();
    if (status === "completed") {
      const url = readFirstString(pollRecord.unsigned_urls) ?? buildOpenRouterContentUrl(baseUrl, jobId);
      return downloadOpenRouterVideo(url, apiKey, request.signal);
    }
    if (status === "failed" || status === "cancelled" || status === "expired") {
      const error = readString(pollRecord.error);
      throw new Error(`OpenRouter video generation ${status}${error ? `: ${error}` : ""}`);
    }
    if (status && status !== "pending" && status !== "in_progress") {
      logger.debug("[video-gen/openrouter] continuing after unknown status: %s", status);
    }
  }
}

async function generateSeedanceVideo(
  baseUrl: string,
  apiKey: string,
  request: VideoGenerationRequest,
): Promise<VideoGenerationResult> {
  if (!apiKey.trim()) throw new Error("Seedance video generation requires a Seedance API key");
  const model = request.model?.trim() || DEFAULT_SEEDANCE_VIDEO_MODEL;
  const startUrl = buildSeedanceUrl(baseUrl, "v1/videos/generations");
  const imageUrls = await seedanceReferenceImageUrls(request);
  const duration = Math.min(15, Math.max(4, Math.trunc(request.durationSeconds)));
  const body: Record<string, unknown> = {
    model,
    input: {
      prompt: request.prompt,
      generation_type: imageUrls.length > 0 ? "image-to-video" : "text-to-video",
      duration,
      aspect_ratio: request.aspectRatio,
      resolution: request.resolution || DEFAULT_SEEDANCE_VIDEO_RESOLUTION,
      generate_audio: false,
      watermark: false,
      web_search: false,
      return_last_frame: false,
      seed: -1,
      ...(imageUrls.length > 0 ? { image_urls: imageUrls } : {}),
    },
  };

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) {
      logger.warn("[video-gen/seedance] Retrying failed generation after opaque provider task failure");
    }
    const started = await safeFetch(startUrl, {
      method: "POST",
      headers: seedanceHeaders(apiKey),
      body: JSON.stringify(body),
      signal: request.signal,
      policy: {
        allowLocal: false,
        allowLoopback: false,
        allowMdns: false,
        allowedProtocols: ["https:"],
      },
      maxResponseBytes: 2 * 1024 * 1024,
      decodeCompressedResponse: true,
    });

    const startText = await started.text();
    if (!started.ok) {
      throw new Error(`Seedance video generation returned ${started.status}: ${formatProviderError(startText)}`);
    }
    let startJson: unknown;
    try {
      startJson = JSON.parse(startText) as unknown;
    } catch {
      throw new Error(`Seedance video generation returned non-JSON response: ${startText.slice(0, 300)}`);
    }
    const taskId = readSeedanceTaskId(startJson);
    if (!taskId) {
      throw new Error("Seedance video generation response did not include a taskId");
    }

    const pollUrl = buildSeedanceUrl(baseUrl, `v1/tasks/${encodeURIComponent(taskId)}`);
    while (true) {
      await delayWithSignal(SEEDANCE_POLL_INTERVAL_MS, request.signal);
      const polled = await safeFetch(pollUrl, {
        method: "GET",
        headers: seedanceHeaders(apiKey),
        signal: request.signal,
        policy: {
          allowLocal: false,
          allowLoopback: false,
          allowMdns: false,
          allowedProtocols: ["https:"],
        },
        maxResponseBytes: 2 * 1024 * 1024,
        decodeCompressedResponse: true,
      });
      const pollText = await polled.text();
      if (!polled.ok) {
        throw new Error(`Seedance video polling returned ${polled.status}: ${formatProviderError(pollText)}`);
      }
      let pollJson: unknown;
      try {
        pollJson = JSON.parse(pollText) as unknown;
      } catch {
        throw new Error(`Seedance video polling returned non-JSON response: ${pollText.slice(0, 300)}`);
      }
      const status = readSeedanceStatus(pollJson);
      if (status && ["completed", "succeeded", "success", "done"].includes(status)) {
        const url = findVideoUri(pollJson);
        if (!url) {
          logger.warn("[video-gen/seedance] completed response without video URL: %s", pollText.slice(0, 2000));
          throw new Error("Seedance response did not include a downloadable video");
        }
        return downloadSeedanceVideo(url, baseUrl, apiKey, request.signal);
      }
      if (status && ["failed", "error", "cancelled", "canceled", "expired"].includes(status)) {
        const errorMessage = formatSeedanceOperationError(pollJson);
        logger.warn(
          "[video-gen/seedance] task %s failed attempt %d/%d status=%s reason=%s response=%s",
          taskId,
          attempt,
          maxAttempts,
          status,
          errorMessage,
          compactJsonForLog(pollJson, 2000),
        );
        if (attempt < maxAttempts && isRetryableSeedanceTaskFailure(status, errorMessage)) {
          break;
        }
        throw new Error(`Seedance video generation ${status}: ${errorMessage}`);
      }
      if (status && !["pending", "queued", "processing", "running", "in_progress"].includes(status)) {
        logger.debug("[video-gen/seedance] continuing after unknown status: %s", status);
      }
    }
  }

  throw new Error("Seedance video generation failed after retrying an opaque provider task failure");
}

function withVideoGenerationDeadline<T>(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) {
    controller.abort(externalSignal.reason);
  }
  const timeout = setTimeout(() => controller.abort(new VideoGenerationDeadlineError(timeoutMs)), timeoutMs);
  if (externalSignal?.aborted) {
    controller.abort(externalSignal.reason);
  } else {
    externalSignal?.addEventListener("abort", onAbort, { once: true });
  }
  return run(controller.signal).finally(() => {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", onAbort);
  });
}

function buildGeminiInteractionsUrl(baseUrl: string): string {
  const fallback = "https://generativelanguage.googleapis.com/v1beta";
  const raw = (baseUrl || fallback).trim().replace(/\/+$/, "") || fallback;
  try {
    const url = new URL(raw);
    if (!/\/interactions\/?$/i.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/+$/, "")}/interactions`;
    }
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return `${fallback}/interactions`;
  }
}

function buildGoogleVeoPredictUrl(baseUrl: string, model: string): string {
  return buildGoogleVeoUrl(baseUrl, `models/${encodeURIComponent(model)}:predictLongRunning`);
}

function buildGoogleVeoOperationUrl(baseUrl: string, operationName: string): string {
  if (/^https:\/\//i.test(operationName)) return operationName;
  return buildGoogleVeoUrl(baseUrl, operationName);
}

function buildGoogleVeoUrl(baseUrl: string, path: string): string {
  const fallback = "https://generativelanguage.googleapis.com/v1beta";
  const raw = (baseUrl || fallback).trim().replace(/\/+$/, "") || fallback;
  try {
    const url = new URL(raw);
    const root = url.pathname.replace(/\/+$/, "").replace(/\/models(?:\/.*)?$/i, "");
    url.pathname = `${root}/${path.replace(/^\/+/, "")}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return `${fallback}/${path.replace(/^\/+/, "")}`;
  }
}

function buildXaiVideosUrl(baseUrl: string, path: string): string {
  const fallback = "https://api.x.ai/v1";
  const raw = (baseUrl || fallback).trim().replace(/\/+$/, "") || fallback;
  try {
    const url = new URL(raw);
    const root = url.pathname.replace(/\/+$/, "").replace(/\/videos(?:\/.*)?$/i, "");
    url.pathname = `${root}/${path.replace(/^\/+/, "")}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return `${fallback}/${path.replace(/^\/+/, "")}`;
  }
}

function buildOpenRouterVideosUrl(baseUrl: string, path: string): string {
  const fallback = "https://openrouter.ai/api/v1";
  const raw = (baseUrl || fallback).trim().replace(/\/+$/, "") || fallback;
  try {
    const url = new URL(raw);
    const root = url.pathname.replace(/\/+$/, "").replace(/\/videos(?:\/.*)?$/i, "");
    url.pathname = `${root}/${path.replace(/^\/+/, "")}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return `${fallback}/${path.replace(/^\/+/, "")}`;
  }
}

function buildOpenRouterContentUrl(baseUrl: string, jobId: string): string {
  const url = new URL(buildOpenRouterVideosUrl(baseUrl, `videos/${encodeURIComponent(jobId)}/content`));
  url.searchParams.set("index", "0");
  return url.toString();
}

function buildSeedanceUrl(baseUrl: string, path: string): string {
  const fallback = "https://api.seedance2.ai";
  const configured = baseUrl.trim();
  const raw = (configured || fallback).replace(/\/+$/, "");
  try {
    const url = new URL(raw);
    const root = url.pathname.replace(/\/+$/, "").replace(/\/v1(?:\/.*)?$/i, "");
    url.pathname = `${root}/${path.replace(/^\/+/, "")}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    throw new Error(`Invalid Seedance base URL: ${baseUrl}`);
  }
}

function isTrustedSeedanceDownloadOrigin(url: string, baseUrl: string): boolean {
  try {
    const parsed = new URL(url);
    const configured = new URL(buildSeedanceUrl(baseUrl, "v1/tasks/origin-check"));
    return parsed.origin === configured.origin;
  } catch {
    return false;
  }
}

async function downloadXaiVideo(url: string, signal: AbortSignal | undefined): Promise<VideoGenerationResult> {
  const res = await safeFetch(url, {
    method: "GET",
    headers: { Accept: "video/mp4,video/*;q=0.9,*/*;q=0.1" },
    signal,
    policy: {
      allowLocal: false,
      allowLoopback: false,
      allowMdns: false,
      allowedProtocols: ["https:"],
    },
    maxResponseBytes: MAX_VIDEO_RESPONSE_BYTES,
    decodeCompressedResponse: true,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to download xAI video (${res.status}): ${formatProviderError(text)}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!isMp4Buffer(buffer)) throw new Error("xAI returned a non-MP4 video payload");
  return { base64: buffer.toString("base64"), mimeType: "video/mp4", ext: "mp4" };
}

async function downloadGoogleVeoVideo(
  url: string,
  apiKey: string,
  signal: AbortSignal | undefined,
): Promise<VideoGenerationResult> {
  const res = await safeFetch(url, {
    method: "GET",
    headers: {
      Accept: "video/mp4,video/*;q=0.9,*/*;q=0.1",
      "x-goog-api-key": apiKey,
    },
    signal,
    policy: {
      allowLocal: false,
      allowLoopback: false,
      allowMdns: false,
      allowedProtocols: ["https:"],
    },
    maxResponseBytes: MAX_VIDEO_RESPONSE_BYTES,
    decodeCompressedResponse: true,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to download Google Veo video (${res.status}): ${formatProviderError(text)}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!isMp4Buffer(buffer)) throw new Error("Google Veo returned a non-MP4 video payload");
  return { base64: buffer.toString("base64"), mimeType: "video/mp4", ext: "mp4" };
}

async function downloadOpenRouterVideo(
  url: string,
  apiKey: string,
  signal: AbortSignal | undefined,
): Promise<VideoGenerationResult> {
  const res = await safeFetch(url, {
    method: "GET",
    headers: {
      Accept: "video/mp4,video/*;q=0.9,*/*;q=0.1",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    policy: {
      allowLocal: false,
      allowLoopback: false,
      allowMdns: false,
      allowedProtocols: ["https:"],
    },
    maxResponseBytes: MAX_VIDEO_RESPONSE_BYTES,
    decodeCompressedResponse: true,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to download OpenRouter video (${res.status}): ${formatProviderError(text)}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!isMp4Buffer(buffer)) throw new Error("OpenRouter returned a non-MP4 video payload");
  return { base64: buffer.toString("base64"), mimeType: "video/mp4", ext: "mp4" };
}

async function downloadSeedanceVideo(
  url: string,
  baseUrl: string,
  apiKey: string,
  signal: AbortSignal | undefined,
): Promise<VideoGenerationResult> {
  const headers: Record<string, string> = { Accept: "video/mp4,video/*;q=0.9,*/*;q=0.1" };
  if (isTrustedSeedanceDownloadOrigin(url, baseUrl)) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const res = await safeFetch(url, {
    method: "GET",
    headers,
    signal,
    policy: {
      allowLocal: false,
      allowLoopback: false,
      allowMdns: false,
      allowedProtocols: ["https:"],
    },
    maxResponseBytes: MAX_VIDEO_RESPONSE_BYTES,
    decodeCompressedResponse: true,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to download Seedance video (${res.status}): ${formatProviderError(text)}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!isMp4Buffer(buffer)) throw new Error("Seedance returned a non-MP4 video payload");
  return { base64: buffer.toString("base64"), mimeType: "video/mp4", ext: "mp4" };
}

function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

function seedanceHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

function googleVeoHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-goog-api-key": apiKey,
  };
}

function referenceImageToDataUri(image: VideoReferenceImage): string {
  return `data:${image.mimeType};base64,${stripDataUrl(image.base64)}`;
}

async function seedanceReferenceImageUrls(request: VideoGenerationRequest): Promise<string[]> {
  if (!request.referenceImage) return [];
  const firstFrame = await seedanceReferenceImageUrl(
    request.referenceImage,
    "first frame",
    request.publicReferenceUpload,
    request.signal,
  );
  if (!request.lastFrameImage) {
    return [firstFrame];
  }
  if (videoReferenceImagesMatch(request.referenceImage, request.lastFrameImage)) return [firstFrame, firstFrame];
  const lastFrame = await seedanceReferenceImageUrl(
    request.lastFrameImage,
    "last frame",
    request.publicReferenceUpload,
    request.signal,
  );
  return [firstFrame, lastFrame];
}

async function seedanceReferenceImageUrl(
  image: VideoReferenceImage,
  label: string,
  publicUpload: VideoGenerationRequest["publicReferenceUpload"],
  signal: AbortSignal | undefined,
): Promise<string> {
  const raw = image.url?.trim();
  if (raw) {
    if (/^https:\/\//i.test(raw)) return raw;
    if (/^http:\/\//i.test(raw)) {
      let message = `Seedance ${label} reference URL must be public HTTPS.`;
      try {
        const parsed = new URL(raw);
        message = `Seedance ${label} reference URL must be public HTTPS, but Marinara resolved ${parsed.protocol}//${parsed.host}.`;
      } catch {
        // Keep the generic message for malformed URLs.
      }
      throw new Error(message);
    }
    const publicBaseUrl = process.env.VIDEO_REFERENCE_PUBLIC_BASE_URL?.trim();
    if (publicBaseUrl) {
      try {
        const resolved = new URL(raw, publicBaseUrl);
        if (resolved.protocol === "https:") return resolved.toString();
      } catch {
        // Fall through to the setup error below.
      }
    }
    const uploaded = await maybeUploadSeedanceReferenceImage(image, label, publicUpload, signal);
    if (uploaded) return uploaded;
  }

  const uploaded = await maybeUploadSeedanceReferenceImage(image, label, publicUpload, signal);
  if (uploaded) return uploaded;

  throw new Error(
    `Seedance image-to-video references require a publicly reachable HTTPS image URL for the ${label}. ` +
      "Expose Marinara through a public HTTPS tunnel such as Cloudflare Tunnel or ngrok, then set " +
      "VIDEO_REFERENCE_PUBLIC_BASE_URL to that origin, or turn on Upload Seedance reference frames temporarily " +
      "in this Video Generation connection before generating first/last-frame Seedance clips.",
  );
}

async function maybeUploadSeedanceReferenceImage(
  image: VideoReferenceImage,
  label: string,
  publicUpload: VideoGenerationRequest["publicReferenceUpload"],
  signal: AbortSignal | undefined,
): Promise<string | null> {
  if (!publicUpload?.enabled) return null;
  const expiry = normalizeReferenceUploadExpiry(publicUpload.expiry);
  const base64 = stripDataUrl(image.base64);
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new Error(`Seedance ${label} reference image could not be uploaded because it is empty.`);
  }

  const filename = `marinara-seedance-${label.replace(/\s+/g, "-")}-${Date.now()}${imageExtension(image.mimeType)}`;
  const upload = buildMultipartFormDataBody({
    fields: {
      reqtype: "fileupload",
      time: expiry,
    },
    file: {
      fieldName: "fileToUpload",
      filename,
      contentType: image.mimeType,
      data: buffer,
    },
  });

  logger.warn("[video-gen/seedance] Uploading %s reference image to a temporary public URL for %s", label, expiry);
  const res = await safeFetch(LITTERBOX_UPLOAD_URL, {
    method: "POST",
    headers: upload.headers,
    body: upload.body,
    signal,
    policy: {
      allowLocal: false,
      allowLoopback: false,
      allowMdns: false,
      allowedProtocols: ["https:"],
    },
    maxResponseBytes: 4096,
    decodeCompressedResponse: true,
  });
  const text = (await res.text()).trim();
  if (!res.ok) {
    throw new Error(`Temporary Seedance reference upload returned ${res.status}: ${formatProviderError(text)}`);
  }
  if (!/^https:\/\//i.test(text)) {
    throw new Error(`Temporary Seedance reference upload did not return an HTTPS URL: ${formatProviderError(text)}`);
  }
  return text;
}

function buildMultipartFormDataBody(input: {
  fields: Record<string, string>;
  file: {
    fieldName: string;
    filename: string;
    contentType: string;
    data: Buffer;
  };
}): { body: Buffer; headers: Record<string, string> } {
  const boundary = `----MarinaraEngine${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const chunks: Buffer[] = [];
  const appendText = (value: string) => chunks.push(Buffer.from(value, "utf8"));

  for (const [name, value] of Object.entries(input.fields)) {
    appendText(`--${boundary}\r\n`);
    appendText(`Content-Disposition: form-data; name="${escapeMultipartToken(name)}"\r\n\r\n`);
    appendText(`${value}\r\n`);
  }

  appendText(`--${boundary}\r\n`);
  appendText(
    `Content-Disposition: form-data; name="${escapeMultipartToken(input.file.fieldName)}"; filename="${escapeMultipartToken(input.file.filename)}"\r\n`,
  );
  appendText(`Content-Type: ${input.file.contentType}\r\n\r\n`);
  chunks.push(input.file.data);
  appendText(`\r\n--${boundary}--\r\n`);

  const body = Buffer.concat(chunks);
  return {
    body,
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
  };
}

function escapeMultipartToken(value: string): string {
  return value.replace(/[\r\n"]/g, "_");
}

function normalizeReferenceUploadExpiry(
  value: VideoReferencePublicUploadOptions["expiry"],
): VideoReferencePublicUploadExpiry {
  return LITTERBOX_EXPIRY_VALUES.has(value as VideoReferencePublicUploadExpiry)
    ? (value as VideoReferencePublicUploadExpiry)
    : "12h";
}

function imageExtension(mimeType: VideoReferenceImage["mimeType"]): ".jpg" | ".png" {
  return mimeType === "image/jpeg" ? ".jpg" : ".png";
}

function videoReferenceImagesMatch(first: VideoReferenceImage, second: VideoReferenceImage): boolean {
  if (first.url && second.url && first.url === second.url) return true;
  return first.mimeType === second.mimeType && stripDataUrl(first.base64) === stripDataUrl(second.base64);
}

function buildGoogleVeoStartBody(
  request: VideoGenerationRequest,
  durationSeconds: GoogleVeoDuration,
  resolution: GoogleVeoResolution,
  imageEncoding: GoogleVeoImageEncoding,
): {
  instances: Array<Record<string, unknown>>;
  parameters: {
    aspectRatio: VideoGenerationRequest["aspectRatio"];
    durationSeconds: GoogleVeoDuration;
    resolution: GoogleVeoResolution;
  };
} {
  const instance: Record<string, unknown> = { prompt: request.prompt };
  if (request.referenceImage) {
    instance.image = googleVeoImage(request.referenceImage, imageEncoding);
    instance.lastFrame = googleVeoImage(request.lastFrameImage ?? request.referenceImage, imageEncoding);
  }
  return {
    instances: [instance],
    parameters: {
      aspectRatio: request.aspectRatio,
      durationSeconds,
      resolution,
    },
  };
}

async function startGoogleVeoGeneration(
  endpoint: string,
  apiKey: string,
  body: unknown,
  signal: AbortSignal | undefined,
): Promise<{ ok: boolean; status: number; text: string }> {
  const started = await safeFetch(endpoint, {
    method: "POST",
    headers: googleVeoHeaders(apiKey),
    body: JSON.stringify(body),
    signal,
    policy: {
      allowLocal: false,
      allowLoopback: false,
      allowMdns: false,
      allowedProtocols: ["https:"],
    },
    maxResponseBytes: 2 * 1024 * 1024,
    decodeCompressedResponse: true,
  });
  return {
    ok: started.ok,
    status: started.status,
    text: await started.text(),
  };
}

function shouldRetryGoogleVeoBytesPayload(status: number, text: string): boolean {
  return (
    status === 400 &&
    /inline\s*data/i.test(text) &&
    /not supported|isn't supported|is not supported|remove it/i.test(text)
  );
}

function googleVeoImage(
  image: VideoReferenceImage,
  encoding: GoogleVeoImageEncoding,
): { inlineData: { mimeType: string; data: string } } | { bytesBase64Encoded: string; mimeType: string } {
  if (encoding === "bytesBase64Encoded") {
    return {
      bytesBase64Encoded: stripDataUrl(image.base64),
      mimeType: image.mimeType,
    };
  }
  return {
    inlineData: {
      mimeType: image.mimeType,
      data: stripDataUrl(image.base64),
    },
  };
}

function normalizeGoogleVeoResolution(value: VideoGenerationRequest["resolution"]): GoogleVeoResolution {
  return value === "1080p" ? "1080p" : DEFAULT_GOOGLE_VEO_RESOLUTION;
}

function normalizeGoogleVeoDuration(
  value: number,
  hasReferenceImage: boolean,
  resolution: GoogleVeoResolution,
): GoogleVeoDuration {
  if (hasReferenceImage || resolution === "1080p") return 8;
  if (value <= 5) return 4;
  if (value <= 7) return 6;
  return 8;
}

function extractMp4(value: unknown): string | null {
  const found = findContentRecord(value);
  if (!found) return null;
  return (
    readString(found.data) ??
    readString(found.base64) ??
    readString(found.base64_data) ??
    readString(found.videoBytes) ??
    readString(found.video_bytes) ??
    readString(found.bytesBase64Encoded) ??
    null
  );
}

function findVideoUri(value: unknown, depth = 0): string | null {
  if (depth > 8 || value === null || value === undefined) return null;
  if (typeof value === "string") {
    return /^https?:\/\//i.test(value.trim()) ? value.trim() : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoUri(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const uri =
    readString(record.uri) ??
    readString(record.url) ??
    readString(record.downloadUri) ??
    readString(record.download_uri) ??
    readString(record.fileUri) ??
    readString(record.file_uri);
  if (uri) return uri;
  for (const key of [
    "response",
    "data",
    "results",
    "output",
    "outputs",
    "videos",
    "videoUrls",
    "video_urls",
    "generateVideoResponse",
    "generatedSamples",
    "generatedVideos",
    "video",
    "file",
  ]) {
    const found = findVideoUri(record[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function findContentRecord(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 8 || value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findContentRecord(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const type = readString(record.type)?.toLowerCase();
  const mimeType = (readString(record.mime_type) ?? readString(record.mimeType) ?? "").toLowerCase();
  const hasData =
    typeof record.data === "string" ||
    typeof record.base64 === "string" ||
    typeof record.base64_data === "string" ||
    typeof record.videoBytes === "string" ||
    typeof record.video_bytes === "string" ||
    typeof record.bytesBase64Encoded === "string";
  if (hasData && (type === "video" || mimeType === "video/mp4" || mimeType === "")) {
    return record;
  }
  const inlineData = record.inline_data ?? record.inlineData;
  if (inlineData) {
    const found = findContentRecord(inlineData, depth + 1);
    if (found) return found;
  }
  for (const key of [
    "response",
    "generateVideoResponse",
    "generatedSamples",
    "generatedVideos",
    "video",
    "inline_data",
    "inlineData",
    "steps",
    "content",
    "parts",
    "output_video",
    "outputVideo",
  ]) {
    const found = findContentRecord(record[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function summarizeGoogleVeoMissingVideoReason(value: unknown): string | null {
  const reasons = new Set<string>();
  collectGoogleVeoReasonStrings(value, reasons);
  return [...reasons].slice(0, 5).join("; ") || null;
}

function collectGoogleVeoReasonStrings(value: unknown, reasons: Set<string>, depth = 0): void {
  if (depth > 8 || value === null || value === undefined || reasons.size >= 8) return;
  if (Array.isArray(value)) {
    for (const item of value) collectGoogleVeoReasonStrings(item, reasons, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const key of [
    "raiMediaFilteredReasons",
    "filteredReasons",
    "blockReason",
    "blockedReason",
    "finishReason",
    "message",
    "reason",
  ]) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) reasons.add(`${key}: ${raw.trim().slice(0, 300)}`);
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === "string" && item.trim()) reasons.add(`${key}: ${item.trim().slice(0, 300)}`);
        else collectGoogleVeoReasonStrings(item, reasons, depth + 1);
      }
    }
  }
  for (const key of [
    "response",
    "generateVideoResponse",
    "generatedSamples",
    "generatedVideos",
    "safetyRatings",
    "promptFeedback",
    "error",
    "metadata",
  ]) {
    collectGoogleVeoReasonStrings(record[key], reasons, depth + 1);
  }
}

function isMp4Buffer(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

function stripDataUrl(value: string): string {
  const comma = value.indexOf(",");
  return value.startsWith("data:") && comma >= 0 ? value.slice(comma + 1) : value;
}

function delayWithSignal(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason ?? new Error("Video generation aborted"));
  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.reason ?? new Error("Video generation aborted"));
    };
    timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readFirstString(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    const text = readString(item);
    if (text) return text;
  }
  return null;
}

function readSeedanceTaskId(value: unknown): string | null {
  const root = asRecord(value);
  const data = asRecord(root.data);
  return (
    readString(root.taskId) ??
    readString(root.task_id) ??
    readString(root.id) ??
    readString(data.taskId) ??
    readString(data.task_id) ??
    readString(data.id)
  );
}

function readSeedanceStatus(value: unknown): string | null {
  const root = asRecord(value);
  const data = asRecord(root.data);
  return (
    (
      readString(root.status) ??
      readString(root.state) ??
      readString(data.status) ??
      readString(data.state) ??
      readString(data.task_status)
    )?.toLowerCase() ?? null
  );
}

function formatProviderError(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "No response body";
  try {
    const json = JSON.parse(trimmed) as { error?: { message?: unknown } | string; message?: unknown };
    const nested = json.error;
    if (nested && typeof nested === "object" && typeof nested.message === "string") return nested.message.slice(0, 500);
    if (typeof nested === "string") return nested.slice(0, 500);
    if (typeof json.message === "string") return json.message.slice(0, 500);
  } catch {
    /* use raw text */
  }
  return trimmed
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 500);
}

function formatOperationError(value: unknown): string {
  if (!value) return "Unknown operation error";
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const message = readString(record.message);
    const code = readString(record.code);
    if (message && code) return `${message} (${code})`;
    if (message) return message;
  }
  return (JSON.stringify(value) ?? String(value)).slice(0, 500);
}

function formatSeedanceOperationError(value: unknown): string {
  const root = asRecord(value);
  const data = asRecord(root.data);
  const candidates: unknown[] = [
    root.error,
    root.failed_reason,
    root.failedReason,
    root.failure_reason,
    root.failureReason,
    root.error_message,
    root.errorMessage,
    root.message,
    root.reason,
    root.raiMediaFilteredReasons,
    root.rai_media_filtered_reasons,
    data.error,
    data.failed_reason,
    data.failedReason,
    data.failure_reason,
    data.failureReason,
    data.failed_message,
    data.failedMessage,
    data.error_message,
    data.errorMessage,
    data.message,
    data.reason,
    data.raiMediaFilteredReasons,
    data.rai_media_filtered_reasons,
  ];
  for (const candidate of candidates) {
    const message = formatOperationError(candidate);
    if (message && message !== "Unknown operation error") return message;
  }
  return "Unknown operation error";
}

function isRetryableSeedanceTaskFailure(status: string, message: string): boolean {
  return (status === "failed" || status === "error") && message.trim().toLowerCase() === "unknown operation error";
}

function compactJsonForLog(value: unknown, maxLength: number): string {
  try {
    return JSON.stringify(value).replace(/\s+/g, " ").slice(0, maxLength);
  } catch {
    return String(value).replace(/\s+/g, " ").slice(0, maxLength);
  }
}
