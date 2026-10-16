import type { GameSceneVideoAspectRatio, GeneratedSceneVideo, MessageAttachment } from "@marinara-engine/shared";
import { parseExtra } from "../generation/prompt-attachments.js";
import type { createGameSceneVideosStorage } from "../storage/game-scene-videos.storage.js";

type SceneVideoRow = NonNullable<Awaited<ReturnType<ReturnType<typeof createGameSceneVideosStorage>["getById"]>>>;

function sceneVideoUrl(chatId: string, filePath: string): string {
  const filename = filePath.split(/[\\/]/).pop() ?? "";
  return `/api/gallery/scene-videos/file/${encodeURIComponent(chatId)}/${encodeURIComponent(filename)}`;
}

export function serializeSceneVideo(row: SceneVideoRow): GeneratedSceneVideo {
  const aspectRatio: GameSceneVideoAspectRatio = row.aspectRatio === "9:16" ? "9:16" : "16:9";
  return {
    id: row.id,
    chatId: row.chatId,
    filePath: row.filePath,
    url: sceneVideoUrl(row.chatId, row.filePath),
    sourceIllustrationTag: row.sourceIllustrationTag ?? null,
    sourceIllustrationPath: row.sourceIllustrationPath ?? null,
    prompt: row.prompt,
    provider: row.provider,
    model: row.model,
    durationSeconds: row.durationSeconds,
    aspectRatio,
    createdAt: row.createdAt,
  };
}

/** The chat's scene-video connection, else the game video connection, else the default video connection. */
export async function resolveSceneVideoConnectionId(
  meta: Record<string, unknown>,
  connections: { getDefaultForVideoGeneration(): Promise<{ id: string } | null> },
): Promise<string | null> {
  for (const key of ["sceneVideoConnectionId", "gameVideoConnectionId"] as const) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return (await connections.getDefaultForVideoGeneration())?.id ?? null;
}

export interface ChatVideoAnchor {
  messageId: string;
  swipeIndex: number;
}

/**
 * The message a generated video belongs under: the newest reply the user can see (on its shown swipe), whichever
 * reply its picture came from. Hidden command-only replies are skipped, as the chat skips them. Null when the
 * chat has no visible reply yet; the video then lives only in the gallery.
 */
export function resolveChatVideoAnchor(
  messages: ReadonlyArray<{ id: string; role?: string | null; activeSwipeIndex?: number | null; extra?: unknown }>,
): ChatVideoAnchor | null {
  const latest = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && parseExtra(message.extra).hiddenFromUser !== true);
  return latest ? { messageId: latest.id, swipeIndex: latest.activeSwipeIndex ?? 0 } : null;
}

/** A video attachment; a Conversation video message names the character who sent it. */
export function buildChatVideoAttachment(video: GeneratedSceneVideo, characterName?: string): MessageAttachment {
  return {
    type: "video",
    url: video.url,
    filename: video.filePath.split(/[\\/]/).pop() ?? "video.mp4",
    prompt: video.prompt,
    videoId: video.id,
    durationSeconds: video.durationSeconds,
    aspectRatio: video.aspectRatio,
    ...(characterName ? { characterName } : {}),
  };
}

/** Put the video on its swipe, and on the message too while that swipe is still the one shown. */
export async function attachVideoToMessage(
  chats: {
    appendSwipeAttachment(messageId: string, swipeIndex: number, attachment: Record<string, unknown>): Promise<boolean>;
    appendMessageAttachmentForActiveSwipe(
      messageId: string,
      swipeIndex: number,
      attachment: Record<string, unknown>,
    ): Promise<unknown>;
  },
  anchor: ChatVideoAnchor,
  attachment: MessageAttachment,
): Promise<boolean> {
  const record = attachment as unknown as Record<string, unknown>;
  // The swipe row is the lasting record; the message row only mirrors it while that swipe is shown.
  if (!(await chats.appendSwipeAttachment(anchor.messageId, anchor.swipeIndex, record))) return false;
  await chats.appendMessageAttachmentForActiveSwipe(anchor.messageId, anchor.swipeIndex, record);
  return true;
}
