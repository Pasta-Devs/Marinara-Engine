// ──────────────────────────────────────────────
// Storage: Custom Emojis
// ──────────────────────────────────────────────
import { eq, asc } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { customEmojis } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import type { CreateCustomEmojiInput, UpdateCustomEmojiInput } from "@marinara-engine/shared";

export function createCustomEmojisStorage(db: DB) {
  return {
    async list() {
      return db.select().from(customEmojis).orderBy(asc(customEmojis.name));
    },

    async getById(id: string) {
      const rows = await db.select().from(customEmojis).where(eq(customEmojis.id, id));
      return rows[0] ?? null;
    },

    /** Look up by slug — used to keep names unique within the global pool. */
    async getByName(name: string) {
      const rows = await db.select().from(customEmojis).where(eq(customEmojis.name, name));
      return rows[0] ?? null;
    },

    async create(input: CreateCustomEmojiInput) {
      const id = newId();
      const timestamp = now();
      await db.insert(customEmojis).values({
        id,
        name: input.name,
        filePath: input.filePath,
        width: input.width ?? null,
        height: input.height ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(id);
    },

    async update(id: string, data: UpdateCustomEmojiInput) {
      await db.update(customEmojis).set({ name: data.name, updatedAt: now() }).where(eq(customEmojis.id, id));
      return this.getById(id);
    },

    async remove(id: string) {
      await db.delete(customEmojis).where(eq(customEmojis.id, id));
    },
  };
}
