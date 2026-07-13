import type { ToolDefinition } from "../../tool-definitions.js";

export const humanosGetRuntimeToolManifest = {
  name: "humanos_get_runtime",
  description: "Read the latest committed HumanOS v2 Runtime for the active chat. The chat is selected by Marinara and cannot be supplied by the model.",
  parameters: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
} satisfies ToolDefinition;
