import type { StorageGateway } from "../capabilities/storage";
import { mergeStoredGenerationParameters } from "./generate-route-utils";
import { boolish, isRecord, parseRecord, readString, type JsonRecord } from "./runtime-records";

export function requireRecord(value: unknown, label: string): JsonRecord {
  if (isRecord(value)) return value;
  throw new Error(`${label} was not found`);
}


export async function resolveGenerationConnection(
  storage: StorageGateway,
  chat: JsonRecord,
  input: { connectionId?: string | null },
): Promise<JsonRecord> {
  const requested = readString(input.connectionId).trim();
  if (requested) return requireRecord(await storage.get("connections", requested), "Connection");

  const chatConnection = readString(chat.connectionId).trim();
  if (chatConnection) return requireRecord(await storage.get("connections", chatConnection), "Chat connection");

  const connections = await storage.list<JsonRecord>("connections");
  const selected =
    connections.find((connection) => boolish(connection.isDefault, false) || boolish(connection.default, false)) ??
    connections[0];
  if (!selected) throw new Error("No LLM connection is configured");
  return selected;
}

export async function loadChatMessages(
  storage: StorageGateway,
  chatId: string,
  options?: Parameters<StorageGateway["listChatMessages"]>[1],
): Promise<JsonRecord[]> {
  const messages = await storage.listChatMessages<unknown>(chatId, options);
  return Array.isArray(messages) ? messages.filter(isRecord) : [];
}

export function llmParameters(
  connection: JsonRecord,
  input: { parameters?: Record<string, unknown> | null },
  chat?: JsonRecord | null,
  promptPresetParameters?: unknown,
): Record<string, unknown> {
  const meta = parseRecord(chat?.metadata);
  const mode = readString(chat?.mode || chat?.chatMode);
  const setupConfig = parseRecord(meta.gameSetupConfig);
  const merged = mergeStoredGenerationParameters(
    connection.defaultParameters,
    promptPresetParameters,
    mode === "game" ? setupConfig.generationParameters : null,
    mode === "game" ? meta.gameGenerationParameters : null,
    meta.chatParameters,
    input.parameters,
  );
  return merged ?? {};
}
