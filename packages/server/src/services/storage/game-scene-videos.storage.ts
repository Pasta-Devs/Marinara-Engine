import { and, desc, eq } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { gameSceneVideos } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

export interface CreateGameSceneVideoInput {
  chatId: string;
  filePath: string;
  sourceIllustrationTag?: string | null;
  sourceIllustrationPath?: string | null;
  prompt: string;
  provider: string;
  model: string;
  durationSeconds: number;
  aspectRatio: string;
  /** Characters the video shows; omit to keep it in every chat character's gallery. */
  characterIds?: string[] | null;
}

/** The characters a video row was tagged with, or null for an untagged (older or non-Conversation) video. */
export function parseSceneVideoCharacterIds(value: unknown): string[] | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : null;
  } catch {
    return null;
  }
}

export function createGameSceneVideosStorage(db: DB) {
  return {
    async listByChatId(chatId: string) {
      return db
        .select()
        .from(gameSceneVideos)
        .where(eq(gameSceneVideos.chatId, chatId))
        .orderBy(desc(gameSceneVideos.createdAt));
    },

    async getById(id: string, chatId?: string) {
      const condition = chatId
        ? and(eq(gameSceneVideos.chatId, chatId), eq(gameSceneVideos.id, id))
        : eq(gameSceneVideos.id, id);
      const rows = await db.select().from(gameSceneVideos).where(condition);
      return rows[0] ?? null;
    },

    async remove(id: string, chatId?: string) {
      const condition = chatId
        ? and(eq(gameSceneVideos.chatId, chatId), eq(gameSceneVideos.id, id))
        : eq(gameSceneVideos.id, id);
      await db.delete(gameSceneVideos).where(condition);
    },

    async create(input: CreateGameSceneVideoInput) {
      const id = newId();
      const createdAt = now();
      await db.insert(gameSceneVideos).values({
        id,
        chatId: input.chatId,
        filePath: input.filePath,
        sourceIllustrationTag: input.sourceIllustrationTag ?? null,
        sourceIllustrationPath: input.sourceIllustrationPath ?? null,
        prompt: input.prompt,
        provider: input.provider,
        model: input.model,
        durationSeconds: input.durationSeconds,
        aspectRatio: input.aspectRatio,
        characterIds: input.characterIds?.length ? JSON.stringify(input.characterIds) : null,
        createdAt,
      });
      return this.getById(id, input.chatId);
    },

    async removeByChatId(chatId: string) {
      await db.delete(gameSceneVideos).where(eq(gameSceneVideos.chatId, chatId));
    },
  };
}
