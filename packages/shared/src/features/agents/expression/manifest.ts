import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const expressionAgentManifest = {
  id: "expression",
  name: "Expression Engine",
  description: "Detects character emotions and selects VN sprites/expressions.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "tracker",
  modeAllowlist: ["roleplay", "visual_novel"],
  defaultTools: ["set_expression"],
} satisfies BuiltInAgentManifest;
