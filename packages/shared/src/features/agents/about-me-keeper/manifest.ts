import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

export const aboutMeKeeperAgentManifest = {
  id: "about-me-keeper",
  name: "About Me Keeper",
  description:
    "Conversation mode: lets characters keep their own \"about me\" up to date — updating their public profile, or a private, chat-specific one, as the conversation reveals durable new self-facts.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "misc",
  resultType: "about_me_update",
  modeAllowlist: ["conversation"],
  defaultTools: [],
  runInterval: 8,
  defaultSettings: {
    resultType: "about_me_update",
    runInterval: 8,
  },
} satisfies BuiltInAgentManifest;
