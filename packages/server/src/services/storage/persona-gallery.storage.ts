// ──────────────────────────────────────────────
// Storage: Persona Gallery Images
// ──────────────────────────────────────────────
import { and, desc, eq, gte, isNull, lte } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { personaImages } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

export interface CreatePersonaImageInput {
  personaId: string;
  sourceChatImageId?: string | null;
  filePath: string;
  prompt?: string;
  provider?: string;
  model?: string;
  width?: number;
  height?: number;
}

export interface LegacyPersonaImageCandidateInput {
  createdAfter: string;
  createdBefore: string;
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
}

export function createPersonaGalleryStorage(db: DB) {
  return {
    async listByPersonaId(personaId: string) {
      return db
        .select()
        .from(personaImages)
        .where(eq(personaImages.personaId, personaId))
        .orderBy(desc(personaImages.createdAt));
    },

    async listLegacyCandidates(input: LegacyPersonaImageCandidateInput) {
      return db
        .select()
        .from(personaImages)
        .where(
          and(
            isNull(personaImages.sourceChatImageId),
            gte(personaImages.createdAt, input.createdAfter),
            lte(personaImages.createdAt, input.createdBefore),
            eq(personaImages.prompt, input.prompt),
            eq(personaImages.provider, input.provider),
            eq(personaImages.model, input.model),
            input.width === null ? isNull(personaImages.width) : eq(personaImages.width, input.width),
            input.height === null ? isNull(personaImages.height) : eq(personaImages.height, input.height),
          ),
        )
        .orderBy(desc(personaImages.createdAt));
    },

    async listBySourceChatImageId(sourceChatImageId: string) {
      return db
        .select()
        .from(personaImages)
        .where(eq(personaImages.sourceChatImageId, sourceChatImageId))
        .orderBy(desc(personaImages.createdAt));
    },

    async getById(id: string) {
      const rows = await db.select().from(personaImages).where(eq(personaImages.id, id));
      return rows[0] ?? null;
    },

    async create(input: CreatePersonaImageInput) {
      const id = newId();
      await db.insert(personaImages).values({
        id,
        personaId: input.personaId,
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
      await db.delete(personaImages).where(eq(personaImages.id, id));
    },

    async setTag(
      id: string,
      patch: { customKind: "emoji" | "sticker" | null; customName: string | null; width?: number; height?: number },
    ) {
      await db
        .update(personaImages)
        .set({
          customKind: patch.customKind,
          customName: patch.customName,
          ...(patch.width !== undefined ? { width: patch.width } : {}),
          ...(patch.height !== undefined ? { height: patch.height } : {}),
        })
        .where(eq(personaImages.id, id));
      return this.getById(id);
    },
  };
}
