import { realpath } from "node:fs/promises";
import { basename, join } from "node:path";
import { z } from "zod";
import type { CapabilityGalleryImageAnimationInput, VideoGenerationResult } from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import { logDebugOverride } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { resolveFlatMediaFile, validateImageAssetFile } from "../../utils/media-file-security.js";
import { assertInsideDir } from "../../utils/security.js";
import { resolveVideoConnectionFallback } from "../generation/media-connection-fallback.js";
import { withGlobalGalleryImageLifecycleLocks } from "../image/gallery-file-lifecycle.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createGlobalGalleryStorage } from "../storage/global-gallery.storage.js";
import { ChatVideoError, toVideoReferenceImage } from "../video/chat-video-generation.js";
import { resolveGameVideoRuntime } from "../video/game-video-runtime.js";
import { resolveSceneVideoPrompt } from "../video/scene-video-prompt-review.js";
import { generateVideo, resolveVideoRequestDuration } from "../video/video-generation.js";

const inputSchema = z.object({
  connectionId: z.string().trim().min(1).max(200),
  galleryImageId: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(1).max(20_000),
  durationSeconds: z.number().int().min(1).max(60).optional(),
  aspectRatio: z.enum(["16:9", "9:16"]).optional(),
  loop: z.boolean().default(false),
  debugMode: z.boolean().default(false),
  signal: z.instanceof(AbortSignal).optional(),
});
const globalGalleryRoot = join(DATA_DIR, "gallery", "global");
const maxImageBytes = 20 * 1024 * 1024;

/** Resolve host-owned credentials and artwork; packages receive only the generated MP4 bytes. */
export async function animateCapabilityGalleryImage(
  db: DB,
  value: CapabilityGalleryImageAnimationInput,
  generate: typeof generateVideo = generateVideo,
): Promise<VideoGenerationResult> {
  const input = inputSchema.parse(value);
  input.signal?.throwIfAborted();
  const connections = createConnectionsStorage(db);
  const connection = await connections.getWithKey(input.connectionId);
  if (!connection) throw new ChatVideoError(404, "Video generation connection not found");
  if (connection.provider !== "video_generation")
    throw new ChatVideoError(400, "The selected connection is not a video generation connection.");
  const runtime = resolveGameVideoRuntime(connection);
  const referenceImage = await withGlobalGalleryImageLifecycleLocks([input.galleryImageId], async () => {
    const image = await createGlobalGalleryStorage(db).getImageById(input.galleryImageId);
    const storedPath = image?.filePath.replace(/\\/gu, "/");
    const path = storedPath?.startsWith("global/")
      ? resolveFlatMediaFile(globalGalleryRoot, storedPath.slice("global/".length))
      : null;
    if (!path) throw new ChatVideoError(404, "Global Gallery image not found");
    let canonicalPath: string;
    try {
      canonicalPath = assertInsideDir(await realpath(globalGalleryRoot), await realpath(path));
    } catch {
      throw new ChatVideoError(404, "Global Gallery image not found");
    }
    const file = await validateImageAssetFile(canonicalPath);
    if (!file) throw new ChatVideoError(400, "The selected gallery image cannot be read.");
    try {
      if (file.size > maxImageBytes) throw new ChatVideoError(400, "The selected gallery image is too large.");
      input.signal?.throwIfAborted();
      const bytes = await file.handle.readFile();
      return await toVideoReferenceImage(
        bytes.toString("base64"),
        runtime.publicReferenceUpload?.enabled
          ? undefined
          : `/api/global-gallery/file/${encodeURIComponent(basename(path))}`,
      );
    } finally {
      await file.handle.close();
    }
  });
  input.signal?.throwIfAborted();
  const durationSeconds = resolveVideoRequestDuration(runtime.source, runtime.serviceHint, {
    durationSeconds: Math.min(
      runtime.maxDurationSeconds,
      Math.max(runtime.minDurationSeconds, input.durationSeconds ?? runtime.activeDefaults.durationSeconds),
    ),
    referenceImage,
    resolution: runtime.resolution,
  });
  const prompt = resolveSceneVideoPrompt({
    generatedPrompt: input.prompt,
    maxPromptLength: runtime.promptLimits.finalPrompt,
  });
  logDebugOverride(
    input.debugMode || isDebugAgentsEnabled(),
    "[debug/capability-gallery-animation] Prompt sent to video provider:\n%s",
    prompt,
  );
  return generate(runtime.source, runtime.baseUrl, runtime.apiKey, runtime.serviceHint, {
    prompt,
    model: runtime.model,
    durationSeconds,
    aspectRatio: input.aspectRatio ?? runtime.activeDefaults.aspectRatio,
    resolution: runtime.resolution,
    comfyWorkflow: runtime.comfyWorkflow,
    comfyLoras: runtime.comfyLoras,
    fps: runtime.comfyFps,
    atlasModelOptions: runtime.atlasModelOptions,
    publicReferenceUpload: runtime.publicReferenceUpload,
    referenceImage,
    ...(input.loop ? { lastFrameImage: referenceImage } : {}),
    queue: true,
    connectionKey: input.connectionId,
    signal: input.signal,
    debugMode: input.debugMode,
    fallback: await resolveVideoConnectionFallback(connections, input.connectionId),
  });
}
