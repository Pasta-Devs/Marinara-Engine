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
};

export function createConversationAssetVisionCatalog(): ConversationAssetVisionCatalog {
  return { emojiPaths: new Map(), stickerPaths: new Map(), offeredEmojis: [], offeredStickers: [] };
}

/** Keep the first path recorded for a name: callers record the responder's own, then the persona's, then global. */
export function recordVisionAssetPath(paths: Map<string, string>, name: string, path: string | null | undefined) {
  if (!name || !path || paths.has(name)) return;
  paths.set(name, path);
}

const STICKER_TOKEN = /sticker:([a-z0-9_]{1,32}):/g;
const EMOJI_TOKEN = /:([a-z0-9_]{1,32}):/g;

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

function describeEntry(number: number, token: string, entry: SheetEntry): string {
  const tags = [entry.seen ? "in the chat" : null, entry.offered ? "you may use it" : null].filter(Boolean);
  return `${number} = ${token} (${tags.join(", ")})`;
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
      if (drawn.has(index + 1)) lines.push(describeEntry(index + 1, `:${entry.name}:`, entry));
    });
  }
  if (stickerSheet) {
    images.push(stickerSheet.dataUrl);
    const drawn = new Set(stickerSheet.numbers);
    lines.push(`Picture ${images.length}, stickers:`);
    stickerEntries.forEach((entry, index) => {
      const number = emojiEntries.length + index + 1;
      if (drawn.has(number)) lines.push(describeEntry(number, `sticker:${entry.name}:`, entry));
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
