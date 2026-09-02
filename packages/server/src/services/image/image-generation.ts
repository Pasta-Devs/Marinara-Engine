// ──────────────────────────────────────────────
// Service: Image Generation
// ──────────────────────────────────────────────
// Calls image generation APIs (OpenAI DALL-E, Pollinations, Stability, etc.)
// based on a user's configured image_generation connection.

import { createHash, createHmac, randomBytes } from "crypto";
import { existsSync, mkdirSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { inflateRawSync } from "zlib";
import { WebSocket } from "undici";
import { DATA_DIR } from "../../utils/data-dir.js";
import { newId } from "../../utils/id-generator.js";
import {
  COMFYUI_PLACEHOLDER_REFERENCE_BASE64,
  buildComfyUiLoraWorkflowReplacements,
  DEFAULT_AUTOMATIC1111_DEFAULTS,
  DEFAULT_COMFYUI_DEFAULTS,
  DEFAULT_NOVELAI_DEFAULTS,
  mergeNegativePrompt,
  mergePromptPrefix,
  inferImageSource,
  type Automatic1111Defaults,
  type ComfyUiDefaults,
  type ImageGenerationDefaultsProfile,
  type ImageGenerationQuality,
  type NovelAiDefaults,
  type SceneIllustrationCharacterPrompt,
} from "@marinara-engine/shared";
import { isImageLocalUrlsEnabled } from "../../config/runtime-config.js";
import { runMediaGenerationRequest } from "./image-generation-queue.js";
import { generateRunPodComfyUI } from "./runpod-comfyui.service.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import {
  assertInsideDir,
  normalizeLoopbackUrl,
  safeFetch,
  validateOutboundUrl,
  type SafeFetchOptions,
} from "../../utils/security.js";
import { notifyGenerationFallback, type GenerationFallbackNotifier } from "../generation/fallback-notification.js";
import {
  isConnectionAdmissionFailure,
  splitConnectionAttemptAcrossFallback,
  type ConnectionAttemptOutcome,
  withConnectionAdmission,
  type ConnectionAdmissionMode,
} from "../generation/connection-admission.js";
import {
  COMFYUI_MAX_REFERENCE_IMAGES,
  findMissingComfyReferenceSlots,
  numberedComfyReferencePlaceholder,
} from "./comfyui-reference-placeholders.js";
import { buildVeniceApiUrl, buildVeniceImageRequest, parseVeniceImageResponse } from "./venice-image.js";
import { buildZaiImageRequest, buildZaiImageUrl, parseZaiImageUrl } from "./zai-image.js";
import { buildAtlasCloudImageRequest, runAtlasCloudPrediction } from "../media/atlas-cloud.js";

// sharp is an optional native module (no prebuilds on some platforms like Termux).
// Lazy-load so the server boots even when sharp is missing. The Draw Things img2img
// init resize falls back to passing the original; NovelAI director reference prep
// (prepareNovelAiDirectorReferenceImages) hard-throws when sharp is unavailable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SharpFn = any;
let _sharp: SharpFn | null = null;
let _sharpLoadAttempted = false;
async function tryLoadSharp(): Promise<SharpFn | null> {
  if (_sharp || _sharpLoadAttempted) return _sharp;
  _sharpLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - optional native dep
    const mod = await import("sharp");
    _sharp = (mod.default ?? mod) as SharpFn;
    return _sharp;
  } catch {
    return null;
  }
}

async function resizeBase64ToExactSize(b64: string, width: number, height: number): Promise<string> {
  const sharpFn = await tryLoadSharp();
  if (!sharpFn) return b64;
  try {
    const buf = Buffer.from(b64, "base64");
    const out = await sharpFn(buf).resize(width, height, { fit: "cover", position: "attention" }).png().toBuffer();
    return out.toString("base64");
  } catch (err) {
    logger.warn(err, "[image-gen] init image resize failed, sending original");
    return b64;
  }
}

const GALLERY_DIR = join(DATA_DIR, "gallery");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Strip HTML tags and collapse whitespace — keeps error messages readable when APIs return HTML error pages. */
function sanitizeErrorText(text: string): string {
  if (!text.includes("<")) return text.slice(0, 300);
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export interface ImageGenRequest {
  prompt: string;
  /** OpenAI GPT Image generation quality. Ignored by unsupported services and models. */
  quality?: ImageGenerationQuality;
  negativePrompt?: string;
  width?: number;
  height?: number;
  model?: string;
  /** For endpoint-based image services (e.g. RunPod): the endpoint/instance ID. */
  imageEndpointId?: string;
  /** Optional ComfyUI workflow JSON. Placeholders like %prompt%, %width%, %height%, %seed% will be replaced. */
  comfyWorkflow?: string;
  /** Optional connection-scoped defaults for local Stable Diffusion backends. */
  imageDefaults?: ImageGenerationDefaultsProfile | null;
  /** Allow this explicit image-generation connection to call local/private URLs. */
  allowLocalUrls?: boolean;
  /** Internal exact provider origin allowed to serve a private generated-image result. */
  privateImageResultOrigin?: string;
  /** Optional base64-encoded reference image for img2img / character consistency. */
  referenceImage?: string;
  /** Optional array of base64-encoded reference images (avatars). Providers that support multiple refs use all; others use the first. */
  referenceImages?: string[];
  /** Optional structured per-character prompts. NovelAI V4/V4.5 maps these to native character captions. */
  characterPrompts?: SceneIllustrationCharacterPrompt[];
  /** Request a transparent image background when the provider/model supports it. */
  transparentBackground?: boolean;
  /** Optional caller-owned abort signal for cancelling long image requests. */
  signal?: AbortSignal;
  /** Emit the final provider request even when the global log level is above debug. */
  debugMode?: boolean;
  /** Defaults to foreground: the caller is servicing a user-visible request. */
  admissionMode?: ConnectionAdmissionMode;
  /** Called immediately before a configured fallback connection is attempted. */
  onFallback?: GenerationFallbackNotifier;
  /** Optional one-shot backup connection used only when the primary image request fails. */
  fallback?: {
    connectionId: string;
    connectionName: string;
    provider: string;
    source: string;
    baseUrl: string;
    apiKey: string;
    serviceHint: string;
    model: string;
    imageEndpointId?: string;
    comfyWorkflow?: string;
    imageDefaults?: ImageGenerationDefaultsProfile | null;
    quality?: ImageGenerationQuality;
    imageGenerationSource?: string;
    imageService?: string;
    /** Prompt compiled for this fallback connection's provider and defaults. */
    prompt?: string;
    /** `null` explicitly removes the primary connection's negative prompt. */
    negativePrompt?: string | null;
  };
}

export interface ImageGenResult {
  /** Base64-encoded image data */
  base64: string;
  /** MIME type (e.g. "image/png") */
  mimeType: string;
  /** File extension without dot */
  ext: string;
  /** The provider-specific prompt used when a fallback connection rendered the image. */
  effectivePrompt?: string;
  effectiveNegativePrompt?: string;
  /** Present when a configured fallback connection produced the image. */
  effectiveConnection?: {
    connectionId: string;
    connectionName: string;
    provider: string;
    model: string;
  };
}

const EXPLICIT_IMAGE_SOURCES = new Set([
  "openai",
  "arli",
  "nanogpt",
  "openrouter",
  "pollinations",
  "stability",
  "togetherai",
  "novelai",
  "horde",
  "xai",
  "venice",
  "zai",
  "atlas",
  "comfyui",
  "swarmui",
  "automatic1111",
  "runpod_comfyui",
  "gemini_image",
]);

function normalizeExplicitImageSource(serviceHint: string): string {
  const normalized = serviceHint.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "drawthings") return "automatic1111";
  return EXPLICIT_IMAGE_SOURCES.has(normalized) ? normalized : "";
}

function resolveImageBackend(source: string, baseUrl: string, serviceHint: string, requestModel?: string): string {
  const inferredSource = inferImageSource(requestModel || source, baseUrl);
  const explicitSource = normalizeExplicitImageSource(serviceHint);

  if (!explicitSource) return inferredSource;

  // Gemini image models exposed through OpenAI-compatible proxies (for example LinkAPI)
  // must use the chat-completions path even if an older connection still says "openai".
  if (explicitSource === "openai" && inferredSource === "gemini_image") {
    return inferredSource;
  }

  return explicitSource;
}

/** Default 30-minute timeout for image generation API calls (overridable via env). */
const IMAGE_GEN_TIMEOUT = Number(process.env.IMAGE_GEN_TIMEOUT_MS ?? 1_800_000);
const COMFYUI_GEN_TIMEOUT_SECONDS = Number(process.env.COMFYUI_GEN_TIMEOUT ?? 2400);
export function resolveComfyUiImageGenerationTimeoutMs(
  imageTimeoutMs = IMAGE_GEN_TIMEOUT,
  comfyUiTimeoutSeconds = COMFYUI_GEN_TIMEOUT_SECONDS,
): number {
  return Math.max(imageTimeoutMs, comfyUiTimeoutSeconds * 1000);
}

/**
 * Identify the physical image endpoint an admission slot belongs to. RunPod connections share
 * one API base URL and select the actual endpoint with a separate id, so the base URL alone
 * would make two independent endpoints contend for a single slot. Every other backend's base
 * URL already is the physical target, and a stale `imageEndpointId` left on an imported or
 * copied connection must not split one ComfyUI/A1111 endpoint into separate slots.
 */
export function imageAdmissionKey(normalizedBaseUrl: string, resolvedSource: string, imageEndpointId?: string): string {
  if (resolvedSource === "runpod_comfyui") {
    const endpointId = imageEndpointId?.trim();
    return endpointId ? `${normalizedBaseUrl}#${endpointId}` : normalizedBaseUrl;
  }
  // OpenAI-compatible backends accept the origin, the `/v1` form, and the full endpoint path as
  // spellings of one endpoint, so the base URL alone would let work under one spelling ignore
  // foreground work recorded under another. Key on the URL the request actually goes to.
  if (resolvedSource === "openai") return openAIImagesUrl(normalizedBaseUrl, "generations");
  if (resolvedSource === "nanogpt") return nanoGPTImagesUrl(normalizedBaseUrl);
  return normalizedBaseUrl;
}

/**
 * Generate an image using the configured image generation connection.
 * Returns the base64 data and metadata needed to save it.
 *
 * Self-wrapped in the global media-generation concurrency ceiling (#5097), the
 * way generateVideo already is, so EVERY image path is capped at this single
 * point — game assets, sprites, avatars, storyboards, Mari images — instead of
 * relying on per-caller wiring. Callers that additionally wrap in
 * runImageGenerationRequest for the per-connection FIFO are safe: the nested
 * acquire re-uses their held permit (AsyncLocalStorage re-entrancy guard), as
 * does this function's own fallback-connection recursion. Batch/automatic work
 * (admissionMode "background") never occupies the last permit ahead of
 * interactive requests.
 */
export async function generateImage(
  source: string,
  baseUrl: string,
  apiKey: string,
  serviceHint: string,
  request: ImageGenRequest,
): Promise<ImageGenResult> {
  return runMediaGenerationRequest({
    connectionKey: `image:${baseUrl || source}`,
    queue: false,
    signal: request.signal,
    priority: request.admissionMode?.kind === "background" ? "background" : "foreground",
    task: () => generateImageUncapped(source, baseUrl, apiKey, serviceHint, request),
  });
}

async function generateImageUncapped(
  source: string,
  baseUrl: string,
  apiKey: string,
  serviceHint: string,
  request: ImageGenRequest,
): Promise<ImageGenResult> {
  const resolvedSource = resolveImageBackend(source, baseUrl, serviceHint, request.model);
  const normalizedBaseUrl = normalizeImageUrl(baseUrl);
  const generationTimeoutMs =
    resolvedSource === "comfyui" || resolvedSource === "swarmui" || resolvedSource === "runpod_comfyui"
      ? resolveComfyUiImageGenerationTimeoutMs()
      : IMAGE_GEN_TIMEOUT;
  // Primary plus fallback is one logical attempt, booked once here and reported once below with
  // the outcome of the whole chain. Only the outermost call owns this: the recursive fallback
  // call receives a mode that takes a slot without booking anything.
  const { primaryMode, fallbackMode, settle } = splitConnectionAttemptAcrossFallback(
    request.admissionMode ?? { kind: "foreground" },
  );
  let outcome: ConnectionAttemptOutcome = "failed";

  try {
    const physicalRequest = () =>
      withImageGenerationDeadline(request, generationTimeoutMs, async (signal) => {
        const allowLocalUrls =
          request.allowLocalUrls ?? (await shouldAllowLocalUrlsForImageConnection(normalizedBaseUrl, resolvedSource));
        const scopedRequest = {
          ...request,
          fallback: undefined,
          signal,
          allowLocalUrls,
          privateImageResultOrigin: allowLocalUrls ? imageProviderOrigin(normalizedBaseUrl) : undefined,
        };

        switch (resolvedSource) {
          case "openai":
            return generateOpenAI(normalizedBaseUrl, apiKey, scopedRequest);
          case "arli":
            return generateArli(normalizedBaseUrl, apiKey, scopedRequest);
          case "nanogpt":
            return generateNanoGPT(normalizedBaseUrl, apiKey, scopedRequest);
          case "openrouter":
            return generateOpenRouter(normalizedBaseUrl, apiKey, scopedRequest);
          case "pollinations":
            return generatePollinations(scopedRequest);
          case "stability":
            return generateStability(normalizedBaseUrl, apiKey, scopedRequest);
          case "togetherai":
            return generateTogetherAI(normalizedBaseUrl, apiKey, scopedRequest);
          case "novelai":
            return generateNovelAI(normalizedBaseUrl, apiKey, scopedRequest);
          case "horde":
            return generateHorde(normalizedBaseUrl, apiKey, scopedRequest);
          case "xai":
            return generateXAI(normalizedBaseUrl, apiKey, scopedRequest);
          case "venice":
            return generateVenice(normalizedBaseUrl, apiKey, scopedRequest);
          case "zai":
            return generateZai(normalizedBaseUrl, apiKey, scopedRequest);
          case "atlas":
            return generateAtlasCloudImage(normalizedBaseUrl, apiKey, scopedRequest);
          case "comfyui":
            return generateComfyUI(normalizedBaseUrl, scopedRequest);
          case "swarmui":
            return generateSwarmUI(normalizedBaseUrl, apiKey, scopedRequest);
          case "runpod_comfyui": {
            const endpointId = scopedRequest.imageEndpointId || "";
            if (!endpointId) {
              throw new Error(
                "RunPod ComfyUI requires an endpoint ID. " +
                  "Enter your RunPod endpoint ID in the Endpoint ID field (e.g. 'abc123def456').",
              );
            }
            return generateRunPodComfyUI(normalizedBaseUrl, endpointId, apiKey, scopedRequest);
          }
          case "automatic1111":
            return generateAutomatic1111(normalizedBaseUrl, scopedRequest, serviceHint);
          case "gemini_image":
            return generateViaChatCompletions(normalizedBaseUrl, apiKey, scopedRequest);
          default:
            return generateOpenAI(normalizedBaseUrl, apiKey, scopedRequest);
        }
      });
    // Admit on the resolved endpoint rather than a connection id: every caller reaches this
    // function, but only some have a connection row in scope, and foreground work that
    // registers nothing would let background preparation start on top of it.
    // ponytail: image work keys on the endpoint URL while text work keys on the connection
    // id, so the two do not hold each other off on a connection used for both. Unify the
    // key if that overlap ever shows up in practice.
    const primaryResult = await withConnectionAdmission(
      imageAdmissionKey(normalizedBaseUrl, resolvedSource, request.imageEndpointId),
      primaryMode,
      physicalRequest,
    );
    outcome = "completed";
    return primaryResult;
  } catch (error) {
    const fallback = request.fallback;
    if (!fallback || request.signal?.aborted || isConnectionAdmissionFailure(error)) throw error;
    logger.warn(
      error,
      "[illustrator-fallback] Primary image generation failed; retrying with connection %s (%s)",
      fallback.connectionId,
      fallback.model,
    );
    try {
      await (request.onFallback ?? notifyGenerationFallback)({
        category: "illustrator",
        connectionId: fallback.connectionId,
        connectionName: fallback.connectionName,
        model: fallback.model,
      });
    } catch (noticeError) {
      logger.warn(noticeError, "[illustrator-fallback] Failed to report fallback activation");
    }
    const result = await generateImage(fallback.source, fallback.baseUrl, fallback.apiKey, fallback.serviceHint, {
      ...request,
      fallback: undefined,
      admissionMode: fallbackMode,
      prompt: fallback.prompt ?? request.prompt,
      negativePrompt:
        fallback.negativePrompt === null ? undefined : (fallback.negativePrompt ?? request.negativePrompt),
      model: fallback.model,
      imageEndpointId: fallback.imageEndpointId,
      comfyWorkflow: fallback.comfyWorkflow,
      imageDefaults: fallback.imageDefaults,
      quality: fallback.quality,
      allowLocalUrls: undefined,
    });
    outcome = "completed";
    return {
      ...result,
      effectiveConnection: {
        connectionId: fallback.connectionId,
        connectionName: fallback.connectionName,
        provider: fallback.provider,
        model: fallback.model,
      },
      effectivePrompt: result.effectivePrompt ?? fallback.prompt ?? request.prompt,
      effectiveNegativePrompt:
        result.effectiveNegativePrompt ??
        (fallback.negativePrompt === null ? undefined : (fallback.negativePrompt ?? request.negativePrompt)),
    };
  } finally {
    await settle(outcome);
  }
}

