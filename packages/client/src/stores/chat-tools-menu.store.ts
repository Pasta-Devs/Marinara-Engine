import type { ReactNode } from "react";
import { create } from "zustand";

export const CHAT_TOOLS_MENU_ID = "chat-tools-menu";

export interface ChatToolsMenuEntry {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
}

/** Content stays with its window owner; only the phone launcher is collected here. */
export const useChatToolsMenuStore = create<{
  entries: Record<string, ChatToolsMenuEntry>;
  register: (entry: ChatToolsMenuEntry) => () => void;
}>()((set, get) => ({
  entries: {},
  register: (entry) => {
    set((state) => ({ entries: { ...state.entries, [entry.id]: entry } }));
    return () => {
      if (get().entries[entry.id] !== entry) return;
      const entries = { ...get().entries };
      delete entries[entry.id];
      set({ entries });
    };
  },
}));
