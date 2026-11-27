import {
  cardHasInteractiveOnboarding,
  compareTokenEstimates,
  estimateCharacterCardTokens,
  isTokenSort,
  matchesAllCardSearchTags,
  normalizeNameAliases,
  normalizeTextForMatch,
  parseCardTagSearchTerms,
  PROFESSOR_MARI_ID,
  type CharacterData,
  type CharacterCatalogEntry,
  type CharacterCatalogPage,
  type CharacterCatalogSummaryEntry,
  type CharacterCatalogTagCounts,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { characterGroups, characters } from "../../db/schema/index.js";

type CachedCharacterCatalogEntry = CharacterCatalogEntry & {
  searchText: string;
  cardSpec: string;
  cardSpecVersion: string;
};

type CatalogOptions = {
  includeBuiltIn?: boolean;
  search?: string;
  sort?: string;
  favoriteFilter?: string;
  /** Any of these tags (case-insensitive); more matches rank first. */
  tags?: string[];
  /** "all": a card needs every tag in `tags` (the overhaul's tag selector). */
  tagMatch?: "any" | "all";
  /** Only cards without tags. */
  untagged?: boolean;
  /** "names": search only the name, other names and tags (the overhaul's Characters page), not the card text. */
  searchIn?: "all" | "names";
  excludeTags?: string[];
  /** A folder id, "none" for cards in no folder, or "any" for cards in some folder. */
  folder?: string;
  limit: number;
  offset: number;
};

type CatalogCache = { generation: number; entries: CachedCharacterCatalogEntry[] };
const caches = new WeakMap<DB, CatalogCache>();

function readData(value: string): CharacterData {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { name: "Unknown" } as CharacterData;
    }
    return parsed as CharacterData;
  } catch {
    return { name: "Unknown" } as CharacterData;
  }
}

function parseIdList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function strings(data: CharacterData, comment: string) {
  const extensions =
    data.extensions && typeof data.extensions === "object" ? (data.extensions as Record<string, unknown>) : {};
  const backstory = typeof extensions.backstory === "string" ? extensions.backstory : "";
  const appearance = typeof extensions.appearance === "string" ? extensions.appearance : "";
  const tags = Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string") : [];
  const nameAliases = normalizeNameAliases(extensions.nameAliases);
  return {
    tags,
    nameAliases,
    searchText: [
      data.name,
      ...nameAliases,
      comment,
      data.creator,
      data.character_version,
      data.creator_notes,
      data.summary,
      data.description,
      data.personality,
      data.scenario,
      data.first_mes,
      backstory,
      appearance,
      ...tags,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join("\n")
      .normalize("NFKC")
      .toLocaleLowerCase(),
  };
}

function entry(row: typeof characters.$inferSelect): CachedCharacterCatalogEntry {
  const data = readData(row.data);
  const { tags, nameAliases, searchText } = strings(data, row.comment ?? "");
  const extensions =
    data.extensions && typeof data.extensions === "object" ? (data.extensions as Record<string, unknown>) : {};
  const importMetadata =
    extensions.importMetadata && typeof extensions.importMetadata === "object"
      ? (extensions.importMetadata as Record<string, unknown>)
      : {};
  const cardMetadata =
    importMetadata.card && typeof importMetadata.card === "object"
      ? (importMetadata.card as Record<string, unknown>)
      : {};
  const embeddedMetadata =
    importMetadata.embeddedLorebook && typeof importMetadata.embeddedLorebook === "object"
      ? (importMetadata.embeddedLorebook as Record<string, unknown>)
      : {};
  const book = data.character_book as { entries?: unknown } | null | undefined;
  const hasEmbeddedLorebook =
    (Array.isArray(book?.entries) && book.entries.length > 0) || embeddedMetadata.hasEmbeddedLorebook === true;
  const summary =
    [data.summary, data.creator_notes, data.description, data.personality].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    ) ?? "";
  return {
    id: row.id,
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Unknown",
    nameAliases,
    comment: row.comment ?? "",
    creator: typeof data.creator === "string" ? data.creator : "",
    version: typeof data.character_version === "string" ? data.character_version : "",
    tags,
    favorite: extensions.fav === true,
    summary,
    explicitSummary: typeof data.summary === "string" ? data.summary : "",
    description: typeof data.description === "string" ? data.description : "",
    personality: typeof data.personality === "string" ? data.personality : "",
    scenario: typeof data.scenario === "string" ? data.scenario : "",
    firstMessage: typeof data.first_mes === "string" ? data.first_mes : "",
    creatorNotes: typeof data.creator_notes === "string" ? data.creator_notes : "",
    tokenEstimate: estimateCharacterCardTokens(data),
    hasOnboarding: cardHasInteractiveOnboarding(data),
    hasEmbeddedLorebook,
    nameColor: typeof extensions.nameColor === "string" ? extensions.nameColor : null,
    avatarPath: row.avatarPath ?? null,
    avatarCrop: extensions.avatarCrop ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    searchText,
    cardSpec: typeof cardMetadata.spec === "string" ? cardMetadata.spec : "",
    cardSpecVersion: typeof cardMetadata.specVersion === "string" ? cardMetadata.specVersion : "",
  };
}

