// ──────────────────────────────────────────────
// Music DJ: the folder on the server device that Custom mode plays from (#8901)
//
// Three places can hold it, and the first one set wins:
// 1. the chat's own folder (chat metadata `customMusicExternalFolder`),
// 2. the folder linked to the chat's character, only when the chat has exactly one
//    (Music DJ settings `customMusicCharacterFolders`, keyed by character id),
// 3. the default folder for all chats (Music DJ settings `customMusicExternalFolder`).
// ──────────────────────────────────────────────

import { parseAgentSettingsRecord } from "../types/agent.js";

export type MusicDjFolderSource = "chat" | "character" | "default";

export interface MusicDjFolderResolution {
  folder: string;
  source: MusicDjFolderSource;
  /** The character whose linked folder is in use, or the one the chat could link to. */
  characterId: string | null;
}

function readFolder(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readDefaultFolder(settings: Record<string, unknown>): string {
  return readFolder(settings.customMusicExternalFolder ?? settings.localMusicExternalFolder);
}

/** The character a chat's folder can come from: its only character. A group chat never follows one. */
export function musicDjFolderCharacterId(chatCharacterIds: readonly string[] | null | undefined): string | null {
  const only = Array.isArray(chatCharacterIds) && chatCharacterIds.length === 1 ? chatCharacterIds[0] : null;
  return typeof only === "string" && only ? only : null;
}

/** The folders linked to characters, without empty or malformed entries. */
export function readMusicDjCharacterFolders(settings: unknown): Record<string, string> {
  const raw = parseAgentSettingsRecord(settings).customMusicCharacterFolders;
  const folders: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return folders;
  for (const [characterId, value] of Object.entries(raw)) {
    const folder = readFolder(value);
    if (folder) folders[characterId] = folder;
  }
  return folders;
}

/** The character links with one link set to `folder`, or removed when `folder` is empty. */
export function withMusicDjCharacterFolder(settings: unknown, characterId: string, folder: string) {
  const folders = readMusicDjCharacterFolders(settings);
  const trimmed = readFolder(folder);
  if (trimmed) folders[characterId] = trimmed;
  else delete folders[characterId];
  return folders;
}

export function resolveMusicDjExternalFolder(args: {
  settings: unknown;
  chatMetadata?: Record<string, unknown> | null;
  chatCharacterIds?: readonly string[] | null;
}): MusicDjFolderResolution {
  const settings = parseAgentSettingsRecord(args.settings);
  const characterId = musicDjFolderCharacterId(args.chatCharacterIds);
  const chatFolder = readFolder(args.chatMetadata?.customMusicExternalFolder);
  if (chatFolder) return { folder: chatFolder, source: "chat", characterId };
  const characterFolder = characterId ? readMusicDjCharacterFolders(settings)[characterId] : undefined;
  if (characterFolder) return { folder: characterFolder, source: "character", characterId };
  return {
    folder: readDefaultFolder(settings),
    source: "default",
    characterId,
  };
}

/**
 * The Music DJ settings one chat runs with. A chat or character folder replaces the default folder and
 * selects folder mode, even when the default source is Game Assets.
 */
export function applyMusicDjChatFolder(
  agentType: string,
  settings: Record<string, unknown>,
  chatMetadata: Record<string, unknown> | null | undefined,
  chatCharacterIds: readonly string[] | null | undefined,
): Record<string, unknown> {
  if (agentType !== "spotify") return settings;
  const resolved = resolveMusicDjExternalFolder({ settings, chatMetadata, chatCharacterIds });
  if (resolved.source === "default") return settings;
  return { ...settings, customMusicSource: "folder", customMusicExternalFolder: resolved.folder };
}

/**
 * Whether `next` saves a folder path that `previous` does not already hold in the same place. Saving one needs
 * the folder picker's privileged access, because the Music DJ lists and plays files from it. Keeping a saved
 * folder or clearing one is not a new path.
 */
export function addsMusicDjFolderPath(previous: unknown, next: unknown): boolean {
  const before = parseAgentSettingsRecord(previous);
  const after = parseAgentSettingsRecord(next);
  const defaultFolder = readDefaultFolder(after);
  if (defaultFolder && defaultFolder !== readDefaultFolder(before)) return true;
  const linked = readMusicDjCharacterFolders(before);
  return Object.entries(readMusicDjCharacterFolders(after)).some(([id, folder]) => linked[id] !== folder);
}
