import { parseMessageExtraRecord } from "./chat-message-extra";
import { estimateTextTokens } from "@marinara-engine/shared";

type GameSessionHistoryMessage = {
  content: string;
  extra?: unknown;
};

const APPROX_MESSAGE_TOKEN_OVERHEAD = 4;

function estimateTextTokenCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const wordEstimate = trimmed.split(/\s+/).filter(Boolean).length * 1.3;
  const charEstimate = estimateTextTokens(trimmed);
  return Math.ceil(Math.max(wordEstimate, charEstimate));
}

function estimateMessageTokenCount(message: GameSessionHistoryMessage): number {
  const stored = parseMessageExtraRecord(message.extra).tokenCount;
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) return stored;
  const textTokens = estimateTextTokenCount(message.content);
  return textTokens > 0 ? textTokens + APPROX_MESSAGE_TOKEN_OVERHEAD : 0;
}

/** Estimates the active Game session history, beginning at its latest start marker. */
export function estimateGameSessionHistoryTokens(messages: GameSessionHistoryMessage[]): number {
  let startIndex = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (parseMessageExtraRecord(messages[i]?.extra).isConversationStart === true) {
      startIndex = i;
      break;
    }
  }
  return messages.slice(startIndex).reduce((total, message) => total + estimateMessageTokenCount(message), 0);
}
