import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const autonomousMessengerAgentManifest = {
  id: "autonomous-messenger",
  name: "Autonomous Messenger",
  description:
    "Allows characters to send messages unprompted when the user has been inactive, based on personality traits like talkativeness and the character's current schedule.",
  phase: "parallel",
  enabledByDefault: false,
  category: "misc",
  libraryHidden: true,
  modeAllowlist: ["conversation"],
  defaultTools: [],
} satisfies BuiltInAgentManifest;
