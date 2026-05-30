const GAME_LOREBOOK_KEEPER_SOURCE_ID = "game-lorebook-keeper";

export type LorebookScopeExclusions = {
  excludedLorebookIds: string[];
  excludedSourceAgentIds: string[];
};

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveGameLorebookScopeExclusions(
  chatMode: unknown,
  metadata: Record<string, unknown> | null | undefined,
): LorebookScopeExclusions {
  if (chatMode !== "game" || metadata?.gameLorebookKeeperEnabled === true) {
    return { excludedLorebookIds: [], excludedSourceAgentIds: [] };
  }

  const gameLorebookId = readTrimmedString(metadata?.gameLorebookKeeperLorebookId);
  return {
    excludedLorebookIds: gameLorebookId ? [gameLorebookId] : [],
    excludedSourceAgentIds: [GAME_LOREBOOK_KEEPER_SOURCE_ID],
  };
}
