// ──────────────────────────────────────────────
// Chat Mode Capability Matrix
// ──────────────────────────────────────────────
// This is the shared source of truth for mode-specific settings and feature
// availability. UI code should render the common settings shell from this map
// instead of scattering mode checks across large components.

import type { ChatMode } from "../types/chat.js";
import { BUILT_IN_AGENTS, isRetiredBuiltInAgentId } from "../types/agent.js";

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

export const ROLEPLAY_DEFAULT_AGENT_IDS = [
  "world-state",
  "prose-guardian",
  "continuity",
  "expression",
] as const;

export const VISUAL_NOVEL_DEFAULT_AGENT_IDS = [
  "world-state",
  "prose-guardian",
  "expression",
] as const;

// Game mode has native GM/world-state/quest/combat/knowledge systems.
// Roleplay helper agents must not be exposed as per-game agent toggles here.
export const GAME_AGENT_IDS = [] as const;

export const GAME_OPTIONAL_AGENT_IDS = [] as const;

const BUILT_IN_AGENT_ID_SET = new Set(BUILT_IN_AGENTS.map((agent) => agent.id));

export const CHAT_MODE_CAPABILITIES: Record<ChatMode, ChatModeCapabilities> = {
  conversation: {
    mode: "conversation",
    label: "Conversation",
    participantModel: "chat-participants",
    defaultAgentIds: CONVERSATION_AGENT_IDS,
    agentPolicy: {
      kind: "allowlist",
      defaultAgentIds: CONVERSATION_AGENT_IDS,
      allowedAgentIds: CONVERSATION_AGENT_IDS,
    },
    sharedSections: SHARED_CHAT_SETTINGS_SECTIONS,
    modeSections: [
      "conversation-prompt",
      "manual-replies",
      "autonomous-messaging",
      "conversation-commands",
      "cross-chat-awareness",
      "automatic-summarization",
    ],
    supportsChatSettingsPresets: true,
    supportsPromptPresets: false,
    supportsGroupChatControls: false,
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
    label: "Visual Novel",
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
    modeSections: ["extra-prompt", "conversation-notes"],
    supportsChatSettingsPresets: false,
    supportsPromptPresets: false,
    supportsGroupChatControls: false,
    supportsSceneInstructions: false,
    supportsConnectedChat: true,
  },
};

export function getChatModeCapabilities(mode: ChatMode | null | undefined): ChatModeCapabilities {
  return CHAT_MODE_CAPABILITIES[mode ?? "roleplay"] ?? CHAT_MODE_CAPABILITIES.roleplay;
}

export function isAgentAvailableInChatMode(mode: ChatMode | null | undefined, agentId: string): boolean {
  if (isRetiredBuiltInAgentId(agentId)) return false;
  const normalizedMode = mode ?? "roleplay";
  const builtIn = BUILT_IN_AGENTS.find((agent) => agent.id === agentId);
  if (builtIn?.modeAllowlist?.length && !builtIn.modeAllowlist.includes(normalizedMode)) return false;
  const policy = getChatModeCapabilities(mode).agentPolicy;
  if (policy.kind === "all") return true;
  if (!BUILT_IN_AGENT_ID_SET.has(agentId)) return true;
  return policy.allowedAgentIds.includes(agentId);
}

export function isAgentHiddenFromChatSettingsPicker(mode: ChatMode | null | undefined, agentId: string): boolean {
  const hidden = getChatModeCapabilities(mode).agentPolicy.hiddenPickerAgentIds ?? [];
  return hidden.includes(agentId);
}
