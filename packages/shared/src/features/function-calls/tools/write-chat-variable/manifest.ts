import type { ToolDefinition } from "../../tool-definitions.js";

export const writeChatVariableToolManifest = {
  name: "write_chat_variable",
  description:
    "Write or replace a chat-wide string variable by key. Any agent in this chat can read the value if it knows the key.",
  parameters: {
    type: "object",
    properties: {
      key: { type: "string", description: "Variable key to write" },
      value: { type: "string", description: "String value to store for this key" },
    },
    required: ["key", "value"],
  },
} satisfies ToolDefinition;
