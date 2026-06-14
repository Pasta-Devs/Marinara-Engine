import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const promptReviewerAgentManifest = {
  id: "prompt-reviewer",
  name: "Prompt Reviewer",
  description:
    "Analyses your prompt preset for clarity, redundancy, and formatting issues, and suggests improvements.",
  phase: "pre_generation",
  enabledByDefault: false,
  category: "writer",
  libraryHidden: true,
  runtimeDisabled: true,
  defaultTools: [],
} satisfies BuiltInAgentManifest;
