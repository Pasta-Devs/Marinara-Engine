import {
  getCharacterLookupAliasCandidates,
  type CharacterDisplayInfo,
  type CharacterLookupAliasKind,
} from "./character-display";

export interface CharacterLookupDisplayRow {
  character: { id: string };
  display: CharacterDisplayInfo;
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
    return normalizeStringArray(JSON.parse(trimmed));
  } catch {
    return [trimmed];
  }
}

export function normalizeLookupText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

const ALIAS_LOOKUP_KIND_ORDER: readonly CharacterLookupAliasKind[] = [
  "fullTitle",
  "explicitAlias",
  "parenthetical",
  "titleLead",
];

interface LookupCandidate {
  characterId: string;
  key: string;
}

function addUniqueLookupTier(candidates: readonly LookupCandidate[], idByLookupText: Map<string, string>) {
  const idsByKey = new Map<string, Set<string>>();
  const firstIdByKey = new Map<string, string>();

  for (const candidate of candidates) {
    if (!candidate.key || idByLookupText.has(candidate.key)) continue;

    firstIdByKey.set(candidate.key, firstIdByKey.get(candidate.key) ?? candidate.characterId);

    const ids = idsByKey.get(candidate.key) ?? new Set<string>();
    ids.add(candidate.characterId);
    idsByKey.set(candidate.key, ids);
  }

  for (const [key, ids] of idsByKey) {
    if (ids.size !== 1 || idByLookupText.has(key)) continue;

    const characterId = firstIdByKey.get(key);
    if (characterId) idByLookupText.set(key, characterId);
  }
}

export function addExactNameLookups(
  candidates: readonly CharacterLookupDisplayRow[],
  idByLookupText: Map<string, string>,
) {
  addUniqueLookupTier(
    candidates.map(({ character, display }) => ({
      characterId: character.id,
      key: normalizeLookupText(display.name),
    })),
    idByLookupText,
  );
}

export function addAliasLookups(candidates: readonly CharacterLookupDisplayRow[], idByLookupText: Map<string, string>) {
  const aliasCandidatesByKind = new Map<CharacterLookupAliasKind, LookupCandidate[]>();

  for (const kind of ALIAS_LOOKUP_KIND_ORDER) aliasCandidatesByKind.set(kind, []);

  for (const { character, display } of candidates) {
    const nameKey = normalizeLookupText(display.name);

    for (const alias of getCharacterLookupAliasCandidates(display)) {
      const aliasKey = normalizeLookupText(alias.text);
      if (!aliasKey || aliasKey === nameKey) continue;

      const tier = aliasCandidatesByKind.get(alias.kind);
      if (tier) {
        tier.push({
          characterId: character.id,
          key: aliasKey,
        });
      }
    }
  }

  for (const kind of ALIAS_LOOKUP_KIND_ORDER) {
    addUniqueLookupTier(aliasCandidatesByKind.get(kind) ?? [], idByLookupText);
  }
}
