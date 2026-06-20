import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const characterTrackerAgentManifest = {
  id: "character-tracker",
  name: "Character Tracker",
  description:
    "Tracks which characters are present in the scene, their mood, actions, appearance, outfit, thoughts, and per-character stats (HP, etc.).",
  phase: "post_processing",
  enabledByDefault: false,
  defaultInjectAsSection: true,
  category: "tracker",
  defaultTools: ["update_game_state"],
} satisfies BuiltInAgentManifest;