export type SaveImageToDiskOptions = {
  /**
   * Store one canonical file for images referenced by more than one gallery.
   * Gallery metadata remains responsible for deciding where the image appears.
   */
  shared?: boolean;
};

/**
 * Save a generated image to the gallery directory on disk.
 * Returns a path relative to data/gallery/.
 */
export function saveImageToDisk(
  chatId: string,
  base64: string,
  ext: string,
  options: SaveImageToDiskOptions = {},
): string {
  const ownerDir = options.shared ? "shared" : chatId;
  const dir = assertInsideDir(GALLERY_DIR, join(GALLERY_DIR, ownerDir));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const detectedMime = detectImageMimeType(base64);
  const effectiveExt = (detectedMime ? imageExtensionFromMimeType(detectedMime) : null) ?? ext;
  const filename = `${newId()}.${effectiveExt}`;
  const filePath = assertInsideDir(GALLERY_DIR, join(dir, filename));
  const tempPath = assertInsideDir(GALLERY_DIR, `${filePath}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(tempPath, Buffer.from(base64, "base64"));
    renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {
      /* best-effort cleanup */
    }
    throw error;
  }
  return `${ownerDir}/${filename}`;
}

export function removeSavedImageFromDisk(filePath: string): void {
  const fullPath = assertInsideDir(GALLERY_DIR, join(GALLERY_DIR, filePath));
  try {
    unlinkSync(fullPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export type StagedGalleryImage = {
  filePath: string;
  promote: () => void;
  compensate: () => void;
};

/**
 * Staged files are named for the writing process and only survive it if that process was killed
 * between writing the image and promoting or compensating it. Nothing can reference them, so a
 * startup sweep reclaims the space.
 */
export function sweepStagedImages(): number {
  const stagingDir = assertInsideDir(GALLERY_DIR, join(GALLERY_DIR, ".staging", "noodle"));
  let removed = 0;
  try {
    for (const entry of readdirSync(stagingDir)) {
      if (!entry.endsWith(".tmp")) continue;
      try {
        unlinkSync(assertInsideDir(stagingDir, join(stagingDir, entry)));
        removed += 1;
      } catch {
        /* best-effort sweep */
      }
    }
  } catch {
    /* no staging directory yet */
  }
  return removed;
}

/** Stage provider output without making it visible in the gallery. */
export function stageImageToDisk(chatId: string, base64: string, ext: string): StagedGalleryImage {
  const detectedMime = detectImageMimeType(base64);
  const effectiveExt = (detectedMime ? imageExtensionFromMimeType(detectedMime) : null) ?? ext;
  const filename = `${newId()}.${effectiveExt}`;
  const relativePath = `${chatId}/${filename}`;
  const finalPath = assertInsideDir(GALLERY_DIR, join(GALLERY_DIR, relativePath));
  const stagingDir = assertInsideDir(GALLERY_DIR, join(GALLERY_DIR, ".staging", "noodle"));
  const stagedPath = assertInsideDir(stagingDir, join(stagingDir, `${filename}.${process.pid}.${Date.now()}.tmp`));
  mkdirSync(stagingDir, { recursive: true });
  try {
    writeFileSync(stagedPath, Buffer.from(base64, "base64"));
  } catch (error) {
    try {
      if (existsSync(stagedPath)) unlinkSync(stagedPath);
    } catch {
      /* best-effort cleanup */
    }
    throw error;
  }

  return {
    filePath: relativePath,
    promote() {
      mkdirSync(dirname(finalPath), { recursive: true });
      renameSync(stagedPath, finalPath);
    },
    compensate() {
      for (const path of [stagedPath, finalPath]) {
        try {
          if (existsSync(path)) unlinkSync(path);
        } catch {
          /* best-effort compensation */
        }
      }
    },
  };
}

// ── Provider Implementations ──

const MAX_IMAGE_RESPONSE_BYTES = 30 * 1024 * 1024;
const SWARMUI_MAX_TRACKED_IMAGES = 16;
const LOCAL_IMAGE_BACKENDS = new Set(["comfyui", "swarmui", "automatic1111"]);
const NANOGPT_REFERENCE_IMAGE_LIMIT = 3;
const NANOGPT_MAX_REQUEST_BYTES = 4 * 1024 * 1024;

class ImageGenerationDeadlineError extends Error {
  constructor(timeoutMs: number) {
    super(`Image generation timed out after ${Math.round(timeoutMs / 1000)} seconds`);
    this.name = "ImageGenerationDeadlineError";
  }
}

function withImageGenerationDeadline<T>(
  request: Pick<ImageGenRequest, "signal">,
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const abortFromRequest = () => controller.abort(request.signal?.reason);
  if (request.signal?.aborted) {
    controller.abort(request.signal.reason);
  } else {
    request.signal?.addEventListener("abort", abortFromRequest, { once: true });
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      const error = new ImageGenerationDeadlineError(timeoutMs);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
    timeout.unref?.();
  });

  return Promise.race([run(controller.signal), deadline]).finally(() => {
    request.signal?.removeEventListener("abort", abortFromRequest);
    if (timeout) clearTimeout(timeout);
  });
}

function imageRequestSignal(request: Pick<ImageGenRequest, "signal">): AbortSignal {
  return request.signal ?? AbortSignal.timeout(IMAGE_GEN_TIMEOUT);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new Error("Image generation aborted");
}

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      throwIfAborted(signal);
    } catch (err) {
      reject(err);
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const onAbort = () => {
      if (timeout) clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.reason instanceof Error ? signal.reason : new Error("Image generation aborted"));
    };
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    };
    timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    timeout.unref?.();
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function normalizeImageUrl(url: string | URL): string {
  try {
    return normalizeLoopbackUrl(url);
  } catch {
    return url.toString();
  }
}

function imageProviderOrigin(baseUrl: string): string | undefined {
  try {
    return new URL(normalizeImageUrl(baseUrl)).origin;
  } catch {
    return undefined;
  }
}

async function shouldAllowLocalUrlsForImageConnection(baseUrl: string, resolvedSource: string): Promise<boolean> {
  if (isImageLocalUrlsEnabled() || LOCAL_IMAGE_BACKENDS.has(resolvedSource)) return true;

  try {
    await validateOutboundUrl(baseUrl, {
      allowLoopback: true,
      allowedProtocols: ["https:", "http:"],
    });
    return false;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return /private|loopback|local|reserved/i.test(message);
  }
}

type ImageFetchOptions = {
  allowLocal?: boolean;
  allowLoopback?: boolean;
  allowedOrigins?: string[];
  agentOptions?: SafeFetchOptions["agentOptions"];
  keepAliveInitialDelayMs?: number;
};

function imageFetch(url: string | URL, init?: RequestInit, options: ImageFetchOptions = {}) {
  return safeFetch(url, {
    ...(init ?? {}),
    policy: {
      allowLocal: options.allowLocal ?? isImageLocalUrlsEnabled(),
      allowLoopback: options.allowLoopback ?? true,
      allowedOrigins: options.allowedOrigins,
      allowedProtocols: ["https:", "http:"],
      flagName: "IMAGE_LOCAL_URLS_ENABLED",
    },
    agentOptions: options.agentOptions,
    keepAliveInitialDelayMs: options.keepAliveInitialDelayMs,
    maxResponseBytes: MAX_IMAGE_RESPONSE_BYTES,
    decodeCompressedResponse: true,
  });
}

function localImageBackendFetch(
  url: string | URL,
  init?: RequestInit,
  options: { timeoutMs?: number; keepAliveInitialDelayMs?: number } = {},
) {
  return imageFetch(url, init, {
    allowLocal: true,
    agentOptions: options.timeoutMs ? { bodyTimeout: options.timeoutMs, headersTimeout: options.timeoutMs } : undefined,
    keepAliveInitialDelayMs: options.keepAliveInitialDelayMs,
  });
}

function isOpenAIGptImageModel(model?: string): boolean {
  return !!model && /^gpt-image-(?:1|1\.5|2)(?:$|-)/i.test(model.trim());
}

function isOpenAIGptImage2Model(model?: string): boolean {
  return !!model && /^gpt-image-2(?:$|-)/i.test(model.trim());
}

function supportsOpenAITransparentBackground(model?: string): boolean {
  const m = model?.trim().toLowerCase() ?? "";
  // OpenAI documents transparent backgrounds for GPT Image output generally,
  // but explicitly excludes GPT Image 2 from background: "transparent".
  return /^gpt-image-(?:1|1\.5)(?:$|-)/i.test(m);
}

const OPENAI_GPT_IMAGE_2_MIN_PIXELS = 1024 * 1024;
const OPENAI_GPT_IMAGE_2_SIZE_MULTIPLE = 32;

function roundUpToMultiple(value: number, multiple: number): number {
  return Math.ceil(value / multiple) * multiple;
}

function openAIGptImage2Size(width: number, height: number): string {
  const requestedPixels = width * height;
  if (requestedPixels >= OPENAI_GPT_IMAGE_2_MIN_PIXELS) return `${width}x${height}`;

  const scale = Math.sqrt(OPENAI_GPT_IMAGE_2_MIN_PIXELS / Math.max(1, requestedPixels));
  const scaledWidth = roundUpToMultiple(width * scale, OPENAI_GPT_IMAGE_2_SIZE_MULTIPLE);
  const scaledHeight = roundUpToMultiple(height * scale, OPENAI_GPT_IMAGE_2_SIZE_MULTIPLE);
  return `${scaledWidth}x${scaledHeight}`;
}

function openAIImageSize(request: ImageGenRequest): string {
  const width = request.width ?? 1024;
  const height = request.height ?? 1024;
  const requested = `${width}x${height}`;
  const model = request.model?.trim() ?? "";
  const ratio = width / Math.max(1, height);

  if (/dall-e-2/i.test(model)) {
    return width === height && [256, 512, 1024].includes(width) ? requested : "1024x1024";
  }

  if (/dall-e-3/i.test(model)) {
    if (ratio > 1.12) return "1792x1024";
    if (ratio < 0.88) return "1024x1792";
    return "1024x1024";
  }

  if (isOpenAIGptImage2Model(model)) {
    return openAIGptImage2Size(width, height);
  }

  // GPT Image models reject small custom dimensions such as 1024x576.
  // Use the closest supported canvas and let callers crop/resize if needed.
  if (ratio > 1.12) return "1536x1024";
  if (ratio < 0.88) return "1024x1536";
  return "1024x1024";
}

const XAI_IMAGE_ASPECT_RATIOS = [
  ["1:1", 1],
  ["16:9", 16 / 9],
  ["9:16", 9 / 16],
  ["4:3", 4 / 3],
  ["3:4", 3 / 4],
  ["3:2", 3 / 2],
  ["2:3", 2 / 3],
  ["2:1", 2],
  ["1:2", 1 / 2],
  ["19.5:9", 19.5 / 9],
  ["9:19.5", 9 / 19.5],
  ["20:9", 20 / 9],
  ["9:20", 9 / 20],
] as const;

function xAIImageAspectRatio(width?: number, height?: number): string {
  if (!width || !height) return "auto";
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`xAI image generation requires positive width and height values, got ${width}x${height}`);
  }

  const ratio = width / height;
  return XAI_IMAGE_ASPECT_RATIOS.reduce((best, candidate) =>
    Math.abs(candidate[1] - ratio) < Math.abs(best[1] - ratio) ? candidate : best,
  )[0];
}

function imageDataUrlFromReference(reference: string): string {
  const trimmed = reference.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  const base64 = trimmed.replace(/\s+/g, "");
  return `data:${detectImageMimeType(base64) ?? "image/png"};base64,${base64}`;
}

function detectImageMimeType(base64: string): string | null {
  const bytes = Buffer.from(base64.slice(0, 64), "base64");
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = bytes.subarray(8, 12).toString("ascii").toLowerCase();
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "image/avif";
  }
  return null;
}

function imageExtensionFromMimeType(mimeType: string): string {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("avif")) return "avif";
  if (mimeType.includes("bmp")) return "bmp";
  return "png";
}

function normalizeImageMimeType(mimeType: string | null | undefined): string | null {
  const normalized = mimeType?.split(";")[0]?.trim().toLowerCase().replace("image/jpg", "image/jpeg") ?? "";
  return /^(?:image\/png|image\/jpeg|image\/webp|image\/gif|image\/avif|image\/bmp)$/.test(normalized)
    ? normalized
    : null;
}

function imageResultMetadata(
  filename: string,
  contentType: string | null,
  base64: string,
): Pick<ImageGenResult, "mimeType" | "ext"> {
  const normalizedContentType = contentType?.toLowerCase() ?? "";
  const normalizedFilename = filename.toLowerCase();

  if (
    normalizedContentType.includes("jpeg") ||
    normalizedContentType.includes("jpg") ||
    /\.jpe?g(?:$|[?#])/i.test(normalizedFilename)
  ) {
    return { mimeType: "image/jpeg", ext: "jpg" };
  }
  if (normalizedContentType.includes("webp") || /\.webp(?:$|[?#])/i.test(normalizedFilename)) {
    return { mimeType: "image/webp", ext: "webp" };
  }
  if (normalizedContentType.includes("gif") || /\.gif(?:$|[?#])/i.test(normalizedFilename)) {
    return { mimeType: "image/gif", ext: "gif" };
  }
  if (normalizedContentType.includes("avif") || /\.avif(?:$|[?#])/i.test(normalizedFilename)) {
    return { mimeType: "image/avif", ext: "avif" };
  }
  if (normalizedContentType.includes("bmp") || /\.bmp(?:$|[?#])/i.test(normalizedFilename)) {
    return { mimeType: "image/bmp", ext: "bmp" };
  }

  const detectedMimeType = detectImageMimeType(base64) ?? normalizeImageMimeType(contentType) ?? "image/png";
  return { mimeType: detectedMimeType, ext: imageExtensionFromMimeType(detectedMimeType) };
}

function decodeImageDataUrl(imageUrl: string): ImageGenResult {
  const match = imageUrl.trim().match(/^data:(image\/(?:png|jpe?g|webp|gif|avif|bmp));base64,([\s\S]+)$/i);
  if (!match) {
    throw new Error("Generated image data URL was not a supported image format");
  }

  const declaredMimeType = match[1]!.toLowerCase().replace("image/jpg", "image/jpeg");
  const encoded = match[2]!.replace(/\s+/g, "");
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error("Generated image data URL was not valid base64 image data");
  }

  const buffer = Buffer.from(encoded, "base64");
  if (buffer.byteLength === 0) {
    throw new Error("Generated image data URL was empty");
  }

  const base64 = buffer.toString("base64");
  const mimeType = detectImageMimeType(base64) || declaredMimeType;
  return { base64, mimeType, ext: imageExtensionFromMimeType(mimeType) };
}

function nanoGPTImagesUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname.replace(/\/+$/, "");
    if (path.endsWith("/images/generations")) {
      // Keep user-supplied full endpoint URLs, but normalize the legacy /api/v1 prefix below.
    } else if (path === "" || path === "/" || path.endsWith("/api")) {
      parsed.pathname = "/v1/images/generations";
    } else if (path.endsWith("/api/v1")) {
      parsed.pathname = `${path.slice(0, -"/api/v1".length)}/v1/images/generations`;
    } else if (path.endsWith("/v1")) {
      parsed.pathname = `${path}/images/generations`;
    } else {
      parsed.pathname = `${path}/images/generations`;
    }
    parsed.pathname = parsed.pathname.replace(/\/api\/v1\/images\/generations$/, "/v1/images/generations");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return `${trimmed}/images/generations`;
  }
}

function openAIImagesUrl(baseUrl: string, endpoint: "generations" | "edits"): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const targetPath = `/images/${endpoint}`;
  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname.replace(/\/+$/, "");
    if (/\/images\/(?:generations|edits|variations)$/i.test(path)) {
      parsed.pathname = path.replace(/\/images\/(?:generations|edits|variations)$/i, targetPath);
    } else if (path === "" || path === "/") {
      parsed.pathname = `/v1${targetPath}`;
    } else if (path.endsWith("/api/v1")) {
      parsed.pathname = `${path.slice(0, -"/api/v1".length)}/v1${targetPath}`;
    } else if (path.endsWith("/api")) {
      parsed.pathname = `${path.slice(0, -"/api".length)}/v1${targetPath}`;
    } else if (path.endsWith("/v1")) {
      parsed.pathname = `${path}${targetPath}`;
    } else {
      parsed.pathname = `${path}${targetPath}`;
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return `${trimmed}${targetPath}`;
  }
}

function openAIReferenceImages(request: ImageGenRequest): string[] {
  const references = request.referenceImages?.length
    ? request.referenceImages
    : request.referenceImage
      ? [request.referenceImage]
      : [];
  return references
    .map((reference) => reference.trim())
    .filter(Boolean)
    .slice(0, 16);
}

function normalizeBase64ImagePayload(value: string, label = "Reference image"): string {
  const compact = value.replace(/\s+/g, "");
  const unpadded = compact.replace(/=+$/, "");
  if (!unpadded || /[^A-Za-z0-9+/]/.test(unpadded)) {
    throw new Error(`${label} was not valid base64 image data`);
  }

  const remainder = unpadded.length % 4;
  if (remainder === 1) {
    throw new Error(`${label} was not valid base64 image data`);
  }

  return `${unpadded}${"=".repeat(remainder === 0 ? 0 : 4 - remainder)}`;
}

function decodeReferenceImage(reference: string): { base64: string; mimeType: string; ext: string } {
  const dataUrlMatch = reference.trim().match(/^data:(image\/(?:png|jpe?g|webp|gif|avif|bmp));base64,([\s\S]+)$/i);
  if (dataUrlMatch) {
    const mimeType = dataUrlMatch[1]!.toLowerCase().replace("image/jpg", "image/jpeg");
    const base64 = normalizeBase64ImagePayload(dataUrlMatch[2]!);
    return { base64, mimeType, ext: imageExtensionFromMimeType(mimeType) };
  }

  const base64 = normalizeBase64ImagePayload(reference);
  const mimeType = detectImageMimeType(base64) ?? "image/png";
  return { base64, mimeType, ext: imageExtensionFromMimeType(mimeType) };
}

async function readOpenAIImageResult(
  resp: Response,
  request: ImageGenRequest,
  operation: "generation" | "edit",
): Promise<ImageGenResult> {
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`OpenAI image ${operation} failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const data = (await resp.json()) as {
    data?: Array<{ b64_json?: string; image_base64?: string; url?: string; revised_prompt?: string }>;
  };
  const item = data.data?.[0];
  const b64 = item?.b64_json ?? item?.image_base64;
  if (!b64 && item?.url) return downloadImageUrl(item.url, request.privateImageResultOrigin, request.signal);
  if (!b64) {
    const fields = item
      ? Object.keys(item).join(", ")
      : data && typeof data === "object"
        ? Object.keys(data).join(", ")
        : "none";
    throw new Error(`No image data in OpenAI response (fields: ${fields || "none"})`);
  }

  return { base64: b64, mimeType: "image/png", ext: "png" };
}

async function downloadImageUrl(
  imageUrl: string,
  privateProviderOrigin?: string,
  signal?: AbortSignal,
): Promise<ImageGenResult> {
  if (imageUrl.trim().startsWith("data:")) {
    return decodeImageDataUrl(imageUrl);
  }

  const resultPolicy = await resolveImageResultUrlPolicy(imageUrl, privateProviderOrigin);
  const normalizedImageUrl = resultPolicy.url;
  const imgResp = await imageFetch(
    normalizedImageUrl,
    { signal: imageRequestSignal({ signal }) },
    {
      allowLocal: resultPolicy.allowLocal,
      allowLoopback: resultPolicy.allowLoopback,
      allowedOrigins: resultPolicy.allowedOrigins,
    },
  );
  if (!imgResp.ok) {
    throw new Error(`Failed to download generated image (${imgResp.status})`);
  }

  const arrayBuffer = await imgResp.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const contentType = imgResp.headers.get("content-type") ?? "";
  let mimeType = detectImageMimeType(base64) ?? normalizeImageMimeType(contentType) ?? "image/png";
  if (contentType.includes("jpeg") || contentType.includes("jpg") || normalizedImageUrl.match(/\.jpe?g/i)) {
    mimeType = "image/jpeg";
  } else if (contentType.includes("webp") || normalizedImageUrl.match(/\.webp/i)) {
    mimeType = "image/webp";
  } else if (contentType.includes("gif") || normalizedImageUrl.match(/\.gif/i)) {
    mimeType = "image/gif";
  } else if (contentType.includes("avif") || normalizedImageUrl.match(/\.avif/i)) {
    mimeType = "image/avif";
  } else if (contentType.includes("bmp") || normalizedImageUrl.match(/\.bmp/i)) {
    mimeType = "image/bmp";
  }

  return { base64, mimeType, ext: imageExtensionFromMimeType(mimeType) };
}

export type ImageResultUrlPolicy = {
  url: string;
  allowLocal: boolean;
  allowLoopback: boolean;
  allowedOrigins?: string[];
};

/**
 * Public provider results retain ordinary CDN redirect support. Private
 * results are accepted only from the exact configured provider origin.
 */
export async function resolveImageResultUrlPolicy(
  imageUrl: string,
  privateProviderOrigin?: string,
): Promise<ImageResultUrlPolicy> {
  const normalizedImageUrl = normalizeImageUrl(imageUrl);
  try {
    await validateOutboundUrl(normalizedImageUrl, {
      allowLocal: false,
      allowLoopback: false,
      allowedProtocols: ["https:", "http:"],
    });
    return {
      url: normalizedImageUrl,
      allowLocal: false,
      allowLoopback: false,
    };
  } catch (publicPolicyError) {
    let allowedOrigin: string | undefined;
    let resultOrigin: string | undefined;
    try {
      allowedOrigin = privateProviderOrigin ? new URL(normalizeImageUrl(privateProviderOrigin)).origin : undefined;
      resultOrigin = new URL(normalizedImageUrl).origin;
    } catch {
      throw publicPolicyError;
    }
    if (!allowedOrigin || resultOrigin !== allowedOrigin) throw publicPolicyError;
    return {
      url: normalizedImageUrl,
      allowLocal: true,
      allowLoopback: true,
      allowedOrigins: [allowedOrigin],
    };
  }
}

function openAITextPrompt(request: ImageGenRequest): string {
  const prompt = request.prompt.trim();
  const negativePrompt = request.negativePrompt?.trim();
  if (!negativePrompt) return prompt;
  return `${prompt}\n\nDo not include: ${negativePrompt}.`;
}

async function generateOpenAI(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  const usesGptImageApi = isOpenAIGptImageModel(request.model);
  const references = openAIReferenceImages(request);
  const prompt = openAITextPrompt(request);

  if (usesGptImageApi && references.length > 0) {
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("n", "1");
    formData.append("size", openAIImageSize(request));
    formData.append("output_format", "png");
    if (request.quality) formData.append("quality", request.quality);
    if (request.transparentBackground && supportsOpenAITransparentBackground(request.model)) {
      formData.append("background", "transparent");
    }
    if (request.model) formData.append("model", request.model);

    references.forEach((reference, index) => {
      const decoded = decodeReferenceImage(reference);
      formData.append(
        "image[]",
        new Blob([Buffer.from(decoded.base64, "base64")], { type: decoded.mimeType }),
        `reference-${index + 1}.${decoded.ext}`,
      );
    });

    const resp = await imageFetch(
      openAIImagesUrl(baseUrl, "edits"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: imageRequestSignal(request),
      },
      { allowLocal: request.allowLocalUrls },
    );

    return readOpenAIImageResult(resp, request, "edit");
  }

  const url = openAIImagesUrl(baseUrl, "generations");
  const body: Record<string, unknown> = {
    prompt,
    n: 1,
    size: openAIImageSize(request),
  };
  if (request.model) body.model = request.model;
  if (usesGptImageApi) {
    // GPT Image models return base64 image data from the Images API without the
    // legacy DALL-E `response_format` toggle. `output_format` controls PNG/JPEG/WebP.
    body.output_format = "png";
    if (request.quality) body.quality = request.quality;
    if (request.transparentBackground && supportsOpenAITransparentBackground(request.model)) {
      body.background = "transparent";
    }
  } else {
    body.response_format = "b64_json";
  }

  const resp = await imageFetch(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  return readOpenAIImageResult(resp, request, "generation");
}

function xAIImagesUrl(baseUrl: string, endpoint: "generations" | "edits"): string {
  return openAIImagesUrl(baseUrl, endpoint);
}

function xAIReferenceImages(request: ImageGenRequest): string[] {
  return openAIReferenceImages(request).slice(0, 3);
}

function nanoGPTReferenceImages(request: ImageGenRequest): string[] {
  return openAIReferenceImages(request).slice(0, NANOGPT_REFERENCE_IMAGE_LIMIT);
}

function serializeNanoGPTImageRequest(body: Record<string, unknown>, references: string[]): string {
  const dataUrls = references.map(imageDataUrlFromReference);
  const selected: string[] = [];
  let serialized = JSON.stringify(body);

  for (const dataUrl of dataUrls) {
    const candidateReferences = [...selected, dataUrl];
    const candidate = {
      ...body,
      ...(candidateReferences.length === 1
        ? { imageDataUrl: candidateReferences[0] }
        : { imageDataUrls: candidateReferences }),
    };
    const candidateSerialized = JSON.stringify(candidate);
    if (Buffer.byteLength(candidateSerialized, "utf8") > NANOGPT_MAX_REQUEST_BYTES) continue;
    selected.push(dataUrl);
    serialized = candidateSerialized;
  }

  if (dataUrls.length > 0 && selected.length === 0) {
    throw new Error(
      "NanoGPT reference image is too large for its 4 MB request limit. Compress or resize the reference and retry.",
    );
  }
  if (selected.length < dataUrls.length) {
    logger.warn(
      "[image-gen/nanogpt] Reduced reference images from %d to %d to stay within the 4 MB request limit",
      dataUrls.length,
      selected.length,
    );
  }
  if (Buffer.byteLength(serialized, "utf8") > NANOGPT_MAX_REQUEST_BYTES) {
    throw new Error("NanoGPT image request exceeds its 4 MB limit. Shorten the prompt or reduce image inputs.");
  }
  return serialized;
}

function xAIImageInput(reference: string): { type: "image_url"; url: string } {
  const decoded = decodeReferenceImage(reference);
  return {
    type: "image_url",
    url: `data:${decoded.mimeType};base64,${decoded.base64}`,
  };
}

async function generateXAI(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  const references = xAIReferenceImages(request);
  const endpoint = references.length > 0 ? "edits" : "generations";
  const body: Record<string, unknown> = {
    prompt: request.prompt,
    n: 1,
    aspect_ratio: xAIImageAspectRatio(request.width, request.height),
  };
  if (request.model) body.model = request.model;
  if (references.length === 0) {
    body.response_format = "b64_json";
  } else if (references.length === 1) {
    body.image = xAIImageInput(references[0]!);
  } else {
    body.images = references.map(xAIImageInput);
  }

  const resp = await imageFetch(
    xAIImagesUrl(baseUrl, endpoint),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    const operation = endpoint === "edits" ? "edit" : "generation";
    throw new Error(`xAI image ${operation} failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const data = (await resp.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const result = data.data?.[0];
  if (result?.b64_json) return { base64: result.b64_json, mimeType: "image/png", ext: "png" };
  if (result?.url) return downloadImageUrl(result.url, request.privateImageResultOrigin, request.signal);

  throw new Error("No image data in xAI response");
}

async function generateVenice(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  const body = buildVeniceImageRequest(request);
  logDebugOverride(
    request.debugMode === true,
    "[debug/image/venice] final request payload:\n%s",
    JSON.stringify(body, null, 2),
  );
  const resp = await imageFetch(
    buildVeniceApiUrl(baseUrl, "image/generate"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  const responseText = await resp.text();
  if (!resp.ok) {
    throw new Error(`Venice image generation failed (${resp.status}): ${sanitizeErrorText(responseText)}`);
  }

  let response: unknown;
  try {
    response = JSON.parse(responseText);
  } catch {
    throw new Error("Venice image generation returned invalid JSON");
  }
  return parseVeniceImageResponse(response);
}

async function generateZai(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  const body = buildZaiImageRequest(request);
  logDebugOverride(
    request.debugMode === true,
    "[debug/image/zai] final request payload:\n%s",
    JSON.stringify(body, null, 2),
  );
  const resp = await imageFetch(
    buildZaiImageUrl(baseUrl),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  const responseText = await resp.text();
  if (!resp.ok) {
    throw new Error(`Z.AI image generation failed (${resp.status}): ${sanitizeErrorText(responseText)}`);
  }

  let response: unknown;
  try {
    response = JSON.parse(responseText);
  } catch {
    throw new Error("Z.AI image generation returned invalid JSON");
  }
  return downloadImageUrl(parseZaiImageUrl(response), request.privateImageResultOrigin, request.signal);
}

async function generateAtlasCloudImage(
  baseUrl: string,
  apiKey: string,
  request: ImageGenRequest,
): Promise<ImageGenResult> {
  const reference = openAIReferenceImages(request)[0];
  const body = buildAtlasCloudImageRequest({
    model: request.model ?? "",
    prompt: request.prompt,
    width: request.width,
    height: request.height,
    referenceImageDataUrl: reference ? imageDataUrlFromReference(reference) : undefined,
  });
  logDebugOverride(
    request.debugMode === true,
    "[debug/image/atlas-cloud] final request payload:\n%s",
    JSON.stringify(body, null, 2),
  );
  const outputUrl = await runAtlasCloudPrediction({
    baseUrl,
    apiKey,
    kind: "image",
    body,
    signal: imageRequestSignal(request),
  });
  return downloadImageUrl(outputUrl, request.privateImageResultOrigin, request.signal);
}

async function generateNanoGPT(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  const url = nanoGPTImagesUrl(baseUrl);
  const size = isOpenAIGptImageModel(request.model)
    ? openAIImageSize(request)
    : `${request.width ?? 1024}x${request.height ?? 1024}`;
  const body: Record<string, unknown> = {
    prompt: request.prompt,
    n: 1,
    size,
    response_format: "url",
  };
  if (request.model) body.model = request.model;
  if (request.negativePrompt) body.negative_prompt = request.negativePrompt;

  const references = nanoGPTReferenceImages(request);
  if (request.model?.toLowerCase().includes("flux-kontext")) {
    body.kontext_max_mode = true;
  }
  const requestBody = serializeNanoGPTImageRequest(body, references);

  const resp = await imageFetch(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: requestBody,
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`NanoGPT image generation failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const responseText = await resp.text();
  let data: {
    data?: Array<{ b64_json?: string; image_base64?: string; url?: string; image_url?: string }>;
  };
  try {
    data = JSON.parse(responseText) as typeof data;
  } catch {
    throw new Error(`NanoGPT image generation returned invalid JSON (${sanitizeErrorText(responseText)})`);
  }
  const result = data.data?.[0];
  const base64Result = result?.b64_json ?? result?.image_base64;
  if (base64Result) {
    if (base64Result.trim().startsWith("data:")) return decodeImageDataUrl(base64Result);
    const base64 = normalizeBase64ImagePayload(base64Result, "NanoGPT image response");
    const mimeType = detectImageMimeType(base64);
    if (!mimeType) throw new Error("NanoGPT image response did not contain recognized image bytes");
    return { base64, mimeType, ext: imageExtensionFromMimeType(mimeType) };
  }
  const resultUrl = result?.url ?? result?.image_url;
  if (resultUrl) return downloadImageUrl(resultUrl, request.privateImageResultOrigin, request.signal);

  const fields = result
    ? Object.keys(result).join(", ")
    : data && typeof data === "object"
      ? Object.keys(data).join(", ")
      : "none";
  logDebugOverride(request.debugMode === true, "[debug/image/nanogpt] response fields: %s", fields || "none");
  throw new Error(`No image data in NanoGPT response (fields: ${fields || "none"})`);
}

async function generatePollinations(request: ImageGenRequest): Promise<ImageGenResult> {
  const params = new URLSearchParams({
    width: String(request.width ?? 1024),
    height: String(request.height ?? 1024),
    nologo: "true",
    seed: String(Math.floor(Math.random() * 1e9)),
  });
  if (request.negativePrompt) params.set("negative", request.negativePrompt);

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(request.prompt)}?${params}`;
  const resp = await imageFetch(url, { signal: imageRequestSignal(request) });

  if (!resp.ok) {
    throw new Error(`Pollinations image generation failed (${resp.status})`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return { base64, mimeType: "image/jpeg", ext: "jpg" };
}

const HORDE_ANON_API_KEY = "0000000000";

function hordeUrl(baseUrl: string, targetPath: string): string {
  try {
    const url = new URL(baseUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const versionIndex = parts.findIndex((part, index) => part === "api" && parts[index + 1] === "v2");
    const prefix = versionIndex >= 0 ? parts.slice(0, versionIndex + 2) : [...parts, "api", "v2"];
    url.pathname = `/${[...prefix, ...targetPath.split("/").filter(Boolean)].join("/")}`;
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return `${baseUrl.replace(/\/+$/, "")}/api/v2/${targetPath.replace(/^\/+/, "")}`;
  }
}

function hordeHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    apikey: apiKey.trim() || HORDE_ANON_API_KEY,
    "Client-Agent": "Marinara-Engine",
  };
}

function hordePrompt(request: ImageGenRequest): string {
  const prompt = request.prompt.trim();
  const negativePrompt = request.negativePrompt?.trim();
  return negativePrompt ? `${prompt} ### ${negativePrompt}` : prompt;
}

async function readHordeJson<T>(resp: Response, fallback: string): Promise<T> {
  const text = await resp.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${fallback}: ${sanitizeErrorText(text)}`);
  }
}

async function generateHorde(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  const body: Record<string, unknown> = {
    prompt: hordePrompt(request),
    params: {
      n: 1,
      width: request.width ?? 512,
      height: request.height ?? 512,
      steps: 30,
      cfg_scale: 7,
      sampler_name: "k_euler",
    },
  };
  if (request.model) body.models = [request.model];

  const startResp = await imageFetch(
    hordeUrl(baseUrl, "generate/async"),
    {
      method: "POST",
      headers: hordeHeaders(apiKey),
      body: JSON.stringify(body),
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  if (!startResp.ok) {
    const errText = await startResp.text().catch(() => "Unknown error");
    throw new Error(`Horde image generation failed (${startResp.status}): ${sanitizeErrorText(errText)}`);
  }

  const start = await readHordeJson<{ id?: string }>(startResp, "Could not parse Horde generation response");
  const jobId = start.id?.trim();
  if (!jobId) throw new Error("Horde image generation did not return a job id");

  const maxAttempts = Math.max(1, Math.ceil(IMAGE_GEN_TIMEOUT / 2000));
  let completed = false;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const checkResp = await imageFetch(
      hordeUrl(baseUrl, `generate/check/${encodeURIComponent(jobId)}`),
      {
        headers: hordeHeaders(apiKey),
        signal: imageRequestSignal(request),
      },
      { allowLocal: request.allowLocalUrls },
    );

    if (!checkResp.ok) {
      const errText = await checkResp.text().catch(() => "Unknown error");
      throw new Error(`Horde image generation check failed (${checkResp.status}): ${sanitizeErrorText(errText)}`);
    }

    const check = await readHordeJson<{ done?: boolean; is_possible?: boolean; faulted?: boolean }>(
      checkResp,
      "Could not parse Horde generation check response",
    );
    if (check.is_possible === false || check.faulted) {
      throw new Error("Horde image generation could not be completed by available workers");
    }
    if (check.done) {
      completed = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (!completed) {
    throw new Error("Horde image generation timed out before the worker finished");
  }

  const statusResp = await imageFetch(
    hordeUrl(baseUrl, `generate/status/${encodeURIComponent(jobId)}`),
    {
      headers: hordeHeaders(apiKey),
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  if (!statusResp.ok) {
    const errText = await statusResp.text().catch(() => "Unknown error");
    throw new Error(`Horde image generation status failed (${statusResp.status}): ${sanitizeErrorText(errText)}`);
  }

  const status = await readHordeJson<{ generations?: Array<{ img?: string; censored?: boolean }> }>(
    statusResp,
    "Could not parse Horde generation status response",
  );
  const generation = status.generations?.find((item) => item.img);
  if (!generation?.img) throw new Error("No image data in Horde response");
  if (generation.censored) throw new Error("Horde image generation was censored by the worker");

  const image = generation.img.trim();
  if (image.startsWith("data:")) return decodeImageDataUrl(image);
  if (/^https?:\/\//i.test(image)) {
    return downloadImageUrl(image, request.privateImageResultOrigin, request.signal);
  }

  const mimeType = detectImageMimeType(image) ?? "image/png";
  return { base64: image, mimeType, ext: imageExtensionFromMimeType(mimeType) };
}

function buildStabilityUrl(baseUrl: string, targetPath: string): string {
  try {
    const url = new URL(baseUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const versionIndex = parts.findIndex((part) => part === "v1" || part === "v2beta");
    const prefix = versionIndex >= 0 ? parts.slice(0, versionIndex) : parts;
    url.pathname = `/${[...prefix, ...targetPath.split("/").filter(Boolean)].join("/")}`;
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return `${baseUrl.replace(/\/+$/, "")}/${targetPath.replace(/^\/+/, "")}`;
  }
}

function isStabilityV1Base(baseUrl: string): boolean {
  try {
    const parts = new URL(baseUrl).pathname.split("/").filter(Boolean);
    return parts.includes("v1") && !parts.includes("v2beta");
  } catch {
    return /\/v1(?:\/|$)/i.test(baseUrl) && !/\/v2beta(?:\/|$)/i.test(baseUrl);
  }
}

function normalizeStabilitySd3Model(model?: string): string {
  const raw = model?.trim() || "sd3.5-large";
  const lower = raw.toLowerCase();
  if (lower === "sd3-large") return "sd3.5-large";
  if (lower === "sd3-large-turbo") return "sd3.5-large-turbo";
  if (lower === "sd3-medium") return "sd3.5-medium";
  return raw;
}

function resolveStabilityV2Endpoint(baseUrl: string, request: ImageGenRequest): { url: string; model: string | null } {
  const hasReference = Boolean(request.referenceImage || request.referenceImages?.length);
  const model = request.model?.trim().toLowerCase() ?? "";

  if (!hasReference && (model === "stable-image-ultra" || model === "ultra")) {
    return { url: buildStabilityUrl(baseUrl, "v2beta/stable-image/generate/ultra"), model: null };
  }

  if (!hasReference && (model === "stable-image-core" || model === "core")) {
    return { url: buildStabilityUrl(baseUrl, "v2beta/stable-image/generate/core"), model: null };
  }

  return {
    url: buildStabilityUrl(baseUrl, "v2beta/stable-image/generate/sd3"),
    model: normalizeStabilitySd3Model(request.model),
  };
}

function stabilityAspectRatio(width?: number, height?: number): string | null {
  if (!width || !height) return null;
  const ratio = width / height;
  const candidates = [
    ["21:9", 21 / 9],
    ["16:9", 16 / 9],
    ["3:2", 3 / 2],
    ["5:4", 5 / 4],
    ["1:1", 1],
    ["4:5", 4 / 5],
    ["2:3", 2 / 3],
    ["9:16", 9 / 16],
    ["9:21", 9 / 21],
  ] as const;
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate[1] - ratio) < Math.abs(best[1] - ratio) ? candidate : best,
  )[0];
}

function normalizeStabilityV1Engine(model?: string): string {
  const raw = model?.trim() ?? "";
  const lower = raw.toLowerCase();
  if (!raw || lower.startsWith("sd3") || lower.startsWith("stable-image") || lower.includes("/")) {
    return "stable-diffusion-xl-1024-v1-0";
  }
  return raw;
}

async function generateStability(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  if (isStabilityV1Base(baseUrl)) {
    return generateStabilityV1(baseUrl, apiKey, request);
  }

  const endpoint = resolveStabilityV2Endpoint(baseUrl, request);
  const formData = new FormData();
  formData.append("prompt", request.prompt);
  if (request.negativePrompt) formData.append("negative_prompt", request.negativePrompt);
  if (endpoint.model) formData.append("model", endpoint.model);
  const hasReference = Boolean(request.referenceImage || request.referenceImages?.length);
  const aspectRatio = stabilityAspectRatio(request.width, request.height);
  if (aspectRatio && !hasReference) formData.append("aspect_ratio", aspectRatio);
  if (request.referenceImage) {
    formData.append(
      "image",
      new Blob([Buffer.from(request.referenceImage, "base64")], { type: "image/png" }),
      "reference.png",
    );
    formData.append("strength", "0.5");
    formData.append("mode", "image-to-image");
  } else if (request.referenceImages?.length) {
    formData.append(
      "image",
      new Blob([Buffer.from(request.referenceImages[0]!, "base64")], { type: "image/png" }),
      "reference.png",
    );
    formData.append("strength", "0.5");
    formData.append("mode", "image-to-image");
  }
  formData.append("output_format", "png");

  const resp = await imageFetch(
    endpoint.url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "image/*",
      },
      body: formData,
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`Stability image generation failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return { base64, mimeType: "image/png", ext: "png" };
}

async function generateStabilityV1(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  const engine = normalizeStabilityV1Engine(request.model);
  const url = buildStabilityUrl(baseUrl, `v1/generation/${engine}/text-to-image`);
  const textPrompts: Array<{ text: string; weight: number }> = [{ text: request.prompt, weight: 1 }];
  if (request.negativePrompt) textPrompts.push({ text: request.negativePrompt, weight: -1 });

  const body = {
    text_prompts: textPrompts,
    cfg_scale: 7,
    height: request.height ?? 1024,
    width: request.width ?? 1024,
    samples: 1,
    steps: 30,
  };

  const resp = await imageFetch(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`Stability image generation failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const data = (await resp.json()) as { artifacts?: Array<{ base64?: string }> };
  const base64 = data.artifacts?.find((artifact) => artifact.base64)?.base64;
  if (!base64) throw new Error("No image data in Stability response");

  return { base64, mimeType: "image/png", ext: "png" };
}

async function generateTogetherAI(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  const url = openAIImagesUrl(baseUrl, "generations");
  const body: Record<string, unknown> = {
    prompt: request.prompt,
    model: request.model || "black-forest-labs/FLUX.1-schnell-Free",
    n: 1,
    width: request.width ?? 1024,
    height: request.height ?? 1024,
    response_format: "b64_json",
  };
  if (request.negativePrompt) body.negative_prompt = request.negativePrompt;

  const resp = await imageFetch(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`Together AI image generation failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const data = (await resp.json()) as { data: Array<{ b64_json: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data in Together AI response");

  return { base64: b64, mimeType: "image/png", ext: "png" };
}

export function buildArliImageUrl(baseUrl: string, endpoint: "txt2img" | "img2img"): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname.replace(/\/+$/, "");
    if (/\/(?:txt2img|img2img)$/i.test(path)) {
      parsed.pathname = path.replace(/\/(?:txt2img|img2img)$/i, `/${endpoint}`);
    } else if (path === "" || path === "/") {
      parsed.pathname = `/v1/${endpoint}`;
    } else {
      parsed.pathname = `${path}/${endpoint}`;
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return `${trimmed}/${endpoint}`;
  }
}

export function buildArliImageRequest(request: ImageGenRequest): Record<string, unknown> {
  const model = request.model?.trim();
  if (!model) throw new Error("Arli.ai image generation requires a model");

  const defaults = resolveAutomatic1111Defaults(request);
  const body: Record<string, unknown> = {
    sd_model_checkpoint: model,
    prompt: mergePromptPrefix(defaults.promptPrefix, request.prompt),
    negative_prompt: mergeNegativePrompt(defaults.negativePromptPrefix, request.negativePrompt),
    width: request.width ?? 512,
    height: request.height ?? 768,
    steps: defaults.steps,
    sampler_name: defaults.sampler || DEFAULT_AUTOMATIC1111_DEFAULTS.sampler,
    cfg_scale: defaults.cfgScale,
    seed: resolveSeed(request.imageDefaults),
    batch_size: 1,
    stream: false,
  };
  if (defaults.clipSkip) body.clip_skip = defaults.clipSkip;

  const reference = request.referenceImage ?? request.referenceImages?.[0];
  if (reference) {
    body.init_images = [decodeReferenceImage(reference).base64];
    body.denoising_strength = defaults.denoisingStrength;
  }
  return body;
}

async function generateArli(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  if (!apiKey.trim()) throw new Error("Arli.ai image generation requires an API key");
  const body = buildArliImageRequest(request);
  const useImg2Img = Array.isArray(body.init_images);
  logDebugOverride(
    request.debugMode === true,
    "[debug/image/arli] final request payload:\n%s",
    JSON.stringify({ ...body, ...(useImg2Img ? { init_images: "[1 reference image]" } : {}) }, null, 2),
  );
  const resp = await imageFetch(
    buildArliImageUrl(baseUrl, useImg2Img ? "img2img" : "txt2img"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`Arli.ai image generation failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const data = (await resp.json()) as { images?: string[] };
  const image = data.images?.[0];
  if (!image) throw new Error("No image data in Arli.ai response");
  if (image.trim().startsWith("data:")) return decodeImageDataUrl(image);
  const base64 = normalizeBase64ImagePayload(image, "Arli.ai image response");
  const mimeType = detectImageMimeType(base64) ?? "image/png";
  return { base64, mimeType, ext: imageExtensionFromMimeType(mimeType) };
}

const NOVELAI_V4_PROMPT_HINT =
  "NovelAI V4/V4.5 prompts support roughly 512 T5 tokens and reject most Unicode prompt characters; try a shorter ASCII prompt without emoji or non-Latin text.";
const NOVELAI_V5_PROMPT_HINT =
  "NovelAI V5 prompts support up to 1471 tokens (Full) or 703 tokens (Curated) and accept Unicode text including Japanese and Chinese; try a shorter prompt.";
const NOVELAI_SIZE_MULTIPLE = 64;
const NOVELAI_MIN_DIMENSION = 64;
const NOVELAI_MAX_DIMENSION = 2048;
const NOVELAI_MAX_PIXELS = 1024 * 1024;
const NOVELAI_MAX_CHARACTER_PROMPTS = 6;
const NOVELAI_REFERENCE_MAX_INPUT_PIXELS = 32_000_000;
const NOVELAI_DIRECTOR_REFERENCE_SIZES = [
  { width: 1024, height: 1536 },
  { width: 1536, height: 1024 },
  { width: 1472, height: 1472 },
] as const;
const NOVELAI_REFERENCE_CACHE_HMAC_KEY = randomBytes(32);

function clampNovelAiDimension(value: number): number {
  const rounded = Math.round(value / NOVELAI_SIZE_MULTIPLE) * NOVELAI_SIZE_MULTIPLE;
  return Math.max(NOVELAI_MIN_DIMENSION, Math.min(NOVELAI_MAX_DIMENSION, rounded));
}

export function detectNovelAiSubjectCount(prompt: string): number | null {
  const [baseFragment = ""] = prompt.split("|", 1);
  const subjectTokens = baseFragment.matchAll(/\b(\d+)\s*(?:girls?|boys?|others?)\b/gi);
  let tokenCount = 0;
  for (const match of subjectTokens) tokenCount += Number.parseInt(match[1] ?? "0", 10);
  if (tokenCount > 0) return tokenCount;

  const pipeSegments = prompt
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);
  return pipeSegments.length > 1 ? pipeSegments.length - 1 : null;
}

export function resolveNovelAiSize(
  request: ImageGenRequest,
  prompt = request.prompt,
  defaults: NovelAiDefaults = resolveNovelAiDefaults(request),
): { width: number; height: number } {
  if (defaults.dynamicResolutionBySubjectCount) {
    const subjectCount = detectNovelAiSubjectCount(prompt);
    if (subjectCount === 1) return { width: 832, height: 1216 };
    if (subjectCount === 2) return { width: 1024, height: 1024 };
    if (subjectCount !== null && subjectCount >= 3) return { width: 1216, height: 832 };
  }

  let width = clampNovelAiDimension(request.width ?? 832);
  let height = clampNovelAiDimension(request.height ?? 1216);
  const pixels = width * height;
  if (pixels <= NOVELAI_MAX_PIXELS) return { width, height };

  const scale = Math.sqrt(NOVELAI_MAX_PIXELS / pixels);
  width = Math.max(NOVELAI_MIN_DIMENSION, Math.floor((width * scale) / NOVELAI_SIZE_MULTIPLE) * NOVELAI_SIZE_MULTIPLE);
  height = Math.max(
    NOVELAI_MIN_DIMENSION,
    Math.floor((height * scale) / NOVELAI_SIZE_MULTIPLE) * NOVELAI_SIZE_MULTIPLE,
  );
  return { width, height };
}

/** Resolve the native NovelAI request size from scene content only, excluding the connection Prompt Prefix. */
export function resolveNovelAiRequestSize(
  request: ImageGenRequest,
  defaults: NovelAiDefaults = resolveNovelAiDefaults(request),
): { width: number; height: number } {
  const model = request.model || "nai-diffusion-4-5-full";
  const scenePrompt = isNovelAiV4Model(model)
    ? sanitizeNovelAiV4Prompt(request.prompt, isNovelAiV5Model(model))
    : request.prompt;
  return resolveNovelAiSize(request, scenePrompt, defaults);
}

export function resolveNovelAiStyleReferenceSecondaryStrength(fidelity: number): number {
  return 1 - Math.max(0, Math.min(1, fidelity));
}

function isNovelAiV4Model(model: string): boolean {
  return /^nai-diffusion-(?:4(?:-(?:curated-preview|full))?|4-5(?:-(?:curated|full))?|5(?:-(?:curated|full))?)$/i.test(
    model.trim(),
  );
}

function isNovelAiV5Model(model: string): boolean {
  return /^nai-diffusion-5(?:-(?:curated|full))?$/i.test(model.trim());
}

function isNovelAiPreciseReferenceModel(model: string): boolean {
  return /^nai-diffusion-(?:4-5)(?:-(?:curated|full))?$/i.test(model.trim());
}

function collectNovelAiReferenceImages(request: ImageGenRequest): string[] {
  return [request.referenceImage, ...(request.referenceImages ?? [])]
    .filter((reference): reference is string => typeof reference === "string" && reference.trim().length > 0)
    .filter((reference, index, all) => all.indexOf(reference) === index)
    .slice(0, 16)
    .map((reference, index) => {
      try {
        return decodeReferenceImage(reference).base64;
      } catch (err) {
        const detail = err instanceof Error ? ` ${err.message}` : "";
        throw new Error(
          `NovelAI reference image ${index + 1} could not be read as valid image data. Upload a PNG, JPEG, WebP, or valid image data URL.${detail}`,
        );
      }
    });
}

function selectNovelAiDirectorReferenceSize(width: number, height: number): { width: number; height: number } {
  const ratio = width / height;
  return NOVELAI_DIRECTOR_REFERENCE_SIZES.reduce((best, candidate) => {
    const bestDistance = Math.abs(best.width / best.height - ratio);
    const candidateDistance = Math.abs(candidate.width / candidate.height - ratio);
    return candidateDistance < bestDistance ? candidate : best;
  }, NOVELAI_DIRECTOR_REFERENCE_SIZES[0]);
}

async function prepareNovelAiDirectorReferenceImages(referenceImages: string[]): Promise<string[]> {
  if (referenceImages.length === 0) return [];

  const sharpFn = await tryLoadSharp();
  if (!sharpFn) {
    throw new Error(
      "NovelAI precise reference images require server image preprocessing, but the optional sharp dependency is unavailable.",
    );
  }

  return Promise.all(
    referenceImages.map(async (reference, index) => {
      try {
        const buffer = Buffer.from(reference, "base64");
        const metadata = await sharpFn(buffer, { limitInputPixels: NOVELAI_REFERENCE_MAX_INPUT_PIXELS }).metadata();
        if (!metadata.width || !metadata.height) {
          throw new Error("image dimensions could not be read");
        }
        const size = selectNovelAiDirectorReferenceSize(metadata.width, metadata.height);
        const resized = await sharpFn(buffer, { limitInputPixels: NOVELAI_REFERENCE_MAX_INPUT_PIXELS })
          .resize(size.width, size.height, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 1 },
          })
          .png()
          .toBuffer();
        return resized.toString("base64");
      } catch (err) {
        const detail = err instanceof Error ? ` ${err.message}` : "";
        throw new Error(`NovelAI reference image ${index + 1} could not be prepared for precise reference.${detail}`);
      }
    }),
  );
}

function novelAiReferenceCacheKey(referenceBase64: string): string {
  return createHmac("sha256", NOVELAI_REFERENCE_CACHE_HMAC_KEY).update(referenceBase64).digest("hex");
}

function buildNovelAiReferenceFormData(body: Record<string, unknown>, directorReferenceImages: string[]): FormData {
  const multipartBody = structuredClone(body) as Record<string, unknown>;
  const parameters =
    multipartBody.parameters && typeof multipartBody.parameters === "object" && !Array.isArray(multipartBody.parameters)
      ? (multipartBody.parameters as Record<string, unknown>)
      : {};

  parameters.director_reference_images_cached = directorReferenceImages.map((reference, index) => {
    const partName = `director_ref_${index}`;
    return {
      cache_secret_key: novelAiReferenceCacheKey(reference),
      data: partName,
    };
  });
  delete parameters.director_reference_images;

  const formData = new FormData();
  for (let index = 0; index < directorReferenceImages.length; index++) {
    formData.append(
      `director_ref_${index}`,
      new Blob([Buffer.from(directorReferenceImages[index]!, "base64")], { type: "image/png" }),
    );
  }
  formData.append("request", new Blob([JSON.stringify(multipartBody)], { type: "application/json" }));
  return formData;
}

function cloneNovelAiRequestForMetadata(body: Record<string, unknown>): Record<string, unknown> {
  const metadataBody = structuredClone(body) as Record<string, unknown>;
  const parameters =
    metadataBody.parameters && typeof metadataBody.parameters === "object" && !Array.isArray(metadataBody.parameters)
      ? (metadataBody.parameters as Record<string, unknown>)
      : null;
  if (parameters) {
    if (Array.isArray(parameters.director_reference_images)) {
      parameters.director_reference_images = parameters.director_reference_images.map(() => "[omitted]");
    }
    if (Array.isArray(parameters.reference_image_multiple)) {
      parameters.reference_image_multiple = parameters.reference_image_multiple.map(() => "[omitted]");
    }
  }
  return metadataBody;
}

function sanitizeNovelAiV4Prompt(value: string, allowUnicode = false): string {
  return value
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .normalize(allowUnicode ? "NFC" : "NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, allowUnicode ? "$&" : " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function prepareNovelAiPrompt(value: string, fieldName: string, model: string): string {
  if (!isNovelAiV4Model(model)) return value;

  const sanitized = sanitizeNovelAiV4Prompt(value, isNovelAiV5Model(model));
  if (value.trim() && !sanitized) {
    throw new Error(
      `NovelAI ${fieldName} contains only unsupported ${isNovelAiV5Model(model) ? "V5" : "V4/V4.5"} prompt characters. ${isNovelAiV5Model(model) ? NOVELAI_V5_PROMPT_HINT : NOVELAI_V4_PROMPT_HINT}`,
    );
  }
  return sanitized;
}

type PreparedNovelAiCharacterPrompt = {
  prompt: string;
  negativePrompt: string;
  center: { x: number; y: number };
};

function clampNovelAiCharacterCoordinate(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(1, Math.max(0, numeric));
}

function defaultNovelAiCharacterCenter(index: number, total: number): { x: number; y: number } {
  if (total <= 1) return { x: 0.5, y: 0.5 };
  if (total <= 3) return { x: (index + 1) / (total + 1), y: 0.5 };

  const columns = 3;
  const rows = Math.ceil(total / columns);
  const row = Math.floor(index / columns);
  const rowStart = row * columns;
  const rowCount = Math.min(columns, total - rowStart);
  const column = index - rowStart;
  return {
    x: (column + 1) / (rowCount + 1),
    y: (row + 1) / (rows + 1),
  };
}

function prepareNovelAiCharacterPrompts(
  prompts: SceneIllustrationCharacterPrompt[] | undefined,
  model: string,
): PreparedNovelAiCharacterPrompt[] {
  const candidates = (prompts ?? [])
    .filter((entry) => entry && typeof entry.prompt === "string" && entry.prompt.trim().length > 0)
    .slice(0, NOVELAI_MAX_CHARACTER_PROMPTS);

  return candidates
    .map((entry, index) => {
      const fallbackCenter = defaultNovelAiCharacterCenter(index, candidates.length);
      const prompt = prepareNovelAiPrompt(entry.prompt, `character prompt ${index + 1}`, model);
      if (!prompt) return null;
      return {
        prompt,
        negativePrompt: prepareNovelAiPrompt(
          typeof entry.negativePrompt === "string" ? entry.negativePrompt : "",
          `character negative prompt ${index + 1}`,
          model,
        ),
        center: {
          x: clampNovelAiCharacterCoordinate(entry.position?.x, fallbackCenter.x),
          y: clampNovelAiCharacterCoordinate(entry.position?.y, fallbackCenter.y),
        },
      };
    })
    .filter((entry): entry is PreparedNovelAiCharacterPrompt => Boolean(entry));
}

export function buildNovelAiV4CharacterPromptPayload(
  prompts: SceneIllustrationCharacterPrompt[] | undefined,
  model: string,
): {
  captions: Array<{ char_caption: string; centers: Array<{ x: number; y: number }> }>;
  negativeCaptions: Array<{ char_caption: string; centers: Array<{ x: number; y: number }> }>;
  useCoords: boolean;
} {
  if (!isNovelAiV4Model(model)) return { captions: [], negativeCaptions: [], useCoords: false };
  const prepared = prepareNovelAiCharacterPrompts(prompts, model);
  return {
    captions: prepared.map((entry) => ({ char_caption: entry.prompt, centers: [entry.center] })),
    negativeCaptions: prepared.map((entry) => ({
      char_caption: entry.negativePrompt,
      centers: [entry.center],
    })),
    useCoords: prepared.length > 1,
  };
}

async function generateNovelAI(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  // Only use the native NovelAI API format when hitting the actual NovelAI domain.
  // Proxies (linkapi.ai, etc.) expose OpenAI-compatible chat completions that return
  // image URLs in markdown format (![image](url)).
  const isNativeNovelAI = baseUrl.toLowerCase().includes("novelai.net");
  if (!isNativeNovelAI) {
    return generateViaChatCompletions(baseUrl, apiKey, request);
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/ai/generate-image`;
  const model = request.model || "nai-diffusion-4-5-full";
  const isV4 = isNovelAiV4Model(model);
  const defaults = resolveNovelAiDefaults(request);
  const mergedPrompt = mergePromptPrefix(defaults.promptPrefix, request.prompt);
  const prompt = prepareNovelAiPrompt(mergedPrompt, "prompt", model);
  const negativePrompt = prepareNovelAiPrompt(
    mergeNegativePrompt(defaults.negativePromptPrefix, request.negativePrompt),
    "negative prompt",
    model,
  );
  const seed = resolveSeed(request.imageDefaults);
  const styleReferenceImage =
    isNovelAiPreciseReferenceModel(model) && defaults.styleReferenceImage
      ? collectNovelAiReferenceImages({
          ...request,
          referenceImage: defaults.styleReferenceImage,
          referenceImages: [],
        })[0]
      : undefined;
  const characterReferenceImages = collectNovelAiReferenceImages(request)
    .filter((reference) => reference !== styleReferenceImage)
    .slice(0, styleReferenceImage ? 15 : 16);
  const referenceImages = styleReferenceImage
    ? [styleReferenceImage, ...characterReferenceImages]
    : characterReferenceImages;
  if (referenceImages.length > 0 && !isNovelAiPreciseReferenceModel(model)) {
    throw new Error("NovelAI precise reference images require a V4.5 model such as nai-diffusion-4-5-full.");
  }
  const directorReferenceImages = await prepareNovelAiDirectorReferenceImages(referenceImages);
  const characterPromptPayload = buildNovelAiV4CharacterPromptPayload(request.characterPrompts, model);
  const size = resolveNovelAiRequestSize(request, defaults);

  const parameters: Record<string, unknown> = {
    width: size.width,
    height: size.height,
    n_samples: 1,
    ucPreset: defaults.undesiredContentPreset,
    negative_prompt: negativePrompt,
    seed,
    scale: defaults.promptGuidance,
    steps: defaults.steps,
    sampler: defaults.sampler,
  };
  if (defaults.noiseSchedule) {
    parameters.noise_schedule = defaults.noiseSchedule;
  }
  if (isV4) {
    parameters.cfg_rescale = defaults.promptGuidanceRescale;
  }

  if (isV4) {
    parameters.params_version = 3;
    parameters.v4_prompt = {
      caption: { base_caption: prompt, char_captions: characterPromptPayload.captions },
      use_coords: characterPromptPayload.useCoords,
      use_order: true,
    };
    parameters.v4_negative_prompt = {
      caption: { base_caption: negativePrompt, char_captions: characterPromptPayload.negativeCaptions },
      use_coords: characterPromptPayload.useCoords,
      use_order: true,
    };
  }
  if (isV4) {
    parameters.reference_image_multiple = [];
    parameters.reference_information_extracted_multiple = [];
    parameters.reference_strength_multiple = [];
  }
  if (directorReferenceImages.length > 0) {
    const styleReferenceOffset = styleReferenceImage ? 1 : 0;
    parameters.director_reference_images = directorReferenceImages;
    parameters.director_reference_descriptions = directorReferenceImages.map((_, index) => ({
      caption: { base_caption: index < styleReferenceOffset ? "style" : "character&style", char_captions: [] },
      legacy_uc: false,
    }));
    parameters.director_reference_information_extracted = directorReferenceImages.map(() => 1);
    parameters.director_reference_strength_values = directorReferenceImages.map((_, index) =>
      index < styleReferenceOffset ? defaults.styleReferenceStrength : 1,
    );
    parameters.director_reference_secondary_strength_values = directorReferenceImages.map((_, index) =>
      index < styleReferenceOffset ? resolveNovelAiStyleReferenceSecondaryStrength(defaults.styleReferenceFidelity) : 0,
    );
  }

  const body: Record<string, unknown> = {
    input: prompt,
    model,
    action: "generate",
    parameters,
    use_new_shared_trial: true,
  };
  const metadataBody = cloneNovelAiRequestForMetadata(body);

  const hasReferences = directorReferenceImages.length > 0;
  const resp = await imageFetch(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(hasReferences ? {} : { "Content-Type": "application/json" }),
      },
      body: hasReferences ? buildNovelAiReferenceFormData(body, directorReferenceImages) : JSON.stringify(body),
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    const hint = isV4 ? ` ${isNovelAiV5Model(model) ? NOVELAI_V5_PROMPT_HINT : NOVELAI_V4_PROMPT_HINT}` : "";
    const referenceDetail = hasReferences ? ` with ${directorReferenceImages.length} precise reference image(s)` : "";
    throw new Error(
      `NovelAI image generation failed (${resp.status})${referenceDetail}: ${sanitizeErrorText(errText)}${hint}`,
    );
  }

  // NovelAI returns a zip file containing the image
  const arrayBuffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Check if response is a zip (PK signature) — extract using the central directory
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const extracted = extractFirstFileFromZip(bytes);
    if (extracted) {
      const imageBytes = appendNovelAiGenerationMetadata(Buffer.from(extracted), metadataBody);
      const base64 = imageBytes.toString("base64");
      return { base64, mimeType: "image/png", ext: "png" };
    }
  }

  // Check if it's a PNG directly
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const imageBytes = appendNovelAiGenerationMetadata(Buffer.from(bytes), metadataBody);
    const base64 = imageBytes.toString("base64");
    return { base64, mimeType: "image/png", ext: "png" };
  }

  // Try parsing as JSON (some proxies return JSON with base64)
  try {
    const text = new TextDecoder().decode(bytes);
    const json = JSON.parse(text);
    const b64 = json.data?.[0]?.b64_json ?? json.output?.[0] ?? json.image;
    if (b64) return { base64: b64, mimeType: "image/png", ext: "png" };
  } catch {
    /* not JSON */
  }

  throw new Error("Could not parse NovelAI image response");
}

function appendNovelAiGenerationMetadata(image: Buffer, body: Record<string, unknown>): Buffer {
  try {
    const metadata = JSON.stringify({
      source: "marinara-engine",
      provider: "novelai",
      request: body,
    });
    return injectPngTextChunk(image, "marinara_novelai_request", metadata);
  } catch {
    return image;
  }
}

function injectPngTextChunk(png: Buffer, keyword: string, text: string): Buffer {
  if (png.subarray(0, 8).compare(PNG_SIGNATURE) !== 0) {
    throw new Error("Invalid PNG signature");
  }

  const textChunk = buildPngChunk("iTXt", buildPngInternationalTextData(keyword, text));
  const parts: Buffer[] = [PNG_SIGNATURE];
  let offset = 8;
  let inserted = false;

  while (offset < png.length) {
    const chunkLen = png.readUInt32BE(offset);
    const chunkType = png.subarray(offset + 4, offset + 8).toString("ascii");
    const totalChunkSize = 4 + 4 + chunkLen + 4;
    const chunkBuf = png.subarray(offset, offset + totalChunkSize);

    if (chunkType === "IDAT" && !inserted) {
      parts.push(textChunk);
      inserted = true;
    }
    parts.push(chunkBuf);
    offset += totalChunkSize;
  }

  if (!inserted) {
    parts.splice(parts.length - 1, 0, textChunk);
  }

  return Buffer.concat(parts);
}

function buildPngInternationalTextData(keyword: string, text: string): Buffer {
  return Buffer.concat([Buffer.from(keyword, "latin1"), Buffer.from([0, 0, 0, 0, 0]), Buffer.from(text, "utf8")]);
}

function buildPngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])) >>> 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Extract the first file from a zip archive.
 * Uses the central directory (at the end of the zip) to get reliable offset/size,
 * since local file headers may have zeroed-out sizes when a data descriptor is used.
 */
export const MAX_NOVELAI_ZIP_OUTPUT_BYTES = 64 * 1024 * 1024;

function readZipUint32Le(zip: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > zip.length) return null;
  return new DataView(zip.buffer, zip.byteOffset, zip.byteLength).getUint32(offset, true);
}

