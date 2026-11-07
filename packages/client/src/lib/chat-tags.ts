// Chat tags live in chat.metadata.tags as plain strings (the sidebar's tag filter and the
// data-chat-tags theme hook read them).

export const MAX_CHAT_TAGS = 12;
const MAX_TAG_LENGTH = 40;

export function readChatTags(metadata: unknown): string[] {
  const raw = metadata && typeof metadata === "object" ? (metadata as { tags?: unknown }).tags : null;
  return Array.isArray(raw)
    ? raw.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).map((tag) => tag.trim())
    : [];
}

/** Trims, drops empties and duplicates (ignoring case), and caps the count and length. */
export function normalizeChatTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_CHAT_TAGS) break;
  }
  return out;
}
