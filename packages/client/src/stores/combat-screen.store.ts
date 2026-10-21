// ──────────────────────────────────────────────
// Zustand Store: Combat Screen Slice
// ──────────────────────────────────────────────
// What the top bar needs to know about a fight on a board while it runs: its round, and whether the
// log under the board and the combat pane beside it are showing. The fight screen sets `round` while
// it is mounted and clears it when it goes, so the top bar shows the combat controls only then.
import { create } from "zustand";

interface CombatScreenState {
  /** The round of the fight on screen, or null when no fight on a board is showing. */
  round: number | null;
  logOpen: boolean;
  paneOpen: boolean;
  /** How a phone lays the screen out: the pane as a sheet over the board, or a tab beside it. */
  phoneLayout: "sheet" | "tabs";
  setRound: (round: number | null) => void;
  toggleLog: () => void;
  togglePane: () => void;
  setPaneOpen: (open: boolean) => void;
}

export const useCombatScreenStore = create<CombatScreenState>((set) => ({
  round: null,
  logOpen: true,
  paneOpen: true,
  phoneLayout: (() => {
    try {
      return globalThis.localStorage?.getItem("marinara:combat-phone-layout") === "tabs" ? "tabs" : "sheet";
    } catch {
      return "sheet";
    }
  })(),
  setRound: (round) => set({ round }),
  toggleLog: () => set((state) => ({ logOpen: !state.logOpen })),
  togglePane: () => set((state) => ({ paneOpen: !state.paneOpen })),
  setPaneOpen: (open) => set({ paneOpen: open }),
}));
