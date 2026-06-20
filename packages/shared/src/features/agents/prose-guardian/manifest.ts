import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const proseGuardianAgentManifest = {
  id: "prose-guardian",
  name: "Prose Guardian",
  description:
    "Post-processes the latest assistant message to remove banned words, repetition, and unwanted prose habits without changing the meaning.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "writer",
  resultType: "text_rewrite",
  defaultSettings: {
    resultType: "text_rewrite",
    contextSize: 5,
    maxTokens: 4096,
    banned: "ozone",
    avoid:
      "no repetition of any phrases or sentence structure from the last messages, if the last output started with dialogue line, this one needs to start with narration, no purple prose",
    prefer: "",
    holdForRewrite: true,
  },
  defaultTools: [],
} satisfies BuiltInAgentManifest;
