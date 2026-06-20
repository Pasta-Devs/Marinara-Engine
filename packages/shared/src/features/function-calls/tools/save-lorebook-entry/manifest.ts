import type { ToolDefinition } from "../../tool-definitions.js";

export const saveLorebookEntryToolManifest = {
  name: "save_lorebook_entry",
  description:
    "Create or update an entry in the lorebook selected for this agent. Use it only for durable facts, world lore, characters, locations, or long-term story developments worth remembering.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short entry title, such as a character, location, object, or event name" },
      content: { type: "string", description: "Concise lorebook entry content to store" },
      description: { type: "string", description: "Optional one-line description for routing and editor context" },
      keys: {
        type: "array",
        items: { type: "string" },
        description: "Optional trigger/search keys. If omitted, the title is used as a key.",
      },
      tag: { type: "string", description: "Optional category tag" },
      mode: {
        type: "string",
        enum: ["create", "replace", "append"],
        description:
          "How to handle an existing entry with the same name in the selected lorebook. Defaults to replace.",
      },
    },
    required: ["name", "content"],
  },
} satisfies ToolDefinition;
