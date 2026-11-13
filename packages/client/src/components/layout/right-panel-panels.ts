// Right-panel panels live here so the top bar can preload one on hover or touch without
// pulling every panel into the main bundle.
import { preloadedLazy } from "../../lib/preloaded-lazy";

export const RIGHT_PANELS = {
  "bot-browser": preloadedLazy(() => import("../panels/BotBrowserPanel").then((module) => module.BotBrowserPanel)),
  characters: preloadedLazy(() => import("../panels/CharactersPanel").then((module) => module.CharactersPanel)),
  lorebooks: preloadedLazy(() => import("../panels/LorebooksPanel").then((module) => module.LorebooksPanel)),
  presets: preloadedLazy(() => import("../panels/PresetsPanel").then((module) => module.PresetsPanel)),
  connections: preloadedLazy(() => import("../panels/ConnectionsPanel").then((module) => module.ConnectionsPanel)),
  agents: preloadedLazy(() => import("../panels/AgentsPanel").then((module) => module.AgentsPanel)),
  personas: preloadedLazy(() => import("../panels/PersonasPanel").then((module) => module.PersonasPanel)),
  settings: preloadedLazy(() => import("../panels/SettingsPanel").then((module) => module.SettingsPanel)),
  extensions: preloadedLazy(() =>
    import("../panels/PersonalExtensionPanel").then((module) => module.PersonalExtensionPanel),
  ),
};

export function preloadRightPanel(panel: string) {
  if (panel in RIGHT_PANELS) RIGHT_PANELS[panel as keyof typeof RIGHT_PANELS].preload().catch(() => undefined);
}
