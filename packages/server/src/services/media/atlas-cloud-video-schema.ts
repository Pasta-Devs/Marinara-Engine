import { safeFetch } from "../../utils/security.js";
import { logger } from "../../lib/logger.js";
import { getSharp } from "../image/sharp-runtime.js";
import type { AtlasCloudModelLimits, AtlasCloudModelOptionField } from "@marinara-engine/shared";

/**
 * Atlas Cloud publishes one OpenAPI document per model. Its `Input` schema is the only
 * authoritative list of the fields a model accepts, so video requests are shaped from it
 * instead of assuming every model takes the same body.
 */
export interface AtlasCloudSchemaProperty {
  type: string | null;
  enum: Array<string | number> | null;
  minimum: number | null;
  maximum: number | null;
  default: unknown;
  description: string | null;
}

export interface AtlasCloudModelInputSchema {
  required: string[];
  properties: Record<string, AtlasCloudSchemaProperty>;
}

export interface AtlasCloudVideoRequestInput {
  model: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16";
  resolution?: "480p" | "720p" | "1080p";
  referenceImageDataUrl?: string;
  /** Model-specific inputs the user set on the connection; anything the model does not declare is ignored. */
  modelOptions?: Record<string, unknown>;
}

export interface AdaptedAtlasCloudVideoRequest {
  body: Record<string, unknown>;
  /** Human-readable notes for every value that was renamed, snapped, or dropped to fit the model. */
  adjustments: string[];
  /** True when a source illustration was supplied but the model has no field that accepts one. */
  referenceImageDropped: boolean;
}

const ATLAS_CLOUD_SCHEMA_BASE_URL = "https://static.atlascloud.ai/model/schema";
const ATLAS_CLOUD_SCHEMA_RESPONSE_LIMIT_BYTES = 1024 * 1024;
const ATLAS_CLOUD_SCHEMA_TIMEOUT_MS = 15_000;
const ATLAS_CLOUD_SCHEMA_TTL_MS = 6 * 60 * 60 * 1000;
const ATLAS_CLOUD_SCHEMA_MISS_TTL_MS = 10 * 60 * 1000;
/** The editor endpoint accepts any well-formed model ID, so the cache is bounded. */
const ATLAS_CLOUD_SCHEMA_CACHE_MAX_ENTRIES = 200;
const ATLAS_CLOUD_MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)+$/i;
/** Schema keys that carry the first-frame or reference image, in the order Marinara prefers them. */
const ATLAS_CLOUD_STRING_IMAGE_KEYS = ["image", "image_url"] as const;
const ATLAS_CLOUD_ARRAY_IMAGE_KEYS = ["images", "reference_images"] as const;

/** Inputs Marinara fills from the prompt, the source illustration, and the common connection defaults. */
const ATLAS_CLOUD_MANAGED_KEYS: ReadonlySet<string> = new Set([
  "model",
  "prompt",
  "duration",
  "resolution",
  "aspect_ratio",
  "ratio",
  "size",
  ...ATLAS_CLOUD_STRING_IMAGE_KEYS,
  ...ATLAS_CLOUD_ARRAY_IMAGE_KEYS,
]);

const schemaCache = new Map<string, { schema: AtlasCloudModelInputSchema | null; expiresAt: number }>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseAtlasCloudModelSchema(document: unknown): AtlasCloudModelInputSchema | null {
  if (!isRecord(document)) return null;
  const components = isRecord(document.components) ? document.components : null;
  const schemas = components && isRecord(components.schemas) ? components.schemas : null;
  const input = schemas && isRecord(schemas.Input) ? schemas.Input : isRecord(document.properties) ? document : null;
  if (!input || !isRecord(input.properties)) return null;
  const properties: Record<string, AtlasCloudSchemaProperty> = {};
  for (const [name, rawProperty] of Object.entries(input.properties)) {
    if (!isRecord(rawProperty)) continue;
    const rawEnum = Array.isArray(rawProperty.enum)
      ? rawProperty.enum.filter(
          (entry): entry is string | number => typeof entry === "string" || typeof entry === "number",
        )
      : [];
    properties[name] = {
      type: typeof rawProperty.type === "string" ? rawProperty.type : null,
      enum: rawEnum.length > 0 ? rawEnum : null,
      minimum: readFiniteNumber(rawProperty.minimum),
      maximum: readFiniteNumber(rawProperty.maximum),
      default: rawProperty.default,
      description:
        typeof rawProperty.description === "string" && rawProperty.description.trim()
          ? rawProperty.description.trim().slice(0, 600)
          : null,
    };
  }
  if (Object.keys(properties).length === 0) return null;
  return {
    required: Array.isArray(input.required)
      ? input.required.filter((entry): entry is string => typeof entry === "string")
      : [],
    properties,
  };
}

