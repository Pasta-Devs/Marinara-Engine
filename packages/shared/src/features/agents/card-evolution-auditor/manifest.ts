import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const cardEvolutionAuditorAgentManifest = {
  id: "card-evolution-auditor",
  name: "Card Evolution Auditor",
  description:
    "Audits durable roleplay changes against saved character cards and proposes precise edits for user approval.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  defaultTools: [],
  runInterval: 8,
} satisfies BuiltInAgentManifest;
