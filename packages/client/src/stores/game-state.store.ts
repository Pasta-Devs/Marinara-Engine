// ──────────────────────────────────────────────
// Zustand Store: Game State Slice (RPG Companion)
// ──────────────────────────────────────────────
import { create } from "zustand";
import type { GameState } from "@marinara-engine/shared";

interface GameStateStore {
  current: GameState | null;
  isVisible: boolean;
  expandedSections: Set<string>;
  /** Registered by RoleplayHUD — flushes any pending debounced patch immediately. */
  flushPatch: (() => Promise<void>) | null;

  // Actions
  setGameState: (state: GameState | null) => void;
  setVisible: (visible: boolean) => void;
  toggleSection: (section: string) => void;
  setFlushPatch: (fn: (() => Promise<void>) | null) => void;
  reset: () => void;
}

export const useGameStateStore = create<GameStateStore>((set) => ({
  current: null,
  isVisible: true,
  expandedSections: new Set(["location", "characters", "stats"]),
  flushPatch: null,

  setGameState: (state) => set({ current: state }),
  setVisible: (visible) => set({ isVisible: visible }),
  setFlushPatch: (fn) => set({ flushPatch: fn }),

  toggleSection: (section) =>
    set((s) => {
      const expanded = new Set(s.expandedSections);
      if (expanded.has(section)) expanded.delete(section);
      else expanded.add(section);
      return { expandedSections: expanded };
    }),

  reset: () =>
    set({
      current: null,
      isVisible: true,
      expandedSections: new Set(["location", "characters", "stats"]),
      flushPatch: null,
    }),
}));
