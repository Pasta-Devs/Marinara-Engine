// ──────────────────────────────────────────────
// Storage: Character Gallery Images
// ──────────────────────────────────────────────
import { and, desc, eq, gte, isNull, lte } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { characterImages } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

export interface CreateCharacterImageInput {
  characterId: string;
  sourceChatImageId?: string | null;
  filePath: string;
  prompt?: string;
  provider?: string;
  model?: string;
  width?: number;
  height?: number;
}

export interface LegacyCharacterImageCandidateInput {
  createdAfter: string;
  createdBefore: string;
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
}

export function createCharacterGalleryStorage(db: DB) {
  return {
    async listByCharacterId(characterId: string) {
      return db
        .select()
        .from(characterImages)
        .where(eq(characterImages.characterId, characterId))
        .orderBy(desc(characterImages.createdAt));
    },

    async listLegacyCandidates(input: LegacyCharacterImageCandidateInput) {
      return db
        .select()
        .from(characterImages)
        .where(
          and(
            isNull(characterImages.sourceChatImageId),
            gte(characterImages.createdAt, input.createdAfter),
            lte(characterImages.createdAt, input.createdBefore),
            eq(characterImages.prompt, input.prompt),
            eq(characterImages.provider, input.provider),
            eq(characterImages.model, input.model),
            input.width === null ? isNull(characterImages.width) : eq(characterImages.width, input.width),
            input.height === null ? isNull(characterImages.height) : eq(characterImages.height, input.height),
          ),
        )
        .orderBy(desc(characterImages.createdAt));
    },

    async listBySourceChatImageId(sourceChatImageId: string) {
      return db
        .select()
        .from(characterImages)
        .where(eq(characterImages.sourceChatImageId, sourceChatImageId))
        .orderBy(desc(characterImages.createdAt));
    },

    async getById(id: string) {
      const rows = await db.select().from(characterImages).where(eq(characterImages.id, id));
      return rows[0] ?? null;
    },

    async create(input: CreateCharacterImageInput) {
      const id = newId();
      await db.insert(characterImages).values({
        id,
        characterId: input.characterId,
        sourceChatImageId: input.sourceChatImageId ?? null,
        filePath: input.filePath,
        prompt: input.prompt ?? "",
        provider: input.provider ?? "",
        model: input.model ?? "",
        width: input.width ?? null,
        height: input.height ?? null,
        createdAt: now(),
      });
      return this.getById(id);
    },

    async remove(id: string) {
      await db.delete(characterImages).where(eq(characterImages.id, id));
    },

    async setTag(
      id: string,
      patch: { customKind: "emoji" | "sticker" | null; customName: string | null; width?: number; height?: number },
    ) {
      await db
        .update(characterImages)
        .set({
          customKind: patch.customKind,
          customName: patch.customName,
          ...(patch.width !== undefined ? { width: patch.width } : {}),
          ...(patch.height !== undefined ? { height: patch.height } : {}),
        })
        .where(eq(characterImages.id, id));
      return this.getById(id);
    },
  };
}
