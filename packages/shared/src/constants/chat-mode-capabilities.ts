// ──────────────────────────────────────────────
// Chat Mode Capability Matrix
// ──────────────────────────────────────────────
// This is the shared source of truth for mode-specific settings and feature
// availability. UI code should render the common settings shell from this map
// instead of scattering mode checks across large components.

import type { ChatMode } from "../types/chat.js";
import { BUILT_IN_AGENTS, isRetiredBuiltInAgentId, type BuiltInAgentMeta } from "../types/agent.js";

export type ChatParticipantModel = "chat-participants" | "game-party";

export type ChatSettingsSectionId =
  | "chat-settings-presets"
  | "chat-name"
  | "connection"
  | "prompt-preset"
  | "extra-prompt"
  | "scene-instructions"
  | "participants"
  | "conversation-prompt"
  | "manual-replies"
  | "group-chat"
  | "autonomous-messaging"
  | "conversation-commands"
  | "cross-chat-awareness"
  | "linked-chat"
  | "conversation-notes"
  | "lorebooks"
  | "agents"
  | "memory-recall"
  | "automatic-summarization"
  | "discord-mirror"
  | "function-calling"
  | "translation"
  | "advanced-parameters"
  | "context-limit"
  | "impersonation";

export type ChatModeAgentPolicy =
  | {
      kind: "all";
      defaultAgentIds: readonly string[];
      hiddenPickerAgentIds?: readonly string[];
    }
  | {
      kind: "allowlist";
      defaultAgentIds: readonly string[];
      allowedAgentIds: readonly string[];
      hiddenPickerAgentIds?: readonly string[];
    };

export interface ChatModeCapabilities {
  mode: ChatMode;
  label: string;
  participantModel: ChatParticipantModel;
  defaultAgentIds: readonly string[];
  agentPolicy: ChatModeAgentPolicy;
  sharedSections: readonly ChatSettingsSectionId[];
  modeSections: readonly ChatSettingsSectionId[];
  supportsChatSettingsPresets: boolean;
  supportsPromptPresets: boolean;
  supportsGroupChatControls: boolean;
  supportsSceneInstructions: boolean;
  supportsConnectedChat: boolean;
}

export const SHARED_CHAT_SETTINGS_SECTIONS = [
  "chat-name",
  "connection",
  "participants",
  "linked-chat",
  "lorebooks",
  "agents",
  "memory-recall",
  "discord-mirror",
  "function-calling",
  "translation",
  "advanced-parameters",
  "context-limit",
  "impersonation",
] as const satisfies readonly ChatSettingsSectionId[];

export const ROLEPLAY_AGENT_PICKER_HIDDEN_IDS = [] as const;

export const CONVERSATION_AGENT_IDS = [] as const;

// Conversation mode's About Me profile and update_about_me tool are core features,
// not downloadable agents. Conversation still permits user-authored custom agents.
export const CONVERSATION_ALLOWED_AGENT_IDS = [] as const;

// Optional packages are never activated implicitly. Existing chats retain their
// selections through the one-time legacy package migration.
export const ROLEPLAY_DEFAULT_AGENT_IDS = [] as const;

export const VISUAL_NOVEL_DEFAULT_AGENT_IDS = [] as const;

// Game mode has native GM/world-state/quest/combat/knowledge systems.
// Roleplay helper agents must not be exposed as per-game agent toggles here.
export const GAME_AGENT_IDS = [] as const;

export const GAME_OPTIONAL_AGENT_IDS = [] as const;

