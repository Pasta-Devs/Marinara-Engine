// ──────────────────────────────────────────────
// Zustand Store: the Roleplay ruleset sheet on screen
// ──────────────────────────────────────────────
// A Roleplay chat that plays by a ruleset shows one member's sheet at a time, in Game Mode's own
// character sheet. Chat Settings and the tracker panel open it; the chat's overlays draw it.
import { create } from "zustand";

export interface RoleplaySheetOpen {
  chatId: string;
  /** The member's name, as their sheet card is named. */
  name: string;
  /** Open the build editor at once: the sheet is still the ruleset's blank one. */
  build: boolean;
}

interface RoleplaySheetState {
  open: RoleplaySheetOpen | null;
  show: (open: RoleplaySheetOpen) => void;
  close: () => void;
}

export const useRoleplaySheetStore = create<RoleplaySheetState>((set) => ({
  open: null,
  show: (open) => set({ open }),
  close: () => set({ open: null }),
}));