export function buildAtlasCloudModelSchemaUrl(model: string): string | null {
  const trimmed = model.trim();
  if (!ATLAS_CLOUD_MODEL_ID_PATTERN.test(trimmed) || trimmed.includes("..")) return null;
  return `${ATLAS_CLOUD_SCHEMA_BASE_URL}/${encodeURIComponent(trimmed.replaceAll("/", "-"))}.json`;
}

/** Returns null when the model has no published schema or it cannot be read; callers keep the generic body. */
export async function fetchAtlasCloudModelSchema(
  model: string,
  signal?: AbortSignal,
): Promise<AtlasCloudModelInputSchema | null> {
  const url = buildAtlasCloudModelSchemaUrl(model);
  if (!url) return null;
  const cached = schemaCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.schema;

  let schema: AtlasCloudModelInputSchema | null = null;
  try {
    const timeout = AbortSignal.timeout(ATLAS_CLOUD_SCHEMA_TIMEOUT_MS);
    const response = await safeFetch(url, {
      method: "GET",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      policy: { allowLocal: false, allowLoopback: false, allowMdns: false, allowedProtocols: ["https:"] },
      maxResponseBytes: ATLAS_CLOUD_SCHEMA_RESPONSE_LIMIT_BYTES,
      decodeCompressedResponse: true,
    });
    if (response.ok) {
      schema = parseAtlasCloudModelSchema(JSON.parse(await response.text()) as unknown);
    } else {
      logger.debug("[atlas-cloud] no published schema for %s (%d)", model, response.status);
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    logger.warn(error, "[atlas-cloud] could not read the published schema for %s; using the generic request", model);
  }
  // Re-inserting moves the entry to the end, so the first key is always the least recently fetched.
  schemaCache.delete(url);
  while (schemaCache.size >= ATLAS_CLOUD_SCHEMA_CACHE_MAX_ENTRIES) {
    const oldest = schemaCache.keys().next().value;
    if (oldest === undefined) break;
    schemaCache.delete(oldest);
  }
  schemaCache.set(url, {
    schema,
    expiresAt: Date.now() + (schema ? ATLAS_CLOUD_SCHEMA_TTL_MS : ATLAS_CLOUD_SCHEMA_MISS_TTL_MS),
  });
  return schema;
}

/** True when the model cannot run without a first-frame or reference image. */
export function atlasCloudSchemaRequiresImage(schema: AtlasCloudModelInputSchema): boolean {
  return [...ATLAS_CLOUD_STRING_IMAGE_KEYS, ...ATLAS_CLOUD_ARRAY_IMAGE_KEYS].some((key) =>
    schema.required.includes(key),
  );
}

function snapDuration(requested: number, property: AtlasCloudSchemaProperty): number {
  const allowed = (property.enum ?? [])
    .map((entry) => (typeof entry === "number" ? entry : Number(entry)))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
  if (allowed.length > 0) {
    return allowed.reduce((best, candidate) => {
      const delta = Math.abs(candidate - requested) - Math.abs(best - requested);
      return delta < 0 || (delta === 0 && candidate < best) ? candidate : best;
    });
  }
  const minimum = property.minimum ?? 1;
  const maximum = property.maximum ?? Number.POSITIVE_INFINITY;
  return Math.min(maximum, Math.max(minimum, requested));
}

function resolutionHeight(value: string): number | null {
  const match = /^(\d{3,4})p$/i.exec(value.trim());
  return match ? Number(match[1]) : null;
}

/** Picks the model's own spelling of the requested resolution, or its nearest plain `<height>p` tier. */
function snapResolution(requested: string, property: AtlasCloudSchemaProperty): string | null {
  const allowed = (property.enum ?? []).filter((entry): entry is string => typeof entry === "string");
  if (allowed.length === 0) return requested;
  const exact = allowed.find((entry) => entry.toLowerCase() === requested.toLowerCase());
  if (exact) return exact;
  const requestedHeight = resolutionHeight(requested);
  if (requestedHeight === null) return null;
  let best: { value: string; distance: number } | null = null;
  for (const entry of allowed) {
    const height = resolutionHeight(entry);
    if (height === null) continue;
    const distance = Math.abs(height - requestedHeight);
    if (!best || distance < best.distance) best = { value: entry, distance };
  }
  return best?.value ?? null;
}

/** Chooses a `width*height` entry by orientation first, then aspect ratio, then the requested height tier. */
function snapSize(aspectRatio: "16:9" | "9:16", resolution: string, property: AtlasCloudSchemaProperty): string | null {
  const targetRatio = aspectRatio === "16:9" ? 16 / 9 : 9 / 16;
  const targetShortSide = resolutionHeight(resolution) ?? 720;
  let best: { value: string; score: number } | null = null;
  for (const entry of property.enum ?? []) {
    if (typeof entry !== "string") continue;
    const match = /^(\d+)\s*[*x]\s*(\d+)$/i.exec(entry.trim());
    if (!match) continue;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) continue;
    const orientationPenalty = width >= height === targetRatio >= 1 ? 0 : 100;
    const ratioPenalty = Math.abs(Math.log(width / height / targetRatio)) * 10;
    const sizePenalty = Math.abs(Math.log(Math.min(width, height) / targetShortSide));
    const score = orientationPenalty + ratioPenalty + sizePenalty;
    if (!best || score < best.score) best = { value: entry, score };
  }
  return best?.value ?? null;
}

