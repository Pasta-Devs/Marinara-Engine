import type { GameStoryboardViewerDisplayMode } from "@marinara-engine/shared";

export function resolveRoleplayStoryboardDisplayMode(
  metadata: Record<string, unknown>,
): GameStoryboardViewerDisplayMode {
  const configured = metadata.gameStoryboardViewerDisplayMode;
  return configured === "floating" || configured === "background" || configured === "inline" ? configured : "inline";
}
