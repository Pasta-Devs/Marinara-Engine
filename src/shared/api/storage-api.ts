import type { AddChatMessageSwipeOptions, StorageGateway, StorageListOptions } from "../../engine/capabilities/storage";
import { collapseExcessBlankLines } from "../../engine/shared/text/newlines";
import { ApiError } from "./api-errors";
import { invokeTauri } from "./tauri-client";
import { trackerSnapshotApi, type TrackerSnapshotInput } from "./tracker-snapshot-api";

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function parseStoredJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeArrayField(record: Record<string, unknown>, field: string): void {
  const parsed = parseStoredJson(record[field]);
  if (Array.isArray(parsed)) {
    record[field] = parsed;
  } else if (field in record) {
    record[field] = [];
  }
}

function normalizeObjectField(
  record: Record<string, unknown>,
  field: string,
  fallback: Record<string, unknown> | null,
): void {
  const parsed = parseStoredJson(record[field]);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    record[field] = parsed as Record<string, unknown>;
  } else if (field in record || fallback !== null) {
    record[field] = fallback;
  }
}

function normalizeStorageRecord(entity: string, value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = { ...(value as Record<string, unknown>) };

  switch (entity) {
    case "chats":
      for (const field of [
        "characterIds",
        "activeLorebookIds",
        "activeAgentIds",
        "activeToolIds",
        "memories",
        "notes",
      ]) {
        normalizeArrayField(record, field);
      }
      normalizeObjectField(record, "metadata", {});
      normalizeObjectField(record, "gameState", null);
      break;
    case "messages":
      for (const field of ["swipes", "images", "attachments"]) normalizeArrayField(record, field);
      normalizeObjectField(record, "extra", {});
      break;
    default:
      break;
  }

  return record;
}

function normalizeSwipeContent(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const swipe = { ...(value as Record<string, unknown>) };
  if (typeof swipe.content === "string") {
    swipe.content = collapseExcessBlankLines(swipe.content);
  }
  return swipe;
}

function normalizeMessageWrite(value: Record<string, unknown>): Record<string, unknown> {
  const next = { ...value };
  if (typeof next.content === "string") {
    next.content = collapseExcessBlankLines(next.content);
  }
  if (Array.isArray(next.swipes)) {
    next.swipes = next.swipes.map(normalizeSwipeContent);
  }
  return next;
}

function normalizeStorageWrite(entity: string, value: Record<string, unknown>): Record<string, unknown> {
  return entity === "messages" ? normalizeMessageWrite(value) : value;
}

function normalizeStorageReadResult(entity: string, value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeStorageRecord(entity, item));
  return normalizeStorageRecord(entity, value);
}

function chatMessageDefaults(chatId: string, value: Record<string, unknown>): Record<string, unknown> {
  const content = typeof value.content === "string" ? collapseExcessBlankLines(value.content) : "";
  const extra = value.extra ?? {};
  return {
    ...value,
    chatId,
    role: value.role ?? "user",
    content,
    extra,
    activeSwipeIndex: value.activeSwipeIndex ?? 0,
    swipes: value.swipes ?? [{ content, extra }],
  };
}

function chatMessageSwipeBody(content: string, options?: AddChatMessageSwipeOptions): Record<string, unknown> {
  const body: Record<string, unknown> = { content: collapseExcessBlankLines(content) };
  if (options?.extra) body.extra = options.extra;
  if (typeof options?.activate === "boolean") body.activate = options.activate;
  return body;
}

async function patchChatObjectField<T>(chatId: string, field: string, patch: Record<string, unknown>): Promise<T> {
  const chat = await storageApi.get<Record<string, unknown>>("chats", chatId, { fields: [field] });
  if (!chat) throw new ApiError(`Chat ${chatId} was not found`, 404);
  const current = asRecord(chat[field]);
  return storageApi.update<T>("chats", chatId, { [field]: { ...current, ...patch } });
}

// Day/week summary maps live inside chat metadata, but callers send only the
// entries they changed (a delta), not the whole map. A plain metadata patch
// would replace `metadata.daySummaries` with just the delta and drop every
// other summary, so merge each map at the entry level instead.
const SUMMARY_MAP_FIELDS = ["daySummaries", "weekSummaries"] as const;

async function patchChatSummariesField<T>(chatId: string, patch: Record<string, unknown>): Promise<T> {
  const chat = await storageApi.get<Record<string, unknown>>("chats", chatId, { fields: ["metadata"] });
  if (!chat) throw new ApiError(`Chat ${chatId} was not found`, 404);
  const current = asRecord(chat.metadata);
  const metadata: Record<string, unknown> = { ...current };
  for (const field of SUMMARY_MAP_FIELDS) {
    if (patch[field] === undefined) continue;
    metadata[field] = { ...asRecord(current[field]), ...asRecord(patch[field]) };
  }
  return storageApi.update<T>("chats", chatId, { metadata });
}

