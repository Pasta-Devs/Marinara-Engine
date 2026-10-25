// ──────────────────────────────────────────────
// Zustand Store: Combat Screen Slice
// ──────────────────────────────────────────────
// What the top bar needs to know about a fight on a board while it runs: its round, and whether the
// log under the board and the combat pane beside it are showing. The fight screen sets `round` while
// it is mounted and clears it when it goes, so the top bar shows the combat controls only then. The
// tactical board, which has neither control, says only that it is showing.
import { create } from "zustand";

interface CombatScreenState {
  /** The round of the fight on screen, or null when no fight on a board is showing. */
  round: number | null;
  /** A tactical board is showing a fight. */
  tacticalShowing: boolean;
  logOpen: boolean;
  paneOpen: boolean;
  setRound: (round: number | null) => void;
  setTacticalShowing: (showing: boolean) => void;
  toggleLog: () => void;
  togglePane: () => void;
}

export const useCombatScreenStore = create<CombatScreenState>((set) => ({
  round: null,
  tacticalShowing: false,
  logOpen: true,
  paneOpen: true,
  // A fight that goes takes its layout with it: the next one opens with the pane showing.
  setRound: (round) => set(round === null ? { round, paneOpen: true } : { round }),
  setTacticalShowing: (tacticalShowing) => set({ tacticalShowing }),
  toggleLog: () => set((state) => ({ logOpen: !state.logOpen })),
  togglePane: () => set((state) => ({ paneOpen: !state.paneOpen })),
}));
