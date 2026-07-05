import { desc, eq } from "drizzle-orm";
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

    async getById(id: string) {
      const rows = await db.select().from(gameSceneVideos).where(eq(gameSceneVideos.id, id));
      return rows[0] ?? null;
    },

    async remove(id: string) {
      await db.delete(gameSceneVideos).where(eq(gameSceneVideos.id, id));
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
        createdAt,
      });
      return this.getById(id);
    },

    async removeByChatId(chatId: string) {
      await db.delete(gameSceneVideos).where(eq(gameSceneVideos.chatId, chatId));
    },
  };
}