export function extractFirstFileFromZip(
  zip: Uint8Array,
  maxOutputBytes = MAX_NOVELAI_ZIP_OUTPUT_BYTES,
): Uint8Array | null {
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1) return null;
  // Find End of Central Directory record (search backwards for signature 0x06054b50)
  let eocdOffset = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip[i] === 0x50 && zip[i + 1] === 0x4b && zip[i + 2] === 0x05 && zip[i + 3] === 0x06) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return null;
  if (eocdOffset + 19 >= zip.length) return null;

  // Read first central directory entry offset
  const cdOffset = readZipUint32Le(zip, eocdOffset + 16);
  if (cdOffset === null) return null;

  // Parse central directory entry for the first file
  const cd = cdOffset;
  if (cd + 46 > zip.length) return null;
  if (zip[cd] !== 0x50 || zip[cd + 1] !== 0x4b || zip[cd + 2] !== 0x01 || zip[cd + 3] !== 0x02) return null;

  const method = zip[cd + 10]! | (zip[cd + 11]! << 8);
  const compSize = readZipUint32Le(zip, cd + 20);
  const uncompSize = readZipUint32Le(zip, cd + 24);
  const localHeaderOffset = readZipUint32Le(zip, cd + 42);
  if (compSize === null || uncompSize === null || localHeaderOffset === null) return null;
  if (uncompSize > maxOutputBytes) return null;

  // Skip past local file header to reach data
  const lh = localHeaderOffset;
  if (lh + 30 > zip.length) return null;
  if (zip[lh] !== 0x50 || zip[lh + 1] !== 0x4b || zip[lh + 2] !== 0x03 || zip[lh + 3] !== 0x04) return null;
  const lhFnLen = zip[lh + 26]! | (zip[lh + 27]! << 8);
  const lhExtraLen = zip[lh + 28]! | (zip[lh + 29]! << 8);
  const dataStart = lh + 30 + lhFnLen + lhExtraLen;

  const dataSize = method === 0 ? uncompSize : compSize;
  if (dataStart + dataSize > zip.length) return null;
  if (method === 0) {
    // Stored (no compression)
    if (compSize !== uncompSize) return null;
    return zip.slice(dataStart, dataStart + uncompSize);
  }

  if (method === 8) {
    // Deflate
    const compressed = zip.slice(dataStart, dataStart + compSize);
    try {
      const inflated = inflateRawSync(Buffer.from(compressed), {
        maxOutputLength: Math.max(1, Math.min(maxOutputBytes, uncompSize)),
      });
      if (inflated.length !== uncompSize || inflated.length > maxOutputBytes) return null;
      return inflated;
    } catch {
      // Malformed or unsupported deflate data
      return null;
    }
  }

  // Unsupported compression method
  return null;
}

