// ──────────────────────────────────────────────
// Storage: Generation job records (feature switch generationJobTracking)
// ──────────────────────────────────────────────
import { eq, inArray } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { generationJobRecords } from "../../db/schema/index.js";

export type GenerationJobRecordRow = typeof generationJobRecords.$inferSelect;
export type GenerationJobRecordInsert = typeof generationJobRecords.$inferInsert;

export function createGenerationJobRecordsStorage(db: DB) {
  return {
    async list(): Promise<GenerationJobRecordRow[]> {
      const rows = await db.select().from(generationJobRecords);
      return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    },

    async get(id: string): Promise<GenerationJobRecordRow | null> {
      return (await db.select().from(generationJobRecords).where(eq(generationJobRecords.id, id)))[0] ?? null;
    },

    /** Insert or replace one record. */
    async upsert(row: GenerationJobRecordInsert): Promise<void> {
      const existing = await db.select().from(generationJobRecords).where(eq(generationJobRecords.id, row.id));
      if (existing.length > 0) {
        const { id, ...rest } = row;
        await db.update(generationJobRecords).set(rest).where(eq(generationJobRecords.id, id));
      } else {
        await db.insert(generationJobRecords).values(row);
      }
    },

    async update(id: string, patch: Partial<Omit<GenerationJobRecordInsert, "id">>): Promise<void> {
      await db.update(generationJobRecords).set(patch).where(eq(generationJobRecords.id, id));
    },

    async remove(ids: readonly string[]): Promise<void> {
      if (ids.length === 0) return;
      await db.delete(generationJobRecords).where(inArray(generationJobRecords.id, [...ids]));
    },
  };
}