function isManagedKey(name: string, schema: AtlasCloudModelInputSchema): boolean {
  // `quality` only stands in for resolution on models that have no `resolution` field.
  if (name === "quality") return !schema.properties.resolution && !!schema.properties.quality?.enum;
  return ATLAS_CLOUD_MANAGED_KEYS.has(name);
}

function describeModelOptionProblem(
  name: string,
  value: unknown,
  schema: AtlasCloudModelInputSchema,
  body: Record<string, unknown>,
): string | null {
  const property = schema.properties[name];
  if (!property) return "the model has no such input";
  if (isManagedKey(name, schema) || name in body) return "Marinara sets this input itself";
  if (property.enum && !property.enum.includes(value as string | number)) return "not one of the model's choices";
  if (property.type === "boolean" && typeof value !== "boolean") return "expected true or false";
  if (property.type === "string" && typeof value !== "string") return "expected text";
  if (property.type === "array" && !Array.isArray(value)) return "expected a list";
  if (property.type === "number" || property.type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value)) return "expected a number";
    if (property.type === "integer" && !Number.isInteger(value)) return "expected a whole number";
    if (property.minimum !== null && value < property.minimum) return `below the minimum of ${property.minimum}`;
    if (property.maximum !== null && value > property.maximum) return `above the maximum of ${property.maximum}`;
  }
  return null;
}

/** The model's inputs that Marinara does not fill itself, in schema order, for the connection editor. */
export function listAtlasCloudModelOptionFields(schema: AtlasCloudModelInputSchema): AtlasCloudModelOptionField[] {
  const fields: AtlasCloudModelOptionField[] = [];
  for (const [name, property] of Object.entries(schema.properties)) {
    if (isManagedKey(name, schema)) continue;
    const type =
      property.type === "boolean" || property.type === "number" || property.type === "integer"
        ? property.type
        : property.type === "string" || (property.type === null && property.enum)
          ? "string"
          : "json";
    fields.push({
      name,
      type,
      enum: property.enum,
      minimum: property.minimum,
      maximum: property.maximum,
      default: property.default,
      description: property.description,
      required: schema.required.includes(name),
    });
  }
  return fields;
}

export function describeAtlasCloudModelLimits(schema: AtlasCloudModelInputSchema): AtlasCloudModelLimits {
  const { properties } = schema;
  const strings = (property: AtlasCloudSchemaProperty | undefined) =>
    property?.enum ? property.enum.filter((entry): entry is string => typeof entry === "string") : null;
  const durations = (properties.duration?.enum ?? [])
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
  const resolutionProperty = properties.resolution ?? (properties.quality?.enum ? properties.quality : undefined);
  const acceptsReferenceImage = [...ATLAS_CLOUD_STRING_IMAGE_KEYS, ...ATLAS_CLOUD_ARRAY_IMAGE_KEYS].some(
    (key) => properties[key],
  );
  return {
    durations: durations.length > 0 ? durations : null,
    minDurationSeconds: durations.length > 0 ? null : (properties.duration?.minimum ?? null),
    maxDurationSeconds: durations.length > 0 ? null : (properties.duration?.maximum ?? null),
    resolutions: strings(resolutionProperty),
    sizes: strings(properties.size),
    aspectRatios: strings(properties.aspect_ratio ?? properties.ratio),
    acceptsReferenceImage,
    requiresReferenceImage: atlasCloudSchemaRequiresImage(schema),
  };
}

