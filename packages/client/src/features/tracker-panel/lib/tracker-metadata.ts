import { getCharacterLookupAliases, type CharacterDisplayInfo } from "../../../lib/character-display";

interface CharacterLookupDisplayRow {
  character: { id: string };
  display: CharacterDisplayInfo;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseRecord(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRecord(raw) ? raw : {};
}

export function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

export function normalizeMaybeJsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return normalizeStringArray(value);
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return normalizeStringArray(parsed);
    if (typeof parsed === "string") {
      const parsedText = parsed.trim();
      return parsedText ? [parsedText] : [];
    }
    return [trimmed];
  } catch {
    return [trimmed];
  }
}

export function normalizeLookupText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function buildCharacterLookupMap(...candidateGroups: Array<readonly CharacterLookupDisplayRow[]>) {
  const idByLookupText = new Map<string, string>();

  for (const candidates of candidateGroups) {
    for (const { character, display } of candidates) {
      const nameKey = normalizeLookupText(display.name);
      if (nameKey && !idByLookupText.has(nameKey)) idByLookupText.set(nameKey, character.id);
    }
    for (const { character, display } of candidates) {
      const nameKey = normalizeLookupText(display.name);
      for (const alias of getCharacterLookupAliases(display)) {
        const aliasKey = normalizeLookupText(alias);
        if (aliasKey === nameKey) continue;
        if (aliasKey && !idByLookupText.has(aliasKey)) idByLookupText.set(aliasKey, character.id);
      }
    }
  }

  return idByLookupText;
}
