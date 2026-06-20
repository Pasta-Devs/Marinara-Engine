import type { ToolDefinition } from "../../tool-definitions.js";

export const appendChatSummaryToolManifest = {
  name: "append_chat_summary",
  description: "Append durable memory text to the persisted chat summary for this chat.",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description:
          "Concise summary text to append. Include only durable facts, plans, preferences, or story developments.",
      },
    },
    required: ["text"],
  },
} satisfies ToolDefinition;
