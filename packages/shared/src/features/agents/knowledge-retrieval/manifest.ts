import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const knowledgeRetrievalAgentManifest = {
  id: "knowledge-retrieval",
  name: "Knowledge Retrieval",
  description:
    "Scans specified lorebooks for information relevant to the current conversation, summarizes the key data, and injects it into the prompt — a lightweight RAG pipeline without vector databases.",
  phase: "pre_generation",
  enabledByDefault: false,
  category: "writer",
  modeAllowlist: ["roleplay", "visual_novel"],
  defaultTools: ["search_lorebook"],
  defaultSettings: {
    useChatActiveLorebooks: true,
  },
} satisfies BuiltInAgentManifest;
