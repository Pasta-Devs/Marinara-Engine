/**
 * Which chat characters a merged Roleplay narrator reply shows as avatars (#8762). A saved reply keeps
 * the active roster it was generated with (`mergedRosterCharacterIds`), so automatic or manual roster
 * changes affect only later replies. Only a reply that is still streaming follows the live roster.
 */
export function resolveMergedAvatarRoster({
  savedRoster,
  chatCharacterIds,
  liveRoster,
  isLive,
}: {
  /** The reply's saved `mergedRosterCharacterIds`, read from its extra as is. */
  savedRoster: unknown;
  chatCharacterIds: readonly string[];
  /** The chat's current active characters. */
  liveRoster?: readonly string[];
  isLive: boolean;
}): string[] {
  if (isLive) return [...(liveRoster ?? chatCharacterIds)];
  const saved = new Set(Array.isArray(savedRoster) ? savedRoster : []);
  const roster = chatCharacterIds.filter((id) => saved.has(id));
  // Replies saved before the snapshot existed show the whole chat, which never shrinks with the live roster.
  return roster.length > 0 ? roster : [...chatCharacterIds];
}
