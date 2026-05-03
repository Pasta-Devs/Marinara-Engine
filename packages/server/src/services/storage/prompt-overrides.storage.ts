// ──────────────────────────────────────────────
// Storage: Prompt Overrides
// ──────────────────────────────────────────────
import { eq } from "drizzle-orm";
import type { DB } from "../../db/connection.js";
import { promptOverrides } from "../../db/schema/index.js";
import { now } from "../../utils/id-generator.js";

export interface PromptOverrideRow {
  key: string;
  template: string;
  enabled: boolean;
  updatedAt: string;
}

export function createPromptOverridesStorage(db: DB) {
  return {
    async get(key: string): Promise<PromptOverrideRow | null> {
      const rows = await db.select().from(promptOverrides).where(eq(promptOverrides.key, key));
      const row = rows[0];
      if (!row) return null;
      return {
        key: row.key,
        template: row.template,
        enabled: row.enabled === 1,
        updatedAt: row.updatedAt,
      };
    },

    async list(): Promise<PromptOverrideRow[]> {
      const rows = await db.select().from(promptOverrides);
      return rows.map((row) => ({
        key: row.key,
        template: row.template,
        enabled: row.enabled === 1,
        updatedAt: row.updatedAt,
      }));
    },

    async upsert(input: { key: string; template: string; enabled: boolean }): Promise<PromptOverrideRow> {
      const timestamp = now();
      const enabledFlag = input.enabled ? 1 : 0;
      await db
        .insert(promptOverrides)
        .values({
          key: input.key,
          template: input.template,
          enabled: enabledFlag,
          updatedAt: timestamp,
        })
        .onConflictDoUpdate({
          target: promptOverrides.key,
          set: {
            template: input.template,
            enabled: enabledFlag,
            updatedAt: timestamp,
          },
        });
      return { key: input.key, template: input.template, enabled: input.enabled, updatedAt: timestamp };
    },

    async remove(key: string): Promise<void> {
      await db.delete(promptOverrides).where(eq(promptOverrides.key, key));
    },
  };
}

export type PromptOverridesStorage = ReturnType<typeof createPromptOverridesStorage>;
