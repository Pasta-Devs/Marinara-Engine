import { mergedReplyRoster } from "@marinara-engine/shared";
import { parseMessageExtraRecord } from "../../lib/chat-message-extra";
import { isFullBodySpriteExpression, type SpriteDisplayMode } from "./sprite-display-modes";

type MergedRosterExtra = {
  mergedRosterCharacterIds?: unknown;
  expressionSpriteIds?: unknown;
  spriteExpressions?: unknown;
};

/**
 * Which chat characters a merged Roleplay narrator reply shows as avatars (#8762). A saved reply shows only its own
 * scene (#8823): the active roster it was generated with (`mergedRosterCharacterIds`), or for a reply saved before
 * that existed, the members its expression result names (`mergedReplyRoster`) plus the active members that result
 * could never name. Roster changes affect only later replies. A streaming reply follows the live roster; a
 * continuation also keeps the reply's own roster, as the server merges both when it saves. A regeneration streams
 * with that roster cleared.
 */
export function resolveMergedAvatarRoster({
  extra,
  chatCharacterIds,
  liveRoster,
  isLive,
  noExpressionCharacterIds = [],
  splitReplyLastPartExtra,
}: {
  /** The reply's extra as is: its saved roster and, for replies saved before it existed, its expression owners. */
  extra: MergedRosterExtra;
  chatCharacterIds: readonly string[];
  /** The chat's current active characters. */
  liveRoster?: readonly string[];
  isLive: boolean;
  /** Chat members an expression result cannot name (`membersWithoutExpressions`). */
  noExpressionCharacterIds?: readonly string[];
  /** For an earlier part of a reply split at scene breaks: the extra of its last part (`splitReplyLastParts`). */
  splitReplyLastPartExtra?: MergedRosterExtra;
}): string[] {
  const live = liveRoster ?? chatCharacterIds;
  const inChatOrder = (...lists: ReadonlyArray<readonly unknown[]>) => {
    const ids = new Set(lists.flat());
    return chatCharacterIds.filter((id) => ids.has(id));
  };
  if (isLive) {
    return inChatOrder(Array.isArray(extra.mergedRosterCharacterIds) ? extra.mergedRosterCharacterIds : [], live);
  }
  // An older split reply saved its expression result only on its last part, whose avatars stay hidden under this one.
  const source =
    splitReplyLastPartExtra && mergedReplyRoster(extra, chatCharacterIds).length === 0
      ? splitReplyLastPartExtra
      : extra;
  const own = inChatOrder(mergedReplyRoster(source, chatCharacterIds));
  // ponytail: a reply with no per-character data at all (saved before #8762 without an expression result, a greeting
  // or a message added through the API), or whose saved roster has all left the chat, shows the live roster as before
  // #8762: it never revives an inactive member, but it grows and shrinks with the roster.
  if (own.length === 0) return inChatOrder(live);
  const hasSavedRoster =
    Array.isArray(source.mergedRosterCharacterIds) &&
    source.mergedRosterCharacterIds.some((id) => typeof id === "string");
  if (hasSavedRoster) return own;
  // ponytail: an expression result names only members with sprites the chat shows (and in its sprite selection), so
  // the active members it could never name are kept, judged by today's sprites and selection, not the reply's. An
  // active member with sprites the result left out stays hidden. Upgrade path: backfill `mergedRosterCharacterIds`
  // on old replies from their speaker tags.
  const unnamed = new Set(noExpressionCharacterIds);
  return inChatOrder(
    own,
    live.filter((id) => unnamed.has(id)),
  );
}

/**
 * The chat members an expression result can never name, as the server builds the expression agent's sprite list:
 * a member outside the chat's sprite selection (when it has one), or one with no sprite the chat's display modes
 * show. `spriteLists[i]` is `chatCharacterIds[i]`'s sprite list; a member whose list has not loaded (null or missing)
 * is not listed, so their avatar waits for it.
 */
export function membersWithoutExpressions({
  chatCharacterIds,
  spriteCharacterIds,
  spriteDisplayModes,
  spriteLists,
}: {
  chatCharacterIds: readonly string[];
  spriteCharacterIds: readonly string[];
  spriteDisplayModes: readonly SpriteDisplayMode[];
  spriteLists: ReadonlyArray<ReadonlyArray<{ expression: string }> | null | undefined>;
}): string[] {
  return chatCharacterIds.filter((id, index) => {
    if (spriteCharacterIds.length > 0 && !spriteCharacterIds.includes(id)) return true;
    const sprites = spriteLists[index];
    return (
      !!sprites &&
      !sprites.some((sprite) =>
        spriteDisplayModes.includes(isFullBodySpriteExpression(sprite.expression) ? "full-body" : "expressions"),
      )
    );
  });
}

/**
 * For each earlier part of a reply split at scene breaks (it carries `continuesAfterSceneBreak`, and the parts
 * follow each other with the same role and character), the extra of that reply's last part, by message id. A part
 * whose reply has no last part among `messages` is left out.
 */
export function splitReplyLastParts(
  messages: ReadonlyArray<{ id: string; role: string; characterId?: string | null; extra?: unknown }>,
): Map<string, Record<string, unknown>> {
  const lastParts = new Map<string, Record<string, unknown>>();
  let last: { role: string; characterId: string | null; extra: Record<string, unknown> } | null = null;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!;
    const extra = parseMessageExtraRecord(message.extra);
    const characterId = message.characterId ?? null;
    if (extra.continuesAfterSceneBreak !== true) last = { role: message.role, characterId, extra };
    else if (last && last.role === message.role && last.characterId === characterId)
      lastParts.set(message.id, last.extra);
    else last = null;
  }
  return lastParts;
}
