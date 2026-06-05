import { ApiError } from "./api-errors";
import { storageApi } from "./storage-api";

const PLUGIN_MEMORY_ENTITY = "plugin-memory" as const;
const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/i;
const MAX_PLUGIN_MEMORY_KEY_LENGTH = 160;

export interface PluginMemoryRecord<T = unknown> {
  id: string;
  pluginId: string;
  key: string;
  value: T;
  schemaVersion: number;
  createdAt?: string;
  updatedAt?: string;
}

function validatePluginId(pluginId: string): string {
  const trimmed = pluginId.trim();
  if (!PLUGIN_ID_PATTERN.test(trimmed)) {
    throw new Error("Plugin memory pluginId must be a stable plugin id.");
  }
  return trimmed;
}

function validateMemoryKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed || trimmed.length > MAX_PLUGIN_MEMORY_KEY_LENGTH || hasControlCharacters(trimmed)) {
    throw new Error("Plugin memory key must be a short printable string.");
  }
  return trimmed;
}

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function memoryRecordId(pluginId: string, key: string): string {
  return `${validatePluginId(pluginId)}:${encodeURIComponent(validateMemoryKey(key))}`;
}

function memoryPayload<T>(pluginId: string, key: string, value: T): Record<string, unknown> {
  return {
    id: memoryRecordId(pluginId, key),
    pluginId: validatePluginId(pluginId),
    key: validateMemoryKey(key),
    value,
    schemaVersion: 1,
  };
}

function isDuplicateCreateError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400 && error.message.includes("already exists");
}

export const pluginMemoryApi = {
  list: <T = unknown>(pluginId: string) =>
    storageApi.list<PluginMemoryRecord<T>>(PLUGIN_MEMORY_ENTITY, {
      filters: { pluginId: validatePluginId(pluginId) },
      orderBy: "updatedAt",
      descending: true,
    }),
  get: <T = unknown>(pluginId: string, key: string) =>
    storageApi.get<PluginMemoryRecord<T>>(PLUGIN_MEMORY_ENTITY, memoryRecordId(pluginId, key)),
  put: async <T = unknown>(pluginId: string, key: string, value: T) => {
    const id = memoryRecordId(pluginId, key);
    const payload = memoryPayload(pluginId, key, value);
    const existing = await storageApi.get<PluginMemoryRecord<T>>(PLUGIN_MEMORY_ENTITY, id, { fields: ["id"] });
    if (existing) {
      return storageApi.update<PluginMemoryRecord<T>>(PLUGIN_MEMORY_ENTITY, id, payload);
    }
    try {
      return await storageApi.create<PluginMemoryRecord<T>>(PLUGIN_MEMORY_ENTITY, payload);
    } catch (error) {
      if (!isDuplicateCreateError(error)) throw error;
      return storageApi.update<PluginMemoryRecord<T>>(PLUGIN_MEMORY_ENTITY, id, payload);
    }
  },
  delete: (pluginId: string, key: string) => storageApi.delete(PLUGIN_MEMORY_ENTITY, memoryRecordId(pluginId, key)),
};
