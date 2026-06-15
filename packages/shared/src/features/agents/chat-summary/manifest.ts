import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const chatSummaryAgentManifest = {
  id: "chat-summary",
  name: "Automated Chat Summary",
  description:
    "Automatically generates rolling Roleplay chat summaries from the Chat Summary popover settings.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  libraryHidden: true,
  modeAllowlist: ["roleplay"],
  defaultTools: [],
  runInterval: 5,
} satisfies BuiltInAgentManifest;
