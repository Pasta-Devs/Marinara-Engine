import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const knowledgeRouterAgentManifest = {
  id: "knowledge-router",
  name: "Knowledge Router",
  description:
    "Lower-cost alternative to Knowledge Retrieval. Reads a short catalog of lorebook entries (descriptions or content snippets), picks which ones are relevant to the current scene, and injects them verbatim — no per-entry summarization passes. Best for large lorebooks where you've written entry descriptions.",
  phase: "pre_generation",
  enabledByDefault: false,
  category: "writer",
  modeAllowlist: ["roleplay", "visual_novel"],
  defaultTools: [],
  defaultSettings: {
    useChatActiveLorebooks: true,
  },
} satisfies BuiltInAgentManifest;
