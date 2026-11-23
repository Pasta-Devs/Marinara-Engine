// ──────────────────────────────────────────────
// UI check: lets the automatic layout check (scripts/ui-check) open any page directly
// ──────────────────────────────────────────────
// Off unless the browser has localStorage "marinara:ui-check" = "1", which only the check's own browser sets. It
// then reaches the same store actions a click would, so every page opens the way the app opens it, on every
// layout (desktop, tablet, phone), without the check having to know where each button sits on each one.
import { useUIStore } from "../stores/ui.store";
import { useOverhaulStore } from "../stores/overhaul.store";
import { useChatStore } from "../stores/chat.store";
import { openLibrarySection } from "../components/overhaul/library-navigation";
import { useMobileChatSettingsNav } from "../features/chat-settings/mobile-nav";
import { openChatSettingsSubpage } from "../features/chat-settings/subpage";
import { getBackLayerStack } from "./back-navigation";

export function installUiCheckHook() {
  try {
    if (localStorage.getItem("marinara:ui-check") !== "1") return;
  } catch {
    return;
  }
  Object.assign(window, {
    __marinaraUiCheck: {
      ui: useUIStore,
      overhaul: useOverhaulStore,
      chat: useChatStore,
      chatSettingsNav: useMobileChatSettingsNav,
      openLibrarySection,
      openChatSettingsSubpage,
      backLayers: () => getBackLayerStack().map((layer) => layer.id),
    },
  });
}