function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  try {
    const url = new URL(trimmed);
    const path = url.pathname.replace(/\/+$/, "");
    if (!path.endsWith("/chat/completions")) {
      url.pathname =
        path.endsWith("/v1") || path.endsWith("/api/v1") ? `${path}/chat/completions` : `${path}/chat/completions`;
    }
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return `${trimmed}/chat/completions`;
  }
}

function buildChatImageMessageContent(request: ImageGenRequest): string | Array<Record<string, unknown>> {
  const refImages = request.referenceImages ?? (request.referenceImage ? [request.referenceImage] : []);
  const prompt = request.negativePrompt
    ? `${request.prompt}\n\nAvoid in the image: ${request.negativePrompt}`
    : request.prompt;
  if (refImages.length > 0) {
    const parts: Array<Record<string, unknown>> = refImages.map((b64) => ({
      type: "image_url",
      image_url: { url: imageDataUrlFromReference(b64) },
    }));
    parts.push({ type: "text", text: prompt });
    return parts;
  }
  return prompt;
}

function extractImageUrlFromMessage(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const record = message as Record<string, unknown>;
  const images = Array.isArray(record.images) ? record.images : [];
  for (const image of images) {
    if (!image || typeof image !== "object") continue;
    const imageRecord = image as Record<string, unknown>;
    const snake = imageRecord.image_url;
    if (snake && typeof snake === "object" && typeof (snake as Record<string, unknown>).url === "string") {
      return (snake as { url: string }).url;
    }
    const camel = imageRecord.imageUrl;
    if (camel && typeof camel === "object" && typeof (camel as Record<string, unknown>).url === "string") {
      return (camel as { url: string }).url;
    }
    if (typeof imageRecord.url === "string") return imageRecord.url;
  }

  const content = typeof record.content === "string" ? record.content : "";
  const mdMatch = content.match(/!\[[^\]]*\]\(([^)]+)\)/);
  const dataUrlMatch = content.match(/data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+/i);
  return mdMatch?.[1] ?? dataUrlMatch?.[0] ?? content.match(/https?:\/\/\S+\.(png|jpg|jpeg|webp|gif)/i)?.[0] ?? null;
}

