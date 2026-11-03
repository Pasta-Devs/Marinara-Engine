/**
 * Which chat characters a merged Roleplay narrator reply shows as avatars (#8762). A saved reply keeps
 * the active roster it was generated with (`mergedRosterCharacterIds`), so automatic or manual roster
 * changes affect only later replies. A streaming reply follows the live roster; a continuation also keeps
 * its saved roster, as the server merges both when it saves. A regeneration streams with that roster cleared.
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
  const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  const inChatOrder = (...lists: ReadonlyArray<readonly unknown[]>) => {
    const ids = new Set(lists.flat());
    return chatCharacterIds.filter((id) => ids.has(id));
  };
  const saved = list(extra.mergedRosterCharacterIds);
  if (isLive) return inChatOrder(saved, live);
  const roster = inChatOrder(saved);
  if (roster.length > 0) return roster;
  // ponytail: a reply saved before #8762 has no roster, so it shows the chat members its expression result
  // names plus the live roster. That never revives a member who was inactive then, but such a reply still gains
  // avatars with the live roster, and one without expression data also loses them. Upgrade path: backfill
  // `mergedRosterCharacterIds` on old replies from their speaker tags.
  const expressions = extra.spriteExpressions;
  const expressionOwners = expressions && typeof expressions === "object" ? Object.keys(expressions) : [];
  return inChatOrder(list(extra.expressionSpriteIds), expressionOwners, live);
}
