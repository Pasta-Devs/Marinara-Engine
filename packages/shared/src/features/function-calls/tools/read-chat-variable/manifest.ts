import type { ToolDefinition } from "../../tool-definitions.js";

export const readChatVariableToolManifest = {
  name: "read_chat_variable",
  description:
    "Read a chat-wide string variable by key. Use this for agent-private state or coordination with other agents in the same chat.",
  parameters: {
    type: "object",
    properties: {
      key: { type: "string", description: "Variable key to read" },
    },
    required: ["key"],
  },
} satisfies ToolDefinition;
