// ──────────────────────────────────────────────
// Storage: Story Bundles
// ──────────────────────────────────────────────
import { eq } from "../../db/file-query.js";
import type { CreateStoryBundleInput, UpdateStoryBundleInput } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { storyBundles } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

export function createStoryBundlesStorage(db: DB) {
  return {
    async list() {
      return db.select().from(storyBundles).orderBy(storyBundles.createdAt);
    },

    async getById(id: string) {
      const rows = await db.select().from(storyBundles).where(eq(storyBundles.id, id));
      return rows[0] ?? null;
    },

    async create(input: CreateStoryBundleInput) {
      const id = newId();
      const timestamp = now();
      await db.insert(storyBundles).values({
        id,
        name: input.name,
        description: input.description ?? null,
        imagePath: input.imagePath ?? null,
        avatarCrop: input.avatarCrop != null ? JSON.stringify(input.avatarCrop) : null,
        comment: input.comment ?? "",
        creator: input.creator ?? "",
        version: input.version ?? "",
        tags: JSON.stringify(input.tags ?? []),
        characterIds: JSON.stringify(input.characterIds ?? []),
        personaIds: JSON.stringify(input.personaIds ?? []),
        lorebookIds: JSON.stringify(input.lorebookIds ?? []),
        presetIds: JSON.stringify(input.presetIds ?? []),
        agentIds: JSON.stringify(input.agentIds ?? []),
        intros: JSON.stringify(input.intros ?? []),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(id);
    },

    async update(id: string, data: UpdateStoryBundleInput) {
      await db
        .update(storyBundles)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.imagePath !== undefined && { imagePath: data.imagePath }),
          ...(data.avatarCrop !== undefined && {
            avatarCrop: data.avatarCrop != null ? JSON.stringify(data.avatarCrop) : null,
          }),
          ...(data.comment !== undefined && { comment: data.comment }),
          ...(data.creator !== undefined && { creator: data.creator }),
          ...(data.version !== undefined && { version: data.version }),
          ...(data.tags !== undefined && { tags: JSON.stringify(data.tags) }),
          ...(data.characterIds !== undefined && { characterIds: JSON.stringify(data.characterIds) }),
          ...(data.personaIds !== undefined && { personaIds: JSON.stringify(data.personaIds) }),
          ...(data.lorebookIds !== undefined && { lorebookIds: JSON.stringify(data.lorebookIds) }),
          ...(data.presetIds !== undefined && { presetIds: JSON.stringify(data.presetIds) }),
          ...(data.agentIds !== undefined && { agentIds: JSON.stringify(data.agentIds) }),
          ...(data.intros !== undefined && { intros: JSON.stringify(data.intros) }),
          updatedAt: now(),
        })
        .where(eq(storyBundles.id, id));
      return this.getById(id);
    },

    async remove(id: string) {
      await db.delete(storyBundles).where(eq(storyBundles.id, id));
    },
  };
}
