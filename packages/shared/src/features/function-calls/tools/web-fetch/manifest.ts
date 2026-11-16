import type { ToolDefinition } from "../../tool-definitions.js";

export const webFetchToolManifest = {
  name: "web_fetch",
  description:
    "Read the readable text of one public web page by URL. Use it after web_search when a result page likely holds the answer, such as a wiki, encyclopedia, or news article.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Absolute https:// URL of the page to read.",
      },
      maxChars: {
        type: "integer",
        description:
          "Maximum characters of page text to return, including the title. Defaults to 6000 and is capped at 12000.",
        minimum: 500,
        maximum: 12000,
      },
    },
    required: ["url"],
  },
} satisfies ToolDefinition;
