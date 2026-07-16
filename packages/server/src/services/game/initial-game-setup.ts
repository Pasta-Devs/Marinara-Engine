export const GAME_SETUP_GENERATION_TIMEOUT_MS = 500 * 1000;

export function resolveInitialGameGmConnectionId(
  explicitConnectionId: string | null | undefined,
  chatConnectionId: string | null | undefined,
): string | null {
  return explicitConnectionId || chatConnectionId || null;
}
