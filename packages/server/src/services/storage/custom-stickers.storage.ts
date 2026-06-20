// ──────────────────────────────────────────────
// Storage: Custom Stickers
// ──────────────────────────────────────────────
import { eq, asc } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { customStickers } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import type { CreateCustomStickerInput, UpdateCustomStickerInput } from "@marinara-engine/shared";

export function createCustomStickersStorage(db: DB) {
  return {
    async list() {
      return db.select().from(customStickers).orderBy(asc(customStickers.name));
    },

    async getById(id: string) {
      const rows = await db.select().from(customStickers).where(eq(customStickers.id, id));
      return rows[0] ?? null;
    },

    /** Look up by slug — used to keep names unique within the global pool. */
    async getByName(name: string) {
      const rows = await db.select().from(customStickers).where(eq(customStickers.name, name));
      return rows[0] ?? null;
    },

    async create(input: CreateCustomStickerInput) {
      const id = newId();
      const timestamp = now();
      await db.insert(customStickers).values({
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

    async update(id: string, data: UpdateCustomStickerInput) {
      await db.update(customStickers).set({ name: data.name, updatedAt: now() }).where(eq(customStickers.id, id));
      return this.getById(id);
    },

    async remove(id: string) {
      await db.delete(customStickers).where(eq(customStickers.id, id));
    },
  };
}