function openRouterAspectRatio(width?: number, height?: number): string | null {
  if (!width || !height) return null;
  const ratio = width / Math.max(1, height);
  const candidates = [
    ["21:9", 21 / 9],
    ["16:9", 16 / 9],
    ["3:2", 3 / 2],
    ["5:4", 5 / 4],
    ["4:3", 4 / 3],
    ["1:1", 1],
    ["3:4", 3 / 4],
    ["4:5", 4 / 5],
    ["2:3", 2 / 3],
    ["9:16", 9 / 16],
  ] as const;
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate[1] - ratio) < Math.abs(best[1] - ratio) ? candidate : best,
  )[0];
}

/**
 * OpenRouter only routes to endpoints that emit every requested modality, and
 * most of its image models return image only. Default to image-only; opt in to
 * text for the few families that also return it.
 */
export function openRouterModalities(model?: string): string[] {
  const lower = model?.trim().toLowerCase() ?? "";
  const emitsText =
    /^google\/gemini-.*-image/.test(lower) ||
    /^openai\/gpt-5.*-image/.test(lower) ||
    lower.startsWith("openrouter/auto");
  return emitsText ? ["image", "text"] : ["image"];
}

export function usesOpenRouterImagesApi(model?: string): boolean {
  const lower = model?.trim().toLowerCase() ?? "";
  return lower.startsWith("krea/") || lower.startsWith("bytedance-seed/seedream-");
}

