import {
  PROFESSOR_MARI_ID,
  type CharacterData,
  type CharacterCatalogEntry,
  type CharacterCatalogPage,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { characters } from "../../db/schema/index.js";

type CachedCharacterCatalogEntry = CharacterCatalogEntry & { searchText: string };

type CatalogOptions = {
  includeBuiltIn?: boolean;
  search?: string;
  sort?: string;
  favoriteFilter?: string;
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

function strings(data: CharacterData, comment: string) {
  const extensions =
    data.extensions && typeof data.extensions === "object" ? (data.extensions as Record<string, unknown>) : {};
  const backstory = typeof extensions.backstory === "string" ? extensions.backstory : "";
  const appearance = typeof extensions.appearance === "string" ? extensions.appearance : "";
  const tags = Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string") : [];
  return {
    tags,
    searchText: [
      data.name,
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
      .toLocaleLowerCase(),
  };
}

function entry(row: typeof characters.$inferSelect): CachedCharacterCatalogEntry {
  const data = readData(row.data);
  const { tags, searchText } = strings(data, row.comment ?? "");
  const extensions =
    data.extensions && typeof data.extensions === "object" ? (data.extensions as Record<string, unknown>) : {};
  const summary =
    [data.summary, data.creator_notes, data.description, data.personality].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    ) ?? "";
  const textFields = [
    data.name,
    row.comment,
    data.creator,
    data.character_version,
    data.creator_notes,
    data.summary,
    data.description,
    data.personality,
    data.scenario,
    data.first_mes,
    extensions.backstory,
    extensions.appearance,
    ...tags,
  ];
  return {
    id: row.id,
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Unknown",
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
    tokenEstimate: Math.ceil(
      textFields.filter((value): value is string => typeof value === "string").join("\n").length / 4,
    ),
    nameColor: typeof extensions.nameColor === "string" ? extensions.nameColor : null,
    avatarPath: row.avatarPath ?? null,
    avatarCrop: extensions.avatarCrop ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    searchText,
  };
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
    async list(options: CatalogOptions): Promise<CharacterCatalogPage> {
      const catalog = await getEntries();
      let entries = catalog.entries;
      if (!options.includeBuiltIn) entries = entries.filter((item) => item.id !== PROFESSOR_MARI_ID);
      const query = options.search?.trim().toLocaleLowerCase();
      if (query) entries = entries.filter((item) => item.searchText.includes(query));
      if (options.favoriteFilter === "favorites") entries = entries.filter((item) => item.favorite);
      if (options.favoriteFilter === "non-favorites") entries = entries.filter((item) => !item.favorite);
      entries = sortEntries(entries, options.sort ?? "");
      const page = entries.slice(options.offset, options.offset + options.limit + 1);
      return {
        items: page.slice(0, options.limit).map(({ searchText: _searchText, ...item }) => item),
        limit: options.limit,
        offset: options.offset,
        hasMore: page.length > options.limit,
        catalogGeneration: catalog.generation,
      };
    },
  };
}
