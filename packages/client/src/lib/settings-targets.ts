import { useUIStore } from "../stores/ui.store";

/** Opens the Settings panel on `tab`, optionally scrolling to a searchable control. */
export function openSettingsTarget(tab: string, controlId: string | null = null) {
  const ui = useUIStore.getState();
  ui.setSettingsTab(tab);
  ui.setSettingsTargetControlId(controlId);
  ui.openRightPanel("settings");
}