export function openRouterImagesUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  try {
    const url = new URL(trimmed);
    const path = url.pathname.replace(/\/+$/, "");
    if (/\/chat\/completions$/i.test(path)) {
      url.pathname = path.replace(/\/chat\/completions$/i, "/images");
    } else if (!/\/images$/i.test(path)) {
      url.pathname =
        path === "" || path === "/" ? "/api/v1/images" : path.endsWith("/api") ? `${path}/v1/images` : `${path}/images`;
    }
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return `${trimmed}/images`;
  }
}

export function buildOpenRouterImagesRequest(request: ImageGenRequest): Record<string, unknown> {
  const prompt = request.negativePrompt
    ? `${request.prompt}\n\nAvoid in the image: ${request.negativePrompt}`
    : request.prompt;
  const body: Record<string, unknown> = {
    model: request.model || "krea/krea-2-medium",
    prompt,
    resolution: "1K",
  };
  const aspectRatio = openRouterAspectRatio(request.width, request.height);
  if (aspectRatio) body.aspect_ratio = aspectRatio;

  const references = request.referenceImages ?? (request.referenceImage ? [request.referenceImage] : []);
  if (references.length > 0) {
    body.input_references = references.slice(0, 1).map((reference) => ({
      type: "image_url",
      image_url: { url: imageDataUrlFromReference(reference) },
    }));
  }
  return body;
}

