// ──────────────────────────────────────────────
// Storage: engine-wide Image reading prompt, request and limits
// ──────────────────────────────────────────────
import {
  IMAGE_READING_SETTINGS_KEY,
  parseImageReadingSettings,
  type ImageReadingSettings,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createAppSettingsStorage } from "./app-settings.storage.js";
import { setImageReadingSettings } from "../generation/image-captioning-runtime.js";

/** The stored settings, also handed to the captioning runtime so every caller uses them. */
export async function readImageReadingSettings(db: DB): Promise<ImageReadingSettings> {
  const settings = parseImageReadingSettings(await createAppSettingsStorage(db).get(IMAGE_READING_SETTINGS_KEY));
  setImageReadingSettings(settings);
  return settings;
}

export async function writeImageReadingSettings(
  db: DB,
  changes: Partial<ImageReadingSettings>,
): Promise<ImageReadingSettings> {
  await db.transaction(async () => {
    const current = await readImageReadingSettings(db);
    const next = parseImageReadingSettings({ ...current, ...changes });
    await createAppSettingsStorage(db).set(IMAGE_READING_SETTINGS_KEY, JSON.stringify(next));
  });
  return readImageReadingSettings(db);
}
