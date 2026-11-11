import {
  cardHasInteractiveOnboarding,
  estimateCharacterCardTokens,
  matchesAllCardSearchTags,
  normalizeNameAliases,
  normalizeTextForMatch,
  parseCardTagSearchTerms,
  PROFESSOR_MARI_ID,
  type CharacterData,
  type CharacterCatalogEntry,
  type CharacterCatalogPage,
  type CharacterCatalogSummaryEntry,
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

function sortEntries(entries: CachedCharacterCatalogEntry[], sort: string) {
  return [...entries].sort((a, b) => {
    if (sort === "favorites") {
      return Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
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
      if (query) {
        const tagTerms = parseCardTagSearchTerms(query);
        entries = entries.filter(
          (item) => item.searchText.includes(query) || matchesAllCardSearchTags(item.tags, tagTerms),
        );
      }
      if (options.favoriteFilter === "favorites") entries = entries.filter((item) => item.favorite);
      if (options.favoriteFilter === "non-favorites") entries = entries.filter((item) => !item.favorite);
      const lowerTags = (item: CachedCharacterCatalogEntry) => item.tags.map(normalizeTextForMatch);
      const excluded = new Set((options.excludeTags ?? []).map(normalizeTextForMatch));
      if (excluded.size > 0) entries = entries.filter((item) => !lowerTags(item).some((tag) => excluded.has(tag)));
      const included = new Set((options.tags ?? []).map(normalizeTextForMatch));
      const matchCount = new Map<string, number>();
      if (included.size > 0) {
        for (const item of entries) matchCount.set(item.id, lowerTags(item).filter((tag) => included.has(tag)).length);
        entries = entries.filter((item) => matchCount.get(item.id)! > 0);
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
  };
}
