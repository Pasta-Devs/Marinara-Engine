export const GAME_START_CONNECTION_REQUIRED_MESSAGE = "Choose a GM / Party Model before starting the game.";
export const RANDOM_CONNECTION_SENTINEL = "random";

export function normalizeGameStartConnectionId(connectionId: unknown): string {
  return typeof connectionId === "string" ? connectionId.trim() : "";
}

export function canStartGameWithConnection(connectionId: unknown): boolean {
  return normalizeGameStartConnectionId(connectionId).length > 0;
}
