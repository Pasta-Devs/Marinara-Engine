import { normalizeCharacterGroupMemberIds } from "./character-groups";
import {
  characterMatchesScopedSearchTerms,
  characterHasAnyExcludedTag,
  countIncludedTagMatches,
  getCharacterTagsFromData,
  type CharacterScopedSearchTerm,
  type CharacterSearchData,
} from "./character-search";

export type CharacterRow = {
  id: string;
  data: CharacterSearchData & Record<string, unknown>;
  comment?: string | null;
  avatarPath?: string | null;
  avatarFilePath?: string | null;
  avatarFilename?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type GroupRow = {
  id: string;
  name: string;
  description?: string;
  characterIds?: unknown;
  avatarPath?: string | null;
};

export type ParsedCharacterRow = CharacterRow & { parsed: Record<string, unknown> };

export type ParsedGroupRow = Omit<GroupRow, "characterIds"> & {
  characterIds: string[];
  memberIds: string[];
  isSynthetic?: boolean;
};

export type SortOption = "name-asc" | "name-desc" | "newest" | "oldest" | "favorites";
export type FavoriteFilter = "all" | "favorites" | "non-favorites";

const UNGROUPED_CHARACTER_GROUP_ID = "__ungrouped-characters__";

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function characterExtensions(char: ParsedCharacterRow): Record<string, unknown> {
  return readRecord(char.parsed.extensions);
}

export function parseCharacterRows(characters: unknown): ParsedCharacterRow[] {
  if (!characters) return [];
  return (characters as CharacterRow[]).map((char) => ({
    ...char,
    parsed: char.data ?? { name: "Unknown", description: "" },
  }));
}

export function getCharacterTags(char: ParsedCharacterRow): string[] {
  return getCharacterTagsFromData(char.parsed);
}

export function getCharacterPreviewMetadata(char: ParsedCharacterRow): string | null {
  const parts: string[] = [];
  const creator = typeof char.parsed.creator === "string" ? char.parsed.creator.trim() : "";
  const version = typeof char.parsed.character_version === "string" ? char.parsed.character_version.trim() : "";
  const extensions = characterExtensions(char);
  const importMetadata = readRecord(extensions.importMetadata);
  const cardMetadata =
    importMetadata.card && typeof importMetadata.card === "object"
      ? (importMetadata.card as Record<string, unknown>)
      : {};
  const spec = typeof cardMetadata.spec === "string" ? cardMetadata.spec.trim() : "";
  const specVersion = typeof cardMetadata.specVersion === "string" ? cardMetadata.specVersion.trim() : "";
  const tags = getCharacterTags(char);

  if (creator) parts.push(`by ${creator}`);
  if (version) parts.push(`v${version}`);
  if (spec) parts.push(spec);
  if (specVersion) parts.push(`spec ${specVersion}`);
  if (parts.length > 0) return parts.join(" · ");
  if (tags.length > 0) return tags.slice(0, 3).join(" · ");
  return null;
}

export function filterCharacterRows({
  characters,
  favoriteFilter,
  includedTags,
  excludedTags,
  searchExcludedTags,
  scopedTerms,
}: {
  characters: ParsedCharacterRow[];
  favoriteFilter: FavoriteFilter;
  includedTags: ReadonlySet<string>;
  excludedTags: ReadonlySet<string>;
  searchExcludedTags: readonly string[];
  scopedTerms: readonly CharacterScopedSearchTerm[];
}): ParsedCharacterRow[] {
  let list = characters;
  if (favoriteFilter === "favorites") {
    list = list.filter((c) => characterExtensions(c).fav);
  } else if (favoriteFilter === "non-favorites") {
    list = list.filter((c) => !characterExtensions(c).fav);
  }
  if (includedTags.size > 0) {
    list = list.filter((c) => countIncludedTagMatches(c.parsed, includedTags) > 0);
  }
  const excludedTagFilters = new Set([...Array.from(excludedTags, (tag) => tag.toLowerCase()), ...searchExcludedTags]);
  if (excludedTagFilters.size > 0) {
    list = list.filter((c) => !characterHasAnyExcludedTag(c.parsed, excludedTagFilters));
  }
  if (scopedTerms.length > 0) {
    list = list.filter((c) => characterMatchesScopedSearchTerms({ data: c.parsed, comment: c.comment, scopedTerms }));
  }
  return list;
}

export function collectCharacterTags(characters: ParsedCharacterRow[]): string[] {
  const tagSet = new Set<string>();
  for (const c of characters) {
    for (const tag of getCharacterTags(c)) {
      tagSet.add(tag);
    }
  }
  return [...tagSet].sort((a, b) => a.localeCompare(b));
}

export function sortCharacterRows(
  characters: ParsedCharacterRow[],
  sort: SortOption,
  includedTags: ReadonlySet<string>,
): ParsedCharacterRow[] {
  const list = [...characters];
  const hasIncludedTags = includedTags.size > 0;
  const matchCounts = hasIncludedTags
    ? new Map(list.map((char) => [char.id, countIncludedTagMatches(char.parsed, includedTags)]))
    : null;
  const compareIncludedTagMatches = (left: ParsedCharacterRow, right: ParsedCharacterRow) => {
    if (!matchCounts) return 0;
    return (matchCounts.get(right.id) ?? 0) - (matchCounts.get(left.id) ?? 0);
  };

  switch (sort) {
    case "name-asc":
      return list.sort(
        (a, b) => compareIncludedTagMatches(a, b) || readString(a.parsed.name).localeCompare(readString(b.parsed.name)),
      );
    case "name-desc":
      return list.sort(
        (a, b) => compareIncludedTagMatches(a, b) || readString(b.parsed.name).localeCompare(readString(a.parsed.name)),
      );
    case "newest":
      return list.sort(
        (a, b) => compareIncludedTagMatches(a, b) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
      );
    case "oldest":
      return list.sort(
        (a, b) => compareIncludedTagMatches(a, b) || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
      );
    case "favorites":
      return list.sort((a, b) => {
        const aFav = characterExtensions(a).fav ? 1 : 0;
        const bFav = characterExtensions(b).fav ? 1 : 0;
        if (bFav !== aFav) return bFav - aFav;
        const tagMatchDiff = compareIncludedTagMatches(a, b);
        if (tagMatchDiff !== 0) return tagMatchDiff;
        return readString(a.parsed.name).localeCompare(readString(b.parsed.name));
      });
    default:
      return list;
  }
}

export function parseCharacterGroups(groups: unknown, parsedCharacters: ParsedCharacterRow[]): ParsedGroupRow[] {
  if (!groups) return [];
  const assignedIds = new Set<string>();
  const realGroups = (groups as GroupRow[]).map((group) => {
    const memberIds = normalizeCharacterGroupMemberIds(group.characterIds);
    for (const id of memberIds) assignedIds.add(id);
    return {
      ...group,
      characterIds: memberIds,
      memberIds,
    };
  });
  const ungroupedMemberIds = parsedCharacters
    .filter((char) => !assignedIds.has(char.id))
    .sort((a, b) => readString(a.parsed.name).localeCompare(readString(b.parsed.name)))
    .map((char) => char.id);
  if (ungroupedMemberIds.length === 0) return realGroups;
  return [
    ...realGroups,
    {
      id: UNGROUPED_CHARACTER_GROUP_ID,
      name: "Ungrouped",
      description: "Characters not assigned to any group",
      characterIds: ungroupedMemberIds,
      avatarPath: null,
      memberIds: ungroupedMemberIds,
      isSynthetic: true,
    },
  ];
}
