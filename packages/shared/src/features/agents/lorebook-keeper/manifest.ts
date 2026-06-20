import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const lorebookKeeperAgentManifest = {
  id: "lorebook-keeper",
  name: "Lorebook Keeper",
  description:
    "Creates and updates durable chat lorebook entries from important story facts, characters, places, and world changes.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  defaultTools: ["search_lorebook"],
  runInterval: 8,
} satisfies BuiltInAgentManifest;
