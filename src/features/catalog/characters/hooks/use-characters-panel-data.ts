import { useMemo } from "react";

import { characterAvatarUrl } from "../lib/character-avatar-url";
import {
  filterCharacterRows,
  parseCharacterGroups,
  sortCharacterRows,
  type FavoriteFilter,
  type ParsedCharacterRow,
  type SortOption,
} from "../lib/characters-panel-model";
import type { CharacterScopedSearchTerm } from "../lib/character-search";

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function useCharactersPanelData({
  assigningToGroup,
  excludedTags,
  favoriteFilter,
  groups,
  includedTags,
  parsedCharacters,
  searchExcludedTags,
  scopedSearchTerms,
  sort,
}: {
  assigningToGroup: string | null;
  excludedTags: ReadonlySet<string>;
  favoriteFilter: FavoriteFilter;
  groups: unknown;
  includedTags: ReadonlySet<string>;
  parsedCharacters: ParsedCharacterRow[];
  searchExcludedTags: readonly string[];
  scopedSearchTerms: readonly CharacterScopedSearchTerm[];
  sort: SortOption;
}) {
  const charMap = useMemo(() => {
    const map = new Map<
      string,
      { name: string; comment?: string | null; avatarPath: string | null; avatarCrop?: unknown }
    >();
    for (const character of parsedCharacters) {
      const extensions = readRecord(character.parsed.extensions);
      map.set(character.id, {
        name: typeof character.parsed.name === "string" ? character.parsed.name : "Unknown",
        comment: character.comment,
        avatarPath: characterAvatarUrl(character),
        avatarCrop: extensions.avatarCrop,
      });
    }
    return map;
  }, [parsedCharacters]);

  const filteredCharacters = useMemo(() => {
    return filterCharacterRows({
      characters: parsedCharacters,
      favoriteFilter,
      includedTags,
      excludedTags,
      searchExcludedTags,
      scopedTerms: scopedSearchTerms,
    });
  }, [parsedCharacters, favoriteFilter, includedTags, excludedTags, searchExcludedTags, scopedSearchTerms]);

  const sortedCharacters = useMemo(
    () => sortCharacterRows(filteredCharacters, sort, includedTags),
    [filteredCharacters, includedTags, sort],
  );

  const parsedGroups = useMemo(() => parseCharacterGroups(groups, parsedCharacters), [groups, parsedCharacters]);

  const assigningGroup = useMemo(() => {
    if (!assigningToGroup) return null;
    const group = parsedGroups.find((candidate) => candidate.id === assigningToGroup);
    if (!group) return null;
    return { id: group.id, memberIds: group.memberIds };
  }, [assigningToGroup, parsedGroups]);

  return {
    assigningGroup,
    charMap,
    filteredCharacters,
    parsedGroups,
    sortedCharacters,
  };
}
