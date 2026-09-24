import { create } from "zustand";

interface CommandPaletteState {
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  openShortcuts: () => void;
  closeShortcuts: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  paletteOpen: false,
  shortcutsOpen: false,
  openPalette: () => set({ paletteOpen: true, shortcutsOpen: false }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen, shortcutsOpen: false })),
  openShortcuts: () => set({ shortcutsOpen: true, paletteOpen: false }),
  closeShortcuts: () => set({ shortcutsOpen: false }),
}));
