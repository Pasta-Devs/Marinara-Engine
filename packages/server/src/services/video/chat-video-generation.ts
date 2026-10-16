import {
  VIDEO_GENERATION_SETTINGS_KEY,
  normalizeVideoGenerationUserSettings,
  type GeneratedSceneVideo,
  type VideoReferenceImage,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { resolveVideoConnectionFallback } from "../generation/media-connection-fallback.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createGameSceneVideosStorage } from "../storage/game-scene-videos.storage.js";
import { getSharp } from "../../utils/sharp.js";
import { resolveSceneVideoConnectionId, serializeSceneVideo } from "./chat-video-messages.js";
import { resolveGameVideoRuntime } from "./game-video-runtime.js";
import { generateVideo, removeSavedVideoFromDisk, saveVideoToDisk } from "./video-generation.js";

/** A problem the user can fix (missing connection, unusable picture); `statusCode` suits an HTTP reply. */
export class ChatVideoError extends Error {
  constructor(
    readonly statusCode: 400 | 404 | 502,
    message: string,
  ) {
    super(message);
    this.name = "ChatVideoError";
  }
}

export type ChatVideoSetup = Awaited<ReturnType<typeof resolveChatVideoSetup>>;

/** The chat's video connection with its runtime, clip length and aspect ratio. */
export async function resolveChatVideoSetup(db: DB, chatMeta: Record<string, unknown>) {
  const connections = createConnectionsStorage(db);
  const videoConnectionId = await resolveSceneVideoConnectionId(chatMeta, connections);
  if (!videoConnectionId) {
    throw new ChatVideoError(400, "Choose a video connection in Chat Settings before making a video.");
  }
  const videoConn = await connections.getWithKey(videoConnectionId);
  if (!videoConn) throw new ChatVideoError(404, "Video generation connection not found");
  if (videoConn.provider !== "video_generation") {
    throw new ChatVideoError(400, "The selected connection is not a video generation connection.");
  }
  const runtime = resolveGameVideoRuntime(videoConn);
  const videoSettings = normalizeVideoGenerationUserSettings(
    await createAppSettingsStorage(db).get(VIDEO_GENERATION_SETTINGS_KEY),
  );
  const durationSeconds = Math.min(
    runtime.maxDurationSeconds,
    Math.max(
      runtime.minDurationSeconds,
      Math.trunc(
        runtime.hasStoredDefaults ? runtime.activeDefaults.durationSeconds : videoSettings.sceneVideoDurationSeconds,
      ),
    ),
  );
  return { videoConnectionId, videoConn, runtime, durationSeconds, aspectRatio: runtime.activeDefaults.aspectRatio };
}

/** Generate the clip, save it to disk and the chat's scene videos, and return it. */
export async function generateAndSaveChatVideo(
  db: DB,
  setup: Pick<ChatVideoSetup, "videoConnectionId" | "runtime" | "durationSeconds" | "aspectRatio">,
  args: {
    chatId: string;
    prompt: string;
    referenceImage?: VideoReferenceImage;
    sourceTag: string | null;
    sourcePath: string | null;
    /** The characters the clip shows, for their galleries; omit to leave it in every chat character's. */
    characterIds?: string[];
    queue?: boolean;
    signal?: AbortSignal;
    debugMode?: boolean;
  },
): Promise<GeneratedSceneVideo> {
  const { runtime, videoConnectionId, durationSeconds, aspectRatio } = setup;
  let savedFilePath: string | null = null;
  try {
    const generated = await generateVideo(runtime.source, runtime.baseUrl, runtime.apiKey, runtime.serviceHint, {
      prompt: args.prompt,
      model: runtime.model,
      durationSeconds,
      aspectRatio,
      resolution: runtime.resolution,
      comfyWorkflow: runtime.comfyWorkflow,
      comfyLoras: runtime.comfyLoras,
      fps: runtime.comfyFps,
      atlasModelOptions: runtime.atlasModelOptions,
      referenceImage: args.referenceImage,
      publicReferenceUpload: runtime.publicReferenceUpload,
      queue: args.queue,
      connectionKey: videoConnectionId,
      signal: args.signal,
      debugMode: args.debugMode,
      fallback: await resolveVideoConnectionFallback(createConnectionsStorage(db), videoConnectionId),
    });
    savedFilePath = await saveVideoToDisk(args.chatId, generated.base64);
    const row = await createGameSceneVideosStorage(db).create({
      chatId: args.chatId,
      filePath: savedFilePath,
      sourceIllustrationTag: args.sourceTag,
      sourceIllustrationPath: args.sourcePath,
      prompt: args.prompt,
      provider: runtime.source,
      model: runtime.model,
      durationSeconds,
      aspectRatio,
      characterIds: args.characterIds,
    });
    if (!row) throw new Error("Video metadata could not be saved");
    savedFilePath = null;
    await createChatsStorage(db).patchMetadata(args.chatId, () => ({ sceneLastVideoId: row.id }));
    logger.info("[chat-video] saved video %s for chat %s", row.id, args.chatId);
    return serializeSceneVideo(row);
  } finally {
    if (savedFilePath) {
      await removeSavedVideoFromDisk(savedFilePath).catch((err) => {
        logger.warn(err, "[chat-video] Failed to clean up orphaned video file %s", savedFilePath);
      });
    }
  }
}

/**
 * A picture as a video first frame. Video backends take PNG or JPEG, told apart by their first bytes; anything else
 * an image provider returns (WebP from Venice, AVIF, ...) is converted to PNG with sharp. Throws a ChatVideoError
 * when the picture can't be read or sharp is unavailable.
 */
export async function toVideoReferenceImage(base64: string, url?: string | null): Promise<VideoReferenceImage> {
  const raw = base64.replace(/^data:[^,]+,/u, "");
  const head = Buffer.from(raw.slice(0, 16), "base64");
  const withUrl = url ? { url } : {};
  if (head[0] === 0x89 && head.subarray(1, 4).toString("ascii") === "PNG") {
    return { base64: raw, mimeType: "image/png", ...withUrl };
  }
  if (head[0] === 0xff && head[1] === 0xd8) return { base64: raw, mimeType: "image/jpeg", ...withUrl };
  const sharp = await getSharp();
  if (!sharp) {
    throw new ChatVideoError(
      400,
      "This picture needs converting to PNG for video, but image processing is unavailable.",
    );
  }
  try {
    const png = await sharp(Buffer.from(raw, "base64")).png().toBuffer();
    // A converted copy has no public link of its own, so a provider that fetches by URL gets the PNG data instead.
    return { base64: png.toString("base64"), mimeType: "image/png" };
  } catch {
    throw new ChatVideoError(400, "This picture can't be read as a video first frame.");
  }
}
