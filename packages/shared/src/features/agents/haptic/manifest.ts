import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const hapticAgentManifest = {
  id: "haptic",
  name: "Haptic Feedback",
  description:
    "Analyzes narrative content and controls connected intimate toys in real time. Requires Intiface Central running locally — connect your toy there first, then enable this agent.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  defaultTools: [],
} satisfies BuiltInAgentManifest;
