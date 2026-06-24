export const BASIC_PANEL_SORT_OPTIONS = ["name-asc", "name-desc", "newest", "oldest"] as const;

export type BasicPanelSort = (typeof BASIC_PANEL_SORT_OPTIONS)[number];

export function normalizeBasicPanelSort(value: unknown): BasicPanelSort {
  return BASIC_PANEL_SORT_OPTIONS.includes(value as BasicPanelSort) ? (value as BasicPanelSort) : "name-asc";
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
