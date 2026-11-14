export type CharacterGreeting = { text: string; alternateIndex: number | null };

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export type GreetingEntry = { tags: string[]; title: string; preview: string };

const GREETING_TAG_PREFIX = /^\s*((?:\[[^[\]\n]{1,24}\]\s*)+)/;
// A leading `**Title**`, or a `(Title)` on its own line, names the greeting.
const GREETING_TITLE_PREFIX = /^\s*(?:\*\*([^*\n]{1,80})\*\*|\(([^()\n]{1,80})\)[ \t]*(?:\n|$))/;

/** Splits a greeting into its leading `[tag]` groups, a title and the text after it. */
export function parseGreeting(text: string, allowTags = true): GreetingEntry {
  const match = allowTags ? GREETING_TAG_PREFIX.exec(text) : null;
  const tags = match ? [...match[1]!.matchAll(/\[([^\]]+)\]/g)].map((tag) => tag[1]!.trim()) : [];
  const rest = match ? text.slice(match[0].length) : text;
  const named = GREETING_TITLE_PREFIX.exec(rest);
  if (named) {
    const preview = rest.slice(named[0].length).replace(/[*_"]/g, "").trim();
    return { tags, title: (named[1] ?? named[2])!.trim(), preview };
  }
  const plain = rest.replace(/[*_"]/g, "").trim();
  const cut = plain.search(/[.!?](?=\s|$)|\n/);
  if (cut < 0) return { tags, title: plain, preview: "" };
  const end = plain[cut] === "\n" ? cut : cut + 1;
  return { tags, title: plain.slice(0, end).trim(), preview: plain.slice(end).trim() };
}

/** Brackets count as tags only when at least two greetings use them, so a single `[OOC]` opener stays text. */
export function parseGreetings(texts: readonly string[]): GreetingEntry[] {
  const tagged = texts.filter((text) => GREETING_TAG_PREFIX.test(text)).length >= 2;
  return texts.map((text) => parseGreeting(text, tagged));
}

/** Reads a card's first message plus alternate greetings, in the order they should be offered. */
export function readCharacterGreetings(data: unknown): {
  greetings: CharacterGreeting[];
  dialogueColor?: string;
} {
  const parsed = typeof data === "string" ? safeParse(data) : data;
  if (!parsed || typeof parsed !== "object") return { greetings: [] };
  const card = parsed as { first_mes?: unknown; alternate_greetings?: unknown; extensions?: unknown };
  const greetings: CharacterGreeting[] = [];
  if (typeof card.first_mes === "string" && card.first_mes.trim()) {
    greetings.push({ text: card.first_mes.trim(), alternateIndex: null });
  }
  if (Array.isArray(card.alternate_greetings)) {
    card.alternate_greetings.forEach((greeting, index) => {
      if (typeof greeting === "string" && greeting.trim()) {
        greetings.push({ text: greeting.trim(), alternateIndex: index + 1 });
      }
    });
  }
  const dialogueColor =
    card.extensions && typeof card.extensions === "object"
      ? (card.extensions as { dialogueColor?: unknown }).dialogueColor
      : undefined;
  return {
    greetings,
    dialogueColor: typeof dialogueColor === "string" && dialogueColor.trim() ? dialogueColor.trim() : undefined,
  };
}
