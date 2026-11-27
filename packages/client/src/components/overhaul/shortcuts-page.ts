// ──────────────────────────────────────────────
// UI overhaul: open Settings › Shortcuts (the "?" key, Search's "Keyboard shortcuts")
//
// The new layout has no shortcuts window: the list is a Settings page, like every
// other list of settings. On a phone or upright tablet it opens on Touch gestures.
// ──────────────────────────────────────────────
import { useOverhaulStore } from "../../stores/overhaul.store";
import { isMobileShellViewport, useUIStore } from "../../stores/ui.store";
import { openLibrarySection } from "./library-navigation";

export function openShortcutsPage(section?: "keyboard-shortcuts" | "touch-gestures") {
  const target = section ?? (isMobileShellViewport() ? "touch-gestures" : "keyboard-shortcuts");
  useOverhaulStore.getState().setSettingsTab("shortcuts");
  openLibrarySection("settings");
  useUIStore.getState().setSettingsTargetSectionId(target);
}