/**
 * Shapes Marinara's common scene-video controls into the body one Atlas Cloud model accepts.
 * Fields the model does not declare are left out so the provider's own defaults apply.
 */
export function adaptAtlasCloudVideoRequest(
  input: AtlasCloudVideoRequestInput,
  schema: AtlasCloudModelInputSchema,
): AdaptedAtlasCloudVideoRequest {
  const model = input.model.trim();
  if (!model) throw new Error("Atlas Cloud video generation requires a model");
  const { properties } = schema;
  const adjustments: string[] = [];
  let referenceImageDropped = false;
  const body: Record<string, unknown> = { model };
  const prompt = input.prompt.trim();
  const requestedResolution = input.resolution ?? "720p";

  if (properties.prompt?.type === "array") {
    body.prompt = [prompt];
    adjustments.push("prompt sent as a one-segment list");
  } else if (properties.prompt) {
    body.prompt = prompt;
  } else {
    adjustments.push("model has no prompt field; the prompt was not sent");
  }

  if (properties.duration) {
    const requested = Math.max(1, Math.trunc(input.durationSeconds));
    const duration = snapDuration(requested, properties.duration);
    if (duration !== requested) adjustments.push(`duration ${requested}s changed to ${duration}s`);
    body.duration = properties.duration.type === "string" ? String(duration) : duration;
  } else {
    adjustments.push("model has no duration field; its own clip length applies");
  }

  const resolutionKey = properties.resolution ? "resolution" : properties.quality?.enum ? "quality" : null;
  if (resolutionKey) {
    const resolution = snapResolution(requestedResolution, properties[resolutionKey]!);
    if (resolution === null) {
      adjustments.push(`${requestedResolution} is not offered; the model default resolution applies`);
    } else {
      if (resolution.toLowerCase() !== requestedResolution.toLowerCase()) {
        adjustments.push(`resolution ${requestedResolution} changed to ${resolution}`);
      }
      body[resolutionKey] = resolution;
    }
  }

  const aspectKey = properties.aspect_ratio ? "aspect_ratio" : properties.ratio ? "ratio" : null;
  if (aspectKey) {
    const allowed = properties[aspectKey]!.enum;
    if (!allowed || allowed.includes(input.aspectRatio)) body[aspectKey] = input.aspectRatio;
    else adjustments.push(`aspect ratio ${input.aspectRatio} is not offered; the model default applies`);
  }

  if (properties.size?.enum) {
    const size = snapSize(input.aspectRatio, requestedResolution, properties.size);
    if (size) {
      body.size = size;
      adjustments.push(`${input.aspectRatio} at ${requestedResolution} sent as size ${size}`);
    }
  }

  if (input.referenceImageDataUrl) {
    const stringKey = ATLAS_CLOUD_STRING_IMAGE_KEYS.find((key) => properties[key]);
    const arrayKey = ATLAS_CLOUD_ARRAY_IMAGE_KEYS.find((key) => properties[key]);
    if (stringKey) {
      body[stringKey] = input.referenceImageDataUrl;
    } else if (arrayKey) {
      body[arrayKey] = [input.referenceImageDataUrl];
    } else {
      referenceImageDropped = true;
      adjustments.push("model does not accept a reference image; the source illustration was not sent");
    }
  }

  for (const [name, value] of Object.entries(input.modelOptions ?? {})) {
    const problem = describeModelOptionProblem(name, value, schema, body);
    if (problem) adjustments.push(`option ${name} was not sent: ${problem}`);
    else body[name] = value;
  }

  return { body, adjustments, referenceImageDropped };
}

/**
 * Connection tests have no gallery image to animate. Image-to-video models still need a first frame,
 * so the test renders a plain gradient; text-to-video models keep the text-only request.
 */
export async function buildAtlasCloudTestReferenceImage(
  model: string,
  aspectRatio: "16:9" | "9:16",
  signal?: AbortSignal,
): Promise<{ base64: string; mimeType: "image/png" } | null> {
  const schema = await fetchAtlasCloudModelSchema(model, signal);
  if (!schema || !atlasCloudSchemaRequiresImage(schema)) return null;
  const [width, height] = aspectRatio === "16:9" ? [1280, 720] : [720, 1280];
  const gradient =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#f4c38a"/><stop offset="1" stop-color="#8a2f1f"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  try {
    const sharp = await getSharp();
    const png: Buffer = await sharp(Buffer.from(gradient)).png().toBuffer();
    return { base64: png.toString("base64"), mimeType: "image/png" };
  } catch (error) {
    logger.warn(error, "[atlas-cloud] could not render a test first frame for %s; sending a text-only test", model);
    return null;
  }
}
