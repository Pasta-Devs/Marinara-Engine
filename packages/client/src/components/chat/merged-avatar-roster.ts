import { mergedReplyRoster } from "@marinara-engine/shared";

/**
 * Which chat characters a merged Roleplay narrator reply shows as avatars (#8762). A saved reply keeps
 * the active roster it was generated with (`mergedRosterCharacterIds`), so automatic or manual roster
 * changes affect only later replies. A streaming reply follows the live roster; a continuation also keeps
 * the reply's own roster (`mergedReplyRoster`), as the server merges both when it saves. A regeneration streams
 * with that roster cleared.
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
  const saved = inChatOrder(Array.isArray(extra.mergedRosterCharacterIds) ? extra.mergedRosterCharacterIds : []);
  if (isLive) return inChatOrder(saved, live);
  if (saved.length > 0) return saved;
  // ponytail: a reply saved before #8762 has no roster, so it shows the chat members its expression result
  // names (`mergedReplyRoster` falls back to them) plus the live roster. That never revives a member who was
  // inactive then, but such a reply still gains avatars with the live roster, and one without expression data
  // also loses them. Upgrade path: backfill `mergedRosterCharacterIds` on old replies from their speaker tags.
  return inChatOrder(mergedReplyRoster(extra, chatCharacterIds), live);
}
