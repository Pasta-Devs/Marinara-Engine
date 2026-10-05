// ──────────────────────────────────────────────
// Help Layout targets: what the chat Help overlay labels in each mode
//
// Each target names a control by selector; the overlay skips any that are not
// visible right now, so one list covers desktop, phones, and the Chat Settings
// window being open or closed. Session, Volume, Assets, Game controls, the
// connected chat, package toolbars and Beholder point at their windows' buttons
// (bubbles), on phones too, where the Tracker Panel has a bubble as well.
// Add new chat controls here.
// ──────────────────────────────────────────────
import type { ChatMode } from "@marinara-engine/shared";
import { CHAT_SETTINGS_WINDOW_ID } from "../stores/floating-window.store";

export type ChatHelpTargetId =
  | "identity"
  | "agents"
  | "call"
  | "agent-controls"
  | "connected-chat"
  | "settings"
  | "help"
  | "window-title"
  | "window-pin"
  | "window-lock"
  | "window-close"
  | "tracker-panel"
  | "tracker-panel-bubble"
  | "agent-activity"
  | "drawer-bubble"
  | "window-put-back"
  | "reset-view"
  | "messages"
  | "composer"
  | "map"
  | "party"
  | "scene-media"
  | "game-controls"
  | "retry"
  | "session"
  | "volume"
  | "assets"
  | "widgets"
  | "dialogue";

export interface ChatHelpTargetDefinition {
  id: ChatHelpTargetId;
  titleKey: string;
  bodyKey: string;
  selector?: string;
  mergeMatches?: boolean;
  virtual?: "messages" | "composer";
}

function chatHelpTarget(id: ChatHelpTargetId, key: string, selector = `[data-chat-help="${id}"]`) {
  return {
    id,
    selector,
    titleKey: `chat.help.targets.${key}.title`,
    bodyKey: `chat.help.targets.${key}.body`,
  } satisfies ChatHelpTargetDefinition;
}

const CHAT_SETTINGS_WINDOW = `[data-window="${CHAT_SETTINGS_WINDOW_ID}"]`;

const TARGETS = {
  identity: chatHelpTarget("identity", "identity"),
  agents: chatHelpTarget("agents", "agents"),
  call: chatHelpTarget("call", "call"),
  "agent-controls": chatHelpTarget("agent-controls", "agentControls"),
  "connected-chat": chatHelpTarget("connected-chat", "connectedChat"),
  // The Chat Settings button in the chat (at the top right unless moved).
  settings: chatHelpTarget("settings", "settings"),
  // The ? beside the Chat Settings title (a phone closes Chat Settings to show the guide).
  help: chatHelpTarget("help", "help"),
  "window-title": chatHelpTarget("window-title", "windowTitle", `${CHAT_SETTINGS_WINDOW} .mari-window__title`),
  // Controls with their own tooltip reuse its sentence.
  "window-pin": {
    ...chatHelpTarget("window-pin", "windowPin", `${CHAT_SETTINGS_WINDOW} [data-window-control="pin"]`),
    bodyKey: "window.controls.pinHint",
  },
  "window-lock": {
    ...chatHelpTarget("window-lock", "windowLock", `${CHAT_SETTINGS_WINDOW} [data-window-control="lock"]`),
    bodyKey: "window.controls.lockHint",
  },
  "window-close": chatHelpTarget(
    "window-close",
    "windowClose",
    `${CHAT_SETTINGS_WINDOW} [data-window-control="close"]`,
  ),
  // The whole switch row, not just its ? button.
  "tracker-panel": {
    ...chatHelpTarget("tracker-panel", "trackerPanel", '[data-tracker-panel-toggle="chat-settings"]'),
    bodyKey: "chat.settings.trackerPanelHelp",
  },
  // On a phone, the bubble the Tracker Panel switch shows.
  "tracker-panel-bubble": {
    ...chatHelpTarget("tracker-panel-bubble", "trackerPanelBubble", '[data-tracker-panel-toggle="bubble"]'),
    titleKey: "chat.help.targets.trackerPanel.title",
  },
  "reset-view": { ...chatHelpTarget("reset-view", "resetView"), bodyKey: "chat.settings.resetViewHelp" },
  // Roleplay's Agent activity section, right below Agents in Chat Settings.
  "agent-activity": {
    ...chatHelpTarget(
      "agent-activity",
      "agentActivity",
      `${CHAT_SETTINGS_WINDOW} [data-drawer$="-agent-activity"] > .mari-drawer__header`,
    ),
    titleKey: "chat.settings.agentActivity",
    bodyKey: "chat.settings.agentActivityHelp",
  },
  // A section popped out of Chat Settings or the Trackers window, shrunk to its button.
  "drawer-bubble": chatHelpTarget("drawer-bubble", "drawerBubble", ".mari-window-bubble[data-drawer-host]"),
  // The button beside a popped-out section's X that puts it back.
  "window-put-back": chatHelpTarget("window-put-back", "windowPutBack", '[data-window-control="put-back"]'),
  map: chatHelpTarget("map", "map", '[data-tour="game-map"]'),
  party: chatHelpTarget("party", "party", '[data-tour="game-party"]'),
  "scene-media": chatHelpTarget("scene-media", "sceneMedia"),
  // On a computer, Retry and the storyboard controls share the Game controls window and its button.
  "game-controls": chatHelpTarget("game-controls", "gameControls"),
  retry: chatHelpTarget("retry", "retry"),
  session: chatHelpTarget("session", "session"),
  volume: chatHelpTarget("volume", "volume"),
  assets: chatHelpTarget("assets", "assets"),
  widgets: { ...chatHelpTarget("widgets", "widgets", "[data-game-widget-rail]"), mergeMatches: true },
  dialogue: chatHelpTarget("dialogue", "dialogue", '[data-tour="game-dialogue"]'),
} satisfies Partial<Record<ChatHelpTargetId, ChatHelpTargetDefinition>>;

