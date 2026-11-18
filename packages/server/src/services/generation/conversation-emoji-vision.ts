import type { CustomEmojiSelectionPrefs } from "@marinara-engine/shared";

import { EMOJI_SHEET_MAX_ITEMS, renderEmojiSheet, type EmojiSheetItem } from "./conversation-emoji-sheet.js";

/**
 * Conversation emoji vision: a model that reads images sees the custom emojis and stickers used in recent messages
 * (and the ones offered for its reply) as one numbered picture sheet per kind, with the exact names in text.
 */

/** Every custom emoji and sticker the responders can see this turn, by name, plus what was offered for the reply. */
export type ConversationAssetVisionCatalog = {
  emojiPaths: Map<string, string>;
  stickerPaths: Map<string, string>;
  offeredEmojis: string[];
  offeredStickers: string[];
  /** Short descriptions by name, shown for pictures the offered list does not already describe. */
  emojiDescriptions: Map<string, string>;
  stickerDescriptions: Map<string, string>;
};

export function createConversationAssetVisionCatalog(): ConversationAssetVisionCatalog {
  return {
    emojiPaths: new Map(),
    stickerPaths: new Map(),
    offeredEmojis: [],
    offeredStickers: [],
    emojiDescriptions: new Map(),
    stickerDescriptions: new Map(),
  };
}

/** Keep the first path recorded for a name: callers record the responder's own, then the persona's, then global. */
export function recordVisionAssetPath(paths: Map<string, string>, name: string, path: string | null | undefined) {
  if (!name || !path || paths.has(name)) return;
  paths.set(name, path);
}

const STICKER_TOKEN = /sticker:([a-z0-9_]{1,32}):/g;
const EMOJI_TOKEN = /:([a-z0-9_]{1,32}):/g;

/**
 * Models often write a sticker as an emoji (`:hug:` for `sticker:hug:`). Rewrite a bare `:name:` into a sticker token
 * when the name is a sticker the responders can see and no custom emoji has that name, so it shows as the sticker, and
 * the reverse: `sticker:name:` for a custom emoji with no sticker of that name becomes `:name:`.
 */
export function rewriteStickerNamesWrittenAsEmojis(
  text: string,
  stickerNames: ReadonlySet<string> | Map<string, unknown>,
  emojiNames: ReadonlySet<string> | Map<string, unknown>,
): { text: string; changed: boolean } {
  if ((stickerNames.size === 0 && emojiNames.size === 0) || !text.includes(":")) return { text, changed: false };
  // A sticker the reply already sends is not sent twice: its bare `:name:` copy is dropped instead.
  const alreadySent = new Set([...text.matchAll(STICKER_TOKEN)].map((match) => match[1]!));
  let out = "";
  let cursor = 0;
  for (const match of text.matchAll(/(sticker)?:([a-z0-9_]{1,32}):/g)) {
    const [whole, prefix, name] = match;
    const start = match.index!;
    // Leave word-joined colons alone ("a:hug:b"), which are not emoji tokens.
    if (start > 0 && /[a-z0-9_]/i.test(text[start - 1]!)) continue;
    const end = start + whole.length;
    if (prefix) {
      // The mirror case: an emoji's name sent as a sticker (`sticker:oof:` with no sticker of that name) shows the emoji.
      if (!stickerNames.has(name!) && emojiNames.has(name!)) {
        out += `${text.slice(cursor, start)}:${name}:`;
        cursor = end;
      }
      continue;
    }
    if (!stickerNames.has(name!) || emojiNames.has(name!)) continue;
    if (!alreadySent.has(name!)) {
      alreadySent.add(name!);
      out += `${text.slice(cursor, start)}sticker:${name}:`;
      cursor = end;
      continue;
    }
    // Drop only the duplicate and one space beside it; a copy alone on its line takes its line break with it.
    let dropStart = start;
    let dropEnd = end;
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const lineEndAt = text.indexOf("\n", end);
    const lineEnd = lineEndAt === -1 ? text.length : lineEndAt;
    if (text.slice(lineStart, start).trim() === "" && text.slice(end, lineEnd).trim() === "" && lineStart >= cursor) {
      dropStart = lineStart;
      dropEnd = lineEndAt === -1 ? lineEnd : lineEnd + 1;
      // The last line has no line break after it: take the one before it instead.
      if (lineEndAt === -1 && lineStart > cursor) dropStart = lineStart - 1;
    } else if (text[end] === " ") {
      dropEnd = end + 1;
    } else if (start > cursor && text[start - 1] === " ") {
      dropStart = start - 1;
    }
    out += text.slice(cursor, dropStart);
    cursor = dropEnd;
  }
  if (cursor === 0) return { text, changed: false };
  out += text.slice(cursor);
  return { text: out, changed: out !== text };
}

/** Custom emoji and sticker names written in the given texts, newest text first, each name once. */
export function extractCustomAssetNames(textsNewestFirst: string[]): { emojis: string[]; stickers: string[] } {
  const emojis: string[] = [];
  const stickers: string[] = [];
  for (const text of textsNewestFirst) {
    for (const match of text.matchAll(STICKER_TOKEN)) {
      if (!stickers.includes(match[1]!)) stickers.push(match[1]!);
    }
    // A sticker token contains ":name:"; blank stickers out so they are not read as emojis too.
    const withoutStickers = text.replace(STICKER_TOKEN, " ");
    for (const match of withoutStickers.matchAll(EMOJI_TOKEN)) {
      if (!emojis.includes(match[1]!)) emojis.push(match[1]!);
    }
  }
  return { emojis, stickers };
}

type VisionMessage = {
  role: string;
  content: string;
  contextKind?: string | null;
  images?: string[];
};

