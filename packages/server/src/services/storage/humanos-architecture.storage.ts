// ──────────────────────────────────────────────
// Storage: HumanOS v2 Private Architecture
// ──────────────────────────────────────────────
import { and, eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { humanosArchitectures } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";

export type HumanOSSubjectType = "CHARACTER" | "USER_PERSONA";

export function createHumanOSArchitectureStorage(db: DB) {
  return {
    async get(subjectType: HumanOSSubjectType, subjectId: string) {
      const rows = await db
        .select()
        .from(humanosArchitectures)
        .where(and(eq(humanosArchitectures.subjectType, subjectType), eq(humanosArchitectures.subjectId, subjectId)))
        .limit(1);
      return rows[0] ?? null;
    },

    async upsert(input: {
      subjectType: HumanOSSubjectType;
      subjectId: string;
      schemaVersion: number;
      architecture: string;
    }) {
      const existing = await this.get(input.subjectType, input.subjectId);
      const timestamp = now();
      if (existing) {
        await db
          .update(humanosArchitectures)
          .set({ schemaVersion: input.schemaVersion, architecture: input.architecture, updatedAt: timestamp })
          .where(eq(humanosArchitectures.id, existing.id));
        return { ...existing, schemaVersion: input.schemaVersion, architecture: input.architecture, updatedAt: timestamp };
      }

      const row = {
        id: newId(),
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        schemaVersion: input.schemaVersion,
        architecture: input.architecture,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.insert(humanosArchitectures).values(row);
      return row;
    },

    async remove(subjectType: HumanOSSubjectType, subjectId: string) {
      await db
        .delete(humanosArchitectures)
        .where(and(eq(humanosArchitectures.subjectType, subjectType), eq(humanosArchitectures.subjectId, subjectId)));
    },
  };
}
