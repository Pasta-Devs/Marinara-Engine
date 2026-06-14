import type { CharacterData, DiscordBridgeChatContext, DiscordBridgeSetupOptions } from "@marinara-engine/shared";
import type { PersonaCardData } from "../embeds/persona-card.embed.js";
import type { EditableCharacterField } from "./character-card-fields.js";

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

export function getBridgeSetupOptions(serverUrl: string) {
  return getJson<DiscordBridgeSetupOptions>(serverUrl, "/api/discord-bridge/setup-options");
}

export function getBridgeChatContext(serverUrl: string, chatId: string, messageLimit = 0) {
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
