import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const personaStatsAgentManifest = {
  id: "persona-stats",
  name: "Persona Stats",
  description:
    "Tracks the player persona's status bars — Satiety, Energy, Hygiene, and other custom stats — with realistic changes based on narrative events.",
  phase: "post_processing",
  enabledByDefault: false,
  defaultInjectAsSection: true,
  category: "tracker",
  defaultTools: ["update_game_state"],
} satisfies BuiltInAgentManifest;
