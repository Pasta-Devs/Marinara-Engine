import { appSettingsResponseSchema, appSettingsUpdateSchema } from "../../engine/contracts/schemas/app-settings.schema";
import { coreModuleSettingsSchema } from "../../engine/contracts/schemas/core-module.schema";
import type { CoreModuleSettings } from "../../engine/contracts/types/core-module";
import { storageApi } from "./storage-api";

const CORE_MODULE_SETTINGS_ID = "core-modules";

type AppSettingsRecord = {
  value?: unknown;
};

function normalizeSettings(value: unknown): CoreModuleSettings {
  return coreModuleSettingsSchema.parse(value ?? undefined);
}

async function readSettingsRecord(): Promise<CoreModuleSettings> {
  const record = await storageApi.get<AppSettingsRecord>("app-settings", CORE_MODULE_SETTINGS_ID);
  const parsed = appSettingsResponseSchema.safeParse(record ?? { value: null });
  return normalizeSettings(parsed.success ? parsed.data.value : null);
}

async function saveSettingsRecord(settings: CoreModuleSettings): Promise<CoreModuleSettings> {
  const normalized = normalizeSettings(settings);
  const payload = appSettingsUpdateSchema.parse({ value: normalized });
  const existing = await storageApi.get<AppSettingsRecord>("app-settings", CORE_MODULE_SETTINGS_ID, { fields: ["id"] });
  if (existing) {
    await storageApi.update("app-settings", CORE_MODULE_SETTINGS_ID, payload);
  } else {
    await storageApi.create("app-settings", {
      id: CORE_MODULE_SETTINGS_ID,
      ...payload,
    });
  }
  return normalized;
}

export const coreModulesApi = {
  settings: {
    get: readSettingsRecord,
    save: saveSettingsRecord,
    setEnabled: async (moduleId: string, enabled: boolean) => {
      const current = await readSettingsRecord();
      return saveSettingsRecord({
        enabled: {
          ...current.enabled,
          [moduleId]: enabled,
        },
      });
    },
  },
};
