import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const schedulePlannerAgentManifest = {
  id: "schedule-planner",
  name: "Schedule Planner",
  description:
    "Generates a realistic weekly schedule for each character in Conversation mode based on their personality and description. Updates automatically each week.",
  phase: "pre_generation",
  enabledByDefault: false,
  category: "tracker",
  libraryHidden: true,
  modeAllowlist: ["conversation"],
  defaultTools: [],
} satisfies BuiltInAgentManifest;