/** Preserve list metadata while excluding the large prose fields from the all-rows response. */
export function toCharacterCatalogSummary(item: CachedCharacterCatalogEntry): CharacterCatalogSummaryEntry {
  const {
    searchText: _searchText,
    explicitSummary: _explicitSummary,
    description: _description,
    personality: _personality,
    scenario: _scenario,
    firstMessage: _firstMessage,
    creatorNotes: _creatorNotes,
    ...summary
  } = item;
  return { ...summary, summary: (summary.summary.trim() || "No creator notes yet.").slice(0, 200) };
}

/**
 * The overhaul Characters page search: name, other names or a tag contains the text, and "tag:" searches tags only.
 * Case and width are ignored (normalizeTextForMatch), the same as the page's own filter on loaded cards.
 */
function matchesCatalogNameSearch(item: CachedCharacterCatalogEntry, query: string) {
  const tags = item.tags.map(normalizeTextForMatch);
  if (query.startsWith("tag:")) {
    const tagQuery = query.slice(4).trim();
    return tags.some((tag) => tag.includes(tagQuery));
  }
  return (
    [item.name, ...item.nameAliases].some((name) => normalizeTextForMatch(name).includes(query)) ||
    tags.some((tag) => tag.includes(query))
  );
}

function sortEntries(entries: CachedCharacterCatalogEntry[], sort: string) {
  return [...entries].sort((a, b) => {
    if (sort === "favorites") {
      return Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    }
    if (isTokenSort(sort)) {
      return (
        compareTokenEstimates(sort, a.tokenEstimate, b.tokenEstimate) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
      );
    }
    if (sort === "name-desc") return b.name.localeCompare(a.name) || a.id.localeCompare(b.id);
    if (sort === "name-asc") return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    if (sort === "newest") return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
    return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
  });
}

