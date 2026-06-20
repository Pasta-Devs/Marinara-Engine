import type { ToolDefinition } from "../../tool-definitions.js";

export const editChatMessageToolManifest = {
  name: "edit_chat_message",
  description:
    "Replace the content of a recent user or assistant message by message ID. Only use this when the agent has message-edit permission and the replacement is intentional.",
  parameters: {
    type: "object",
    properties: {
      messageId: {
        type: "string",
        description: "The message ID to replace. Use the exact ID shown in the message context.",
      },
      content: {
        type: "string",
        description: "The full replacement message content.",
      },
      reason: {
        type: "string",
        description: "Short reason for the edit, used for audit/debug output.",
      },
    },
    required: ["messageId", "content"],
  },
} satisfies ToolDefinition;
