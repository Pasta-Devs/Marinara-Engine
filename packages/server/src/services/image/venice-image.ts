const VENICE_MAX_DIMENSION = 1280;
const VENICE_MAX_IMAGE_BYTES = 30 * 1024 * 1024;

const VENICE_ASPECT_RATIOS = [
  ["1:1", 1],
  ["16:9", 16 / 9],
  ["9:16", 9 / 16],
  ["4:3", 4 / 3],
  ["3:4", 3 / 4],
  ["3:2", 3 / 2],
  ["2:3", 2 / 3],
] as const;

type VeniceImageRequestInput = {
  model?: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
};

export type VeniceImageResult = {
  base64: string;
  mimeType: string;
  ext: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function veniceAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  return VENICE_ASPECT_RATIOS.reduce((best, candidate) =>
    Math.abs(candidate[1] - ratio) < Math.abs(best[1] - ratio) ? candidate : best,
  )[0];
}

function scaledVeniceDimensions(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, VENICE_MAX_DIMENSION / Math.max(width, height));
  const roundDimension = (value: number) => Math.max(8, Math.round((value * scale) / 8) * 8);
  return { width: roundDimension(width), height: roundDimension(height) };
}

function veniceResolution(width: number, height: number): "1K" | "2K" | "4K" {
  const largestDimension = Math.max(width, height);
  if (largestDimension >= 3072) return "4K";
  if (largestDimension >= 1536) return "2K";
  return "1K";
}

function isVeniceResolutionTierModel(model: string): boolean {
  return /^(?:gpt-image-2|nano-banana-(?:2|pro))(?:$|-)/i.test(model);
}

function isVeniceAspectRatioModel(model: string): boolean {
  return /^(?:qwen-image-2)(?:$|-)/i.test(model);
}

export function buildVeniceApiUrl(baseUrl: string, resource: "models" | "image/generate"): string {
  const parsed = new URL(baseUrl.replace(/\/+$/, ""));
  let path = parsed.pathname.replace(/\/+$/, "");
  path = path.replace(/\/(?:models|image\/generate)$/i, "");

  if (!path || path === "/") path = "/api/v1";
  else if (path === "/api") path = "/api/v1";

  parsed.pathname = `${path}/${resource}`.replace(/\/{2,}/g, "/");
  parsed.search = "";
  parsed.hash = "";
  if (resource === "models") parsed.searchParams.set("type", "image");
  return parsed.toString();
}

export function buildVeniceImageRequest(input: VeniceImageRequestInput): Record<string, unknown> {
  const model = input.model?.trim();
  if (!model) throw new Error("Venice image generation requires a model");

  const width = Number.isFinite(input.width) && Number(input.width) > 0 ? Number(input.width) : 1024;
  const height = Number.isFinite(input.height) && Number(input.height) > 0 ? Number(input.height) : 1024;
  const body: Record<string, unknown> = {
    model,
    prompt: input.prompt.trim(),
    format: "webp",
    return_binary: false,
    variants: 1,
  };

  if (input.negativePrompt?.trim()) body.negative_prompt = input.negativePrompt.trim();

  if (isVeniceResolutionTierModel(model)) {
    body.aspect_ratio = veniceAspectRatio(width, height);
    body.resolution = veniceResolution(width, height);
  } else if (isVeniceAspectRatioModel(model)) {
    body.aspect_ratio = veniceAspectRatio(width, height);
  } else {
    Object.assign(body, scaledVeniceDimensions(width, height));
  }

  return body;
}

function normalizeBase64(value: string): string {
  const compact = value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "").replace(/\s+/g, "");
  const unpadded = compact.replace(/=+$/, "");
  if (!unpadded || /[^A-Za-z0-9+/]/.test(unpadded) || unpadded.length % 4 === 1) {
    throw new Error("Venice returned invalid base64 image data");
  }
  return `${unpadded}${"=".repeat((4 - (unpadded.length % 4)) % 4)}`;
}

function detectImageType(buffer: Buffer): Pick<VeniceImageResult, "mimeType" | "ext"> | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: "image/png", ext: "png" };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", ext: "jpg" };
  }
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mimeType: "image/webp", ext: "webp" };
  }
  return null;
}

export function parseVeniceImageResponse(value: unknown): VeniceImageResult {
  const encoded = isRecord(value) && Array.isArray(value.images) ? value.images[0] : null;
  if (typeof encoded !== "string" || !encoded.trim()) {
    throw new Error("Venice response did not contain image data");
  }

  const buffer = Buffer.from(normalizeBase64(encoded), "base64");
  if (buffer.byteLength === 0 || buffer.byteLength > VENICE_MAX_IMAGE_BYTES) {
    throw new Error("Venice returned an empty or oversized image");
  }
  const type = detectImageType(buffer);
  if (!type) throw new Error("Venice returned data that was not a supported image");

  return { base64: buffer.toString("base64"), ...type };
}

export function normalizeVeniceImageModels(value: unknown): Array<{ id: string; name: string }> {
  if (!isRecord(value) || !Array.isArray(value.data)) return [];
  return value.data
    .map((entry) => {
      if (!isRecord(entry) || entry.type !== "image") return null;
      const id = typeof entry.id === "string" ? entry.id.trim() : "";
      const spec = isRecord(entry.model_spec) ? entry.model_spec : null;
      const name = spec && typeof spec.name === "string" ? spec.name.trim() : "";
      return id ? { id, name: name || id } : null;
    })
    .filter((model): model is { id: string; name: string } => Boolean(model));
}
