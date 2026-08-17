import { personalExtensionStoragePatchSchema, type PersonalExtensionStoragePatchInput } from "@marinara-engine/shared";
import type { createAppSettingsStorage } from "../storage/app-settings.storage.js";

const STORAGE_KEY_PREFIX = "extension-storage:";

type AppSettingsStorage = ReturnType<typeof createAppSettingsStorage>;

function storageKey(extensionId: string): string {
  return `${STORAGE_KEY_PREFIX}${extensionId}`;
}

function parseStoredValue(raw: string | null): PersonalExtensionStoragePatchInput {
  if (!raw) return {};
  try {
    const parsed = personalExtensionStoragePatchSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function createPersonalExtensionSettingsStorage(appSettings: AppSettingsStorage) {
  const get = async (extensionId: string) => parseStoredValue(await appSettings.get(storageKey(extensionId)));

  return {
    get,
    async patch(extensionId: string, patch: PersonalExtensionStoragePatchInput) {
      const next = personalExtensionStoragePatchSchema.parse({ ...(await get(extensionId)), ...patch });
      await appSettings.set(storageKey(extensionId), JSON.stringify(next));
      return next;
    },
    async remove(extensionId: string) {
      await appSettings.remove(storageKey(extensionId));
    },
  };
}
