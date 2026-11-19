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
const GREETING_TITLE_PREFIX = /^\s*(?:\*\*([^*\n]{1,80})\*\*|\(([^()\n]{1,80})\)[ \t]*(?:\r?\n|$))/;

/** Splits a greeting into its leading `[tag]` groups, a title and the text after it. */
export function parseGreeting(text: string, allowTags = true): GreetingEntry {
  const match = allowTags ? GREETING_TAG_PREFIX.exec(text) : null;
  const tags = match ? [...match[1]!.matchAll(/\[([^\]]+)\]/g)].map((tag) => tag[1]!.trim()) : [];
  const rest = match ? text.slice(match[0].length) : text;
  const named = GREETING_TITLE_PREFIX.exec(rest);
  if (named) {
    const preview = rest.slice(named[0].length).replace(/[*_"]/g, "").trim();
    return { tags, title: (named[1] ?? named[2])!.trim(), preview: dropRepeatedHeader(rest, preview) };
  }
  const plain = rest.replace(/[*_"]/g, "").trim();
  const cut = plain.search(/[.!?](?=\s|$)|\n/);
  if (cut < 0) return { tags, title: plain, preview: "" };
  const end = plain[cut] === "\n" ? cut : cut + 1;
  const preview = plain.slice(end).trim();
  return { tags, title: plain.slice(0, end).trim(), preview: match ? dropRepeatedHeader(rest, preview) : preview };
}

/** Lists from this size on get search and filters, in the picker and in the character editor. */
export const GREETING_LIST_MIN = 8;

/** A greeting's tag group and title line as written, so `tagText + titleText + rest` is the exact text. */
export function splitGreetingHeader(text: string, allowTags = true) {
  const match = allowTags ? GREETING_TAG_PREFIX.exec(text) : null;
  const tagText = match?.[0] ?? "";
  const after = text.slice(tagText.length);
  const named = GREETING_TITLE_PREFIX.exec(after);
  const titleText = named ? named[0] + (/^\r?\n/.exec(after.slice(named[0].length))?.[0] ?? "") : "";
  return {
    tags: match ? [...match[1]!.matchAll(/\[([^\]]+)\]/g)].map((tag) => tag[1]!.trim()) : [],
    tagText,
    title: named ? (named[1] ?? named[2])! : "",
    titleText,
    rest: text.slice(tagText.length + titleText.length),
  };
}

/** Writes new tags and a new title into a greeting; keeps the author's header form and the text under it. */
export function setGreetingHeader(text: string, tags: readonly string[], title: string, allowTags = true) {
  const header = splitGreetingHeader(text, allowTags);
  const gap = header.tagText ? /\s*$/.exec(header.tagText)![0] : " ";
  const tagText = tags.length ? `${tags.map((tag) => `[${tag}]`).join("")}${gap}` : "";
  if (!title.trim()) return tagText + header.rest;
  const titleText = header.titleText ? header.titleText.replace(header.title, () => title) : `**${title}**\n`;
  return tagText + titleText + header.rest;
}

/** Some cards repeat their header line right under it; leave the copy out of what the picker shows. */
function dropRepeatedHeader(text: string, after: string): string {
  return stripRepeatedHeader(text.trimStart().split("\n", 1)[0]!, after);
}

/** A header or repeat line reduced to its words: no markup, quotes or one pair of parentheses. */
function plainHeader(line: string): string {
  const bare = line.replace(/[*_"]/g, "").trim();
  return (/^\((.*)\)$/.exec(bare)?.[1] ?? bare).trim();
}

/** Drops the first line of `after` when it repeats `header` as a whole line, so "Drago" keeps the "Drago asked" that follows it. */
function stripRepeatedHeader(header: string, after: string): string {
  const nl = after.indexOf("\n");
  const first = nl < 0 ? after : after.slice(0, nl);
  const title = plainHeader(header);
  return title && plainHeader(first) === title ? (nl < 0 ? "" : after.slice(nl + 1).trim()) : after;
}

/** The greeting without its header line (tags, a title line, or a repeat of them), markup kept. */
export function greetingBody(text: string, allowTags = true): string {
  const lines = text.trimStart().split("\n");
  const header = lines[0]!.trim();
  const isHeader = (allowTags && GREETING_TAG_PREFIX.test(header)) || GREETING_TITLE_PREFIX.test(header + "\n");
  if (!isHeader) return text.trim();
  const tags = allowTags ? GREETING_TAG_PREFIX.exec(header) : null;
  const rest = tags ? header.slice(tags[0].length) : header;
  const named = GREETING_TITLE_PREFIX.exec(rest);
  const afterTitle = named ? rest.slice(named[0].length) : rest;
  // Prose after a plain-sentence title shares the header line; keep it.
  const cut = named ? -1 : afterTitle.search(/[.!?](?=\s|$)/);
  const lead = named ? afterTitle : cut < 0 ? "" : afterTitle.slice(cut + 1);
  const below = stripRepeatedHeader(rest, lines.slice(1).join("\n").trimStart());
  // Header and text may share one line: with nothing below, keep what follows the tags or title.
  return [lead.trim(), below].filter(Boolean).join("\n") || afterTitle.trim();
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
