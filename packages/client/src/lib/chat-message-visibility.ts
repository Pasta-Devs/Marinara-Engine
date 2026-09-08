import { parseMessageExtraRecord } from "./chat-message-extra";

interface ChatMessageVisibilityInput {
  role: string;
  content?: unknown;
  extra?: unknown;
}

export function hasVisibleUserMessagePayload(content: unknown, attachments: unknown): boolean {
  if (typeof content === "string" && content.trim().length > 0) return true;
  return Array.isArray(attachments) && attachments.length > 0;
}

export function isMessageHiddenFromUser(message: ChatMessageVisibilityInput): boolean {
  const extra = parseMessageExtraRecord(message.extra);
  if (extra.hiddenFromUser === true) return true;
  if (message.role !== "user") return false;
  if (extra.diceRollResult && typeof extra.diceRollResult === "object") return false;
  return !hasVisibleUserMessagePayload(message.content, extra.attachments);
}

/** Game narration and logs share one rule for readable turns, including hidden command anchors. */
export function isVisibleGameMessage(message: ChatMessageVisibilityInput): boolean {
  return (
    !isMessageHiddenFromUser(message) &&
    parseMessageExtraRecord(message.extra).commandOnly !== true &&
    typeof message.content === "string" &&
    message.content.trim().length > 0
  );
}
