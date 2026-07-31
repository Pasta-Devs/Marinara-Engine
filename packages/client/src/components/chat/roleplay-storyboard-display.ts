import type { GameStoryboardViewerDisplayMode } from "@marinara-engine/shared";

export type RoleplayStoryboardAutomaticTriggerState = {
  generationWasBusy: boolean;
  completedTargetKey: string | null;
};

export function advanceRoleplayStoryboardAutomaticTrigger(
  state: RoleplayStoryboardAutomaticTriggerState,
  generationBusy: boolean,
  targetKey: string | null,
): RoleplayStoryboardAutomaticTriggerState {
  if (generationBusy) {
    return { generationWasBusy: true, completedTargetKey: null };
  }
  if (state.generationWasBusy) {
    return { generationWasBusy: false, completedTargetKey: targetKey };
  }
  return state;
}

export function resolveRoleplayStoryboardDisplayMode(
  metadata: Record<string, unknown>,
): GameStoryboardViewerDisplayMode {
  const configured = metadata.gameStoryboardViewerDisplayMode;
  return configured === "floating" || configured === "background" || configured === "inline" ? configured : "inline";
}
