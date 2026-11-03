/**
 * The chat members a merged Roleplay reply was written with (#8762), in `memberIds` order: its saved
 * `mergedRosterCharacterIds`, or, for a reply saved before replies kept one, the members its expression result
 * names (`expressionSpriteIds`, or the `spriteExpressions` keys of an older result). Never the persona or anyone
 * outside `memberIds`. The server keeps it when the reply is continued, and the client streams that continuation with it.
 */
export function mergedReplyRoster(
  extra: { mergedRosterCharacterIds?: unknown; expressionSpriteIds?: unknown; spriteExpressions?: unknown },
  memberIds: readonly string[],
): string[] {
  const members = (...lists: unknown[][]) => {
    const ids = new Set(lists.flat());
    return memberIds.filter((id) => ids.has(id));
  };
  const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  const saved = members(list(extra.mergedRosterCharacterIds));
  if (saved.length > 0) return saved;
  const expressions = extra.spriteExpressions;
  return members(
    list(extra.expressionSpriteIds),
    expressions && typeof expressions === "object" ? Object.keys(expressions) : [],
  );
}
