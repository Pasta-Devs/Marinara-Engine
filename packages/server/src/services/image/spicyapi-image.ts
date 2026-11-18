import { isRecord } from "../../utils/large-json.js";
// SpicyAPI runs images as asynchronous tasks: POST /api/v1/jobs/createTask, then
// GET /api/v1/jobs/recordInfo until data.state is terminal. Each model declares its
// own input JSON Schema, so requests are fitted to the fields that model accepts.

const MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]*(?:\/[a-zA-Z0-9][a-zA-Z0-9._-]*)+$/;
const DEFAULT_ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
/** createTask limits from SpicyAPI's OpenAPI contract: per decoded inline image, and for the whole JSON body. */
export const SPICYAPI_MAX_INLINE_IMAGE_BYTES = 1024 * 1024;
const SPICYAPI_MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const INLINE_IMAGE_PREFIX = /^data:image\/(?:jpeg|png|webp|gif);base64,/i;

export interface SpicyApiTask {
  taskId: string | null;
  state: string | null;
  imageUrl: string | null;
  /** True while a result is still being stored, even after the task succeeded. */
  pending: boolean;
  error: string | null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function assertSpicyApiModelId(model: string): string {
  if (!MODEL_ID.test(model)) {
    throw new Error("SpicyAPI requires a model ID, such as alibaba/z-image-spicy-pro/text-to-image");
  }
  return model;
}

/** Accepts the origin, `/v1`, or `/api/v1` spelling of the API base URL. */
export function buildSpicyApiUrl(baseUrl: string, resource: string, query: Record<string, string> = {}): string {
  const parsed = new URL(baseUrl.trim().replace(/\/+$/, ""));
  const root = parsed.pathname.replace(/\/+$/, "").replace(/\/(?:api\/)?v1$/i, "");
  parsed.pathname = `${root}/api/v1/${resource}`.replace(/\/{2,}/g, "/");
  parsed.search = new URLSearchParams(query).toString();
  parsed.hash = "";
  return parsed.toString();
}

function parseDimensions(option: string): { ratio: number; area: number } | null {
  const match = /^(\d+(?:\.\d+)?)\s*[:x*×]\s*(\d+(?:\.\d+)?)$/i.exec(option.trim());
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return a > 0 && b > 0 ? { ratio: a / b, area: a * b } : null;
}

/** Closest declared shape by ratio, then by size; options like "auto" are ignored. */
function closestShape(options: unknown[], width: number, height: number): string | null {
  let best: { option: string; ratioGap: number; areaGap: number } | null = null;
  for (const option of options) {
    if (typeof option !== "string") continue;
    const parsed = parseDimensions(option);
    if (!parsed) continue;
    const ratioGap = Math.abs(Math.log(parsed.ratio / (width / height)));
    const areaGap = Math.abs(Math.log(parsed.area / (width * height)));
    if (
      !best ||
      ratioGap < best.ratioGap - 1e-9 ||
      (Math.abs(ratioGap - best.ratioGap) <= 1e-9 && areaGap < best.areaGap)
    ) {
      best = { option, ratioGap, areaGap };
    }
  }
  return best?.option ?? null;
}

function fitNumber(schema: Record<string, unknown>, value: number): number {
  const step = typeof schema.multipleOf === "number" && schema.multipleOf > 0 ? schema.multipleOf : 1;
  let fitted = Math.round(value / step) * step;
  if (typeof schema.minimum === "number") fitted = Math.max(fitted, Math.ceil(schema.minimum / step) * step);
  if (typeof schema.maximum === "number") fitted = Math.min(fitted, Math.floor(schema.maximum / step) * step);
  return fitted;
}

/**
 * Build `createTask.input` from the model's input schema: only fields the model declares are sent,
 * so a model that frames images by aspect ratio, by width and height, or by preset size each gets
 * the field it understands.
 */
export function buildSpicyApiImageInput(
  inputSchema: unknown,
  request: { prompt: string; negativePrompt?: string; width?: number; height?: number; referenceImages: string[] },
): Record<string, unknown> {
  const properties = isRecord(inputSchema) && isRecord(inputSchema.properties) ? inputSchema.properties : {};
  const field = (key: string) => (isRecord(properties[key]) ? properties[key] : null);
  const width = Number.isFinite(request.width) && Number(request.width) > 0 ? Number(request.width) : 1024;
  const height = Number.isFinite(request.height) && Number(request.height) > 0 ? Number(request.height) : 1024;
  const prompt = request.prompt.trim();
  const negativePrompt = request.negativePrompt?.trim();
  const input: Record<string, unknown> = {
    prompt: negativePrompt && !field("negative_prompt") ? `${prompt}\n\nDo not include: ${negativePrompt}.` : prompt,
  };
  if (negativePrompt && field("negative_prompt")) input.negative_prompt = negativePrompt;

  const aspectRatio = field("aspect_ratio");
  if (aspectRatio) {
    const shape = closestShape(
      Array.isArray(aspectRatio.enum) ? aspectRatio.enum : DEFAULT_ASPECT_RATIOS,
      width,
      height,
    );
    if (shape) input.aspect_ratio = shape;
  }
  const widthField = field("width");
  const heightField = field("height");
  if (widthField && heightField) {
    input.width = fitNumber(widthField, width);
    input.height = fitNumber(heightField, height);
  }
  const size = field("size");
  if (size && Array.isArray(size.enum)) {
    const shape = closestShape(size.enum, width, height);
    if (shape) input.size = shape;
  }

  if (request.referenceImages.length) {
    const imageUrls = field("image_urls");
    if (imageUrls) {
      const limit = typeof imageUrls.maxItems === "number" ? imageUrls.maxItems : request.referenceImages.length;
      input.image_urls = request.referenceImages.slice(0, limit);
    } else if (field("image_url")) {
      input.image_url = request.referenceImages[0];
    }
  }
  return input;
}

/** True when SpicyAPI takes this reference as it is: not inline, or an inline type and size it accepts. */
export function fitsSpicyApiInlineLimit(reference: string): boolean {
  if (!reference.startsWith("data:")) return true;
  const prefix = INLINE_IMAGE_PREFIX.exec(reference)?.[0];
  return !!prefix && Buffer.byteLength(reference.slice(prefix.length), "base64") <= SPICYAPI_MAX_INLINE_IMAGE_BYTES;
}

/** Drop trailing `image_urls` until the request fits SpicyAPI's body limit; returns how many were dropped. */
export function trimSpicyApiReferences(body: { input: Record<string, unknown> }): number {
  const references = body.input.image_urls;
  let dropped = 0;
  while (
    Array.isArray(references) &&
    references.length > 1 &&
    Buffer.byteLength(JSON.stringify(body), "utf8") > SPICYAPI_MAX_REQUEST_BYTES
  ) {
    references.pop();
    dropped++;
  }
  return dropped;
}

/** Read a task record or createTask reply from the `{code,msg,data,request_id}` envelope. */
export function parseSpicyApiTask(value: unknown): SpicyApiTask {
  const data = isRecord(value) && isRecord(value.data) ? value.data : {};
  const output = isRecord(data.output) ? data.output : {};
  const assets = Array.isArray(output.assets) ? output.assets : [];
  const ready = assets.find(
    (asset) => isRecord(asset) && readString(asset.url) && asset.pending !== true && asset.unavailable !== true,
  );
  const error = [readString(data.errorCode), readString(data.errorMessage)].filter(Boolean).join(": ");
  return {
    taskId: readString(data.taskId),
    state: readString(data.state)?.toLowerCase() ?? null,
    imageUrl: isRecord(ready) ? readString(ready.url) : null,
    pending: assets.some((asset) => isRecord(asset) && asset.pending === true),
    error: error ? error.slice(0, 500) : null,
  };
}

/** The envelope's human-readable `msg`, for error reports. */
export function readSpicyApiMessage(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? readString(parsed.msg) : null;
  } catch {
    return null;
  }
}

/** Text-to-image and edit models from `GET /api/v1/models?modality=image`. */
export function normalizeSpicyApiImageModels(value: unknown): Array<{ id: string; name: string }> {
  const data = isRecord(value) && isRecord(value.data) ? value.data : {};
  const items = Array.isArray(data.items) ? data.items : [];
  return items.flatMap((item) => {
    if (!isRecord(item) || item.enabled === false || item.available === false) return [];
    const id = readString(item.model);
    const task = Array.isArray(item.tasks) ? readString(item.tasks[0]) : null;
    if (!id || (task !== "text-to-image" && task !== "image-to-image")) return [];
    return [{ id, name: `${readString(item.displayName) ?? id} · ${task}` }];
  });
}
