export type BackgroundLibrarySort = "name-asc" | "name-desc" | "newest" | "oldest";

export type SortableBackgroundLibraryItem = {
  id: string;
  filename: string;
  tag?: string;
  tags: string[];
  source?: "user" | "game_asset";
  createdAt: string;
};

export function getBackgroundLibraryTitle(background: SortableBackgroundLibraryItem): string {
  return background.filename || background.tag || "Background";
}

export function getNextBackgroundFolderName(folders: Array<{ name: string }>): string {
  const names = new Set(folders.map((folder) => folder.name.trim().toLowerCase()));
  if (!names.has("unnamed")) return "unnamed";
  let index = 2;
  while (names.has(`unnamed ${index}`)) index += 1;
  return `unnamed ${index}`;
}

export function filterAndSortBackgrounds<T extends SortableBackgroundLibraryItem>(
  backgrounds: T[],
  options: { search: string; includedTags: ReadonlySet<string>; sort: BackgroundLibrarySort },
): T[] {
  const query = options.search.trim().toLowerCase();
  const includedTags = new Set(Array.from(options.includedTags, (tag) => tag.toLowerCase()));
  const filtered = backgrounds.filter((background) => {
    if (includedTags.size > 0) {
      const backgroundTags = new Set(background.tags.map((tag) => tag.toLowerCase()));
      if (![...includedTags].some((tag) => backgroundTags.has(tag))) return false;
    }
    if (!query) return true;
    return [
      background.filename,
      background.tag ?? "",
      background.source === "game_asset" ? "game asset" : "library",
      ...background.tags,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return filtered.sort((a, b) => {
    const nameComparison = getBackgroundLibraryTitle(a).localeCompare(getBackgroundLibraryTitle(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (options.sort === "name-asc") return nameComparison;
    if (options.sort === "name-desc") return -nameComparison;
    const dateComparison = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    if (dateComparison !== 0) return options.sort === "newest" ? -dateComparison : dateComparison;
    return nameComparison;
  });
}

export type CharacterBackgroundGroupItem = {
  imageId: string;
  title: string;
  places: string | null;
  owner: { type: "character" | "persona"; id: string; name: string };
};

/**
 * Character and persona gallery backgrounds, one group per owner. The chat's owners come first
 * in chat order; everyone else follows A–Z. A search matches a place or the owner's name.
 */
export function groupCharacterBackgrounds<T extends CharacterBackgroundGroupItem>(
  chatBackgrounds: readonly T[],
  otherBackgrounds: readonly T[],
  search: string,
): Array<{ owner: T["owner"]; inChat: boolean; backgrounds: T[] }> {
  const query = search.trim().toLowerCase();
  const chatImageIds = new Set(chatBackgrounds.map((background) => background.imageId));
  const groups = new Map<string, { owner: T["owner"]; inChat: boolean; backgrounds: T[] }>();
  const add = (background: T, inChat: boolean) => {
    const text = [background.title, background.places ?? "", background.owner.name].join(" ").toLowerCase();
    if (query && !text.includes(query)) return;
    const key = `${background.owner.type}:${background.owner.id}`;
    const group = groups.get(key) ?? { owner: background.owner, inChat, backgrounds: [] as T[] };
    group.backgrounds.push(background);
    groups.set(key, group);
  };
  for (const background of chatBackgrounds) add(background, true);
  for (const background of otherBackgrounds) if (!chatImageIds.has(background.imageId)) add(background, false);
  const all = [...groups.values()];
  const others = all
    .filter((group) => !group.inChat)
    .sort((a, b) => a.owner.name.localeCompare(b.owner.name, undefined, { numeric: true, sensitivity: "base" }));
  return [...all.filter((group) => group.inChat), ...others];
}
