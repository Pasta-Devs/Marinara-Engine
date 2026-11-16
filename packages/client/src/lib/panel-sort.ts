import { compareTokenEstimates, isTokenSort, type TokenSort } from "@marinara-engine/shared";

export const BASIC_PANEL_SORT_OPTIONS = ["name-asc", "name-desc", "newest", "oldest"] as const;

export type BasicPanelSort = (typeof BASIC_PANEL_SORT_OPTIONS)[number];

export function normalizeBasicPanelSort(value: unknown): BasicPanelSort {
  return BASIC_PANEL_SORT_OPTIONS.includes(value as BasicPanelSort) ? (value as BasicPanelSort) : "name-asc";
}

/** The sorts a card library offers: the basic ones plus the size pair. */
export type LibrarySort = BasicPanelSort | TokenSort;

/** A stored `"tokens"` (the old largest-first persona sort) lands on Most tokens. */
export function normalizeLibrarySort(value: unknown): LibrarySort {
  if (value === "tokens") return "tokens-desc";
  return isTokenSort(value) ? value : normalizeBasicPanelSort(value);
}

function normalizeTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareNames(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "");
}

export function sortBasicPanelItems<T>(
  items: readonly T[],
  sort: BasicPanelSort,
  getName: (item: T) => string | null | undefined,
  getTimestamp: (item: T) => string | null | undefined,
) {
  const list = [...items];
  switch (sort) {
    case "name-desc":
      return list.sort((a, b) => compareNames(getName(b), getName(a)));
    case "newest":
      return list.sort(
        (a, b) =>
          normalizeTimestamp(getTimestamp(b)) - normalizeTimestamp(getTimestamp(a)) ||
          compareNames(getName(a), getName(b)),
      );
    case "oldest":
      return list.sort(
        (a, b) =>
          normalizeTimestamp(getTimestamp(a)) - normalizeTimestamp(getTimestamp(b)) ||
          compareNames(getName(a), getName(b)),
      );
    case "name-asc":
    default:
      return list.sort((a, b) => compareNames(getName(a), getName(b)));
  }
}

export function sortPanelFolders<T extends { name: string; createdAt?: string; sortOrder?: number }>(
  folders: readonly T[],
  sort: BasicPanelSort | "custom",
) {
  if (sort === "custom") return [...folders].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return sortBasicPanelItems(
    folders,
    sort,
    (folder) => folder.name,
    (folder) => folder.createdAt,
  );
}

/** Size sort for items: by token estimate in the sort's direction, then by name. */
export function sortItemsByTokens<T>(
  items: readonly T[],
  sort: TokenSort,
  getTokens: (item: T) => number | null | undefined,
  getName: (item: T) => string | null | undefined,
) {
  return [...items].sort(
    (a, b) => compareTokenEstimates(sort, getTokens(a), getTokens(b)) || compareNames(getName(a), getName(b)),
  );
}

/** Size sort for folders: by their members' total tokens in the sort's direction, then by name. */
export function sortFoldersByTokens<T extends { id: string; name: string }>(
  folders: readonly T[],
  sort: TokenSort,
  getTotal: (folder: T) => number,
) {
  return sortItemsByTokens(folders, sort, getTotal, (folder) => folder.name);
}
