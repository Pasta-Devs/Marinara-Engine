/**
 * The roster a merged Roleplay reply was written with (#8762): its saved `mergedRosterCharacterIds` as saved, so
 * a character who has since left the chat stays on it and gets their avatar back if they rejoin (the client shows
 * only current members). A reply with no saved roster (saved before #8762, or outside a merged group) falls back to
 * the members its expression result names (`expressionSpriteIds`, or the `spriteExpressions` keys of an older result),
 * in `memberIds` order and never the persona or anyone outside `memberIds`. The server keeps it when a merged group's
 * reply is continued, and the client streams that continuation with it.
 */
export function mergedReplyRoster(
  extra: { mergedRosterCharacterIds?: unknown; expressionSpriteIds?: unknown; spriteExpressions?: unknown },
  memberIds: readonly string[],
): string[] {
  const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  const saved = list(extra.mergedRosterCharacterIds).filter((id): id is string => typeof id === "string");
  if (saved.length > 0) return saved;
  const expressions = extra.spriteExpressions;
  const named = new Set([
    ...list(extra.expressionSpriteIds),
    ...(expressions && typeof expressions === "object" ? Object.keys(expressions) : []),
  ]);
  return memberIds.filter((id) => named.has(id));
}
