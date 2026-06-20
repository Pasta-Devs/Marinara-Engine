import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const backgroundAgentManifest = {
  id: "background",
  name: "Background",
  description:
    "Selects the most fitting background image for the current scene from your uploaded backgrounds, with optional image generation for missing locations.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "tracker",
  defaultTools: [],
} satisfies BuiltInAgentManifest;