const CHAT_SETTINGS_TARGETS: ChatHelpTargetDefinition[] = [
  TARGETS.settings,
  TARGETS.help,
  TARGETS["window-title"],
  TARGETS["window-pin"],
  TARGETS["window-lock"],
  TARGETS["window-close"],
  TARGETS["tracker-panel"],
  TARGETS["reset-view"],
  TARGETS["drawer-bubble"],
  TARGETS["window-put-back"],
];

const COMPOSER_TARGET: ChatHelpTargetDefinition = {
  id: "composer",
  virtual: "composer",
  titleKey: "chat.help.targets.composer.title",
  bodyKey: "chat.help.targets.composer.body",
};

const TARGETS_BY_MODE: Record<ChatMode, ChatHelpTargetDefinition[]> = {
  conversation: [
    TARGETS.identity,
    TARGETS["agent-controls"],
    TARGETS["connected-chat"],
    TARGETS.call,
    ...CHAT_SETTINGS_TARGETS,
    {
      id: "messages",
      virtual: "messages",
      titleKey: "chat.help.targets.conversationMessages.title",
      bodyKey: "chat.help.targets.conversationMessages.body",
    },
    COMPOSER_TARGET,
  ],
  roleplay: [
    TARGETS.agents,
    TARGETS["tracker-panel-bubble"],
    TARGETS["agent-controls"],
    TARGETS["connected-chat"],
    ...CHAT_SETTINGS_TARGETS,
    TARGETS["agent-activity"],
    {
      id: "messages",
      virtual: "messages",
      titleKey: "chat.help.targets.roleplayMessages.title",
      bodyKey: "chat.help.targets.roleplayMessages.body",
    },
    COMPOSER_TARGET,
  ],
  game: [
    TARGETS.map,
    TARGETS.party,
    TARGETS["scene-media"],
    TARGETS["game-controls"],
    TARGETS.retry,
    TARGETS.session,
    TARGETS.volume,
    TARGETS.assets,
    TARGETS["connected-chat"],
    ...CHAT_SETTINGS_TARGETS,
    TARGETS.widgets,
    TARGETS.dialogue,
  ],
};

export function getChatHelpTargets(mode: ChatMode): readonly ChatHelpTargetDefinition[] {
  return TARGETS_BY_MODE[mode];
}
