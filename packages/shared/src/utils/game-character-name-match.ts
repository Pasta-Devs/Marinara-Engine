// Matching a character by the names the story calls them: exact first, then a variant (a first name,
// a name without its title). Shared so a fight on the server finds the same game card the client does.

const NAME_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "il",
  "la",
  "le",
  "el",
  "los",
  "las",
  "de",
  "del",
  "della",
  "da",
  "di",
  "du",
  "der",
  "van",
  "von",
]);

function normalizeCharacterName(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      // Keep letters/numbers from any script (plus combining marks so e.g. the
      // katakana voiced-sound mark survives) instead of ASCII-only [a-z0-9].
      // ASCII-only normalization collapsed non-Latin names (Japanese, Cyrillic,
      // etc.) to an empty string, so speaker lookups for those names always failed.
      .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
      .trim()
  );
}

function getCharacterNameTokens(name: string): string[] {
  const normalized = normalizeCharacterName(name);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .filter((token) => token.length > 2 || /\d/.test(token))
    .filter((token) => !NAME_STOP_WORDS.has(token));
}

function buildCharacterNameVariants(name: string): string[] {
  const normalized = normalizeCharacterName(name);
  if (!normalized) return [];

  const variants = new Set<string>([normalized]);
  const tokens = getCharacterNameTokens(name);
  if (tokens.length > 0) {
    variants.add(tokens.join(" "));
    for (const token of tokens) {
      variants.add(token);
    }
  }

  return [...variants];
}

function includesWholeVariant(left: string, right: string): boolean {
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length < 3) return false;
  return ` ${longer} `.includes(` ${shorter} `);
}

function isSubsetMatch(leftTokens: string[], rightTokens: string[]): boolean {
  if (leftTokens.length === 0 || rightTokens.length === 0) return false;
  const smaller = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const larger = leftTokens.length <= rightTokens.length ? rightTokens : leftTokens;
  return smaller.every((token) => larger.includes(token));
}

export function characterNamesMatch(leftName: string, rightName: string): boolean {
  const leftVariants = buildCharacterNameVariants(leftName);
  const rightVariants = buildCharacterNameVariants(rightName);
  if (leftVariants.length === 0 || rightVariants.length === 0) return false;

  const rightVariantSet = new Set(rightVariants);
  if (leftVariants.some((variant) => rightVariantSet.has(variant))) {
    return true;
  }

  for (const leftVariant of leftVariants) {
    for (const rightVariant of rightVariants) {
      if (includesWholeVariant(leftVariant, rightVariant)) {
        return true;
      }
    }
  }

  return isSubsetMatch(getCharacterNameTokens(leftName), getCharacterNameTokens(rightName));
}

/** Titles a short form may carry that never name the person ("Ms. Kirijo" is Mitsuru Kirijo). */
const NAME_TITLE_WORDS = new Set(["mr", "mrs", "ms", "dr", "sr", "jr", "st"]);

/** Name words for short forms: unlike {@link getCharacterNameTokens}, two-letter names such as "Li" count. */
function getShortFormNameTokens(name: string): string[] {
  const normalized = normalizeCharacterName(name);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .filter((token) => token.length > 1 || /\d/.test(token))
    .filter((token) => !NAME_STOP_WORDS.has(token) && !NAME_TITLE_WORDS.has(token));
}

/**
 * Whether `shortName` is a short form of `fullName`, such as its first name, its surname or the
 * name without a title. Unlike {@link characterNamesMatch}, sharing one word is not enough.
 */
export function isShortFormOfCharacterName(shortName: string, fullName: string): boolean {
  // A title on one side only is ignored, but two different titles are two people: "Mr. Tanaka" is not "Mrs. Tanaka".
  const titles = (name: string) =>
    [
      ...new Set(
        normalizeCharacterName(name)
          .split(/\s+/)
          .filter((token) => NAME_TITLE_WORDS.has(token)),
      ),
    ]
      .sort()
      .join(" ");
  const shortTitles = titles(shortName);
  const fullTitles = titles(fullName);
  if (shortTitles && fullTitles && shortTitles !== fullTitles) return false;
  // An initial must start one of the full name's words: "J. Smith" is John Smith, never Bob Smith.
  const fullWords = normalizeCharacterName(fullName).split(/\s+/);
  const initials = normalizeCharacterName(shortName)
    .split(/\s+/)
    .filter((token) => token.length === 1 && /\p{L}/u.test(token));
  if (initials.some((initial) => !fullWords.some((word) => word.startsWith(initial)))) return false;
  const shortTokens = getShortFormNameTokens(shortName);
  const fullTokens = getShortFormNameTokens(fullName);
  return shortTokens.length <= fullTokens.length && isSubsetMatch(shortTokens, fullTokens);
}

export function findNamedEntry<T>(
  entries: Iterable<T>,
  targetName: string,
  getName: (entry: T) => string | null | undefined,
): T | undefined {
  const normalizedTarget = normalizeCharacterName(targetName);
  if (!normalizedTarget) return undefined;

  const allEntries = [...entries];

  const exact = allEntries.find((entry) => normalizeCharacterName(getName(entry) ?? "") === normalizedTarget);
  if (exact) return exact;

  const variantExact = allEntries.find((entry) => characterNamesMatch(getName(entry) ?? "", targetName));
  if (variantExact) return variantExact;

  return undefined;
}

/** Whether an entry carries exactly this name, not only a variant of it. */
export function hasExactNamedEntry<T>(
  entries: Iterable<T>,
  targetName: string,
  getName: (entry: T) => string | null | undefined,
): boolean {
  const normalizedTarget = normalizeCharacterName(targetName);
  if (!normalizedTarget) return false;
  for (const entry of entries) {
    if (normalizeCharacterName(getName(entry) ?? "") === normalizedTarget) return true;
  }
  return false;
}

export function findNamedMapValue<T>(map: Map<string, T>, targetName: string): T | undefined {
  const entry = findNamedEntry(map.entries(), targetName, ([name]) => name);
  return entry?.[1];
}
