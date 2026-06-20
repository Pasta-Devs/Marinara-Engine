import type { ToolDefinition } from "../../tool-definitions.js";

export const rollDiceToolManifest = {
  name: "roll_dice",
  description:
    "Roll dice using standard notation (e.g. 2d6, 1d20+5). Used for RPG mechanics, skill checks, and random outcomes.",
  parameters: {
    type: "object",
    properties: {
      notation: { type: "string", description: "Dice notation (e.g. '2d6', '1d20+5', '3d8-2')" },
      reason: { type: "string", description: "Why the roll is being made (e.g. 'Perception check')" },
    },
    required: ["notation"],
  },
} satisfies ToolDefinition;
