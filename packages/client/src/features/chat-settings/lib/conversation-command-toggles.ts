import { type ConversationCommandKey, CONVERSATION_COMMAND_KEYS } from "@marinara-engine/shared";

export const CONVERSATION_COMMAND_TOGGLE_OPTIONS: Array<{
  id: ConversationCommandKey;
  label: string;
  description: string;
  /** Catalog keys for the label and description; entries without them still show their English text. */
  labelKey?: string;
  descriptionKey?: string;
}> = [
  {
    id: "schedule_update",
    label: "Schedule Updates",
    description: "Let characters change their current status and activity.",
  },
  {
    id: "cross_post",
    label: "Cross-Post",
    description: "Let characters redirect a message into another shared chat.",
  },
  {
    id: "selfie",
    label: "Selfies",
    description: "Let characters request a generated selfie.",
  },
  {
    id: "video",
    label: "Videos",
    description: "Let characters send short video messages.",
    labelKey: "ui.chat.conversationcommands.videos",
    descriptionKey: "ui.chat.conversationcommands.videosDescription",
  },
  {
    id: "memory",
    label: "Memories",
    description: "Let characters create memories for other characters.",
  },
  {
    id: "scene",
    label: "Scenes",
    description: "Let characters start an immersive scene from the conversation.",
  },
  {
    id: "music",
    label: "Music",
    description: "Let characters play songs through the active Music Player.",
  },
  {
    id: "haptic",
    label: "Haptics",
    description: "Let characters control connected haptic devices.",
  },
  {
    id: "influence",
    label: "Influence",
    description: "Let characters send one-shot influence to a connected chat.",
  },
  {
    id: "note",
    label: "Notes",
    description: "Let characters save durable notes for a connected chat.",
  },
  {
    id: "call",
    label: "Calls",
    description: "Let characters ring you for a Conversation call.",
  },
  {
    id: "react",
    label: "Reactions",
    description: "Let characters react to messages with emoji badges.",
  },
  {
    id: "uno",
    label: "UNO",
    description: "Let characters start a game of UNO at the table when you agree to play.",
  },
  {
    id: "chess",
    label: "Chess",
    description: "Let characters accept a one-on-one chess challenge at the table.",
  },
  {
    id: "poker",
    label: "Poker",
    description: "Let characters sit down for a game of Texas Hold'em poker at the table.",
  },
  {
    id: "eightball",
    label: "8-Ball Pool",
    description: "Let characters rack up a game of 8-ball pool at the table.",
  },
  {
    id: "tic_tac_toe",
    label: "Tic-Tac-Toe",
    description: "Let characters accept a one-on-one tic-tac-toe challenge at the table.",
  },
  {
    id: "rock_paper_scissors",
    label: "Rock-Paper-Scissors",
    description: "Let characters accept a one-on-one rock-paper-scissors match at the table.",
  },
];

export function readConversationCommandToggles(value: unknown): Partial<Record<ConversationCommandKey, boolean>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const toggles: Partial<Record<ConversationCommandKey, boolean>> = {};
  for (const key of CONVERSATION_COMMAND_KEYS) {
    if (typeof source[key] === "boolean") toggles[key] = source[key] as boolean;
  }
  return toggles;
}