export const CHAT_MODE_CAPABILITIES: Record<ChatMode, ChatModeCapabilities> = {
  conversation: {
    mode: "conversation",
    label: "Conversation",
    participantModel: "chat-participants",
    defaultAgentIds: CONVERSATION_AGENT_IDS,
    agentPolicy: {
      kind: "allowlist",
      defaultAgentIds: CONVERSATION_AGENT_IDS,
      allowedAgentIds: CONVERSATION_ALLOWED_AGENT_IDS,
    },
    sharedSections: SHARED_CHAT_SETTINGS_SECTIONS,
    modeSections: [
      "prompt-preset",
      "manual-replies",
      "group-chat",
      "autonomous-messaging",
      "conversation-commands",
      "cross-chat-awareness",
      "automatic-summarization",
    ],
    supportsChatSettingsPresets: true,
    supportsPromptPresets: true,
    supportsGroupChatControls: true,
    supportsSceneInstructions: false,
    supportsConnectedChat: true,
  },
  roleplay: {
    mode: "roleplay",
    label: "Roleplay",
    participantModel: "chat-participants",
    defaultAgentIds: ROLEPLAY_DEFAULT_AGENT_IDS,
    agentPolicy: {
      kind: "all",
      defaultAgentIds: ROLEPLAY_DEFAULT_AGENT_IDS,
      hiddenPickerAgentIds: ROLEPLAY_AGENT_PICKER_HIDDEN_IDS,
    },
    sharedSections: SHARED_CHAT_SETTINGS_SECTIONS,
    modeSections: ["chat-settings-presets", "prompt-preset", "scene-instructions", "group-chat", "conversation-notes"],
    supportsChatSettingsPresets: true,
    supportsPromptPresets: true,
    supportsGroupChatControls: true,
    supportsSceneInstructions: true,
    supportsConnectedChat: true,
  },
  visual_novel: {
    mode: "visual_novel",
    label: "Roleplay (Legacy)",
    participantModel: "chat-participants",
    defaultAgentIds: VISUAL_NOVEL_DEFAULT_AGENT_IDS,
    agentPolicy: {
      kind: "all",
      defaultAgentIds: VISUAL_NOVEL_DEFAULT_AGENT_IDS,
      hiddenPickerAgentIds: ROLEPLAY_AGENT_PICKER_HIDDEN_IDS,
    },
    sharedSections: SHARED_CHAT_SETTINGS_SECTIONS,
    modeSections: ["chat-settings-presets", "prompt-preset", "scene-instructions", "group-chat", "conversation-notes"],
    supportsChatSettingsPresets: true,
    supportsPromptPresets: true,
    supportsGroupChatControls: true,
    supportsSceneInstructions: true,
    supportsConnectedChat: true,
  },
  game: {
    mode: "game",
    label: "Game",
    participantModel: "game-party",
    defaultAgentIds: GAME_AGENT_IDS,
    agentPolicy: {
      kind: "allowlist",
      defaultAgentIds: GAME_AGENT_IDS,
      // Music DJ is allowed (opt-in via the game music toggle) but not on by default.
      allowedAgentIds: [...GAME_AGENT_IDS, ...GAME_OPTIONAL_AGENT_IDS, "spotify"],
    },
    sharedSections: SHARED_CHAT_SETTINGS_SECTIONS,
    modeSections: ["prompt-preset", "conversation-notes"],
    supportsChatSettingsPresets: false,
    supportsPromptPresets: true,
    supportsGroupChatControls: false,
    supportsSceneInstructions: false,
    supportsConnectedChat: true,
  },
};

export function getChatModeCapabilities(mode: ChatMode | null | undefined): ChatModeCapabilities {
  return CHAT_MODE_CAPABILITIES[mode ?? "roleplay"] ?? CHAT_MODE_CAPABILITIES.roleplay;
}

export function isAgentManifestAvailableInChatMode(
  mode: ChatMode | null | undefined,
  agent: Pick<BuiltInAgentMeta, "id" | "modeAllowlist" | "execution">,
): boolean {
  if (isRetiredBuiltInAgentId(agent.id)) return false;
  const normalizedMode = mode ?? "roleplay";
  if (agent.modeAllowlist?.length && !agent.modeAllowlist.includes(normalizedMode)) return false;
  if (agent.execution === "feature") return true;
  const policy = getChatModeCapabilities(mode).agentPolicy;
  return policy.kind === "all" || policy.allowedAgentIds.includes(agent.id);
}

export function isAgentAvailableInChatMode(mode: ChatMode | null | undefined, agentId: string): boolean {
  if (isRetiredBuiltInAgentId(agentId)) return false;
  const builtIn = BUILT_IN_AGENTS.find((agent) => agent.id === agentId);
  return builtIn ? isAgentManifestAvailableInChatMode(mode, builtIn) : true;
}

export function isAgentHiddenFromChatSettingsPicker(mode: ChatMode | null | undefined, agentId: string): boolean {
  const hidden = getChatModeCapabilities(mode).agentPolicy.hiddenPickerAgentIds ?? [];
  return hidden.includes(agentId);
}
