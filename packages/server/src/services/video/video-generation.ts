import { mkdir, rename, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { DATA_DIR } from "../../utils/data-dir.js";
import { newId } from "../../utils/id-generator.js";
import { logger } from "../../lib/logger.js";
import { assertInsideDir, safeFetch } from "../../utils/security.js";

export interface VideoReferenceImage {
  base64: string;
  mimeType: "image/png" | "image/jpeg";
}

export interface VideoGenerationRequest {
  prompt: string;
  model?: string;
  // Gemini Omni currently takes duration guidance through the prompt, not video_config.
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16";
  resolution?: "480p" | "720p" | "1080p";
  referenceImage?: VideoReferenceImage | null;
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
const DEFAULT_GOOGLE_VEO_RESOLUTION = "720p";
const DEFAULT_XAI_VIDEO_RESOLUTION = "720p";

function readPositiveIntervalEnv(name: string, fallbackMs: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallbackMs;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallbackMs;
}

const GOOGLE_VEO_POLL_INTERVAL_MS = readPositiveIntervalEnv("GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS", 10_000);
const XAI_POLL_INTERVAL_MS = readPositiveIntervalEnv("XAI_VIDEO_POLL_INTERVAL_MS", 5_000);
const OPENROUTER_POLL_INTERVAL_MS = readPositiveIntervalEnv("OPENROUTER_VIDEO_POLL_INTERVAL_MS", 10_000);

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
  throw new Error(`Unsupported video generation service: ${resolvedService || serviceHint || source}`);
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
  if (!normalized || normalized === "omni" || normalized === "gemini" || normalized === "gemini-omni") {
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
  const referenceImage = request.referenceImage ? videoInlineImage(request.referenceImage) : null;
  const resolution = normalizeGoogleVeoResolution(request.resolution);
  const durationSeconds = normalizeGoogleVeoDuration(request.durationSeconds, !!referenceImage, resolution);
  const instance: Record<string, unknown> = { prompt: request.prompt };
  if (referenceImage) {
    instance.image = referenceImage;
    instance.lastFrame = referenceImage;
  }
  const body = {
    instances: [instance],
    parameters: {
      aspectRatio: request.aspectRatio,
      durationSeconds,
      resolution,
    },
  };

  const started = await safeFetch(endpoint, {
    method: "POST",
    headers: googleVeoHeaders(apiKey),
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
    throw new Error(`Google Veo returned ${started.status}: ${formatProviderError(startText)}`);
  }
  let startJson: unknown;
  try {
    startJson = JSON.parse(startText) as unknown;
  } catch {
    throw new Error(`Google Veo returned non-JSON response: ${startText.slice(0, 300)}`);
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
      logger.debug("[video-gen/google-veo] completed response without video URI: %s", pollText.slice(0, 2000));
      throw new Error("Google Veo response did not include a downloadable video");
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
    body.frame_images = [
      {
        type: "image_url",
        image_url: { url: referenceImageToDataUri(request.referenceImage) },
        frame_type: "first_frame",
      },
    ];
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
  const pollingUrl = readString(startRecord.polling_url) ?? (jobId ? buildOpenRouterVideosUrl(baseUrl, `videos/${jobId}`) : null);
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

function openRouterHeaders(apiKey: string): Record<string, string> {
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

function videoInlineImage(image: VideoReferenceImage): { inlineData: { mimeType: string; data: string } } {
  return {
    inlineData: {
      mimeType: image.mimeType,
      data: stripDataUrl(image.base64),
    },
  };
}

function normalizeGoogleVeoResolution(value: VideoGenerationRequest["resolution"]): "720p" | "1080p" {
  return value === "1080p" ? "1080p" : DEFAULT_GOOGLE_VEO_RESOLUTION;
}

function normalizeGoogleVeoDuration(
  value: number,
  hasReferenceImage: boolean,
  resolution: "720p" | "1080p",
): 4 | 6 | 8 {
  if (hasReferenceImage || resolution === "1080p") return 8;
  if (value <= 5) return 4;
  if (value <= 7) return 6;
  return 8;
}

function extractMp4(value: unknown): string | null {
  const found = findContentRecord(value);
  if (!found) return null;
  return readString(found.data) ?? readString(found.base64) ?? readString(found.base64_data) ?? null;
}

function findVideoUri(value: unknown, depth = 0): string | null {
  if (depth > 8 || value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoUri(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const uri = readString(record.uri);
  if (uri) return uri;
  for (const key of ["response", "generateVideoResponse", "generatedSamples", "generatedVideos", "video"]) {
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
  const hasData = typeof record.data === "string" || typeof record.base64 === "string" || typeof record.base64_data === "string";
  if ((type === "video" || mimeType === "video/mp4") && mimeType === "video/mp4" && hasData) {
    return record;
  }
  const inlineData = record.inline_data ?? record.inlineData;
  if (inlineData) {
    const found = findContentRecord(inlineData, depth + 1);
    if (found) return found;
  }
  for (const key of ["steps", "content", "parts", "output_video", "outputVideo"]) {
    const found = findContentRecord(record[key], depth + 1);
    if (found) return found;
  }
  return null;
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
  return trimmed.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 500);
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