export function createCharacterCatalog(db: DB) {
  async function getEntries(): Promise<{ entries: CachedCharacterCatalogEntry[]; generation: number }> {
    const cached = caches.get(db);
    const generation = db._fileStore.getTableWriteGeneration("characters");
    if (cached?.generation === generation) return { entries: cached.entries, generation };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const before = db._fileStore.getTableWriteGeneration("characters");
      const rows = await db.select().from(characters);
      const after = db._fileStore.getTableWriteGeneration("characters");
      if (before === after) {
        const entries = rows.map(entry);
        caches.set(db, { generation: after, entries });
        return { entries, generation: after };
      }
    }
    throw new Error("Character catalog changed repeatedly while loading.");
  }

  return {
    async list(
      options: CatalogOptions & { view?: "summary" },
    ): Promise<
      Omit<CharacterCatalogPage, "items"> & { items: CharacterCatalogEntry[] | CharacterCatalogSummaryEntry[] }
    > {
      const catalog = await getEntries();
      let entries = catalog.entries;
      if (!options.includeBuiltIn) entries = entries.filter((item) => item.id !== PROFESSOR_MARI_ID);
      const query = normalizeTextForMatch(options.search);
      if (query && options.searchIn === "names") {
        entries = entries.filter((item) => matchesCatalogNameSearch(item, query));
      } else if (query) {
        const tagTerms = parseCardTagSearchTerms(query);
        entries = entries.filter(
          (item) => item.searchText.includes(query) || matchesAllCardSearchTags(item.tags, tagTerms),
        );
      }
      if (options.untagged) entries = entries.filter((item) => !item.tags.some((tag) => tag.trim()));
      if (options.favoriteFilter === "favorites") entries = entries.filter((item) => item.favorite);
      if (options.favoriteFilter === "non-favorites") entries = entries.filter((item) => !item.favorite);
      const lowerTags = (item: CachedCharacterCatalogEntry) => item.tags.map(normalizeTextForMatch);
      const excluded = new Set((options.excludeTags ?? []).map(normalizeTextForMatch));
      if (excluded.size > 0) entries = entries.filter((item) => !lowerTags(item).some((tag) => excluded.has(tag)));
      const included = new Set((options.tags ?? []).map(normalizeTextForMatch));
      const matchCount = new Map<string, number>();
      if (included.size > 0) {
        for (const item of entries) matchCount.set(item.id, lowerTags(item).filter((tag) => included.has(tag)).length);
        const needed = options.tagMatch === "all" ? included.size : 1;
        entries = entries.filter((item) => matchCount.get(item.id)! >= needed);
      }
      entries = sortEntries(entries, options.sort ?? "");
      // Same order as the panel: favourites first when sorted by favourite, then most matching tags.
      if (included.size > 0)
        entries.sort(
          (a, b) =>
            (options.sort === "favorites" ? Number(b.favorite) - Number(a.favorite) : 0) ||
            matchCount.get(b.id)! - matchCount.get(a.id)!,
        );

      const folderOf = new Map<string, string[]>();
      for (const group of await db.select().from(characterGroups)) {
        for (const id of parseIdList(group.characterIds)) folderOf.set(id, [...(folderOf.get(id) ?? []), group.id]);
      }
      // Favourite sort lifts folders that hold a favourite, also when their members are not loaded.
      const favoriteFolderIds = new Set<string>();
      for (const item of entries)
        if (item.favorite) for (const id of folderOf.get(item.id) ?? []) favoriteFolderIds.add(id);
      // Size sort orders folders by their matching members' total, also when those members are not loaded.
      const folderTokenTotals: Record<string, number> = {};
      if (isTokenSort(options.sort))
        for (const item of entries)
          for (const id of folderOf.get(item.id) ?? [])
            folderTokenTotals[id] = (folderTokenTotals[id] ?? 0) + item.tokenEstimate;
      if (options.folder === "none") entries = entries.filter((item) => !folderOf.has(item.id));
      else if (options.folder === "any") entries = entries.filter((item) => folderOf.has(item.id));
      else if (options.folder) entries = entries.filter((item) => folderOf.get(item.id)?.includes(options.folder!));

      const limit = options.view === "summary" ? entries.length : options.limit;
      const offset = options.view === "summary" ? 0 : options.offset;
      const page = entries.slice(offset, offset + limit + 1);
      const items: CharacterCatalogEntry[] | CharacterCatalogSummaryEntry[] =
        options.view === "summary"
          ? page.slice(0, limit).map(toCharacterCatalogSummary)
          : page
              .slice(0, limit)
              .map(
                ({ searchText: _searchText, cardSpec: _cardSpec, cardSpecVersion: _cardSpecVersion, ...full }) => full,
              );
      return {
        items,
        limit,
        offset,
        hasMore: page.length > limit,
        catalogGeneration: catalog.generation,
        total: entries.length,
        favoriteFolderIds: [...favoriteFolderIds],
        folderTokenTotals,
      };
    },
    /** Every tag in the library, for filter chips that must not depend on loaded pages. */
    async tags(includeBuiltIn: boolean): Promise<string[]> {
      const { entries } = await getEntries();
      const tags = new Set<string>();
      for (const item of entries)
        if (includeBuiltIn || item.id !== PROFESSOR_MARI_ID) for (const tag of item.tags) tags.add(tag);
      return [...tags].sort((a, b) => a.localeCompare(b));
    },
    /** Every tag with how many cards carry it, plus the untagged and favourite counts, for the overhaul's tag selector. */
    async tagCounts(includeBuiltIn: boolean): Promise<CharacterCatalogTagCounts> {
      const { entries } = await getEntries();
      const counts = new Map<string, { tag: string; count: number }>();
      let untagged = 0;
      let favorites = 0;
      for (const item of entries) {
        if (!includeBuiltIn && item.id === PROFESSOR_MARI_ID) continue;
        if (item.favorite) favorites += 1;
        const seen = new Set<string>();
        for (const raw of item.tags) {
          const tag = raw.trim();
          const key = tag.toLowerCase();
          if (!tag || seen.has(key)) continue;
          seen.add(key);
          const found = counts.get(key);
          if (found) found.count += 1;
          else counts.set(key, { tag, count: 1 });
        }
        if (!seen.size) untagged += 1;
      }
      return {
        tags: [...counts.values()].sort((a, b) => a.tag.localeCompare(b.tag)),
        untagged,
        favorites,
        total: entries.filter((item) => includeBuiltIn || item.id !== PROFESSOR_MARI_ID).length,
      };
    },
  };
}
