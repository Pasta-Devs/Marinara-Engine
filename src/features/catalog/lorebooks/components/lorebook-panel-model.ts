import type { Lorebook } from "../../../../engine/contracts/types/lorebook";
import {
  resolveActiveLorebookScopeReasons,
  type ActiveLorebookScopeContext,
} from "../../../../engine/generation-core/lorebooks/active-lorebook-scope";
import type { LorebookPanelCategory } from "./lorebook-panel-config";

export type LorebookPanelSort = "name-asc" | "name-desc" | "newest" | "oldest" | "tokens";

function readTagArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === "string") : [];
}

function readParsedTagArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((tag) => typeof tag === "string") ? value : [];
}

export function parseLorebookTags(lorebook: Pick<Lorebook, "tags">): string[] {
  const raw = lorebook.tags;
  if (Array.isArray(raw)) return readTagArray(raw);
  if (typeof raw === "string")
    try {
      return readParsedTagArray(JSON.parse(raw));
    } catch {
      return [];
    }
  return [];
}

export function collectLorebookTags(lorebooks: readonly Lorebook[]): string[] {
  const tagSet = new Set<string>();
  for (const lorebook of lorebooks) {
    for (const tag of parseLorebookTags(lorebook)) tagSet.add(tag);
  }
  return Array.from(tagSet).sort();
}

export function filterLorebooksForPanel({
  lorebooks,
  activeCategory,
  activeScopeContext,
  activeTag,
  searchQuery,
  getCharacterNames,
  getPersonaNames,
}: {
  lorebooks: readonly Lorebook[];
  activeCategory: LorebookPanelCategory;
  activeScopeContext: ActiveLorebookScopeContext;
  activeTag: string | null;
  searchQuery: string;
  getCharacterNames: (lorebook: Lorebook) => string[];
  getPersonaNames: (lorebook: Lorebook) => string[];
}): Lorebook[] {
  let list = [...lorebooks];
  if (activeCategory === "active") {
    list = list.filter((lorebook) => resolveActiveLorebookScopeReasons(lorebook, activeScopeContext).length > 0);
  }
  if (activeTag) {
    list = list.filter((lorebook) => parseLorebookTags(lorebook).includes(activeTag));
  }
  if (!searchQuery) return list;

  const query = searchQuery.toLowerCase();
  return list.filter(
    (lorebook) =>
      lorebook.name.toLowerCase().includes(query) ||
      lorebook.description.toLowerCase().includes(query) ||
      getCharacterNames(lorebook).some((name) => name.toLowerCase().includes(query)) ||
      getPersonaNames(lorebook).some((name) => name.toLowerCase().includes(query)) ||
      parseLorebookTags(lorebook).some((tag) => tag.toLowerCase().includes(query)),
  );
}

export function sortLorebooksForPanel(lorebooks: readonly Lorebook[], sort: LorebookPanelSort): Lorebook[] {
  const list = [...lorebooks];
  switch (sort) {
    case "name-asc":
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return list.sort((a, b) => b.name.localeCompare(a.name));
    case "newest":
      return list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    case "oldest":
      return list.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    case "tokens":
      return list.sort((a, b) => (b.tokenBudget ?? 0) - (a.tokenBudget ?? 0));
  }
}

export function groupLorebooksByCategory(lorebooks: readonly Lorebook[]): Map<string, Lorebook[]> {
  const map = new Map<string, Lorebook[]>();
  for (const lorebook of lorebooks) {
    const category = lorebook.category || "uncategorized";
    const list = map.get(category) ?? [];
    list.push(lorebook);
    map.set(category, list);
  }
  return map;
}
