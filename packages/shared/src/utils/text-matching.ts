export function normalizeTextForMatch(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/gu, " ") : "";
}

export function includesTextForMatch(value: unknown, query: unknown): boolean {
  const normalizedQuery = normalizeTextForMatch(query);
  if (!normalizedQuery) return true;
  return normalizeTextForMatch(value).includes(normalizedQuery);
}

export function startsWithTextForMatch(value: unknown, query: unknown): boolean {
  const normalizedQuery = normalizeTextForMatch(query);
  if (!normalizedQuery) return true;
  return normalizeTextForMatch(value).startsWith(normalizedQuery);
}

/** Positive card tags are space/comma separated; quote tags containing either. */
export function parseCardTagSearchTerms(text: string): string[] {
  const terms = Array.from(normalizeTextForMatch(text).matchAll(/"([^"]+)"|([^\s,"]+)/gu), (match) =>
    normalizeTextForMatch(match[1] ?? match[2]),
  );
  return [...new Set(terms.filter(Boolean))];
}

export function matchesAllCardSearchTags(tags: unknown, terms: readonly string[]): boolean {
  if (!Array.isArray(tags) || terms.length === 0) return false;
  const normalizedTags = new Set(tags.filter((tag) => typeof tag === "string").map(normalizeTextForMatch));
  return terms.every((term) => normalizedTags.has(term));
}
