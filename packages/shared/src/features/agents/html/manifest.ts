import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const htmlAgentManifest = {
  id: "html",
  name: "Immersive HTML",
  description:
    "Post-processes the latest Roleplay response with diegetic HTML/CSS/JS visual artifacts without changing the story meaning.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  resultType: "text_rewrite",
  defaultSettings: {
    resultType: "text_rewrite",
    contextSize: 5,
    maxTokens: 4096,
    holdForRewrite: true,
  },
  modeAllowlist: ["roleplay"],
  defaultTools: [],
} satisfies BuiltInAgentManifest;
