import { EMOJI_SEARCH_NAMES } from "./emoji-catalog.generated";

export interface StandardEmojiShortcode {
  name: string;
  emoji: string;
  searchText: string;
}

const COMMON_SHORTCODES: Readonly<Record<string, string>> = {
  crying: "😢",
  sob: "😭",
  joy: "😂",
  laughing: "😂",
  smile: "😄",
  grin: "😁",
  wink: "😉",
  heart: "❤️",
  broken_heart: "💔",
  thumbs_up: "👍",
  thumbs_down: "👎",
  clap: "👏",
  pray: "🙏",
  fire: "🔥",
  eyes: "👀",
  skull: "💀",
  test_tube: "🧪",
  tada: "🎉",
  thinking: "🤔",
  angry: "😠",
  rage: "😡",
  scream: "😱",
  blush: "😊",
  kiss: "😘",
  sunglasses: "😎",
  shrug: "🤷",
  wave: "👋",
  rocket: "🚀",
  warning: "⚠️",
  check: "✅",
  x: "❌",
};

function toShortcode(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/gu, "")
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

const byName = new Map<string, StandardEmojiShortcode>();

for (const [name, emoji] of Object.entries(COMMON_SHORTCODES)) {
  byName.set(name, { name, emoji, searchText: `${name.replaceAll("_", " ")} ${EMOJI_SEARCH_NAMES[emoji] ?? ""}` });
}

for (const [emoji, unicodeName] of Object.entries(EMOJI_SEARCH_NAMES)) {
  const name = toShortcode(unicodeName);
  if (!name || byName.has(name)) continue;
  byName.set(name, { name, emoji, searchText: `${name.replaceAll("_", " ")} ${unicodeName}` });
}

export const STANDARD_EMOJI_SHORTCODES: readonly StandardEmojiShortcode[] = Array.from(byName.values());

export function resolveStandardEmojiShortcode(name: string): string | null {
  return byName.get(toShortcode(name))?.emoji ?? null;
}

export function searchStandardEmojiShortcodes(query: string, limit = 10): StandardEmojiShortcode[] {
  const normalized = toShortcode(query);
  if (!normalized) return [];
  const matches = STANDARD_EMOJI_SHORTCODES.filter(
    (entry) => entry.name.includes(normalized) || entry.searchText.includes(normalized.replaceAll("_", " ")),
  ).sort((a, b) => {
    const aStarts = a.name.startsWith(normalized) ? 1 : 0;
    const bStarts = b.name.startsWith(normalized) ? 1 : 0;
    return bStarts - aStarts || a.name.length - b.name.length || a.name.localeCompare(b.name);
  });

  const seenEmoji = new Set<string>();
  return matches
    .filter((entry) => {
      if (seenEmoji.has(entry.emoji)) return false;
      seenEmoji.add(entry.emoji);
      return true;
    })
    .slice(0, limit);
}
