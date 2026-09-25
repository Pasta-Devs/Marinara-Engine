import type { ToolDefinition } from "../../tool-definitions.js";

export const updateGameStateToolManifest = {
  name: "update_game_state",
  description:
    "Set the game's shared clock or party location for this turn. A pending receipt is not an applied change: it is stored only after the response is saved. Locked fields and Spatial Context-owned locations are refused. Stats, inventory and quests are tracked elsewhere.",
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
      value: { type: "string", description: "The new stored location or time text, not a relative duration" },
      description: { type: "string", description: "Human-readable description of the change" },
    },
    required: ["type", "value"],
  },
} satisfies ToolDefinition;