export const storageApi: StorageGateway = {
  list: async (entity: string, options?: StorageListOptions) =>
    normalizeStorageReadResult(
      entity,
      await invokeTauri("storage_list", {
        entity,
        options: options ?? null,
      }),
    ) as never,
  get: async (entity: string, id: string, options?: Pick<StorageListOptions, "fields" | "fieldSelections">) =>
    normalizeStorageReadResult(
      entity,
      await invokeTauri("storage_get", {
        entity,
        id,
        options: options ?? null,
      }),
    ) as never,
  create: async (entity: string, value: Record<string, unknown>) =>
    normalizeStorageReadResult(
      entity,
      await invokeTauri("storage_create", {
        entity,
        value: normalizeStorageWrite(entity, value),
      }),
    ) as never,
  update: async (entity: string, id: string, patch: Record<string, unknown>) =>
    normalizeStorageReadResult(
      entity,
      await invokeTauri("storage_update", {
        entity,
        id,
        patch: normalizeStorageWrite(entity, patch),
      }),
    ) as never,
  delete: (entity: string, id: string) =>
    invokeTauri("storage_delete", {
      entity,
      id,
    }),
  listChatMessages: (chatId, options) =>
    storageApi.list("messages", {
      ...options,
      filters: { chatId },
    }),
  createChatMessage: (chatId, value) => storageApi.create("messages", chatMessageDefaults(chatId, value)),
  updateChatMessage: (messageId, patch) => storageApi.update("messages", messageId, normalizeMessageWrite(patch)),
  updateChatMessageContentIfUnchanged: async (chatId, messageId, expectedContent, content) => {
    const result = (await invokeTauri("chat_message_update_content_if_unchanged", {
      chatId,
      messageId,
      expectedContent,
      content: collapseExcessBlankLines(content),
    })) as { updated?: boolean; message?: unknown } | null;
    const message = result?.message ? normalizeStorageReadResult("messages", result.message) : undefined;
    return {
      updated: result?.updated === true,
      ...(message === undefined ? {} : { message }),
    } as never;
  },
  deleteChatMessage: (messageId) => storageApi.delete("messages", messageId),
  patchChatMessageExtra: async (messageId, patch) => {
    const message = await storageApi.get<Record<string, unknown>>("messages", messageId, { fields: ["extra"] });
    if (!message) throw new ApiError(`Message ${messageId} was not found`, 404);
    return storageApi.update("messages", messageId, {
      extra: { ...asRecord(message.extra), ...patch },
    });
  },
  addChatMessageSwipe: (chatId, messageId, content, options) =>
    invokeTauri("chat_message_add_swipe", {
      chatId,
      messageId,
      body: chatMessageSwipeBody(content, options),
    }),
  evictPromptSnapshots: (chatId, keepLast) =>
    invokeTauri("chat_evict_prompt_snapshots", { chatId, keepLast }) as Promise<{ evicted: number }>,
  patchChatMetadata: (chatId, patch) => patchChatObjectField(chatId, "metadata", patch),
  patchChatSummaries: (chatId, patch) => patchChatSummariesField(chatId, patch),
  listChatMemories: async (chatId) => {
    const chat = await storageApi.get<Record<string, unknown>>("chats", chatId);
    return asArray(chat?.memories);
  },
  getWorldState: async (chatId) => {
    const chat = await storageApi.get<Record<string, unknown>>("chats", chatId);
    return (chat?.gameState as never) ?? null;
  },
  saveTrackerSnapshot: <T = unknown>(chatId: string, snapshot: Record<string, unknown>) =>
    trackerSnapshotApi.save(chatId, snapshot as unknown as TrackerSnapshotInput) as Promise<T>,
  listLorebookEntries: (lorebookId) => storageApi.list("lorebook-entries", { filters: { lorebookId } }),
  createLorebookEntries: async (lorebookId, entries) =>
    Promise.all(entries.map((entry) => storageApi.create("lorebook-entries", { ...entry, lorebookId }))) as Promise<
      never[]
    >,
  knowledgeSourceText: <T = unknown>(id: string) => invokeTauri<T>("knowledge_source_text", { id }),
  promptFull: async (presetId) => {
    const preset = await storageApi.get<Record<string, unknown>>("prompts", presetId);
    if (!preset) return null;
    const [sections, groups, choiceBlocks] = await Promise.all([
      storageApi.list("prompt-sections", { filters: { presetId } }),
      storageApi.list("prompt-groups", { filters: { presetId } }),
      storageApi.list("prompt-variables", { filters: { presetId } }),
    ]);
    return { preset, sections, groups, choiceBlocks } as never;
  },
};
