// ──────────────────────────────────────────────
// Service: RunPod Serverless ComfyUI
// ──────────────────────────────────────────────
// Communicates with RunPod serverless endpoints running ComfyUI workflows.
// Uses the RunPod async job API:
//   POST /v2/{endpoint_id}/run  →  receive { id }
//   GET  /v2/{endpoint_id}/status/{job_id}  →  poll until COMPLETED
//   Extract images from output.images[n].data (raw base64)
//
// API format (confirmed via testing):
//   Input:  { "input": { "workflow": <full ComfyUI workflow JSON> } }
//   Output: { "output": { "images": [{ "data": "<base64>", "filename": "...", "type": "base64" }] } }
//
// The prompt is embedded in the workflow JSON (e.g. CLIPTextEncode node text),
// so placeholder substitution (%prompt%, %seed%, etc.) must happen BEFORE sending.

import type { ImageGenRequest, ImageGenResult } from "./image-generation.js";
import {
  COMFYUI_PLACEHOLDER_REFERENCE_BASE64,
  DEFAULT_COMFYUI_DEFAULTS,
  mergeNegativePrompt,
  mergePromptPrefix,
  type ComfyUiDefaults,
  type ImageGenerationDefaultsProfile,
} from "@marinara-engine/shared";
import { safeFetch } from "../../utils/security.js";

const DEFAULT_RUNPOD_POLL_INTERVAL_MS = 2_000;
const DEFAULT_COMFYUI_GEN_TIMEOUT_SECONDS = 2_400;

/** Parse the shared ComfyUI timeout without allowing invalid values to poison RunPod polling. */
export function resolveRunPodComfyUiTimeoutSeconds(rawValue: string | undefined): number {
  const parsed = Number(rawValue);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_COMFYUI_GEN_TIMEOUT_SECONDS;
}

const COMFYUI_GEN_TIMEOUT_SECONDS = resolveRunPodComfyUiTimeoutSeconds(process.env.COMFYUI_GEN_TIMEOUT);
const RUNPOD_MAX_POLLS = Math.max(
  1,
  Math.ceil((COMFYUI_GEN_TIMEOUT_SECONDS * 1000) / DEFAULT_RUNPOD_POLL_INTERVAL_MS),
);
const RUNPOD_MAX_RESPONSE_BYTES = 30 * 1024 * 1024;
const RUNPOD_COMFYUI_MAX_REFERENCE_IMAGES = 4;
interface RunPodRunResponse {
  id: string;
}

interface RunPodStatusResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  output?: {
    images?: Array<Record<string, unknown>>;
  };
  error?: string;
}

/**
 * Generate an image via a RunPod Serverless ComfyUI endpoint.
 *
 * The endpoint ID comes from the dedicated `image_endpoint_id` connection field.
 * The workflow JSON (with placeholders already substituted) comes from
 * the connection's `comfyui_workflow` field.
 *
 * @param baseUrl     - RunPod API base URL (e.g. "https://api.runpod.ai/v2" or test URL)
 * @param endpointId  - RunPod endpoint ID (e.g. "abc123def456")
 * @param apiKey      - RunPod API Bearer token
 * @param request     - Image gen request with comfyWorkflow containing prompt
 */
