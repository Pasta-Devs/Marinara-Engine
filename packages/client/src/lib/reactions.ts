// ──────────────────────────────────────────────
// Conversation message reactions — pure helpers.
// Reactions live on a message's extra.reactions, grouped one entry per emoji with
// a list of reactors (Discord-style). The human is the USER_REACTOR sentinel;
// bots react with their character id. On grouped multi-speaker messages a reaction
// may additionally target one speaker segment (entry identity is then
// emoji + segment); entries without a segment target the whole message.
// Conversation mode only.
// ──────────────────────────────────────────────
import { normalizeTextForMatch, type MessageReaction } from "@marinara-engine/shared";

/** Reactor id for the human (characters react with their character id instead). */
export const USER_REACTOR = "user";

/** Pattern for a custom-emoji reaction token like `:smile:` (group 1 = name). */
const CUSTOM_EMOJI_TOKEN_RE = /^:([a-zA-Z0-9_]+):$/;

/** The custom-emoji name if `emoji` is a `:name:` token, else null (a unicode emoji). */
export function customEmojiReactionName(emoji: string): string | null {
  return emoji.match(CUSTOM_EMOJI_TOKEN_RE)?.[1] ?? null;
}

/** A grouped-segment target for a reaction: the segment's index + its parsed speaker. */
export interface ReactionSegmentTarget {
  segment: number;
  /** The segment's parsed speaker name (null for narration segments). */
  speaker: string | null;
}

/** The segment target stored on a reaction entry, or undefined for whole-message entries. */
export function reactionTargetOf(reaction: MessageReaction): ReactionSegmentTarget | undefined {
  return reaction.segment != null ? { segment: reaction.segment, speaker: reaction.segmentSpeaker ?? null } : undefined;
}

/** Case/format-insensitive speaker comparison (both null = match, e.g. narration). */
function sameSpeaker(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  return normalizeTextForMatch(a) === normalizeTextForMatch(b);
}

/** Whether a reaction entry is the one identified by (emoji, segment target). */
function matchesIdentity(reaction: MessageReaction, emoji: string, target?: ReactionSegmentTarget | null): boolean {
  if (reaction.emoji !== emoji) return false;
  const segment = target?.segment ?? null;
  if ((reaction.segment ?? null) !== segment) return false;
  // Within the same index, an entry left over from a different segmentation (other
  // speaker) is a distinct reaction — don't merge into it.
  return (
    segment === null || reaction.segmentSpeaker === undefined || sameSpeaker(reaction.segmentSpeaker, target?.speaker)
  );
}

/**
 * Toggle a reactor's reaction on a message. Adds the reactor if absent, removes it
 * if present, and drops a reaction entry once its last reactor leaves. Pure —
 * returns a new array. `imageUrl` is stored for a custom (`:name:`) reaction so the
 * pill renders without re-resolving gallery scope. `target` aims the reaction at
 * one grouped speaker segment; omit it for a whole-message reaction.
 */
export function toggleReaction(
  reactions: MessageReaction[] | null | undefined,
  emoji: string,
  reactor: string,
  imageUrl?: string | null,
  target?: ReactionSegmentTarget | null,
): MessageReaction[] {
  const current = reactions ?? [];
  const index = current.findIndex((reaction) => matchesIdentity(reaction, emoji, target));

  if (index === -1) {
    const entry: MessageReaction = { emoji, by: [reactor] };
    if (imageUrl) entry.imageUrl = imageUrl;
    if (target) {
      entry.segment = target.segment;
      entry.segmentSpeaker = target.speaker ?? null;
    }
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

/** Remove every character from one reaction entry while preserving the user's reaction, if present. */
export function removeCharacterReaction(
  reactions: MessageReaction[] | null | undefined,
  reaction: MessageReaction,
): MessageReaction[] {
  const current = reactions ?? [];
  const index = current.findIndex((entry) => matchesIdentity(entry, reaction.emoji, reactionTargetOf(reaction)));
  if (index === -1) return current;

  const entry = current[index]!;
  const nextBy = entry.by.filter((reactor) => reactor === USER_REACTOR);
  if (nextBy.length === entry.by.length) return current;
  if (nextBy.length === 0) return current.filter((_, entryIndex) => entryIndex !== index);

  const next = [...current];
  next[index] = { ...entry, by: nextBy };
  return next;
}

/**
 * Split a message's reactions into per-segment lists (index-aligned with the
 * grouped segments) and the whole-message remainder. A segment-keyed reaction only
 * lands on its segment when the index is still in range AND the stored speaker
 * still matches — after an edit/regeneration re-segments the content, orphaned
 * entries fall back to the whole-message list so they stay visible (and removable)
 * instead of silently mis-attaching to another character's line. With no segments
 * (1:1 layout, parse failure), everything is whole-message.
 */
export function splitReactionsBySegment(
  reactions: MessageReaction[],
  segments: Array<{ speaker: string | null; lines: string[] }> | null,
): { segmentReactions: MessageReaction[][] | null; messageReactions: MessageReaction[] } {
  if (!segments || segments.length === 0) {
    return { segmentReactions: null, messageReactions: reactions };
  }
  const segmentReactions: MessageReaction[][] = segments.map(() => []);
  const messageReactions: MessageReaction[] = [];
  for (const reaction of reactions) {
    const idx = reaction.segment;
    const seg = typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? segments[idx] : undefined;
    const aligned =
      seg !== undefined &&
      // Narration segments render no chip row — never route a reaction there.
      seg.speaker != null &&
      // Empty-text segments render no chip row either (the classic layout skips
      // them entirely) — fall back so the reaction stays visible and removable.
      seg.lines.some((line) => line.trim().length > 0) &&
      // Legacy entries without a stored speaker can only be checked by index.
      (reaction.segmentSpeaker === undefined || sameSpeaker(reaction.segmentSpeaker, seg.speaker));
    if (aligned) segmentReactions[idx as number]!.push(reaction);
    else messageReactions.push(reaction);
  }
  return { segmentReactions, messageReactions };
}

/**
 * Find the user's stale segment entry that a new pick should replace: same emoji,
 * same speaker, but stranded in the whole-message (orphan) list because the
 * segmentation moved under it (another swipe's layout, or an edit). Moving it —
 * instead of adding a second entry — keeps one chip and one prompt annotation per
 * (emoji, speaker) intent. Entries whose segment target is still valid are not in
 * `messageReactions`, so genuine same-emoji reactions on two of a speaker's
 * segments are never collapsed.
 */
export function findRetargetableUserReaction(
  messageReactions: MessageReaction[],
  emoji: string,
  target: ReactionSegmentTarget,
): MessageReaction | undefined {
  return messageReactions.find(
    (reaction) =>
      reaction.segment != null &&
      reaction.emoji === emoji &&
      reaction.by.includes(USER_REACTOR) &&
      sameSpeaker(reaction.segmentSpeaker ?? null, target.speaker),
  );
}
