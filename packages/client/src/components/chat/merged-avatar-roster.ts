import { mergedReplyRoster } from "@marinara-engine/shared";

/**
 * Which chat characters a merged Roleplay narrator reply shows as avatars (#8762). A saved reply shows only its own
 * scene (#8823): the active roster it was generated with (`mergedRosterCharacterIds`), or for a reply saved before
 * that existed, the members its expression result names (`mergedReplyRoster`). Roster changes affect only later
 * replies. A streaming reply follows the live roster; a continuation also keeps the reply's own roster, as the server
 * merges both when it saves. A regeneration streams with that roster cleared.
 */
export function resolveMergedAvatarRoster({
  extra,
  chatCharacterIds,
  liveRoster,
  isLive,
}: {
  /** The reply's extra as is: its saved roster and, for replies saved before it existed, its expression owners. */
  extra: { mergedRosterCharacterIds?: unknown; expressionSpriteIds?: unknown; spriteExpressions?: unknown };
  chatCharacterIds: readonly string[];
  /** The chat's current active characters. */
  liveRoster?: readonly string[];
  isLive: boolean;
}): string[] {
  const live = liveRoster ?? chatCharacterIds;
  const inChatOrder = (...lists: ReadonlyArray<readonly unknown[]>) => {
    const ids = new Set(lists.flat());
    return chatCharacterIds.filter((id) => ids.has(id));
  };
  if (isLive) {
    return inChatOrder(Array.isArray(extra.mergedRosterCharacterIds) ? extra.mergedRosterCharacterIds : [], live);
  }
  const own = inChatOrder(mergedReplyRoster(extra, chatCharacterIds));
  // ponytail: a reply with no per-character data at all (saved before #8762 without an expression result, a greeting
  // or a message added through the API), or whose saved roster has all left the chat, shows the live roster as before
  // #8762: it never revives an inactive member, but it grows and shrinks with the roster. A member the reply included
  // who had no expression entry is not recovered. Upgrade path: backfill `mergedRosterCharacterIds` on old replies
  // from their speaker tags.
  return own.length > 0 ? own : inChatOrder(live);
}
