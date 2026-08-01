import type { ChatMode } from "@marinara-engine/shared";

/** Owns only active ChatSettingsDrawer surface visibility, not the complete chat shell. */
export const CHAT_SETTINGS_SURFACES: Record<
  ChatMode,
  {
    showSettingsProfiles: boolean;
    promptSettingsSurface: "conversation" | "roleplay" | "game";
    agentSettingsSurface: "conversation" | "generation";
    showGroupChatControls: boolean;
  }
> = {
  conversation: {
    showSettingsProfiles: true,
    promptSettingsSurface: "conversation",
    agentSettingsSurface: "conversation",
    showGroupChatControls: true,
  },
  roleplay: {
    showSettingsProfiles: true,
    promptSettingsSurface: "roleplay",
    agentSettingsSurface: "generation",
    showGroupChatControls: true,
  },
  game: {
    showSettingsProfiles: false,
    promptSettingsSurface: "game",
    agentSettingsSurface: "generation",
    showGroupChatControls: false,
  },
};
