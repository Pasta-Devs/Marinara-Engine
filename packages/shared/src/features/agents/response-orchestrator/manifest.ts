import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const responseOrchestratorAgentManifest = {
  id: "response-orchestrator",
  name: "Response Orchestrator",
  description:
    "For group Conversation chats — decides which character(s) should respond to a message based on context, personality, and relevance.",
  phase: "pre_generation",
  enabledByDefault: false,
  category: "misc",
  libraryHidden: true,
  runtimeDisabled: true,
  modeAllowlist: ["conversation"],
  defaultTools: [],
} satisfies BuiltInAgentManifest;
