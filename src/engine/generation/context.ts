import type { StorageGateway } from "../capabilities/storage";
import { generationParameterSources, mergeStoredGenerationParameters } from "./generate-route-utils";
import { boolish, isRecord, readString, type JsonRecord } from "./runtime-records";

const GENERATION_MESSAGE_FIELDS = [
  "id",
  "chatId",
  "role",
  "content",
  "characterId",
  "name",
  "displayName",
  "characterName",
  "activeSwipeIndex",
  "swipeCount",
  "images",
  "extra",
  "createdAt",
];

const GENERATION_MESSAGE_EXTRA_FIELDS = [
  "hiddenFromAI",
  "hiddenFromAi",
  "thinking",
  "reasoning",
  "reasoning_content",
  "contextInjections",
  "cyoaChoices",
  "spriteExpressions",
  "isConversationStart",
];

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function withGenerationMessageProjection(
  options?: Parameters<StorageGateway["listChatMessages"]>[1],
): Parameters<StorageGateway["listChatMessages"]>[1] {
  const fieldSelections = options?.fieldSelections ?? {};
  const extraFields = fieldSelections.extra ?? [];
  return {
    ...options,
    fields: uniqueStrings([...(options?.fields ?? []), ...GENERATION_MESSAGE_FIELDS]),
    fieldSelections: {
      ...fieldSelections,
      extra: uniqueStrings([...extraFields, ...GENERATION_MESSAGE_EXTRA_FIELDS]),
    },
  };
}

export function requireRecord(value: unknown, label: string): JsonRecord {
  if (isRecord(value)) return value;
  throw new Error(`${label} was not found`);
}

export async function resolveGenerationConnection(
  storage: StorageGateway,
  chat: JsonRecord,
  input: { connectionId?: string | null },
): Promise<JsonRecord> {
  async function randomConnection(): Promise<JsonRecord> {
    const connections = await storage.list<JsonRecord>("connections");
    const pool = connections.filter((connection) => boolish(connection.useForRandom, false));
    const selected = pool[Math.floor(Math.random() * pool.length)];
    if (!selected) throw new Error("No connections are marked for the random pool");
    return selected;
  }

  const requested = readString(input.connectionId).trim();
  if (requested === "random") return randomConnection();
  if (requested) return requireRecord(await storage.get("connections", requested), "Connection");

  const chatConnection = readString(chat.connectionId).trim();
  if (chatConnection === "random") return randomConnection();
  if (chatConnection) return requireRecord(await storage.get("connections", chatConnection), "Chat connection");

  throw new Error("No API connection configured for this chat");
}

export async function loadChatMessages(
  storage: StorageGateway,
  chatId: string,
  options?: Parameters<StorageGateway["listChatMessages"]>[1],
): Promise<JsonRecord[]> {
  const messages = await storage.listChatMessages<unknown>(chatId, withGenerationMessageProjection(options));
  return Array.isArray(messages) ? messages.filter(isRecord) : [];
}

export async function loadChatMessage(storage: StorageGateway, messageId: string): Promise<JsonRecord | null> {
  const message = await storage.get<unknown>("messages", messageId, withGenerationMessageProjection());
  return isRecord(message) ? message : null;
}

export function llmParameters(
  connection: JsonRecord,
  input: { parameters?: Record<string, unknown> | null },
  chat?: JsonRecord | null,
  promptPresetParameters?: unknown,
): Record<string, unknown> {
  const sources = generationParameterSources(connection, input, chat, promptPresetParameters);
  const merged = mergeStoredGenerationParameters(...sources);
  return merged ?? {};
}
