import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const continuityAgentManifest = {
  id: "continuity",
  name: "Continuity Checker",
  description:
    "Post-processes the latest assistant message to fix concrete spatial, timeline, and physical logic errors without changing the story.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "writer",
  resultType: "text_rewrite",
  defaultSettings: {
    resultType: "text_rewrite",
    contextSize: 8,
    maxTokens: 4096,
    holdForRewrite: true,
  },
  defaultTools: [],
} satisfies BuiltInAgentManifest;
