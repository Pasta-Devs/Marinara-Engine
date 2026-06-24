export const GAME_LOREBOOK_KEEPER_SOURCE_ID = "game-lorebook-keeper";

export type LorebookScopeExclusions = {
  excludedLorebookIds: string[];
  excludedSourceAgentIds: string[];
};

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Resolve which lorebooks/source-agents are excluded from scope for a chat.
 *
 * Two independent sources are merged:
 *  - Per-chat user exclusions (`metadata.excludedLorebookIds`): books the user
 *    explicitly disabled for THIS chat via the Lorebooks panel. These apply in
 *    every mode — they are how a character/global/persona book (which is
 *    auto-activated, not pinned) gets turned off without unbinding it.
 *  - Game Lorebook Keeper hiding: during normal game play (keeper disabled) the
 *    keeper's managed book and source-agent are hidden so its bookkeeping does
 *    not leak into the prompt.
 */
export function resolveLorebookScopeExclusions(
  chatMode: unknown,
  metadata: Record<string, unknown> | null | undefined,
): LorebookScopeExclusions {
  const userExcludedLorebookIds = Array.isArray(metadata?.excludedLorebookIds)
    ? (metadata.excludedLorebookIds as unknown[]).filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : [];

  const hideGameKeeper = chatMode === "game" && metadata?.gameLorebookKeeperEnabled !== true;
  const gameLorebookId = hideGameKeeper ? readTrimmedString(metadata?.gameLorebookKeeperLorebookId) : null;

  return {
    excludedLorebookIds: [...new Set([...userExcludedLorebookIds, ...(gameLorebookId ? [gameLorebookId] : [])])],
    excludedSourceAgentIds: hideGameKeeper ? [GAME_LOREBOOK_KEEPER_SOURCE_ID] : [],
  };
}

export function filterGameInternalAgentIds(chatMode: unknown, agentIds: string[]): string[] {
  if (chatMode !== "game") return agentIds;
  return agentIds.filter((agentId) => agentId !== "lorebook-keeper");
}
