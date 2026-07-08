import type { ToolDefinition } from "../../tool-definitions.js";

export const updateAboutMeToolManifest = {
  name: "update_about_me",
  description:
    "Conversation mode only: update YOUR OWN \"about me\" profile. Use scope \"public\" to change your real bio that everyone sees in every chat (only if you're fine with that being widely known — it is shown to the user for approval first). Use scope \"chat\" for a private bio just for this conversation. Write only what you would actually put — it can be short, an emoji, a joke, or empty. Do not use this often.",
  parameters: {
    type: "object",
    properties: {
      scope: {
        type: "string",
        enum: ["public", "chat"],
        description: "\"public\" = your real cross-chat bio (needs user approval); \"chat\" = private to this conversation.",
      },
      content: {
        type: "string",
        description: "The complete new about-me text in your own voice. May be empty to clear it.",
      },
    },
    required: ["scope", "content"],
  },
} satisfies ToolDefinition;
