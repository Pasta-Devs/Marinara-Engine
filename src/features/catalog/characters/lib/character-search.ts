export type CharacterSearchData = Record<string, unknown> & {
  tags?: unknown;
};

export type CharacterSearchRow = {
  data?: CharacterSearchData | null;
  comment?: unknown;
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

function asSearchText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function searchTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asSearchText).filter(Boolean);
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

function characterExtensionSearchValues(data: CharacterSearchData): string[] {
  const extensions = data.extensions;
  if (!extensions || typeof extensions !== "object" || Array.isArray(extensions)) return [];
  const record = extensions as Record<string, unknown>;
  const depthPrompt = record.depth_prompt;
  const altDescriptions = Array.isArray(record.altDescriptions) ? record.altDescriptions : [];

  return [
    asSearchText(record.backstory),
    asSearchText(record.appearance),
    asSearchText(record.world),
    depthPrompt && typeof depthPrompt === "object" && !Array.isArray(depthPrompt)
      ? asSearchText((depthPrompt as Record<string, unknown>).prompt)
      : "",
    ...altDescriptions.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const alt = entry as Record<string, unknown>;
      return [asSearchText(alt.label), asSearchText(alt.content)].filter(Boolean);
    }),
  ].filter(Boolean);
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

export function characterMatchesSearchTerms(row: CharacterSearchRow, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const data = row.data ?? {};
  const fields = [
    asSearchText(data.name),
    asSearchText(row.comment),
    asSearchText(data.creator),
    asSearchText(data.creator_notes),
    asSearchText(data.description),
    asSearchText(data.personality),
    asSearchText(data.scenario),
    asSearchText(data.first_mes),
    asSearchText(data.mes_example),
    asSearchText(data.system_prompt),
    asSearchText(data.post_history_instructions),
    ...searchTextList(data.alternate_greetings),
    ...characterExtensionSearchValues(data),
    ...getCharacterTagsFromData(data).map((tag) => tag.toLowerCase()),
  ].filter(Boolean);

  return terms.every((term) => fields.some((field) => field.includes(term)));
}
