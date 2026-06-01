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

export function useCharactersPanelData({
  assigningToGroup,
  excludedTags,
  favoriteFilter,
  groups,
  includedTags,
  parsedCharacters,
  searchExcludedTags,
  sort,
}: {
  assigningToGroup: string | null;
  excludedTags: ReadonlySet<string>;
  favoriteFilter: FavoriteFilter;
  groups: unknown;
  includedTags: ReadonlySet<string>;
  parsedCharacters: ParsedCharacterRow[];
  searchExcludedTags: readonly string[];
  sort: SortOption;
}) {
  const charMap = useMemo(() => {
    const map = new Map<
      string,
      { name: string; comment?: string | null; avatarPath: string | null; avatarCrop?: unknown }
    >();
    for (const character of parsedCharacters) {
      map.set(character.id, {
        name: character.parsed.name ?? "Unknown",
        comment: character.comment,
        avatarPath: characterAvatarUrl(character),
        avatarCrop: character.parsed.extensions?.avatarCrop,
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
    });
  }, [parsedCharacters, favoriteFilter, includedTags, excludedTags, searchExcludedTags]);

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
