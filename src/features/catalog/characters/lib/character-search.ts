export type CharacterSearchData = Record<string, unknown> & {
  tags?: unknown;
};

export type CharacterSearchQuery = {
  text: string;
  terms: string[];
  excludedTags: string[];
};

const NEGATED_TAG_PATTERN = /(^|\s)(?:-|!)(?:tag:|#)(?:"([^"]+)"|(\S+))/gi;

function splitCharacterSearchTerms(value: string): string[] {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function parseCharacterSearchQuery(value: string): CharacterSearchQuery {
  const excludedTags: string[] = [];
  const text = value
    .replace(
      NEGATED_TAG_PATTERN,
      (_match, leadingSpace: string, quoted: string | undefined, bare: string | undefined) => {
        const tag = (quoted ?? bare ?? "").trim();
        if (tag) excludedTags.push(tag.toLowerCase());
        return leadingSpace ? " " : "";
      },
    )
    .replace(/\s+/g, " ")
    .trim();

  return {
    text,
    terms: splitCharacterSearchTerms(text),
    excludedTags,
  };
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
