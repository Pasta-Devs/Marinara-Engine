export type CharacterSearchData = Record<string, unknown> & {
  tags?: unknown;
};

type CharacterSearchScope = "name" | "title" | "tag" | "description" | "personality";

export type CharacterScopedSearchTerm = {
  scope: CharacterSearchScope;
  value: string;
};

export type CharacterSearchQuery = {
  text: string;
  terms: string[];
  excludedTags: string[];
  scopedTerms: CharacterScopedSearchTerm[];
};

const NEGATED_TAG_PATTERN = /(^|\s)(?:-|!)(?:tag:|#)(?:"([^"]+)"|(\S+))/gi;
const SCOPED_TERM_PATTERN = /(^|\s)(name|title|comment|tag|tags|description|desc|personality):(?:"([^"]+)"|(\S+))/gi;

function splitCharacterSearchTerms(value: string): string[] {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function parseCharacterSearchQuery(value: string): CharacterSearchQuery {
  const excludedTags: string[] = [];
  const scopedTerms: CharacterScopedSearchTerm[] = [];
  const withoutExcludedTags = value
    .replace(
      NEGATED_TAG_PATTERN,
      (_match, leadingSpace: string, quoted: string | undefined, bare: string | undefined) => {
        const tag = (quoted ?? bare ?? "").trim();
        if (tag) excludedTags.push(tag.toLowerCase());
        return leadingSpace ? " " : "";
      },
    )
    .trim();
  const text = withoutExcludedTags
    .replace(
      SCOPED_TERM_PATTERN,
      (_match, leadingSpace: string, rawScope: string, quoted: string | undefined, bare: string | undefined) => {
        const value = (quoted ?? bare ?? "").trim();
        const scope = normalizeSearchScope(rawScope);
        if (scope && value) scopedTerms.push({ scope, value });
        return leadingSpace ? " " : "";
      },
    )
    .replace(/\s+/g, " ")
    .trim();

  return {
    text,
    terms: splitCharacterSearchTerms(text),
    excludedTags,
    scopedTerms,
  };
}

function normalizeSearchScope(value: string): CharacterSearchScope | null {
  switch (value.toLowerCase()) {
    case "name":
      return "name";
    case "title":
    case "comment":
      return "title";
    case "tag":
    case "tags":
      return "tag";
    case "description":
    case "desc":
      return "description";
    case "personality":
      return "personality";
    default:
      return null;
  }
}

export function getCharacterTagsFromData(data: CharacterSearchData | null | undefined): string[] {
  if (!Array.isArray(data?.tags)) return [];
  return data.tags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter((tag): tag is string => tag.length > 0);
}

function normalizedTagSet(data: CharacterSearchData | null | undefined): Set<string> {
  return new Set(getCharacterTagsFromData(data).map((tag) => tag.toLowerCase()));
}

export function characterHasAnyExcludedTag(
  data: CharacterSearchData | null | undefined,
  excludedTags: Iterable<string>,
): boolean {
  const tags = normalizedTagSet(data);
  for (const tag of excludedTags) {
    if (tags.has(tag.toLowerCase())) return true;
  }
  return false;
}

export function countIncludedTagMatches(
  data: CharacterSearchData | null | undefined,
  includedTags: Iterable<string>,
): number {
  const tags = normalizedTagSet(data);
  let matches = 0;
  for (const tag of includedTags) {
    if (tags.has(tag.toLowerCase())) matches += 1;
  }
  return matches;
}

function fieldText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function fieldMatches(value: unknown, term: string): boolean {
  const haystack = fieldText(value).toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function tagMatches(data: CharacterSearchData | null | undefined, term: string): boolean {
  const normalizedTerm = term.toLowerCase();
  return getCharacterTagsFromData(data).some((tag) => tag.toLowerCase().includes(normalizedTerm));
}

export function characterMatchesScopedSearchTerms({
  data,
  comment,
  scopedTerms,
}: {
  data: CharacterSearchData | null | undefined;
  comment?: string | null;
  scopedTerms: readonly CharacterScopedSearchTerm[];
}): boolean {
  if (scopedTerms.length === 0) return true;
  return scopedTerms.every((term) => {
    switch (term.scope) {
      case "name":
        return fieldMatches(data?.name, term.value);
      case "title":
        return fieldMatches(comment, term.value);
      case "tag":
        return tagMatches(data, term.value);
      case "description":
        return fieldMatches(data?.description, term.value);
      case "personality":
        return fieldMatches(data?.personality, term.value);
      default:
        return true;
    }
  });
}
