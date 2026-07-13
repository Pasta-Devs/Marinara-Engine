import type { ToolDefinition } from "../../tool-definitions.js";

export const humanosSaveArchitectureToolManifest = {
  name: "humanos_save_architecture",
  description: "Validate and save private HumanOS v2 architecture for an active character or user persona. Unresolved CONFLICTED provenance is preserved and reported as compilation-blocking.",
  parameters: {
    type: "object",
    properties: {
      subjectType: { type: "string", enum: ["CHARACTER", "USER_PERSONA"], description: "HumanOS subject type" },
      subjectId: { type: "string", description: "Active character or persona ID" },
      architecture: { type: "object", description: "Complete schemaVersion 2 HumanOS Private Architecture object" },
    },
    required: ["subjectType", "subjectId", "architecture"],
    additionalProperties: false,
  },
} satisfies ToolDefinition;
