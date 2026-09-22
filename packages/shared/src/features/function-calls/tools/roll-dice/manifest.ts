import type { ToolDefinition } from "../../tool-definitions.js";

export const rollDiceToolManifest = {
  name: "roll_dice",
  description:
    "Roll dice using standard notation (e.g. 2d6, 1d20+5, or a bare d20). Used for RPG mechanics, skill checks, and random outcomes.",
  parameters: {
    type: "object",
    properties: {
      notation: { type: "string", description: "Dice notation (e.g. '2d6', '1d20+5', '3d8-2', 'd20')" },
      reason: { type: "string", description: "Why the roll is being made (e.g. 'Perception check')" },
      modifier: {
        type: "integer",
        description:
          "Optional situational bonus (+) or penalty (-), added once; exclude bonuses already in notation or supplied by an attribute.",
        minimum: Number.MIN_SAFE_INTEGER,
        maximum: Number.MAX_SAFE_INTEGER,
      },
      dc: {
        type: "integer",
        description: "Optional difficulty class; a total at least this high succeeds.",
        minimum: Number.MIN_SAFE_INTEGER,
        maximum: Number.MAX_SAFE_INTEGER,
      },
    },
    required: ["notation"],
  },
} satisfies ToolDefinition;