export async function generateRunPodComfyUI(
  baseUrl: string,
  endpointId: string,
  apiKey: string,
  request: ImageGenRequest,
): Promise<ImageGenResult> {
  const endpointIdSegment = normalizeRunPodEndpointId(endpointId);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // If there's no workflow, this is an error. RunPod needs the workflow because
  // the serverless endpoint executes the ComfyUI graph supplied in the request.
  if (!request.comfyWorkflow) {
    throw new Error(
      "RunPod ComfyUI requires a workflow JSON. " +
        "Paste your ComfyUI workflow (API format) in the connection's workflow field.",
    );
  }

  // ── Substitute placeholders (%prompt%, %seed%, etc.) ──
  // The workflow JSON string contains placeholders like %prompt% and %seed%.
  // Replace them before parsing, matching the local ComfyUI handler behaviour.
  const defaults = resolveRunPodComfyUiDefaults(request);
  const resolvedSeed = resolveRunPodSeed(request.imageDefaults);
  const prompt = mergePromptPrefix(defaults.promptPrefix, request.prompt || "");
  const negativePrompt = mergeNegativePrompt(defaults.negativePromptPrefix, request.negativePrompt);

  let wfStr = request.comfyWorkflow;
  wfStr = wfStr.replace(/%prompt%/g, escapeJsonStr(prompt));
  wfStr = wfStr.replace(/%negative_prompt%/g, escapeJsonStr(negativePrompt));
  wfStr = wfStr.replace(/%width%/g, String(request.width ?? 512));
  wfStr = wfStr.replace(/%height%/g, String(request.height ?? 768));
  wfStr = wfStr.replace(/%seed%/g, String(resolvedSeed));
  wfStr = wfStr.replace(/%steps%/g, String(defaults.steps));
  wfStr = wfStr.replace(/%cfg%/g, String(defaults.cfgScale));
  wfStr = wfStr.replace(/%cfg_scale%/g, String(defaults.cfgScale));
  wfStr = wfStr.replace(/%scale%/g, String(defaults.cfgScale));
  wfStr = wfStr.replace(/%sampler%/g, escapeJsonStr(defaults.sampler));
  wfStr = wfStr.replace(/%scheduler%/g, escapeJsonStr(defaults.scheduler));
  wfStr = wfStr.replace(/%denoise%/g, String(defaults.denoisingStrength));
  wfStr = wfStr.replace(/%denoising_strength%/g, String(defaults.denoisingStrength));
  wfStr = wfStr.replace(/%clip_skip%/g, String(defaults.clipSkip ?? 0));
  if (request.model) {
    wfStr = wfStr.replace(/%model%/g, escapeJsonStr(request.model));
  }
  const referenceImages = collectRunPodReferenceImages(request, defaults);
  for (let i = 0; i < referenceImages.length; i++) {
    const referenceImage = referenceImages[i]!;
    const referenceImageBase64 = normalizeRunPodReferenceImageBase64(referenceImage);
    const numbered = `%reference_image_${String(i + 1).padStart(2, "0")}%`;
    wfStr = wfStr.replaceAll(numbered, escapeJsonStr(referenceImageBase64));
    if (i === 0) {
      wfStr = wfStr.replace(/%reference_image%/g, escapeJsonStr(referenceImageBase64));
    }
  }

  let workflow: Record<string, unknown>;
  try {
    workflow = JSON.parse(wfStr) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid ComfyUI workflow JSON for RunPod endpoint");
  }

  // ── Step 1: Submit the job ──
  const jobResp = await runPodFetch(buildRunPodUrl(baseUrl, endpointIdSegment, "run"), request, {
    method: "POST",
    headers,
    body: JSON.stringify({ input: { workflow } }),
    signal: runPodFetchSignal(request),
  });

  if (!jobResp.ok) {
    const errText = await jobResp.text().catch(() => "Unknown error");
    throw new Error(`RunPod job submission failed (${jobResp.status}): ${sanitizeRunPodError(errText)}`);
  }

  const { id: jobId } = (await jobResp.json()) as RunPodRunResponse;
  if (!jobId) {
    throw new Error("RunPod did not return a job ID");
  }

  // ── Step 2: Poll for completion ──
  for (let attempt = 0; attempt < RUNPOD_MAX_POLLS; attempt++) {
    await runPodSleep(runPodPollIntervalMs(), request.signal);

    const statusResp = await runPodFetch(buildRunPodUrl(baseUrl, endpointIdSegment, "status", jobId), request, {
      method: "GET",
      headers,
      signal: runPodFetchSignal(request),
    });

    if (!statusResp.ok) {
      const errText = await statusResp.text().catch(() => "Unknown error");
      throw new Error(`RunPod status check failed (${statusResp.status}): ${sanitizeRunPodError(errText)}`);
    }

    const status = (await statusResp.json()) as RunPodStatusResponse;

    switch (status.status) {
      case "COMPLETED":
        return extractRunPodImage(status, endpointId);
      case "FAILED":
        throw new Error(`RunPod generation failed: ${status.error || "Unknown error"}`);
      case "CANCELLED":
        throw new Error("RunPod generation was cancelled");
      // IN_QUEUE / IN_PROGRESS → keep polling
    }
  }

  throw new Error(`RunPod generation timed out after ${COMFYUI_GEN_TIMEOUT_SECONDS} seconds`);
}

