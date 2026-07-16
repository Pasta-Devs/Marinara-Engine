export type BackgroundLibrarySort = "name-asc" | "name-desc" | "newest" | "oldest";

export type SortableBackgroundLibraryItem = {
  id: string;
  filename: string;
  originalName: string | null;
  tag?: string;
  tags: string[];
  source?: "user" | "game_asset";
  createdAt: string;
};

export function getBackgroundLibraryTitle(background: SortableBackgroundLibraryItem): string {
  return background.filename || background.originalName || background.tag || "Background";
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
      background.originalName ?? "",
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
