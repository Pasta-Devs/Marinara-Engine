import type { ToolDefinition } from "../../tool-definitions.js";

export const setExpressionToolManifest = {
  name: "set_expression",
  description: "Set a character's sprite expression for visual novel display.",
  parameters: {
    type: "object",
    properties: {
      characterName: { type: "string", description: "Name of the character" },
      expression: { type: "string", description: "Expression name (e.g. happy, sad, angry, neutral)" },
    },
    required: ["characterName", "expression"],
  },
} satisfies ToolDefinition;
