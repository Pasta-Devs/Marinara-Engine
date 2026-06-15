import type {
  CharacterData,
  DiscordBridgeChatContext,
  DiscordBridgeChatPresetOption,
  DiscordBridgeConnectionOption,
  DiscordBridgeCreateRoleplayChatResponse,
  DiscordBridgeEngineSyncResponse,
  DiscordBridgeIngestDiscordMessageResponse,
  DiscordBridgeMessageMapping,
  DiscordBridgePromptPresetOption,
  DiscordBridgeRoleplayDefaults,
  DiscordBridgeRoleplaySettings,
  DiscordBridgeSetupOptions,
  DiscordBridgeThreadBinding,
} from "@marinara-engine/shared";
import type { PersonaCardData } from "../embeds/persona-card.embed.js";
import type { EditableCharacterField } from "./character-card-fields.js";
import type { EditablePersonaField } from "./persona-card-fields.js";

export interface MarinaraCharacterRow {
  id: string;
  data: CharacterData | string;
  comment: string;
  avatarPath: string | null;
  updatedAt: string;
}

export interface MarinaraPersonaRow extends PersonaCardData {
  avatarPath: string | null;
  updatedAt: string;
}

export interface MarinaraMessageRow {
  id: string;
  chatId: string;
  role: DiscordBridgeMessageMapping["role"];
  characterId: string | null;
  content: string;
  createdAt: string;
}

function apiUrl(serverUrl: string, path: string) {
  return `${serverUrl.replace(/\/+$/, "")}${path}`;
}

