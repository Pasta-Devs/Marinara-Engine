import type { DiscoveryAction } from "../discovery-types";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { DISCOVERY_APP_EVENT, type DiscoveryAppEventDetail } from "../discovery-events";

function emitDiscoveryEvent(detail: DiscoveryAppEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DiscoveryAppEventDetail>(DISCOVERY_APP_EVENT, { detail }));
}

export function getDiscoveryActionLabel(action: DiscoveryAction) {
  if (action.label) return action.label;
  switch (action.type) {
    case "open-panel":
      return "Open";
    case "open-settings":
      return "Open Settings";
    case "replay-onboarding":
      return "Replay Tutorial";
    case "open-professor-mari":
      return "Open Professor Mari";
    case "go-home":
      return "Go Home";
  }
}

export function runDiscoveryAction(action: DiscoveryAction) {
  const ui = useUIStore.getState();

  switch (action.type) {
    case "open-panel":
      ui.openRightPanel(action.panel);
      return;
    case "open-settings":
      ui.openRightPanel("settings");
      ui.setSettingsTab(action.tab);
      return;
    case "replay-onboarding":
      ui.setHasCompletedOnboarding(false);
      return;
    case "open-professor-mari":
      emitDiscoveryEvent({ type: "open-professor-mari" });
      return;
    case "go-home":
      useChatStore.getState().setActiveChatId(null);
      ui.closeAllDetails();
      ui.closeRightPanel();
      emitDiscoveryEvent({ type: "go-home" });
      return;
  }
}
