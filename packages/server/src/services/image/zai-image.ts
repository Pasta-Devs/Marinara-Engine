const GLM_IMAGE_SIZES = [
  "1280x1280",
  "1568x1056",
  "1056x1568",
  "1472x1088",
  "1088x1472",
  "1728x960",
  "960x1728",
] as const;

const COGVIEW_IMAGE_SIZES = [
  "1024x1024",
  "768x1344",
  "864x1152",
  "1344x768",
  "1152x864",
  "1440x720",
  "720x1440",
] as const;

type ZaiImageRequestInput = {
  model?: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function buildZaiImageUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl.replace(/\/+$/, ""));
  if (parsed.pathname.includes("/api/coding/")) {
    throw new Error("Z.AI image generation requires the general API URL, not the GLM Coding Plan endpoint");
  }

  let path = parsed.pathname.replace(/\/+$/, "").replace(/\/images\/generations$/i, "");
  if (!path || path === "/") path = "/api/paas/v4";
  parsed.pathname = `${path}/images/generations`.replace(/\/{2,}/g, "/");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function resolveZaiImageSize(model: string, width?: number, height?: number): string {
  const sizes = model.toLowerCase().startsWith("cogview") ? COGVIEW_IMAGE_SIZES : GLM_IMAGE_SIZES;
  const requestedWidth = Number.isFinite(width) && Number(width) > 0 ? Number(width) : 1;
  const requestedHeight = Number.isFinite(height) && Number(height) > 0 ? Number(height) : 1;
  const requestedRatio = requestedWidth / requestedHeight;

  return sizes.reduce((closest, candidate) => {
    const [candidateWidth, candidateHeight] = candidate.split("x").map(Number);
    const [closestWidth, closestHeight] = closest.split("x").map(Number);
    return Math.abs(candidateWidth! / candidateHeight! - requestedRatio) <
      Math.abs(closestWidth! / closestHeight! - requestedRatio)
      ? candidate
      : closest;
  });
}

export function buildZaiImageRequest(input: ZaiImageRequestInput): Record<string, unknown> {
  const model = input.model?.trim() || "glm-image";
  const prompt = input.negativePrompt?.trim()
    ? `${input.prompt.trim()}\n\nDo not include: ${input.negativePrompt.trim()}.`
    : input.prompt.trim();
  return {
    model,
    prompt,
    size: resolveZaiImageSize(model, input.width, input.height),
  };
}

export function parseZaiImageUrl(value: unknown): string {
  const first = isRecord(value) && Array.isArray(value.data) ? value.data[0] : null;
  const url = isRecord(first) && typeof first.url === "string" ? first.url.trim() : "";
  if (!url) throw new Error("Z.AI response did not contain an image URL");
  return url;
}
