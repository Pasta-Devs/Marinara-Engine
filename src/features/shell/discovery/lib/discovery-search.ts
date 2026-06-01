import type { DiscoveryCategory, DiscoveryCoverage, DiscoveryEntry } from "../discovery-types";

export interface DiscoveryFilters {
  category: DiscoveryCategory | "All";
  coverage: DiscoveryCoverage | "All";
}

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function searchableText(entry: DiscoveryEntry) {
  return normalize(
    [
      entry.title,
      entry.category,
      entry.summary,
      entry.audience,
      entry.where,
      entry.coverage,
      ...entry.keywords,
    ].join(" "),
  );
}

function matchesDiscoveryEntry(entry: DiscoveryEntry, query: string) {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = searchableText(entry);
  return terms.every((term) => haystack.includes(term));
}

function searchDiscoveryEntries(entries: readonly DiscoveryEntry[], query: string) {
  return entries.filter((entry) => matchesDiscoveryEntry(entry, query));
}

export function filterDiscoveryEntries(
  entries: readonly DiscoveryEntry[],
  query: string,
  filters: DiscoveryFilters,
) {
  return searchDiscoveryEntries(entries, query).filter((entry) => {
    if (filters.category !== "All" && entry.category !== filters.category) return false;
    if (filters.coverage !== "All" && entry.coverage !== filters.coverage) return false;
    return true;
  });
}
