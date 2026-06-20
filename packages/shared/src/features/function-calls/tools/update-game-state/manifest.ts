import type { ToolDefinition } from "../../tool-definitions.js";

export const updateGameStateToolManifest = {
  name: "update_game_state",
  description: "Update the current game state — character stats, inventory, quest progress, etc.",
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        description: "Type of update",
        enum: ["stat_change", "inventory_add", "inventory_remove", "quest_update", "location_change", "time_advance"],
      },
      target: { type: "string", description: "Who or what is being updated (character name or 'player')" },
      key: { type: "string", description: "The specific stat/item/quest being changed" },
      value: { type: "string", description: "The new value or change amount" },
      description: { type: "string", description: "Human-readable description of the change" },
    },
    required: ["type", "target", "key", "value"],
  },
} satisfies ToolDefinition;
