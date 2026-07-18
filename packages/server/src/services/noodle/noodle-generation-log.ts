import type { ChatMessage } from "../llm/base-provider.js";

export function formatNoodleMessagesForLog(messages: readonly ChatMessage[]) {
  return messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
}
