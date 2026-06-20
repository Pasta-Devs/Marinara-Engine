// ──────────────────────────────────────────────
// Chat Mode Definitions
// ──────────────────────────────────────────────
import type { ChatMode } from "../types/chat.js";
import { CHAT_MODE_CAPABILITIES } from "./chat-mode-capabilities.js";

export interface ChatModeDefinition {
  id: ChatMode;
  name: string;
  description: string;
  icon: string;
  /** Which agents are enabled by default for this mode */
  defaultAgents: string[];
}

export const CHAT_MODES: Record<ChatMode, ChatModeDefinition> = {
  conversation: {
    id: "conversation",
    name: "Conversation",
    description: "A straightforward AI conversation — no roleplay elements.",
    icon: "💬",
    defaultAgents: [...CHAT_MODE_CAPABILITIES.conversation.defaultAgentIds],
  },
  roleplay: {
    id: "roleplay",
    name: "Roleplay",
    description: "Immersive roleplay with characters, game state tracking, and world simulation.",
    icon: "🎭",
    defaultAgents: [...CHAT_MODE_CAPABILITIES.roleplay.defaultAgentIds],
  },
  visual_novel: {
    id: "visual_novel",
    name: "Visual Novel",
    description: "Visual novel experience with backgrounds, sprites, text boxes, and choices.",
    icon: "🎮",
    defaultAgents: [...CHAT_MODE_CAPABILITIES.visual_novel.defaultAgentIds],
  },
  game: {
    id: "game",
    name: "Game",
    description: "AI-managed singleplayer RPG with a Game Master, party members, sessions, and dice.",
    icon: "🎲",
    defaultAgents: [...CHAT_MODE_CAPABILITIES.game.defaultAgentIds],
  },
};
