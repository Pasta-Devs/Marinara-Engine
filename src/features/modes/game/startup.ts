import { useGameModeStore } from "./stores/game-mode.store";

export function useSetGameSetupActive() {
  return useGameModeStore((state) => state.setSetupActive);
}
