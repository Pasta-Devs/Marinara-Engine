import type { ToolDefinition } from "../../tool-definitions.js";

export const webSearchToolManifest = {
  name: "web_search",
  description:
    "Search the public web for current or external information. Returns compact title, URL, and snippet results.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The web search query. Use concise keywords or a direct question.",
      },
      limit: {
        type: "integer",
        description: "Number of search results to return. Defaults to 5 and is capped at 8.",
        minimum: 1,
        maximum: 8,
      },
    },
    required: ["query"],
  },
} satisfies ToolDefinition;
