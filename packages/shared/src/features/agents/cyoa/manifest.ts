import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const cyoaAgentManifest = {
  id: "cyoa",
  name: "CYOA Choices",
  description:
    "Generates interactive Choose Your Own Adventure choices after each assistant message. Click a choice to send it as your response. Available in Roleplay and Visual Novel modes.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  modeAllowlist: ["roleplay", "visual_novel"],
  defaultTools: [],
} satisfies BuiltInAgentManifest;
