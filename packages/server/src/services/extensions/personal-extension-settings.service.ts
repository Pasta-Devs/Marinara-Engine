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

// Serialize writes per extension so concurrent patches cannot read the same
// stale value and overwrite each other's keys. Kept at module scope because the
// sandbox runtime builds a fresh storage wrapper per message and the routes
// build their own, so a per-instance lock would not order them.
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(extensionId: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(extensionId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  locks.set(extensionId, tail);
  void tail.then(() => {
    if (locks.get(extensionId) === tail) locks.delete(extensionId);
  });
  return run;
}

export function createPersonalExtensionSettingsStorage(appSettings: AppSettingsStorage) {
  const get = async (extensionId: string) => parseStoredValue(await appSettings.get(storageKey(extensionId)));

  return {
    get,
    async patch(extensionId: string, patch: PersonalExtensionStoragePatchInput) {
      return withLock(extensionId, async () => {
        const next = personalExtensionStoragePatchSchema.parse({ ...(await get(extensionId)), ...patch });
        await appSettings.set(storageKey(extensionId), JSON.stringify(next));
        return next;
      });
    },
    async remove(extensionId: string) {
      await withLock(extensionId, () => appSettings.remove(storageKey(extensionId)));
    },
  };
}
