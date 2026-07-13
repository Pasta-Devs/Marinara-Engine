import type { ToolDefinition } from "../../tool-definitions.js";

export const humanosCommitRuntimeToolManifest = {
  name: "humanos_commit_runtime",
  description: "Commit HumanOS v2 Runtime for the active chat against Marinara's server-selected canonical assistant message and swipe. Fails closed when no canonical anchor is available.",
  parameters: {
    type: "object",
    properties: {
      committed: { type: "boolean", description: "Must be true to authorize a canonical Runtime commit" },
      state: { type: "object", description: "Complete current HumanOS Runtime state after applying evidence-backed changes" },
    },
    required: ["committed", "state"],
    additionalProperties: false,
  },
} satisfies ToolDefinition;