function collectRunPodReferenceImages(request: ImageGenRequest, defaults: ComfyUiDefaults): string[] {
  const references = [request.referenceImage, ...(request.referenceImages ?? [])]
    .filter((reference): reference is string => typeof reference === "string" && reference.trim().length > 0)
    .filter((reference, index, all) => all.indexOf(reference) === index)
    .slice(0, RUNPOD_COMFYUI_MAX_REFERENCE_IMAGES);
  if (references.length > 0) return references;
  return defaults.uploadPlaceholderOnMissingReference ? [COMFYUI_PLACEHOLDER_REFERENCE_BASE64] : [];
}

function normalizeRunPodReferenceImageBase64(reference: string): string {
  const dataUrlMatch = reference.trim().match(/^data:image\/(?:png|jpe?g|webp|gif|avif|bmp);base64,([\s\S]+)$/i);
  const rawBase64 = dataUrlMatch ? dataUrlMatch[1]! : reference;
  const compact = rawBase64.replace(/\s+/g, "");
  const unpadded = compact.replace(/=+$/, "");
  if (!unpadded || /[^A-Za-z0-9+/]/.test(unpadded)) {
    throw new Error("RunPod ComfyUI reference image was not valid base64 image data");
  }

  const remainder = unpadded.length % 4;
  if (remainder === 1) {
    throw new Error("RunPod ComfyUI reference image was not valid base64 image data");
  }

  return `${unpadded}${"=".repeat(remainder === 0 ? 0 : 4 - remainder)}`;
}

/**
 * Extract the first image from a COMPLETED RunPod response.
 *
 * Expected format:
 *   { output: { images: [{ data: "<base64>", filename: "...", type: "base64" }] } }
 */
function extractRunPodImage(status: RunPodStatusResponse, endpointId: string): ImageGenResult {
  const output = status.output;

  if (!output) {
    throw new Error(`RunPod returned COMPLETED but no output data (endpoint: ${endpointId})`);
  }

  const images = output.images;
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error(
      `RunPod returned COMPLETED but output.images was empty or missing. ` +
        `Check that your workflow has a SaveImage node connected to the output.`,
    );
  }

  // Try each image in order, take the first valid one
  for (const item of images) {
    if (!item || typeof item !== "object") continue;
    const img = item as Record<string, unknown>;

    // Main field is "data" containing raw base64
    const data = typeof img.data === "string" ? img.data : null;
    if (data && data.length > 0) {
      const trimmed = data.trim();
      // Could be data URL or raw base64
      if (trimmed.startsWith("data:")) {
        try {
          return decodeDataUrl(trimmed);
        } catch {
          continue;
        }
      }
      // Raw base64 (most common for RunPod)
      const decoded = decodeRawRunPodImageBase64(trimmed);
      if (decoded) return decoded;
    }

    // Also try "base64" or "image" keys (defensive fallback)
    const fallbackBase64 =
      typeof img.base64 === "string" ? img.base64 : typeof img.image === "string" ? img.image : null;

    if (fallbackBase64) {
      const trimmed = fallbackBase64.trim();
      if (trimmed.startsWith("data:")) {
        try {
          return decodeDataUrl(trimmed);
        } catch {
          continue;
        }
      }
      const decoded = decodeRawRunPodImageBase64(trimmed);
      if (decoded) return decoded;
      continue;
    }
  }

  throw new Error(
    `Could not extract image from RunPod output. ` +
      `Found ${images.length} image(s) but none had valid base64 data. ` +
      `Output preview: ${JSON.stringify(output).slice(0, 300)}`,
  );
}

// ── Helpers ──

function sanitizeRunPodError(text: string): string {
  if (!text.includes("<")) return text.slice(0, 300);
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function normalizeRunPodEndpointId(endpointId: string): string {
  const trimmed = endpointId.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw new Error("RunPod endpoint ID may only contain letters, numbers, underscores, and dashes");
  }
  return trimmed;
}

