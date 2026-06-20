import type { DirectMessageCommand } from "../conversation/character-commands.js";
import { stripConversationPromptTimestamps } from "../conversation/transcript-sanitize.js";

function normalizeDmTargetName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^il\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseChatCharacterIdsForDm(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      .map((id) => id.trim());
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim())
      : [];
  } catch {
    return value.trim() ? [value.trim()] : [];
  }
}

function readCharacterNameFromRow(row: { data?: unknown }): string {
  try {
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) return "";
    const name = (data as { name?: unknown }).name;
    return typeof name === "string" ? name : "";
  } catch {
    return "";
  }
}

export function resolveRoleplayDmTarget(
  requestedTarget: string,
  roleplayCharacters: Array<{ id: string; name: string }>,
  allCharacters: Array<{ id: string; data?: unknown }>,
): { id: string; name: string } | null {
  const requestedId = requestedTarget.trim();
  const requestedKey = normalizeDmTargetName(requestedTarget);
  if (!requestedKey) return null;

  const roleplayTarget = roleplayCharacters.find(
    (character) => character.id === requestedId || normalizeDmTargetName(character.name) === requestedKey,
  );
  if (roleplayTarget) return { id: roleplayTarget.id, name: roleplayTarget.name };

  for (const candidate of allCharacters) {
    if (candidate.id === requestedId) {
      const name = readCharacterNameFromRow(candidate).trim();
      return { id: candidate.id, name: name || requestedId };
    }
    const candidateName = readCharacterNameFromRow(candidate);
    if (candidateName && normalizeDmTargetName(candidateName) === requestedKey) {
      return { id: candidate.id, name: candidateName };
    }
  }

  return null;
}

export function formatUnresolvedRoleplayDmFallback(command: DirectMessageCommand): string {
  const character = command.character.trim();
  const message = stripConversationPromptTimestamps(command.message).trim();
  if (!message) return "";
  return character ? `${character}: "${message}"` : message;
}

export function replaceRoleplayDmCommandText(source: string, command: DirectMessageCommand, replacement: string): string {
  if (command.raw && source.includes(command.raw)) {
    return source.replace(command.raw, replacement);
  }
  return source;
}
