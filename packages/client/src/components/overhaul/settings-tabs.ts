// ──────────────────────────────────────────────
// UI overhaul: which Settings tab holds which section
//
// Kept apart from the Settings page so navigation (omnibar, Mari, links) can
// pick the right tab without loading the page.
// ──────────────────────────────────────────────
import { SETTINGS_SECTIONS, type SettingsSectionId } from "@marinara-engine/shared";
import type { OverhaulSettingsTab } from "../../stores/overhaul.store";

export const OVERHAUL_SETTINGS_TABS: {
  id: OverhaulSettingsTab;
  label: string;
  blurb: string;
  sections: SettingsSectionId[];
}[] = [
  {
    id: "general",
    label: "General",
    blurb: "Language, confirmations, extras, Professor Mari and notifications",
    sections: ["application", "confirmations-help", "extras", "omnibar", "notifications"],
  },
  {
    id: "chatting",
    label: "Chatting",
    blurb: "Replies, the message box, editing and swipes, thinking, formatting and message info",
    sections: ["responses", "input-editing", "editing-swipes", "thinking", "text-rules", "message-tools"],
  },
  {
    id: "appearance",
    label: "Appearance",
    blurb: "Theme, fonts, text colors, layout, effects, backgrounds and CSS themes",
    sections: [
      "app-style",
      "text-scale",
      "accessibility",
      "text-colors",
      "layout",
      "motion-backgrounds",
      "chat-backgrounds",
      "chat-widgets",
      "theme-library",
    ],
  },
  {
    id: "conversation",
    label: "Conversation",
    blurb: "How Conversation chats look",
    sections: ["chat-display", "conversation-theme"],
  },
  {
    id: "roleplay",
    label: "Roleplay",
    blurb: "The Tracker Panel, Roleplay messages, avatars and Visual Novel",
    sections: ["roleplay-tracker", "roleplay-messages", "roleplay-avatars", "visual-novel"],
  },
  {
    id: "game",
    label: "Game",
    blurb: "Game Mode text, art and assets",
    sections: ["game-playback", "game-presentation", "game-assets"],
  },
  {
    id: "media",
    label: "Media",
    blurb: "Image and video generation",
    sections: ["overall-generations", "image-generation", "video-generation", "prompt-overrides"],
  },
  {
    id: "data",
    label: "Data",
    blurb: "Imports, backups, chat exports, storage and deleting data",
    sections: [
      "sillytavern-import",
      "backup-export",
      "profile-marinara",
      "chat-exports",
      "storage-optimization",
      "danger-zone",
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    blurb: "Updates, server, requests, lorebooks, security, multiplayer and troubleshooting",
    sections: [
      "updates",
      "server",
      "request-timeouts",
      "parameters",
      "features",
      "admin-access",
      "multiplayer",
      "support-diagnostics",
    ],
  },
];

/** The new layout's tab for a settings section, or null when the section lives on another page. */
export function overhaulSettingsTabFor(sectionId: string | null | undefined): OverhaulSettingsTab | null {
  if (!sectionId) return null;
  return OVERHAUL_SETTINGS_TABS.find((tab) => tab.sections.includes(sectionId as SettingsSectionId))?.id ?? null;
}

/** The new layout's tab for a classic Settings tab: the one holding that tab's first section. */
export function overhaulSettingsTabForClassicTab(tab: string): OverhaulSettingsTab | null {
  for (const section of SETTINGS_SECTIONS) {
    if (section.tab !== tab) continue;
    const found = overhaulSettingsTabFor(section.id);
    if (found) return found;
  }
  return null;
}
