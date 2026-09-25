import { safeFetch } from "../../utils/security.js";
import { logger } from "../../lib/logger.js";

export type AtlasCloudGenerationKind = "image" | "video";

export interface AtlasCloudPrediction {
  id: string | null;
  status: string | null;
  output: string | null;
  error: string | null;
}

const ATLAS_CLOUD_POLL_INTERVAL_MS = readPositiveIntervalEnv("ATLAS_CLOUD_POLL_INTERVAL_MS", 5_000);
const ATLAS_CLOUD_RESPONSE_LIMIT_BYTES = 2 * 1024 * 1024;
const ATLAS_CLOUD_CATALOG_LIMIT_BYTES = 8 * 1024 * 1024;
const ATLAS_CLOUD_CATALOG_TIMEOUT_MS = 30_000;
const COMPLETE_STATUSES = new Set(["completed", "succeeded", "success", "done"]);
const FAILED_STATUSES = new Set(["failed", "error", "cancelled", "canceled", "expired"]);
const ATLAS_IMAGE_ASPECT_RATIOS = [
  ["1:1", 1],
  ["16:9", 16 / 9],
  ["9:16", 9 / 16],
  ["4:3", 4 / 3],
  ["3:4", 3 / 4],
  ["3:2", 3 / 2],
  ["2:3", 2 / 3],
] as const;

function readPositiveIntervalEnv(name: string, fallbackMs: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallbackMs;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallbackMs;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unwrapPrediction(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  return isRecord(value.data) ? value.data : value;
}

function firstOutput(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const output = firstOutput(item);
      if (output) return output;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const key of ["url", "uri", "output", "outputs", "result", "data"]) {
    const output = firstOutput(value[key]);
    if (output) return output;
  }
  return null;
}

function closestImageAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  return ATLAS_IMAGE_ASPECT_RATIOS.reduce((best, candidate) =>
    Math.abs(candidate[1] - ratio) < Math.abs(best[1] - ratio) ? candidate : best,
  )[0];
}

export function buildAtlasCloudImageRequest(input: {
  model: string;
  prompt: string;
  width?: number;
  height?: number;
  referenceImageDataUrl?: string;
}): Record<string, unknown> {
  const model = input.model.trim();
  if (!model) throw new Error("Atlas Cloud image generation requires a model");
  const body: Record<string, unknown> = { model, prompt: input.prompt.trim() };
  const width = Number.isFinite(input.width) && Number(input.width) > 0 ? Number(input.width) : 1024;
  const height = Number.isFinite(input.height) && Number(input.height) > 0 ? Number(input.height) : 1024;
  if (/(?:google\/(?:nano-banana|gemini-[^/]*image).*\/text-to-image|black-forest-labs\/flux-1\.1-pro)/i.test(model)) {
    body.aspect_ratio = closestImageAspectRatio(width, height);
  } else if (/^black-forest-labs\/flux-(?:dev|krea|kontext)/i.test(model)) {
    body.size = `${Math.round(width)}*${Math.round(height)}`;
  }
  if (input.referenceImageDataUrl && /(?:kontext|image-to-image|image-edit|edit-image)/i.test(model)) {
    body.image = input.referenceImageDataUrl;
  }
  return body;
}

export function buildAtlasCloudVideoRequest(input: {
  model: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16";
  resolution?: "480p" | "720p" | "1080p";
  referenceImageDataUrl?: string;
}): Record<string, unknown> {
  const model = input.model.trim();
  if (!model) throw new Error("Atlas Cloud video generation requires a model");
  const body: Record<string, unknown> = {
    model,
    prompt: input.prompt.trim(),
    duration: Math.max(1, Math.trunc(input.durationSeconds)),
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution ?? "720p",
  };
  if (input.referenceImageDataUrl) {
    if (/reference-to-video/i.test(model)) body.reference_images = [input.referenceImageDataUrl];
    else body.image = input.referenceImageDataUrl;
  }
  return body;
}

function predictionError(record: Record<string, unknown>): string | null {
  for (const key of ["error", "message", "detail", "logs"]) {
    const value = record[key];
    if (isRecord(value)) {
      const message = readString(value.message) ?? readString(value.detail);
      if (message) return message.slice(0, 500);
    }
    const message = readString(value);
    if (message) return message.slice(0, 500);
  }
  return null;
}

export function parseAtlasCloudPrediction(value: unknown): AtlasCloudPrediction {
  const record = unwrapPrediction(value);
  return {
    id: readString(record.id) ?? readString(record.predictionId) ?? readString(record.prediction_id),
    status: readString(record.status)?.toLowerCase() ?? null,
    output: firstOutput(record.outputs) ?? firstOutput(record.output) ?? firstOutput(record.result),
    error: predictionError(record),
  };
}