async function getJson<T>(serverUrl: string, path: string): Promise<T> {
  const response = await fetch(apiUrl(serverUrl, path));
  if (!response.ok) {
    throw new Error(`Marinara request failed: GET ${path} returned HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function patchJson<T>(serverUrl: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(serverUrl, path), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Marinara request failed: PATCH ${path} returned HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function postJson<T>(serverUrl: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(serverUrl, path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Marinara request failed: POST ${path} returned HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function deleteJson<T>(serverUrl: string, path: string): Promise<T> {
  const response = await fetch(apiUrl(serverUrl, path), {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Marinara request failed: DELETE ${path} returned HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export function getBridgeSetupOptions(serverUrl: string) {
  return getJson<DiscordBridgeSetupOptions>(serverUrl, "/api/discord-bridge/setup-options");
}

export function getBridgeHealth(serverUrl: string) {
  return getJson<{ ok: boolean; service: "discord-bridge" }>(serverUrl, "/api/discord-bridge/health");
}

export function getBridgeConnections(serverUrl: string) {
  return getJson<{ connections: DiscordBridgeConnectionOption[]; defaultConnectionId: string | null }>(
    serverUrl,
    "/api/discord-bridge/connections",
  );
}

export function getBridgePromptPresets(serverUrl: string) {
  return getJson<{ presets: DiscordBridgePromptPresetOption[]; defaultPromptPresetId: string | null }>(
    serverUrl,
    "/api/discord-bridge/prompt-presets",
  );
}

export function getBridgeChatPresets(serverUrl: string, mode?: string) {
  const params = mode ? `?${new URLSearchParams({ mode })}` : "";
  return getJson<{ presets: DiscordBridgeChatPresetOption[]; activePresetId: string | null }>(
    serverUrl,
    `/api/discord-bridge/chat-presets${params}`,
  );
}

export function getBridgeRoleplayDefaults(serverUrl: string) {
  return getJson<DiscordBridgeRoleplayDefaults>(serverUrl, "/api/discord-bridge/roleplay-defaults");
}

export function updateBridgeRoleplayDefaults(serverUrl: string, input: DiscordBridgeRoleplaySettings) {
  return patchJson<DiscordBridgeRoleplayDefaults>(serverUrl, "/api/discord-bridge/roleplay-defaults", input);
}

export function getBridgeChatContext(serverUrl: string, chatId: string, messageLimit: number | "all" = 0) {
  const params = new URLSearchParams({ messageLimit: String(messageLimit) });
  return getJson<DiscordBridgeChatContext>(
    serverUrl,
    `/api/discord-bridge/chats/${encodeURIComponent(chatId)}/context?${params}`,
  );
}

export async function getCharacterById(serverUrl: string, characterId: string) {
  const row = await getJson<MarinaraCharacterRow>(serverUrl, `/api/characters/${encodeURIComponent(characterId)}`);
  return {
    ...row,
    data: typeof row.data === "string" ? (JSON.parse(row.data) as CharacterData) : row.data,
  };
}

export function getPersonaById(serverUrl: string, personaId: string) {
  return getJson<MarinaraPersonaRow>(serverUrl, `/api/characters/personas/${encodeURIComponent(personaId)}`);
}

export function updatePersonaFields(
  serverUrl: string,
  personaId: string,
  updates: Array<{ field: EditablePersonaField; value: string }>,
) {
  return patchJson<MarinaraPersonaRow>(
    serverUrl,
    `/api/discord-bridge/personas/${encodeURIComponent(personaId)}/fields`,
    { updates },
  );
}

export async function updateCharacterFields(
  serverUrl: string,
  characterId: string,
  updates: Array<{ field: EditableCharacterField; value: string }>,
) {
  const row = await patchJson<MarinaraCharacterRow>(
    serverUrl,
    `/api/discord-bridge/characters/${encodeURIComponent(characterId)}/fields`,
    { updates },
  );
  return {
    ...row,
    data: typeof row.data === "string" ? (JSON.parse(row.data) as CharacterData) : row.data,
  };
}

export function listThreadBindings(serverUrl: string) {
  return getJson<DiscordBridgeThreadBinding[]>(serverUrl, "/api/discord-bridge/thread-bindings");
}

export function getThreadBindingByThreadId(serverUrl: string, threadId: string) {
  return getJson<DiscordBridgeThreadBinding>(
    serverUrl,
    `/api/discord-bridge/thread-bindings/by-thread/${encodeURIComponent(threadId)}`,
  );
}

export function upsertThreadBinding(
  serverUrl: string,
  input: {
    guildId: string;
    channelId: string;
    threadId: string;
    chatId: string;
    chatName: string;
    personaId?: string | null;
    characterIds: string[];
  },
) {
  return postJson<DiscordBridgeThreadBinding>(serverUrl, "/api/discord-bridge/thread-bindings", input);
}

export function deleteThreadBinding(serverUrl: string, bindingId: string) {
  return deleteJson<{ ok: boolean }>(
    serverUrl,
    `/api/discord-bridge/thread-bindings/${encodeURIComponent(bindingId)}`,
  );
}

export function listThreadMessageMappings(serverUrl: string, threadId: string) {
  return getJson<DiscordBridgeMessageMapping[]>(
    serverUrl,
    `/api/discord-bridge/thread-bindings/by-thread/${encodeURIComponent(threadId)}/message-mappings`,
  );
}

export function getThreadMessageMappingByDiscordMessageId(serverUrl: string, threadId: string, discordMessageId: string) {
  return getJson<DiscordBridgeMessageMapping>(
    serverUrl,
    `/api/discord-bridge/thread-bindings/by-thread/${encodeURIComponent(
      threadId,
    )}/message-mappings/by-discord-message/${encodeURIComponent(discordMessageId)}`,
  );
}

export function createBridgeRoleplayChat(
  serverUrl: string,
  input: { name: string; personaId: string | null; characterIds: string[] },
) {
  return postJson<DiscordBridgeCreateRoleplayChatResponse>(serverUrl, "/api/discord-bridge/roleplay-chats", input);
}

export function upsertMessageMapping(
  serverUrl: string,
  input: {
    bindingId: string;
    marinaraMessageId: string;
    discordMessageIds: string[];
    role: DiscordBridgeMessageMapping["role"];
    direction: DiscordBridgeMessageMapping["direction"];
    contentHash: string;
  },
) {
  return postJson<DiscordBridgeMessageMapping>(serverUrl, "/api/discord-bridge/message-mappings", input);
}

export function createUserChatMessage(serverUrl: string, chatId: string, content: string) {
  return postJson<MarinaraMessageRow>(serverUrl, `/api/chats/${encodeURIComponent(chatId)}/messages`, {
    role: "user",
    characterId: null,
    content,
  });
}

export function ingestDiscordUserMessage(
  serverUrl: string,
  threadId: string,
  input: { discordMessageId: string; content: string },
) {
  return postJson<DiscordBridgeIngestDiscordMessageResponse>(
    serverUrl,
    `/api/discord-bridge/thread-bindings/by-thread/${encodeURIComponent(threadId)}/discord-messages`,
    input,
  );
}

export function updateChatMessageContent(serverUrl: string, chatId: string, messageId: string, content: string) {
  return patchJson<MarinaraMessageRow>(
    serverUrl,
    `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
    { content, source: "discord_bridge" },
  );
}

export function getEngineSyncItems(serverUrl: string, messageLimit = 100) {
  const params = new URLSearchParams({ messageLimit: String(messageLimit) });
  return getJson<DiscordBridgeEngineSyncResponse>(serverUrl, `/api/discord-bridge/engine-sync?${params}`);
}
