import type { ToolDefinition } from "../../tool-definitions.js";

export const humanosGetArchitectureToolManifest = {
  name: "humanos_get_architecture",
  description: "Read the private HumanOS v2 architecture for an active character or user persona. Access is restricted to subjects in the current generation context.",
  parameters: {
    type: "object",
    properties: {
      subjectType: { type: "string", enum: ["CHARACTER", "USER_PERSONA"], description: "HumanOS subject type" },
      subjectId: { type: "string", description: "Active character or persona ID" },
    },
    required: ["subjectType", "subjectId"],
    additionalProperties: false,
  },
} satisfies ToolDefinition;
