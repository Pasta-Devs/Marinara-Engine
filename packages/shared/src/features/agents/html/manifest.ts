import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const htmlAgentManifest = {
  id: "html",
  name: "Immersive HTML",
  description:
    "Adds immersive HTML/CSS/JS formatting instructions to the last Roleplay user prompt without running a separate agent call.",
  phase: "pre_generation",
  enabledByDefault: false,
  category: "misc",
  runtimeDisabled: true,
  modeAllowlist: ["roleplay"],
  defaultTools: [],
} satisfies BuiltInAgentManifest;
