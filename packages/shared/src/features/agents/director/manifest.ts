import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const directorAgentManifest = {
  id: "director",
  name: "Narrative Director",
  description: "Creates one-shot story directions when you choose to push the next response forward.",
  phase: "pre_generation",
  enabledByDefault: false,
  category: "writer",
  modeAllowlist: ["roleplay"],
  defaultTools: [],
  defaultSettings: {
    directorMode: "natural",
    secretPlotEnabled: false,
    secretPlotRunInterval: 8,
  },
} satisfies BuiltInAgentManifest;
