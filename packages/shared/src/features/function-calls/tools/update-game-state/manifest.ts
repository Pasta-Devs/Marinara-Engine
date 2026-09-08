import type { ToolDefinition } from "../../tool-definitions.js";

export const updateGameStateToolManifest = {
  name: "update_game_state",
  description:
    "Move the game clock or the party's location. Stats, inventory and quests are tracked elsewhere — narrate those instead of calling this.",
  parameters: {
    type: "object",
    properties: {
      type: {
        // Only these two are written back to the game state. The four that used to be
        // listed here (stat_change, inventory_add, inventory_remove, quest_update) were
        // reported as applied and then dropped, so they are no longer offered.
        type: "string",
        description: "Type of update",
        enum: ["location_change", "time_advance"],
      },
      target: { type: "string", description: "Who or what is being updated (character name or 'player')" },
      key: { type: "string", description: "Optional label for the location or time being changed" },
      value: { type: "string", description: "The new value or change amount" },
      description: { type: "string", description: "Human-readable description of the change" },
    },
    required: ["type", "value"],
  },
} satisfies ToolDefinition;
