import type { ToolDefinition } from "../../tool-definitions.js";

export const readChatSummaryToolManifest = {
  name: "read_chat_summary",
  description: "Read the current persisted chat summary for this chat.",
  parameters: {
    type: "object",
    properties: {},
  },
} satisfies ToolDefinition;