/** The texts the vision setting looks at: the newest history message, or the last N, newest first. */
export function visionSourceTexts(messages: readonly VisionMessage[], prefs: CustomEmojiSelectionPrefs): string[] {
  if (prefs.visionMode === "off") return [];
  const limit = prefs.visionMode === "last" ? 1 : prefs.visionRecentCount;
  const texts: string[] = [];
  for (let i = messages.length - 1; i >= 0 && texts.length < limit; i--) {
    const message = messages[i]!;
    if (message.contextKind !== "history") continue;
    texts.push(message.content);
  }
  return texts;
}

type SheetEntry = { name: string; seen: boolean; offered: boolean };

function pickSheetEntries(
  seen: string[],
  offered: string[],
  paths: Map<string, string>,
  offeredLimit: number,
  max: number,
): SheetEntry[] {
  const offeredSet = new Set(offered.slice(0, offeredLimit));
  const entries: SheetEntry[] = [];
  for (const name of seen) {
    if (entries.length >= max) break;
    if (paths.has(name)) entries.push({ name, seen: true, offered: offeredSet.has(name) });
  }
  for (const name of offered.slice(0, offeredLimit)) {
    if (entries.length >= max) break;
    if (paths.has(name) && !entries.some((entry) => entry.name === name)) {
      entries.push({ name, seen: false, offered: true });
    }
  }
  return entries;
}

function describeEntry(number: number, token: string, entry: SheetEntry, description?: string): string {
  const tags = [entry.seen ? "in the chat" : null, entry.offered ? "you may use it" : null].filter(Boolean);
  // An offered one is already described in the list of ones it may use; the rest get theirs here.
  const note = description && !entry.offered ? `: ${description}` : "";
  return `${number} = ${token} (${tags.join(", ")})${note}`;
}

export type ConversationEmojiVisionLegend = {
  message: { role: "user"; contextKind: "injection"; content: string; images: string[] };
  images: string[];
};

/**
 * Build the legend message: up to one sheet of emojis and one of stickers, numbered in one run, and the text that
 * maps each number to its exact name. Null when nothing qualifies or the sheets cannot be drawn.
 */
export async function buildConversationEmojiVisionLegend(
  messages: readonly VisionMessage[],
  prefs: CustomEmojiSelectionPrefs,
  catalog: ConversationAssetVisionCatalog,
): Promise<ConversationEmojiVisionLegend | null> {
  if (prefs.visionMode === "off") return null;
  const seen = extractCustomAssetNames(visionSourceTexts(messages, prefs));
  const emojiEntries = pickSheetEntries(
    seen.emojis,
    catalog.offeredEmojis,
    catalog.emojiPaths,
    prefs.visionOfferedCount,
    EMOJI_SHEET_MAX_ITEMS.emoji,
  );
  const stickerEntries = pickSheetEntries(
    seen.stickers,
    catalog.offeredStickers,
    catalog.stickerPaths,
    prefs.visionOfferedCount,
    EMOJI_SHEET_MAX_ITEMS.sticker,
  );
  if (emojiEntries.length === 0 && stickerEntries.length === 0) return null;

  const emojiItems: EmojiSheetItem[] = emojiEntries.map((entry, index) => ({
    number: index + 1,
    path: catalog.emojiPaths.get(entry.name)!,
  }));
  const stickerItems: EmojiSheetItem[] = stickerEntries.map((entry, index) => ({
    number: emojiEntries.length + index + 1,
    path: catalog.stickerPaths.get(entry.name)!,
  }));
  const [emojiSheet, stickerSheet] = await Promise.all([
    emojiItems.length ? renderEmojiSheet("emoji", emojiItems) : Promise.resolve(null),
    stickerItems.length ? renderEmojiSheet("sticker", stickerItems) : Promise.resolve(null),
  ]);

  const lines: string[] = [];
  const images: string[] = [];
  if (emojiSheet) {
    images.push(emojiSheet.dataUrl);
    const drawn = new Set(emojiSheet.numbers);
    lines.push(`Picture ${images.length}, custom emojis:`);
    emojiEntries.forEach((entry, index) => {
      if (drawn.has(index + 1)) {
        lines.push(describeEntry(index + 1, `:${entry.name}:`, entry, catalog.emojiDescriptions.get(entry.name)));
      }
    });
  }
  if (stickerSheet) {
    images.push(stickerSheet.dataUrl);
    const drawn = new Set(stickerSheet.numbers);
    lines.push(`Picture ${images.length}, stickers:`);
    stickerEntries.forEach((entry, index) => {
      const number = emojiEntries.length + index + 1;
      if (drawn.has(number)) {
        lines.push(describeEntry(number, `sticker:${entry.name}:`, entry, catalog.stickerDescriptions.get(entry.name)));
      }
    });
  }
  if (images.length === 0) return null;

  const content = [
    "[Custom emoji and sticker pictures]",
    "These pictures show what the custom emojis and stickers below look like. Each is labelled with a number. Use this to understand them when they appear in the chat and to choose fitting ones. Always write the exact token after the = sign, never the number.",
    ...lines,
  ].join("\n");
  return { message: { role: "user", contextKind: "injection", content, images }, images };
}

/** Insert the legend just before the newest history message, after anything a provider caches. */
export function insertConversationEmojiVisionLegend<T extends { role: string; contextKind?: string | null }>(
  messages: T[],
  legend: T,
): void {
  let insertAt = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.contextKind === "history") {
      insertAt = i;
      break;
    }
  }
  if (insertAt < 0) {
    insertAt = messages.at(-1)?.role === "assistant" ? messages.length - 1 : messages.length;
  }
  messages.splice(insertAt, 0, legend);
}
