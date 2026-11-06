// How Game Mode matches a generated card, a `who=` target or a stored sheet to a character by
// name. Shared so the setup wizard predicts the match exactly as the server will make it.
export function normalizeCharacterLookupName(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      // Not `toLocaleLowerCase`: the wizard and the server must derive the same key, and a host
      // locale (Turkish dotless i) would make them disagree about whose sheet is whose.
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
  );
}

/** Words a name may carry that pick out nobody on their own. */
export const CHARACTER_NAME_PARTICLES: ReadonlySet<string> = new Set([
  "the",
  "of",
  "and",
  "von",
  "van",
  "der",
  "de",
  "del",
  "la",
  "le",
  "du",
]);

/** A nickname written inside a name, in quotes or brackets: `Marigold "Mars" Thimblewick`. */
const WRITTEN_NICKNAME = /(^|\s)["“'‘(]([^"“”'‘’()\n]{1,40})["”'’)](?=\s|$)/gu;

/** The name with any nickname written inside it taken out, or null when it carries none. */
export function characterNameWithoutNickname(name: string): string | null {
  const without = name.replace(WRITTEN_NICKNAME, "$1").replace(/\s+/gu, " ").trim();
  return without && without !== name.trim() ? without : null;
}

function uniqueKeyForWords(all: readonly string[], wanted: string): string | null {
  if (all.includes(wanted)) return all.indexOf(wanted) === all.lastIndexOf(wanted) ? wanted : null;
  const words = wanted.split(" ");
  if (!words.some((word) => word.length >= 3 && !CHARACTER_NAME_PARTICLES.has(word))) return null;
  const matches = [...new Set(all.filter((key) => words.every((word) => key.split(" ").includes(word))))];
  return matches.length === 1 && all.indexOf(matches[0]!) === all.lastIndexOf(matches[0]!) ? matches[0]! : null;
}

/**
 * The one card key a name picks out: the card's whole name, or a name every word of which is one of
 * a single card's words ("Lethariel" for "Lethariel Moonwhisper", "Moonwhisper" too). A name with a
 * nickname written inside it is also read without it (cheap-GM playtest 2026-10-26:
 * `who="Marigold "Mars" Thimblewick"` for the card "Marigold Thimblewick" matched no sheet). Null
 * when no card answers, when two do, and for a name made only of particles like "the". `keys` are
 * normalized card names, as `normalizeCharacterLookupName` writes them.
 */
export function uniqueCharacterKeyFor(keys: Iterable<string>, name: string): string | null {
  const all = [...keys].filter(Boolean);
  const wanted = normalizeCharacterLookupName(name);
  if (!wanted) return null;
  const found = uniqueKeyForWords(all, wanted);
  if (found) return found;
  const without = characterNameWithoutNickname(name);
  const plain = without ? normalizeCharacterLookupName(without) : "";
  return plain && plain !== wanted ? uniqueKeyForWords(all, plain) : null;
}
