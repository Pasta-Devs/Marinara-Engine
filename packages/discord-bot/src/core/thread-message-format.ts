import type { MessageRole } from "@marinara-engine/shared";

function roleLabel(role: MessageRole) {
  switch (role) {
    case "assistant":
      return "Assistant";
    case "narrator":
      return "Narrator";
    case "system":
      return "System";
    case "user":
    default:
      return "User";
  }
}

export function formatThreadMessage(message: { role: MessageRole; displayName?: string; content: string }) {
  return `**${message.displayName || roleLabel(message.role)}**\n${message.content}`;
}
