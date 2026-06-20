import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const customTrackerAgentManifest = {
  id: "custom-tracker",
  name: "Custom Tracker",
  description:
    "Tracks user-defined fields (currencies, counters, flags, or any custom data). Add any fields you want the model to keep track of during the roleplay.",
  phase: "post_processing",
  enabledByDefault: false,
  defaultInjectAsSection: true,
  category: "tracker",
  defaultTools: ["update_game_state"],
} satisfies BuiltInAgentManifest;