export function buildAtlasCloudUrl(
  baseUrl: string,
  resource: "generateImage" | "generateVideo" | `prediction/${string}`,
): string {
  const parsed = new URL(baseUrl.replace(/\/+$/, ""));
  let path = parsed.pathname.replace(/\/+$/, "");
  path = path.replace(/\/model(?:\/.*)?$/i, "");
  if (!path || path === "/") path = "/api/v1";
  if (path === "/api") path = "/api/v1";
  if (path === "/v1" && parsed.hostname.toLowerCase().endsWith("atlascloud.ai")) path = "/api/v1";
  parsed.pathname = `${path}/model/${resource}`.replace(/\/{2,}/g, "/");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

/** The public model catalog sits beside the generation endpoints and does not need an API key. */
export function buildAtlasCloudCatalogUrl(baseUrl: string): string {
  const parsed = new URL(buildAtlasCloudUrl(baseUrl, "generateVideo"));
  parsed.pathname = parsed.pathname.replace(/\/model\/generateVideo$/, "/models");
  return parsed.toString();
}

const ATLAS_CLOUD_CATALOG_CATEGORIES: Record<AtlasCloudGenerationKind, readonly string[]> = {
  // Scene videos always animate an image, so image-to-video models are listed first.
  video: ["IMAGE-TO-VIDEO", "TEXT-TO-VIDEO"],
  image: ["TEXT-TO-IMAGE", "IMAGE-TO-IMAGE"],
};

export function parseAtlasCloudCatalog(
  value: unknown,
  kind: AtlasCloudGenerationKind,
): Array<{ id: string; name: string }> {
  const entries = isRecord(value) && Array.isArray(value.data) ? value.data : Array.isArray(value) ? value : [];
  const wanted = ATLAS_CLOUD_CATALOG_CATEGORIES[kind];
  const models: Array<{ id: string; name: string; rank: number }> = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!isRecord(entry) || entry.display_console === false) continue;
    const id = readString(entry.model);
    if (!id || seen.has(id)) continue;
    const categories = Array.isArray(entry.categories)
      ? entry.categories.map((item) => String(item).toUpperCase())
      : [];
    const rank = wanted.findIndex((category) => categories.includes(category));
    if (rank < 0) continue;
    seen.add(id);
    const price =
      isRecord(entry.price) && isRecord(entry.price.actual) ? readString(entry.price.actual.base_price) : null;
    const label = [
      readString(entry.displayName) ?? id,
      wanted[rank]!.toLowerCase(),
      kind === "video" && price ? `from $${price}/s` : null,
    ];
    models.push({ id, name: label.filter(Boolean).join(" · "), rank });
  }
  return models.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id)).map(({ id, name }) => ({ id, name }));
}

export async function fetchAtlasCloudModels(
  baseUrl: string,
  kind: AtlasCloudGenerationKind,
  signal?: AbortSignal,
): Promise<Array<{ id: string; name: string }>> {
  const response = await safeFetch(buildAtlasCloudCatalogUrl(baseUrl), {
    method: "GET",
    signal: signal ?? AbortSignal.timeout(ATLAS_CLOUD_CATALOG_TIMEOUT_MS),
    policy: { allowLocal: false, allowLoopback: false, allowMdns: false, allowedProtocols: ["https:"] },
    maxResponseBytes: ATLAS_CLOUD_CATALOG_LIMIT_BYTES,
    decodeCompressedResponse: true,
  });
  return parseAtlasCloudCatalog(await readJsonResponse(response, "model catalog"), kind);
}

function atlasHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function readJsonResponse(response: Response, operation: string): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Atlas Cloud ${operation} returned ${response.status}: ${text.trim().slice(0, 500)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Atlas Cloud ${operation} returned invalid JSON`);
  }
}

function atlasFetch(url: string, init: RequestInit) {
  return safeFetch(url, {
    ...init,
    policy: {
      allowLocal: false,
      allowLoopback: false,
      allowMdns: false,
      allowedProtocols: ["https:"],
    },
    maxResponseBytes: ATLAS_CLOUD_RESPONSE_LIMIT_BYTES,
    decodeCompressedResponse: true,
  });
}

function delayWithSignal(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.reason instanceof Error ? signal.reason : new Error("Atlas Cloud generation was cancelled"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    timer.unref?.();
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function runAtlasCloudPrediction(args: {
  baseUrl: string;
  apiKey: string;
  kind: AtlasCloudGenerationKind;
  body: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<string> {
  if (!args.apiKey.trim()) throw new Error("Atlas Cloud generation requires an API key");
  const resource = args.kind === "image" ? "generateImage" : "generateVideo";
  const startedResponse = await atlasFetch(buildAtlasCloudUrl(args.baseUrl, resource), {
    method: "POST",
    headers: atlasHeaders(args.apiKey),
    body: JSON.stringify(args.body),
    signal: args.signal,
  });
  const started = parseAtlasCloudPrediction(await readJsonResponse(startedResponse, `${args.kind} generation`));
  if (started.status && FAILED_STATUSES.has(started.status)) {
    throw new Error(
      `Atlas Cloud ${args.kind} generation ${started.status}${started.error ? `: ${started.error}` : ""}`,
    );
  }
  if (started.output && (!started.status || COMPLETE_STATUSES.has(started.status))) return started.output;
  if (!started.id) throw new Error(`Atlas Cloud ${args.kind} generation response did not include a prediction ID`);

  const pollUrl = buildAtlasCloudUrl(args.baseUrl, `prediction/${encodeURIComponent(started.id)}`);
  while (true) {
    await delayWithSignal(ATLAS_CLOUD_POLL_INTERVAL_MS, args.signal);
    const polledResponse = await atlasFetch(pollUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${args.apiKey}` },
      signal: args.signal,
    });
    const prediction = parseAtlasCloudPrediction(await readJsonResponse(polledResponse, "prediction polling"));
    if (prediction.status && COMPLETE_STATUSES.has(prediction.status)) {
      if (prediction.output) return prediction.output;
      throw new Error(`Atlas Cloud ${args.kind} generation completed without an output`);
    }
    if (prediction.status && FAILED_STATUSES.has(prediction.status)) {
      throw new Error(
        `Atlas Cloud ${args.kind} generation ${prediction.status}${prediction.error ? `: ${prediction.error}` : ""}`,
      );
    }
    if (
      prediction.status &&
      !["pending", "queued", "processing", "running", "in_progress"].includes(prediction.status)
    ) {
      logger.debug("[atlas-cloud] continuing after unknown prediction status: %s", prediction.status);
    }
  }
}
