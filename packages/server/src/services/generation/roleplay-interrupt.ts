const words = new Intl.Segmenter(undefined, { granularity: "word" });
const quotePairs: Record<string, string> = {
  '"': '"',
  "'": "'",
  "“": "”",
  "‘": "’",
  "„": "“",
  "«": "»",
  "「": "」",
  "『": "』",
};

/** Resolve a literal, unique interruption point without changing the original message. */
export function prepareRoleplayInterruption(
  content: string,
  part: string,
): { ok: true; content: string } | { ok: false; error: string } {
  if ([...words.segment(part)].filter((segment) => segment.isWordLike).length < 3)
    return { ok: false, error: "The interruption quote must contain at least three words." };

  const literal = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A lookahead includes overlapping occurrences; the model's text is never a regex.
  const matches = content.matchAll(new RegExp(`(?=${literal})`, "gu"));
  const match = matches.next().value;
  if (!match) return { ok: false, error: "The interruption quote was not found in the latest message." };
  if (!matches.next().done)
    return { ok: false, error: "The interruption quote matches more than once; quote a longer unique passage." };

  let prefix = content.slice(0, match.index + part.length).trimEnd();
  const openQuotes: string[] = [];
  let closedSuffix = "";
  const characters = [...prefix];
  for (let index = 0; index < characters.length; index++) {
    const character = characters[index]!;
    if (character === "\\") {
      closedSuffix = "";
      index++;
      continue;
    }
    // Apostrophes inside words do not open or close dialogue.
    if (
      (character === "'" || character === "’") &&
      /[\p{L}\p{N}]/u.test(characters[index - 1] ?? "") &&
      /[\p{L}\p{N}]/u.test(characters[index + 1] ?? "")
    )
      continue;
    if (openQuotes.at(-1) === character) {
      openQuotes.pop();
      closedSuffix += character;
    } else {
      if (character.trim()) closedSuffix = "";
      // A trailing possessive apostrophe or inch mark is not a dialogue opener.
      if (character === "'" && /[\p{L}\p{N}]/u.test(characters[index - 1] ?? "")) continue;
      if (character === '"' && /\p{N}/u.test(characters[index - 1] ?? "")) continue;
      if (quotePairs[character]) openQuotes.push(quotePairs[character]!);
    }
  }
  // If the quoted span already includes a dialogue closer, place the dash inside it.
  const closingQuotes = prefix.endsWith(closedSuffix) ? closedSuffix : "";
  if (closingQuotes) prefix = prefix.slice(0, -closingQuotes.length).trimEnd();
  prefix = prefix.replace(/[.,!?;:…。！？；：，、—–-]+$/u, "").trimEnd();
  return { ok: true, content: `${prefix}—${closingQuotes}${openQuotes.reverse().join("")}` };
}