async function generateOpenRouterImageApi(
  baseUrl: string,
  apiKey: string,
  request: ImageGenRequest,
): Promise<ImageGenResult> {
  const body = buildOpenRouterImagesRequest(request);
  logDebugOverride(
    request.debugMode === true,
    "[debug/image/openrouter-images] final request payload:\n%s",
    JSON.stringify(
      {
        ...body,
        ...(Array.isArray(body.input_references)
          ? { input_references: `[${body.input_references.length} reference image(s)]` }
          : {}),
      },
      null,
      2,
    ),
  );
  const resp = await imageFetch(
    openRouterImagesUrl(baseUrl),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`OpenRouter Images API failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const data = (await resp.json()) as {
    data?: Array<{ b64_json?: string; image_base64?: string; url?: string; media_type?: string }>;
  };
  const result = data.data?.[0];
  const base64 = result?.b64_json ?? result?.image_base64;
  if (base64) {
    const mimeType = normalizeImageMimeType(result?.media_type) ?? detectImageMimeType(base64) ?? "image/png";
    return { base64, mimeType, ext: imageExtensionFromMimeType(mimeType) };
  }
  if (result?.url) return downloadImageUrl(result.url, request.privateImageResultOrigin, request.signal);
  throw new Error("No image data in OpenRouter Images API response");
}

async function generateOpenRouter(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  if (usesOpenRouterImagesApi(request.model)) {
    return generateOpenRouterImageApi(baseUrl, apiKey, request);
  }

  const body: Record<string, unknown> = {
    model: request.model || "google/gemini-2.5-flash-image",
    messages: [{ role: "user", content: buildChatImageMessageContent(request) }],
    modalities: openRouterModalities(request.model),
    stream: false,
  };
  const aspectRatio = openRouterAspectRatio(request.width, request.height);
  if (aspectRatio) body.image_config = { aspect_ratio: aspectRatio };

  const resp = await imageFetch(
    chatCompletionsUrl(baseUrl),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`OpenRouter image generation failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  // Some OpenRouter image models (e.g. raw provider passthrough) return the
  // image bytes directly instead of a chat-completions JSON envelope. Sniff
  // the content-type and the first bytes before deciding how to parse.
  const contentType = resp.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await resp.arrayBuffer());
  const isImageContentType = contentType.startsWith("image/");
  const isAvifLike =
    buffer.length >= 12 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70 &&
    ["avif", "avis"].some((brand) => buffer.subarray(8, 12).toString("ascii").toLowerCase().startsWith(brand));
  const looksLikeImageBytes =
    buffer.length >= 4 &&
    ((buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) || // PNG
      (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) || // JPEG
      (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) || // GIF
      (buffer[0] === 0x42 && buffer[1] === 0x4d) || // BMP
      isAvifLike ||
      (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46)); // RIFF/WEBP

  if (isImageContentType || looksLikeImageBytes) {
    const base64 = buffer.toString("base64");
    let mimeType = detectImageMimeType(base64);
    if (!mimeType) mimeType = normalizeImageMimeType(contentType);
    if (!mimeType) mimeType = "image/png";
    return { base64, mimeType, ext: imageExtensionFromMimeType(mimeType) };
  }

  let data: { choices?: Array<{ message?: unknown; finish_reason?: string }>; error?: unknown };
  try {
    data = JSON.parse(buffer.toString("utf8")) as typeof data;
  } catch {
    throw new Error(
      `OpenRouter returned unparseable response (content-type: ${contentType || "unknown"}, first 80 bytes hex: ${buffer.subarray(0, 80).toString("hex")})`,
    );
  }
  if (data.error) {
    throw new Error(`OpenRouter returned an error: ${JSON.stringify(data.error).slice(0, 400)}`);
  }
  const choice = data.choices?.[0];
  const message = choice?.message;
  const imageUrl = extractImageUrlFromMessage(message);
  if (!imageUrl) {
    logger.warn(
      "[image-gen] OpenRouter response had no extractable image. model=%s finish_reason=%s shape=%s",
      request.model ?? "(default)",
      choice?.finish_reason ?? "(none)",
      JSON.stringify(message ?? data).slice(0, 800),
    );
    const content =
      message && typeof message === "object" && typeof (message as Record<string, unknown>).content === "string"
        ? ((message as Record<string, string>).content ?? "")
        : "";
    const messageKeys =
      message && typeof message === "object"
        ? Object.keys(message as Record<string, unknown>).join(",")
        : "(no message)";
    throw new Error(
      `No image data in OpenRouter response (finish_reason=${choice?.finish_reason ?? "none"}, message keys=[${messageKeys}], content="${content.slice(0, 200)}")`,
    );
  }

  return downloadImageUrl(imageUrl, request.privateImageResultOrigin, request.signal);
}

/**
 * Generate an image via an OpenAI-compatible chat completions endpoint.
 * Some proxies (LinkAPI, etc.) expose image models through /chat/completions
 * and return the result as a markdown image link: ![image](url)
 */
async function generateViaChatCompletions(
  baseUrl: string,
  apiKey: string,
  request: ImageGenRequest,
): Promise<ImageGenResult> {
  const url = chatCompletionsUrl(baseUrl);
  const messageContent = buildChatImageMessageContent(request);

  const resp = await imageFetch(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || "nai-diffusion-4-5-full",
        messages: [{ role: "user", content: messageContent }],
        stream: false,
        temperature: 0.7,
      }),
      signal: imageRequestSignal(request),
    },
    { allowLocal: request.allowLocalUrls },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`Image generation via chat completions failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: unknown }>;
  };
  const message = data.choices?.[0]?.message;
  const imageUrl = extractImageUrlFromMessage(message);

  if (!imageUrl) {
    const content =
      message && typeof message === "object" && typeof (message as Record<string, unknown>).content === "string"
        ? ((message as Record<string, string>).content ?? "")
        : "";
    throw new Error(`No image URL found in proxy response: ${content.slice(0, 200)}`);
  }

  return downloadImageUrl(imageUrl, request.privateImageResultOrigin, request.signal);
}

// ── ComfyUI ──

/** Default minimal txt2img workflow for ComfyUI. */
const DEFAULT_COMFYUI_WORKFLOW: Record<string, unknown> = {
  "3": {
    class_type: "KSampler",
    inputs: {
      seed: "%seed%",
      steps: 20,
      cfg: 7,
      sampler_name: "euler_ancestral",
      scheduler: "normal",
      denoise: 1,
      model: ["4", 0],
      positive: ["6", 0],
      negative: ["7", 0],
      latent_image: ["5", 0],
    },
  },
  "4": {
    class_type: "CheckpointLoaderSimple",
    inputs: { ckpt_name: "%model%" },
  },
  "5": {
    class_type: "EmptyLatentImage",
    inputs: { width: "%width%", height: "%height%", batch_size: 1 },
  },
  "6": {
    class_type: "CLIPTextEncode",
    inputs: { text: "%prompt%", clip: ["4", 1] },
  },
  "7": {
    class_type: "CLIPTextEncode",
    inputs: { text: "%negative_prompt%", clip: ["4", 1] },
  },
  "8": {
    class_type: "VAEDecode",
    inputs: { samples: ["3", 0], vae: ["4", 2] },
  },
  "9": {
    class_type: "SaveImage",
    inputs: { filename_prefix: "marinara", images: ["8", 0] },
  },
};

const COMFYUI_OUTPUT_FILE_KEYS = ["gifs", "images"] as const;

interface ComfyUiOutputFile {
  filename: string;
  subfolder?: string;
  type?: string;
}

interface ComfyUiNodeOutput {
  images?: ComfyUiOutputFile[];
  gifs?: ComfyUiOutputFile[];
}

interface ComfyUiHistoryEntry {
  outputs?: Record<string, ComfyUiNodeOutput>;
  status?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function collectComfyUiErrorFragments(value: unknown, fragments: string[] = []): string[] {
  if (typeof value === "string") {
    const clean = value.trim();
    if (clean) fragments.push(clean);
    return fragments;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    fragments.push(String(value));
    return fragments;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectComfyUiErrorFragments(entry, fragments);
    return fragments;
  }
  if (!isRecord(value)) return fragments;

  for (const key of ["exception_message", "message", "error", "details", "traceback"]) {
    collectComfyUiErrorFragments(value[key], fragments);
  }
  collectComfyUiErrorFragments(value.node_errors, fragments);
  return fragments;
}

function formatComfyUiError(value: unknown): string {
  const fragments = collectComfyUiErrorFragments(value);
  if (fragments.length > 0) return sanitizeErrorText(fragments.join("; "));
  try {
    const json = JSON.stringify(value);
    return typeof json === "string" ? sanitizeErrorText(json) : "";
  } catch {
    return "";
  }
}

function getComfyUiStatusError(status: unknown): string | null {
  if (!isRecord(status)) return null;
  const statusStr = typeof status.status_str === "string" ? status.status_str.toLowerCase() : "";
  if (statusStr !== "error") return null;
  return formatComfyUiError(status.messages ?? status);
}

function isComfyUiStatusComplete(status: unknown): boolean {
  if (!isRecord(status)) return false;
  const statusStr = typeof status.status_str === "string" ? status.status_str.toLowerCase() : "";
  return status.completed === true || statusStr === "success";
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

function resolveSeed(profile: ImageGenerationDefaultsProfile | null | undefined): number {
  return typeof profile?.seed === "number" && profile.seed >= 0 ? profile.seed : randomSeed();
}

export function resolveNovelAiDefaults(request: ImageGenRequest): NovelAiDefaults {
  if (request.imageDefaults?.service === "novelai" && request.imageDefaults.novelai) {
    return { ...DEFAULT_NOVELAI_DEFAULTS, ...request.imageDefaults.novelai };
  }
  return DEFAULT_NOVELAI_DEFAULTS;
}

function resolveAutomatic1111Defaults(request: ImageGenRequest): Automatic1111Defaults {
  if (request.imageDefaults?.service === "automatic1111" && request.imageDefaults.automatic1111) {
    return request.imageDefaults.automatic1111;
  }
  return DEFAULT_AUTOMATIC1111_DEFAULTS;
}

function resolveComfyUiDefaults(request: ImageGenRequest): ComfyUiDefaults {
  if (request.imageDefaults?.service === "comfyui" && request.imageDefaults.comfyui) {
    return request.imageDefaults.comfyui;
  }
  return DEFAULT_COMFYUI_DEFAULTS;
}

function buildDefaultComfyUiWorkflow(defaults: ComfyUiDefaults): Record<string, unknown> {
  const workflow = JSON.parse(JSON.stringify(DEFAULT_COMFYUI_WORKFLOW)) as Record<string, unknown>;
  const samplerInputs = ((workflow["3"] as Record<string, unknown>)?.inputs ?? {}) as Record<string, unknown>;
  samplerInputs.steps = defaults.steps;
  samplerInputs.cfg = defaults.cfgScale;
  samplerInputs.sampler_name = defaults.sampler || DEFAULT_COMFYUI_DEFAULTS.sampler;
  samplerInputs.scheduler = defaults.scheduler || DEFAULT_COMFYUI_DEFAULTS.scheduler;
  samplerInputs.denoise = defaults.denoisingStrength;
  return workflow;
}

function replaceComfyUiPlaceholders(value: unknown, replacements: Record<string, string | number>): unknown {
  if (typeof value === "string") {
    const exactReplacement = replacements[value];
    if (exactReplacement !== undefined) return exactReplacement;

    return Object.entries(replacements).reduce(
      (resolved, [placeholder, replacement]) => resolved.replaceAll(placeholder, String(replacement)),
      value,
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceComfyUiPlaceholders(item, replacements));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, replaceComfyUiPlaceholders(entry, replacements)]),
    );
  }

  return value;
}

async function uploadComfyReferenceImage(base: string, reference: string, signal?: AbortSignal): Promise<string> {
  const decoded = decodeReferenceImage(reference);
  const imageBytes = Buffer.from(decoded.base64, "base64");
  const hash = createHash("sha256").update(imageBytes).digest("hex").slice(0, 16);
  const filename = `marinara-ref-${hash}.${decoded.ext}`;

  const formData = new FormData();
  formData.append("image", new Blob([imageBytes], { type: decoded.mimeType }), filename);
  formData.append("overwrite", "true");

  const resp = await localImageBackendFetch(`${base}/upload/image`, {
    method: "POST",
    body: formData,
    signal: imageRequestSignal({ signal }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`ComfyUI reference image upload failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const result = (await resp.json()) as { name?: string };
  if (!result.name) {
    throw new Error("ComfyUI did not return a filename for the uploaded reference image");
  }
  return result.name;
}

function collectComfyReferenceImages(request: ImageGenRequest, defaults: ComfyUiDefaults): string[] {
  const references = [request.referenceImage, ...(request.referenceImages ?? [])]
    .filter((reference): reference is string => typeof reference === "string" && reference.trim().length > 0)
    .filter((reference, index, all) => all.indexOf(reference) === index)
    .slice(0, COMFYUI_MAX_REFERENCE_IMAGES);
  if (references.length > 0) return references;
  return defaults.uploadPlaceholderOnMissingReference ? [COMFYUI_PLACEHOLDER_REFERENCE_BASE64] : [];
}

async function generateComfyUI(baseUrl: string, request: ImageGenRequest): Promise<ImageGenResult> {
  const base = baseUrl.replace(/\/+$/, "");
  const defaults = resolveComfyUiDefaults(request);
  const seed = resolveSeed(request.imageDefaults);
  const prompt = mergePromptPrefix(defaults.promptPrefix, request.prompt || "");
  const negativePrompt = mergeNegativePrompt(defaults.negativePromptPrefix, request.negativePrompt);

  // Parse custom workflow or use default
  let workflow: Record<string, unknown>;
  if (request.comfyWorkflow) {
    try {
      workflow = JSON.parse(request.comfyWorkflow) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid ComfyUI workflow JSON");
    }
  } else {
    workflow = buildDefaultComfyUiWorkflow(defaults);
  }

  const replacements: Record<string, string | number> = {
    "%prompt%": prompt,
    "%negative_prompt%": negativePrompt,
    "%width%": request.width ?? 512,
    "%height%": request.height ?? 768,
    "%seed%": seed,
    "%steps%": defaults.steps,
    "%cfg%": defaults.cfgScale,
    "%cfg_scale%": defaults.cfgScale,
    "%scale%": defaults.cfgScale,
    "%sampler%": defaults.sampler,
    "%scheduler%": defaults.scheduler,
    "%denoise%": defaults.denoisingStrength,
    "%denoising_strength%": defaults.denoisingStrength,
    "%clip_skip%": defaults.clipSkip ?? 0,
  };
  Object.assign(replacements, buildComfyUiLoraWorkflowReplacements(defaults.loras));
  if (request.model) {
    replacements["%model%"] = request.model;
  }
  const workflowJson = JSON.stringify(workflow);
  const references = collectComfyReferenceImages(request, defaults);
  let placeholderUploadedName: string | undefined;
  for (let i = 0; i < references.length; i++) {
    const reference = references[i]!;
    const referenceBase64 = decodeReferenceImage(reference).base64;
    const imagePlaceholder = numberedComfyReferencePlaceholder("reference_image", i);
    const namePlaceholder = numberedComfyReferencePlaceholder("reference_image_name", i);

    replacements[imagePlaceholder] = referenceBase64;
    if (i === 0) replacements["%reference_image%"] = referenceBase64;

    if (workflowJson.includes(namePlaceholder) || (i === 0 && workflowJson.includes("%reference_image_name%"))) {
      const uploadedName = await uploadComfyReferenceImage(base, reference, request.signal);
      if (reference === COMFYUI_PLACEHOLDER_REFERENCE_BASE64) placeholderUploadedName = uploadedName;
      replacements[namePlaceholder] = uploadedName;
      if (i === 0) replacements["%reference_image_name%"] = uploadedName;
    }
  }
  if (defaults.uploadPlaceholderOnMissingReference) {
    for (const index of findMissingComfyReferenceSlots(workflowJson, "reference_image", references.length)) {
      const placeholder = numberedComfyReferencePlaceholder("reference_image", index);
      logger.debug("Backfilled ComfyUI reference slot %s with the placeholder image", placeholder);
      replacements[placeholder] = COMFYUI_PLACEHOLDER_REFERENCE_BASE64;
    }
    for (const index of findMissingComfyReferenceSlots(workflowJson, "reference_image_name", references.length)) {
      const placeholder = numberedComfyReferencePlaceholder("reference_image_name", index);
      placeholderUploadedName ??= await uploadComfyReferenceImage(
        base,
        COMFYUI_PLACEHOLDER_REFERENCE_BASE64,
        request.signal,
      );
      logger.debug("Backfilled ComfyUI reference slot %s with the uploaded placeholder", placeholder);
      replacements[placeholder] = placeholderUploadedName;
    }
  }
  const resolvedWorkflow = replaceComfyUiPlaceholders(workflow, replacements);

  // Queue the workflow
  const queueResp = await localImageBackendFetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: resolvedWorkflow }),
    signal: imageRequestSignal(request),
  });

  if (!queueResp.ok) {
    const errText = await queueResp.text().catch(() => "Unknown error");
    throw new Error(`ComfyUI queue failed (${queueResp.status}): ${sanitizeErrorText(errText)}`);
  }

  const queueJson = (await queueResp.json().catch(() => null)) as Record<string, unknown> | null;
  const promptId = typeof queueJson?.prompt_id === "string" ? queueJson.prompt_id.trim() : "";
  if (!promptId) {
    const details = formatComfyUiError(queueJson);
    throw new Error(`ComfyUI queue did not return a prompt_id${details ? `: ${details}` : ""}`);
  }

  // Poll for completion. Default is longer than most image requests so slow/editing workflows can finish.
  const pollTimeoutMs = Math.max(1000, COMFYUI_GEN_TIMEOUT_SECONDS * 1000);
  const pollStartedAt = Date.now();
  while (Date.now() - pollStartedAt < pollTimeoutMs) {
    await sleepWithAbort(1000, request.signal);

    const historyResp = await localImageBackendFetch(`${base}/history/${promptId}`, {
      signal: imageRequestSignal(request),
    });
    if (!historyResp.ok) continue;

    const history = (await historyResp.json()) as Record<string, ComfyUiHistoryEntry>;

    const entry = history[promptId];
    const statusError = getComfyUiStatusError(entry?.status);
    if (statusError) throw new Error(`ComfyUI workflow failed: ${statusError}`);
    if (!entry?.outputs) {
      if (isComfyUiStatusComplete(entry?.status)) {
        throw new Error("ComfyUI workflow completed without image outputs.");
      }
      continue;
    }

    // Video Helper Suite's Video Combine reports animated WebP files as "gifs".
    for (const outputKey of COMFYUI_OUTPUT_FILE_KEYS) {
      for (const nodeOutput of Object.values(entry.outputs)) {
        const outputFiles = nodeOutput[outputKey];
        if (outputFiles && outputFiles.length > 0) {
          const img = outputFiles[0]!;
          const params = new URLSearchParams({
            filename: img.filename,
            subfolder: img.subfolder || "",
            type: img.type || "output",
          });

          const imgResp = await localImageBackendFetch(`${base}/view?${params}`, {
            signal: imageRequestSignal(request),
          });
          if (!imgResp.ok) {
            throw new Error(`ComfyUI image fetch failed (${imgResp.status})`);
          }

          const arrayBuffer = await imgResp.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const { mimeType, ext } = imageResultMetadata(img.filename, imgResp.headers.get("content-type"), base64);
          return { base64, mimeType, ext };
        }
      }
    }

    if (isComfyUiStatusComplete(entry.status)) {
      throw new Error("ComfyUI workflow completed without image outputs.");
    }
  }

  throw new Error(`ComfyUI generation timed out after ${Math.round(pollTimeoutMs / 1000)} seconds`);
}

