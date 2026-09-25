import type { CharacterGroup } from "@marinara-engine/shared";

export type CharacterIdentityChoice = {
  id: string;
  data: string | Record<string, unknown>;
  avatarPath?: string | null;
  comment?: string | null;
};

export type CharacterIdentityGroup = CharacterGroup & { members: CharacterIdentityChoice[] };

function parseIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function buildCharacterIdentityGroups(
  characters: CharacterIdentityChoice[],
  characterGroups: CharacterGroup[],
  ungroupedLabel: string,
): CharacterIdentityGroup[] {
  const characterMap = new Map(characters.map((character) => [character.id, character]));
  const groupedIds = new Set<string>();
  const groups = characterGroups
    .map((group) => {
      const members = parseIds(group.characterIds)
        .map((id) => characterMap.get(id))
        .filter((character): character is CharacterIdentityChoice => Boolean(character));
      members.forEach((character) => groupedIds.add(character.id));
      return { ...group, members };
    })
    .filter((group) => group.members.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const ungrouped = characters.filter((character) => !groupedIds.has(character.id));
  if (ungrouped.length > 0) {
    groups.push({
      id: "__ungrouped-character-persona__",
      name: ungroupedLabel,
      description: "",
      avatarPath: null,
      characterIds: ungrouped.map((character) => character.id),
      createdAt: "",
      updatedAt: "",
      members: ungrouped,
    });
  }
  return groups;
}
