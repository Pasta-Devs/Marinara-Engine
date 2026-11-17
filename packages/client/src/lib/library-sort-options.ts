// The sort options the side panels share, with the short labels a sort menu needs. A panel says which
// ones it offers and which value each is stored as, so persisted sort settings keep their own strings.
import type { TFunction } from "i18next";
import type { SelectOption } from "../components/ui/Select";

export type LibrarySortKey = "az" | "za" | "newest" | "oldest" | "favorites" | "mostTokens" | "fewestTokens";

const LABEL_KEYS: Record<LibrarySortKey, string> = {
  az: "ui.panels.backgroundpicker.aZ",
  za: "ui.panels.backgroundpicker.zA",
  newest: "ui.panels.backgroundpicker.newest",
  oldest: "ui.panels.backgroundpicker.oldest",
  favorites: "ui.panels.backgroundpicker.favorites",
  mostTokens: "ui.panels.librarysort.mostTokens",
  fewestTokens: "ui.panels.librarysort.fewestTokens",
};

/** One common sort as a Select option, stored as `value`. */
export function librarySortOption<V extends string>(t: TFunction, key: LibrarySortKey, value: V): SelectOption<V> {
  return { value, label: t(LABEL_KEYS[key]) };
}

/** The common sorts a panel offers, in the order of `values` (sort key -> the value the panel stores for it). */
export function librarySortOptions<V extends string>(
  t: TFunction,
  values: Partial<Record<LibrarySortKey, V>>,
): SelectOption<V>[] {
  return (Object.keys(values) as LibrarySortKey[]).map((key) => librarySortOption(t, key, values[key]!));
}