// ── SwarmUI ──

function swarmUiHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = apiKey.trim();
  if (token) headers.Cookie = `swarm_token=${encodeURIComponent(token)}`;
  return headers;
}

function swarmUiApiError(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const error = typeof value.error === "string" ? value.error.trim() : "";
  const errorId = typeof value.error_id === "string" ? value.error_id.trim() : "";
  if (!error && !errorId) return null;
  return sanitizeErrorText(error || errorId);
}

async function createSwarmUiSession(base: string, apiKey: string, request: ImageGenRequest): Promise<string> {
  const response = await localImageBackendFetch(`${base}/API/GetNewSession`, {
    method: "POST",
    headers: swarmUiHeaders(apiKey),
    body: "{}",
    signal: imageRequestSignal(request),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`SwarmUI session request failed (${response.status}): ${sanitizeErrorText(text)}`);
  }

  let result: unknown;
  try {
    result = JSON.parse(text) as unknown;
  } catch {
    throw new Error("SwarmUI session request returned invalid JSON");
  }
  const apiError = swarmUiApiError(result);
  if (apiError) throw new Error(`SwarmUI API error: ${apiError}`);
  const sessionId = isRecord(result) && typeof result.session_id === "string" ? result.session_id.trim() : "";
  if (!sessionId) throw new Error("SwarmUI did not return a session_id");
  return sessionId;
}

export function buildSwarmUiGenerationBody(request: ImageGenRequest, sessionId: string): Record<string, unknown> {
  const defaults = resolveComfyUiDefaults(request);
  const seed = resolveSeed(request.imageDefaults);
  const prompt = mergePromptPrefix(defaults.promptPrefix, request.prompt || "");
  const negativePrompt = mergeNegativePrompt(defaults.negativePromptPrefix, request.negativePrompt);
  const model = request.model?.trim();
  const body: Record<string, unknown> = {
    session_id: sessionId,
    images: 1,
    donotsave: true,
    prompt,
    negativeprompt: negativePrompt,
    width: request.width ?? 512,
    height: request.height ?? 768,
    seed,
    steps: defaults.steps,
    cfgscale: defaults.cfgScale,
    sampler: defaults.sampler,
    scheduler: defaults.scheduler,
  };
  if (model) body.model = model;

  const workflowText = request.comfyWorkflow?.trim();
  if (!workflowText) return body;
  if (/%reference_image_name(?:_0[1-4])?%/.test(workflowText)) {
    throw new Error(
      "SwarmUI workflows must use %reference_image% placeholders; backend-local filename placeholders cannot be distributed safely.",
    );
  }

  let workflow: Record<string, unknown>;
  try {
    workflow = JSON.parse(workflowText) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid ComfyUI workflow JSON");
  }
  const replacements: Record<string, string | number> = {
    "%prompt%": prompt,
    "%negative_prompt%": negativePrompt,
    "%width%": request.width ?? 512,
    "%height%": request.height ?? 768,
    "%seed%": seed,
    "%steps%": defaults.steps,
    "%cfg%": defaults.cfgScale,
    "%cfg_scale%": defaults.cfgScale,
    "%scale%": defaults.cfgScale,
    "%sampler%": defaults.sampler,
    "%scheduler%": defaults.scheduler,
    "%denoise%": defaults.denoisingStrength,
    "%denoising_strength%": defaults.denoisingStrength,
    "%clip_skip%": defaults.clipSkip ?? 0,
  };
  Object.assign(replacements, buildComfyUiLoraWorkflowReplacements(defaults.loras));
  if (model) replacements["%model%"] = model;

  const references = collectComfyReferenceImages(request, defaults);
  for (let index = 0; index < references.length; index++) {
    const base64 = decodeReferenceImage(references[index]!).base64;
    replacements[numberedComfyReferencePlaceholder("reference_image", index)] = base64;
    if (index === 0) replacements["%reference_image%"] = base64;
  }
  if (defaults.uploadPlaceholderOnMissingReference) {
    for (const index of findMissingComfyReferenceSlots(workflowText, "reference_image", references.length)) {
      replacements[numberedComfyReferencePlaceholder("reference_image", index)] = COMFYUI_PLACEHOLDER_REFERENCE_BASE64;
    }
  }

  body.comfyworkflowraw = JSON.stringify(replaceComfyUiPlaceholders(workflow, replacements));
  return body;
}

function redactSwarmUiWorkflowImages(workflowText: string, request: ImageGenRequest): string {
  const imageValues = [
    COMFYUI_PLACEHOLDER_REFERENCE_BASE64,
    ...collectComfyReferenceImages(request, resolveComfyUiDefaults(request)).map(
      (reference) => decodeReferenceImage(reference).base64,
    ),
  ];
  return [...new Set(imageValues)].reduce(
    (redacted, image) =>
      redacted.replaceAll(image, `[redacted image: ${Buffer.from(image, "base64").byteLength} bytes]`),
    workflowText,
  );
}

export function parseSwarmUiImageReference(value: unknown): string {
  const apiError = swarmUiApiError(value);
  if (apiError) throw new Error(`SwarmUI API error: ${apiError}`);
  if (!isRecord(value) || !Array.isArray(value.images)) {
    throw new Error("SwarmUI did not return an images array");
  }
  const image = value.images.find(
    (candidate): candidate is string => typeof candidate === "string" && !!candidate.trim(),
  );
  if (!image) throw new Error("SwarmUI completed without an image output");
  return image.trim();
}

async function generateSwarmUiImageReference(
  base: string,
  apiKey: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<string> {
  const socketUrl = new URL(`${base}/API/GenerateText2ImageWS`);
  if (socketUrl.protocol === "https:") socketUrl.protocol = "wss:";
  else if (socketUrl.protocol === "http:") socketUrl.protocol = "ws:";
  else throw new Error(`SwarmUI requires an HTTP or HTTPS base URL, received ${socketUrl.protocol}`);
  await validateOutboundUrl(socketUrl, {
    allowLocal: true,
    allowedProtocols: ["wss:", "ws:"],
    flagName: "IMAGE_LOCAL_URLS_ENABLED",
  });

  return new Promise<string>((resolve, reject) => {
    const images = new Map<number, string>();
    const discarded = new Set<number>();
    const socket = new WebSocket(socketUrl, { headers: swarmUiHeaders(apiKey) });
    let settled = false;

    const closeSocket = () => {
      try {
        socket.close();
      } catch {
        // The connection may have failed before the opening handshake completed.
      }
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      closeSocket();
      if (error) {
        reject(error);
        return;
      }
      const image = [...images.entries()]
        .filter(([index]) => !discarded.has(index))
        .sort(([left], [right]) => left - right)[0]?.[1];
      if (!image) {
        reject(new Error("SwarmUI completed without an image output"));
        return;
      }
      resolve(image);
    };
    const abort = () => {
      finish(signal.reason instanceof Error ? signal.reason : new Error("SwarmUI generation aborted"));
    };

    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    socket.addEventListener("open", () => {
      if (!settled) socket.send(JSON.stringify(body));
    });
    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        finish(new Error("SwarmUI generation returned a non-text WebSocket message"));
        return;
      }
      if (Buffer.byteLength(event.data) > MAX_IMAGE_RESPONSE_BYTES) {
        finish(new Error("SwarmUI generation returned an oversized WebSocket message"));
        return;
      }
      let message: unknown;
      try {
        message = JSON.parse(event.data) as unknown;
      } catch {
        finish(new Error("SwarmUI generation returned invalid JSON"));
        return;
      }
      const apiError = swarmUiApiError(message);
      if (apiError) {
        finish(new Error(`SwarmUI API error: ${apiError}`));
        return;
      }
      if (!isRecord(message)) return;
      if (typeof message.image === "string" && message.image.trim()) {
        const index = Number.parseInt(String(message.batch_index ?? images.size), 10);
        const resolvedIndex = Number.isNaN(index) ? images.size : index;
        if (!images.has(resolvedIndex) && images.size >= SWARMUI_MAX_TRACKED_IMAGES) {
          finish(new Error("SwarmUI generation returned too many image messages"));
          return;
        }
        images.set(resolvedIndex, message.image.trim());
      }
      if (Array.isArray(message.discard_indices)) {
        for (const index of message.discard_indices) {
          if (typeof index === "number" && Number.isInteger(index)) discarded.add(index);
        }
      }
      if (message.socket_intention === "close") finish();
    });
    socket.addEventListener("error", () => finish(new Error("SwarmUI WebSocket connection failed")));
    socket.addEventListener("close", () => {
      if (!settled) finish(images.size > 0 ? undefined : new Error("SwarmUI WebSocket closed before completion"));
    });
  });
}

async function generateSwarmUI(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  const base = baseUrl.replace(/\/+$/, "");
  const sessionId = await createSwarmUiSession(base, apiKey, request);
  const body = buildSwarmUiGenerationBody(request, sessionId);
  const debugBody: Record<string, unknown> = { ...body, session_id: "[session]" };
  if (typeof debugBody.comfyworkflowraw === "string") {
    debugBody.comfyworkflowraw = redactSwarmUiWorkflowImages(debugBody.comfyworkflowraw, request);
  }
  logDebugOverride(
    request.debugMode === true,
    "[debug/image/swarmui] final request payload:\n%s",
    JSON.stringify(debugBody, null, 2),
  );
  const imageReference = await generateSwarmUiImageReference(base, apiKey, body, imageRequestSignal(request));
  if (imageReference.startsWith("data:")) return decodeImageDataUrl(imageReference);
  const imageUrl = new URL(imageReference, `${base}/`).toString();
  return downloadImageUrl(imageUrl, request.privateImageResultOrigin, request.signal);
}

// ── AUTOMATIC1111 / SD Web UI / Forge ──

async function generateAutomatic1111(
  baseUrl: string,
  request: ImageGenRequest,
  serviceHint?: string,
): Promise<ImageGenResult> {
  const base = baseUrl.replace(/\/+$/, "");
  const isDrawThings = serviceHint?.trim().toLowerCase() === "drawthings";
  const defaults = resolveAutomatic1111Defaults(request);
  const useImg2Img = !!(request.referenceImage || request.referenceImages?.length);

  const body: Record<string, unknown> = {
    prompt: mergePromptPrefix(defaults.promptPrefix, request.prompt),
    negative_prompt: mergeNegativePrompt(defaults.negativePromptPrefix, request.negativePrompt),
    width: request.width ?? 512,
    height: request.height ?? 768,
    steps: defaults.steps,
    seed: resolveSeed(request.imageDefaults),
    sampler_name: defaults.sampler || DEFAULT_AUTOMATIC1111_DEFAULTS.sampler,
  };

  if (isDrawThings) {
    // Draw Things' /sdapi/v1/txt2img diverges from A1111: it uses `guidance_scale`
    // (not `cfg_scale`), `batch_count` (not `n_iter`/`batch_size`), and rejects
    // unknown keys like `override_settings`, `scheduler`, and `restore_faces`.
    // Model / LoRA selection is driven by the Draw Things UI state, not the request.
    body.guidance_scale = defaults.cfgScale;
    body.batch_count = 1;
  } else {
    body.cfg_scale = defaults.cfgScale;
    body.batch_size = 1;
    body.n_iter = 1;
    body.restore_faces = defaults.restoreFaces;
    if (request.model) {
      // llama-swap-compatible SDAPI routers need a top-level model id before
      // A1111/Forge receive the request. Keep override_settings for native
      // checkpoint switching below.
      body.model = request.model;
    }
    if (defaults.scheduler) {
      body.scheduler = defaults.scheduler;
    }
    const overrideSettings: Record<string, unknown> = {};
    if (request.model) {
      overrideSettings.sd_model_checkpoint = request.model;
    }
    if (defaults.clipSkip) {
      overrideSettings.CLIP_stop_at_last_layers = defaults.clipSkip;
    }
    if (Object.keys(overrideSettings).length > 0) {
      body.override_settings = overrideSettings;
    }
  }

  if (useImg2Img) {
    const rawInit = (request.referenceImage ?? request.referenceImages?.[0]) as string;
    // Draw Things rejects img2img if init_images dimensions don't match the requested
    // width/height exactly. A1111/Forge auto-resize internally; Draw Things does not.
    const initImage = isDrawThings
      ? await resizeBase64ToExactSize(rawInit, body.width as number, body.height as number)
      : rawInit;
    body.init_images = [initImage];
    body.denoising_strength = defaults.denoisingStrength;
  }

  const endpoint = useImg2Img ? `${base}/sdapi/v1/img2img` : `${base}/sdapi/v1/txt2img`;
  const label = isDrawThings ? "Draw Things" : "AUTOMATIC1111";

  const resp = await localImageBackendFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: imageRequestSignal(request),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`${label} generation failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const data = (await resp.json()) as { images?: string[] };
  const b64 = data.images?.[0];
  if (!b64) {
    const hint = isDrawThings ? " (check that a model is selected in Draw Things and the API server port matches)" : "";
    throw new Error(`No image data in ${label} response${hint}`);
  }

  return { base64: b64, mimeType: "image/png", ext: "png" };
}
