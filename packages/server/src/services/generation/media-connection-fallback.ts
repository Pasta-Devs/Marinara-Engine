import {
  inferImageSource,
  inferVideoSource,
  normalizeVideoGenerationProfile,
  VIDEO_DEFAULTS_STORAGE_KEY,
} from "@marinara-engine/shared";
import type { ImageGenRequest } from "../image/image-generation.js";
import { resolveConnectionImageDefaults } from "../image/image-generation-defaults.js";
import type { VideoGenerationRequest } from "../video/video-generation.js";
import { resolveBaseUrl } from "./connection-base-url.js";

type ImageFallbackStore = {
  getFallbackForImageGeneration(): Promise<any | null>;
};

type VideoFallbackStore = {
  getFallbackForVideoGeneration(): Promise<any | null>;
};

function resolveConnectionVideoComfyDefaults(connection: { defaultParameters?: unknown }) {
  let root = connection.defaultParameters;
  if (typeof root === "string") {
    try {
      root = JSON.parse(root) as unknown;
    } catch {
      return null;
    }
  }
  if (!root || typeof root !== "object" || Array.isArray(root)) return null;
  return normalizeVideoGenerationProfile((root as Record<string, unknown>)[VIDEO_DEFAULTS_STORAGE_KEY]).profile
    .comfyui;
}

export async function resolveImageConnectionFallback(
  connections: ImageFallbackStore,
  primaryConnectionId: string | null | undefined,
): Promise<NonNullable<ImageGenRequest["fallback"]> | undefined> {
  const connection = await connections.getFallbackForImageGeneration();
  if (!connection || connection.id === primaryConnectionId) return undefined;
  const baseUrl = resolveBaseUrl(connection);
  if (!baseUrl) return undefined;
  const model = String(connection.model ?? "").trim();
  const imageGenerationSource = String(connection.imageGenerationSource ?? "").trim();
  const imageService = String(connection.imageService ?? "").trim();
  const explicitSource = imageGenerationSource || imageService;
  const source = explicitSource || inferImageSource(model, baseUrl);
  return {
    connectionId: connection.id,
    connectionName: String(connection.name ?? "").trim() || connection.id,
    provider: String(connection.provider ?? "image_generation"),
    source: model || source,
    baseUrl,
    apiKey: connection.apiKey || "",
    serviceHint: String(connection.imageService ?? connection.imageGenerationSource ?? source),
    model,
    imageEndpointId: connection.imageEndpointId || undefined,
    comfyWorkflow: connection.comfyuiWorkflow || undefined,
    imageDefaults: resolveConnectionImageDefaults(connection),
    ...(imageGenerationSource ? { imageGenerationSource } : {}),
    ...(imageService ? { imageService } : {}),
  };
}

export async function resolveVideoConnectionFallback(
  connections: VideoFallbackStore,
  primaryConnectionId: string | null | undefined,
): Promise<NonNullable<VideoGenerationRequest["fallback"]> | undefined> {
  const connection = await connections.getFallbackForVideoGeneration();
  if (!connection || connection.id === primaryConnectionId) return undefined;
  const baseUrl = resolveBaseUrl(connection);
  if (!baseUrl) return undefined;
  const model = String(connection.model ?? "").trim();
  const explicitSource = String(connection.videoGenerationSource ?? connection.videoService ?? "").trim();
  const source = explicitSource || inferVideoSource(model, baseUrl);
  const comfyDefaults = resolveConnectionVideoComfyDefaults(connection);
  return {
    connectionId: connection.id,
    connectionName: String(connection.name ?? "").trim() || connection.id,
    source,
    baseUrl,
    apiKey: connection.apiKey || "",
    serviceHint: String(connection.videoService ?? connection.videoGenerationSource ?? source),
    model,
    comfyWorkflow: connection.comfyuiWorkflow || undefined,
    comfyLoras: comfyDefaults?.loras ?? [],
    fps: comfyDefaults?.fps,
  };
}
