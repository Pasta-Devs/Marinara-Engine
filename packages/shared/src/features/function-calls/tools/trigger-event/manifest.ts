import type { ToolDefinition } from "../../tool-definitions.js";

export const triggerEventToolManifest = {
  name: "trigger_event",
  description: "Trigger a narrative event — introduce an NPC, start a quest, change the scene, etc.",
  parameters: {
    type: "object",
    properties: {
      eventType: {
        type: "string",
        description: "Type of event",
        enum: [
          "npc_entrance",
          "npc_exit",
          "quest_start",
          "quest_complete",
          "scene_change",
          "combat_start",
          "combat_end",
          "revelation",
          "custom",
        ],
      },
      description: { type: "string", description: "What happens in this event" },
      involvedCharacters: { type: "array", items: { type: "string" }, description: "Names of characters involved" },
    },
    required: ["eventType", "description"],
  },
} satisfies ToolDefinition;
