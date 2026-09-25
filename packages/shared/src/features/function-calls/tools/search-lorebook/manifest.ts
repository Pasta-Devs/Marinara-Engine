import type { ToolDefinition } from "../../tool-definitions.js";

export const searchLorebookToolManifest = {
  name: "search_lorebook",
  description:
    "Search enabled lorebooks for relevant world-building information by meaning. Semantic search requires vectorized entries; Game Master lore search reports when none are available.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Describe the information needed, such as who runs the docks or where a character lives.",
      },
      category: { type: "string", description: "Optional category filter" },
    },
    required: ["query"],
  },
} satisfies ToolDefinition;
