// ──────────────────────────────────────────────
// Storage: Synced App Settings (key/value)
// ──────────────────────────────────────────────
import { FEATURE_SETTINGS_KEY } from "@marinara-engine/shared";
import { eq } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { appSettings } from "../../db/schema/index.js";
import { now } from "../../utils/id-generator.js";
import { applyFeatureSettingsValue } from "../features/feature-settings.js";

export function createAppSettingsStorage(db: DB) {
  return {
    async get(key: string): Promise<string | null> {
      const rows = await db.select().from(appSettings).where(eq(appSettings.key, key));
      return rows[0]?.value ?? null;
    },

    async set(key: string, value: string): Promise<void> {
      const timestamp = now();
      const existing = await db.select().from(appSettings).where(eq(appSettings.key, key));
      if (existing.length > 0) {
        await db.update(appSettings).set({ value, updatedAt: timestamp }).where(eq(appSettings.key, key));
      } else {
        await db.insert(appSettings).values({ key, value, updatedAt: timestamp });
      }
      // Feature switches are read from an in-memory copy on hot paths; refresh it on every write.
      if (key === FEATURE_SETTINGS_KEY) applyFeatureSettingsValue(value);
    },

    async remove(key: string): Promise<void> {
      await db.delete(appSettings).where(eq(appSettings.key, key));
      if (key === FEATURE_SETTINGS_KEY) applyFeatureSettingsValue(null);
    },
  };
}
