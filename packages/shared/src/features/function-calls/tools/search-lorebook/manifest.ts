import type { ToolDefinition } from "../../tool-definitions.js";

export const searchLorebookToolManifest = {
  name: "search_lorebook",
  description: "Search the lorebook for relevant world-building information.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query — keywords, character names, locations, etc." },
      category: { type: "string", description: "Optional category filter" },
    },
    required: ["query"],
  },
} satisfies ToolDefinition;