function buildRunPodUrl(baseUrl: string, endpointId: string, ...pathSegments: string[]): URL {
  const url = new URL(baseUrl);
  const basePathSegments = url.pathname.split("/").filter(Boolean);
  const path = [...basePathSegments, endpointId, ...pathSegments]
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));
  url.pathname = `/${path.join("/")}`;
  url.search = "";
  url.hash = "";
  return url;
}

function runPodPollIntervalMs(): number {
  const interval = Number(process.env.RUNPOD_POLL_INTERVAL_MS ?? DEFAULT_RUNPOD_POLL_INTERVAL_MS);
  return Number.isFinite(interval) && interval >= 0 ? interval : DEFAULT_RUNPOD_POLL_INTERVAL_MS;
}

function resolveRunPodSeed(profile: ImageGenerationDefaultsProfile | null | undefined): number {
  return typeof profile?.seed === "number" && profile.seed >= 0 ? profile.seed : Math.floor(Math.random() * 2 ** 32);
}

function resolveRunPodComfyUiDefaults(request: ImageGenRequest): ComfyUiDefaults {
  if (request.imageDefaults?.service === "comfyui" && request.imageDefaults.comfyui) {
    return request.imageDefaults.comfyui;
  }
  return DEFAULT_COMFYUI_DEFAULTS;
}

function runPodFetch(url: URL, request: ImageGenRequest, init: RequestInit): Promise<Response> {
  return safeFetch(url, {
    ...init,
    policy: {
      allowLocal: request.allowLocalUrls,
      allowLoopback: true,
      allowedProtocols: ["https:", "http:"],
      flagName: "IMAGE_LOCAL_URLS_ENABLED",
    },
    maxResponseBytes: RUNPOD_MAX_RESPONSE_BYTES,
  });
}

function runPodAbortError(signal?: AbortSignal): Error {
  return signal?.reason instanceof Error ? signal.reason : new Error("RunPod generation aborted");
}

function runPodFetchSignal(request: ImageGenRequest): AbortSignal {
  const timeout = AbortSignal.timeout(30_000);
  return request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
}

function runPodSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(runPodAbortError(signal));
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(runPodAbortError(signal));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    if (typeof timer === "object" && typeof timer.unref === "function") {
      timer.unref();
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function detectKnownImageMimeType(base64: string): string | null {
  const bytes = Buffer.from(base64.slice(0, 64), "base64");
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
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
  const brand = bytes.subarray(8, 12).toString("ascii").toLowerCase();
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    (brand.startsWith("avif") || brand.startsWith("avis"))
  ) {
    return "image/avif";
  }
  return null;
}

function decodeRawRunPodImageBase64(raw: string): ImageGenResult | null {
  const compact = raw.trim().replace(/\s+/g, "");
  const unpadded = compact.replace(/=+$/, "");
  if (!unpadded || /[^A-Za-z0-9+/]/.test(unpadded) || unpadded.length % 4 === 1) return null;

  const padded = `${unpadded}${"=".repeat(unpadded.length % 4 === 0 ? 0 : 4 - (unpadded.length % 4))}`;
  const buffer = Buffer.from(padded, "base64");
  if (buffer.byteLength === 0) return null;

  const base64 = buffer.toString("base64");
  const mimeType = detectKnownImageMimeType(base64);
  if (!mimeType) return null;
  return {
    base64,
    mimeType,
    ext: imageExtensionFromMimeType(mimeType),
  };
}

function imageExtensionFromMimeType(mimeType: string): string {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("avif")) return "avif";
  if (mimeType.includes("bmp")) return "bmp";
  return "png";
}

function decodeDataUrl(dataUrl: string): ImageGenResult {
  const match = dataUrl.trim().match(/^data:(image\/(?:png|jpe?g|webp|gif|avif|bmp));base64,([\s\S]+)$/i);
  if (!match) throw new Error("Invalid image data URL from RunPod output");

  const encoded = match[2]!.replace(/\s+/g, "");
  const decoded = decodeRawRunPodImageBase64(encoded);
  if (!decoded) throw new Error("Invalid image data from RunPod");
  return decoded;
}

/** Escape a string for safe insertion into a JSON string value (backslash + quote escaping). */
function escapeJsonStr(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}
