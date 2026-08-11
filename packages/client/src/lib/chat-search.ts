// ──────────────────────────────────────────────
// Find in chat: naive substring matching over one chat's messages
// ──────────────────────────────────────────────
//
// Deliberately literal: no regex, no operators, no field filters. The query is
// treated as plain text and matching is always case-insensitive. Keep this
// module free of React so the regression guard can exercise it directly.

/** The subset of a message this search needs. */
export type ChatSearchMessage = {
  id: string;
  role: string;
  characterId?: string | null;
  content?: string;
  createdAt?: string;
};

export type ChatSearchHit = {
  messageId: string;
  /** 1-based position in the whole chat, matching what /goto expects. */
  messageNumber: number;
  role: string;
  characterId?: string | null;
  createdAt?: string;
  /** Snippet trimmed around the first match, for the result row. */
  snippet: string;
  /** Offset of the match inside `snippet`. */
  matchStart: number;
  matchLength: number;
};

const SNIPPET_LEAD = 32;
const SNIPPET_MAX = 160;
const ELLIPSIS = "…";

/**
 * Drops the characters that render as formatting rather than text, so a search
 * for a word inside *emphasis* still matches what the reader sees.
 *
 * Replaces each stripped character with a space rather than deleting it, which
 * keeps offsets aligned with the original string — the snippet is cut from the
 * original, so the two must not drift.
 */
export function toSearchableText(content: string): string {
  return content.replace(/[*_~`]/g, " ");
}

export function buildChatSearchSnippet(content: string, index: number, length: number) {
  const start = Math.max(0, index - SNIPPET_LEAD);
  const end = Math.min(content.length, start + SNIPPET_MAX);
  const prefix = start > 0 ? ELLIPSIS : "";
  const suffix = end < content.length ? ELLIPSIS : "";
  return {
    snippet: `${prefix}${content.slice(start, end)}${suffix}`,
    matchStart: prefix.length + (index - start),
    matchLength: length,
  };
}

/** Which end of the chat results are listed from. */
export type ChatSearchSort = "newest" | "oldest";

/**
 * Orders hits for display.
 *
 * `findChatSearchHits` always returns chat order (oldest first) because that is
 * the order message numbers run in; this decides how they are shown. Returns a
 * new array so the caller's canonical order is never mutated.
 */
export function sortChatSearchHits(hits: readonly ChatSearchHit[], sort: ChatSearchSort): ChatSearchHit[] {
  const ordered = [...hits];
  return sort === "newest" ? ordered.reverse() : ordered;
}

/**
 * Every message containing `query`, in chat order.
 *
 * `messages` must be the chat's full history, oldest first, so a hit's
 * `messageNumber` is a position /goto can jump to.
 */
export function findChatSearchHits(
  messages: readonly ChatSearchMessage[] | undefined,
  query: string,
): ChatSearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle || !messages?.length) return [];

  const hits: ChatSearchHit[] = [];
  messages.forEach((message, index) => {
    const content = typeof message.content === "string" ? message.content : "";
    if (!content) return;

    // Match against the formatting-stripped text, but cut the snippet from the
    // original so the reader sees the message as written. Both strings are the
    // same length, so one offset serves both.
    const at = toSearchableText(content).toLowerCase().indexOf(needle);
    if (at < 0) return;

    hits.push({
      messageId: message.id,
      messageNumber: index + 1,
      role: message.role,
      characterId: message.characterId,
      createdAt: message.createdAt,
      ...buildChatSearchSnippet(content, at, needle.length),
    });
  });
  return hits;
}
