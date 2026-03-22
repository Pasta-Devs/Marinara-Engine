// ──────────────────────────────────────────────
// Service: Image Generation
// ──────────────────────────────────────────────
// Calls image generation APIs (OpenAI DALL-E, Pollinations, Stability, etc.)
// based on a user's configured image_generation connection.

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { DATA_DIR } from "../../utils/data-dir.js";
import { newId } from "../../utils/id-generator.js";
import { inferImageSource } from "@marinara-engine/shared";

const GALLERY_DIR = join(DATA_DIR, "gallery");

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
  negativePrompt?: string;
  width?: number;
  height?: number;
  model?: string;
}

export interface ImageGenResult {
  /** Base64-encoded image data */
  base64: string;
  /** MIME type (e.g. "image/png") */
  mimeType: string;
  /** File extension without dot */
  ext: string;
}

/**
 * Generate an image using the configured image generation connection.
 * Returns the base64 data and metadata needed to save it.
 */
export async function generateImage(
  source: string,
  baseUrl: string,
  apiKey: string,
  request: ImageGenRequest,
): Promise<ImageGenResult> {
  // Infer the source from model name / base URL if the source looks like a legacy service ID
  // or if the caller passes a model name as source
  const resolvedSource = inferImageSource(source, baseUrl);
  switch (resolvedSource) {
    case "openai":
      return generateOpenAI(baseUrl, apiKey, request);
    case "pollinations":
      return generatePollinations(request);
    case "stability":
      return generateStability(baseUrl, apiKey, request);
    case "togetherai":
      return generateTogetherAI(baseUrl, apiKey, request);
    case "novelai":
      return generateNovelAI(baseUrl, apiKey, request);
    default:
      // Fallback: try OpenAI-compatible endpoint
      return generateOpenAI(baseUrl, apiKey, request);
  }
}

/**
 * Save a generated image to the gallery directory on disk.
 * Returns the relative file path (chatId/filename).
 */
export function saveImageToDisk(chatId: string, base64: string, ext: string): string {
  const dir = join(GALLERY_DIR, chatId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filename = `${newId()}.${ext}`;
  const filePath = join(dir, filename);
  writeFileSync(filePath, Buffer.from(base64, "base64"));
  return `${chatId}/${filename}`;
}

// ── Provider Implementations ──

async function generateOpenAI(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  const url = `${baseUrl.replace(/\/+$/, "")}/images/generations`;
  const body: Record<string, unknown> = {
    prompt: request.prompt,
    n: 1,
    size: `${request.width ?? 1024}x${request.height ?? 1024}`,
    response_format: "b64_json",
  };
  if (request.model) body.model = request.model;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`OpenAI image generation failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const data = (await resp.json()) as { data: Array<{ b64_json: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data in OpenAI response");

  return { base64: b64, mimeType: "image/png", ext: "png" };
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
  const resp = await fetch(url);

  if (!resp.ok) {
    throw new Error(`Pollinations image generation failed (${resp.status})`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return { base64, mimeType: "image/jpeg", ext: "jpg" };
}

async function generateStability(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  const url = `${baseUrl.replace(/\/+$/, "")}/stable-image/generate/sd3`;
  const formData = new FormData();
  formData.append("prompt", request.prompt);
  if (request.negativePrompt) formData.append("negative_prompt", request.negativePrompt);
  formData.append("output_format", "png");

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "image/*",
    },
    body: formData,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`Stability image generation failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return { base64, mimeType: "image/png", ext: "png" };
}

async function generateTogetherAI(baseUrl: string, apiKey: string, request: ImageGenRequest): Promise<ImageGenResult> {
  const url = `${baseUrl.replace(/\/+$/, "")}/images/generations`;
  const body: Record<string, unknown> = {
    prompt: request.prompt,
    model: request.model || "black-forest-labs/FLUX.1-schnell-Free",
    n: 1,
    width: request.width ?? 1024,
    height: request.height ?? 1024,
    response_format: "b64_json",
  };
  if (request.negativePrompt) body.negative_prompt = request.negativePrompt;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`Together AI image generation failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const data = (await resp.json()) as { data: Array<{ b64_json: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data in Together AI response");

  return { base64: b64, mimeType: "image/png", ext: "png" };
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
  const body: Record<string, unknown> = {
    input: request.prompt,
    model: request.model || "nai-diffusion-4-5-full",
    action: "generate",
    parameters: {
      width: request.width ?? 832,
      height: request.height ?? 1216,
      n_samples: 1,
      ucPreset: 0,
      negative_prompt: request.negativePrompt ?? "",
      seed: Math.floor(Math.random() * 2 ** 32),
      cfg_scale: 5,
      steps: 28,
      sampler: "k_euler_ancestral",
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`NovelAI image generation failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  // NovelAI returns a zip file containing the image
  const arrayBuffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Check if response is a zip (PK signature) — extract the first file
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    // Simple zip extraction: find the first local file header and extract
    const localHeaderEnd = 30;
    const fnLen = bytes[26]! | (bytes[27]! << 8);
    const extraLen = bytes[28]! | (bytes[29]! << 8);
    const dataStart = localHeaderEnd + fnLen + extraLen;
    const compressedSize = bytes[18]! | (bytes[19]! << 8) | (bytes[20]! << 16) | (bytes[21]! << 24);
    const compressionMethod = bytes[8]! | (bytes[9]! << 8);

    if (compressionMethod === 0) {
      // Stored (no compression)
      const imageData = bytes.slice(dataStart, dataStart + compressedSize);
      const base64 = Buffer.from(imageData).toString("base64");
      return { base64, mimeType: "image/png", ext: "png" };
    }

    // Compressed — use DecompressionStream (available in Node 18+)
    const compressedData = bytes.slice(dataStart, dataStart + compressedSize);
    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    writer.write(compressedData);
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const decompressed = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      decompressed.set(c, offset);
      offset += c.length;
    }
    const base64 = Buffer.from(decompressed).toString("base64");
    return { base64, mimeType: "image/png", ext: "png" };
  }

  // Check if it's a PNG directly
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const base64 = Buffer.from(bytes).toString("base64");
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
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model || "nai-diffusion-4-5-full",
      messages: [{ role: "user", content: request.prompt }],
      stream: false,
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "Unknown error");
    throw new Error(`Image generation via chat completions failed (${resp.status}): ${sanitizeErrorText(errText)}`);
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";

  // Extract image URL from markdown: ![...](url) or plain https:// URL
  const mdMatch = content.match(/!\[[^\]]*\]\(([^)]+)\)/);
  const imageUrl = mdMatch?.[1] ?? content.match(/https?:\/\/\S+\.(png|jpg|jpeg|webp)/i)?.[0];

  if (!imageUrl) {
    throw new Error(`No image URL found in proxy response: ${content.slice(0, 200)}`);
  }

  // Download the image
  const imgResp = await fetch(imageUrl);
  if (!imgResp.ok) {
    throw new Error(`Failed to download generated image (${imgResp.status})`);
  }

  const arrayBuffer = await imgResp.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  // Detect mime type from URL extension or content-type header
  const contentType = imgResp.headers.get("content-type") ?? "";
  let mimeType = "image/png";
  let ext = "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg") || imageUrl.match(/\.jpe?g/i)) {
    mimeType = "image/jpeg";
    ext = "jpg";
  } else if (contentType.includes("webp") || imageUrl.match(/\.webp/i)) {
    mimeType = "image/webp";
    ext = "webp";
  }

  return { base64, mimeType, ext };
}
