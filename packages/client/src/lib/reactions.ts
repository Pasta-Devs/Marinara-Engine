// ──────────────────────────────────────────────
// Conversation message reactions — pure helpers.
// Reactions live on a message's extra.reactions, grouped one entry per emoji with
// a list of reactors (Discord-style). The human is the USER_REACTOR sentinel;
// bots react with their character id. Conversation mode only.
// ──────────────────────────────────────────────
import type { MessageReaction } from "@marinara-engine/shared";

/** Reactor id for the human (characters react with their character id instead). */
export const USER_REACTOR = "user";

/** Pattern for a custom-emoji reaction token like `:smile:` (group 1 = name). */
const CUSTOM_EMOJI_TOKEN_RE = /^:([a-zA-Z0-9_]+):$/;

/** The custom-emoji name if `emoji` is a `:name:` token, else null (a unicode emoji). */
export function customEmojiReactionName(emoji: string): string | null {
  return emoji.match(CUSTOM_EMOJI_TOKEN_RE)?.[1] ?? null;
}

/**
 * Toggle a reactor's reaction on a message. Adds the reactor if absent, removes it
 * if present, and drops a reaction entry once its last reactor leaves. Pure —
 * returns a new array. `imageUrl` is stored for a custom (`:name:`) reaction so the
 * pill renders without re-resolving gallery scope.
 */
export function toggleReaction(
  reactions: MessageReaction[] | null | undefined,
  emoji: string,
  reactor: string,
  imageUrl?: string | null,
): MessageReaction[] {
  const current = reactions ?? [];
  const index = current.findIndex((reaction) => reaction.emoji === emoji);

  if (index === -1) {
    const entry: MessageReaction = { emoji, by: [reactor] };
    if (imageUrl) entry.imageUrl = imageUrl;
    return [...current, entry];
  }

  const entry = current[index]!;
  const nextBy = entry.by.includes(reactor) ? entry.by.filter((id) => id !== reactor) : [...entry.by, reactor];

  if (nextBy.length === 0) {
    return current.filter((_, i) => i !== index);
  }

  const next = [...current];
  // Backfill a missing imageUrl if this toggle supplies one (unicode entries never
  // have one; a custom one keeps its first snapshot).
  next[index] = { ...entry, by: nextBy, ...(imageUrl && !entry.imageUrl ? { imageUrl } : {}) };
  return next;
}
