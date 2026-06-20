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
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // Keep letters/numbers from any script (plus combining marks so e.g. the
    // katakana voiced-sound mark survives) instead of ASCII-only [a-z0-9].
    // ASCII-only normalization collapsed non-Latin names (Japanese, Cyrillic,
    // etc.) to an empty string, so speaker lookups for those names always failed.
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
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

export function findNamedMapValue<T>(map: Map<string, T>, targetName: string): T | undefined {
  const entry = findNamedEntry(map.entries(), targetName, ([name]) => name);
  return entry?.[1];
}
