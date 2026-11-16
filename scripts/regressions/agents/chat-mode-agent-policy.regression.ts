// Which agents each chat mode offers: downloadable pipeline agents only in Roleplay (also when a chat has no mode),
// Game mode's opt-in Spotify agent, and a mode allowlist that overrides both.
import assert from "node:assert/strict";
import { isAgentManifestAvailableInChatMode } from "../../../packages/shared/src/constants/chat-mode-agent-policy.js";

const downloadableAgent = { id: "downloadable-agent", execution: "pipeline" as const };
assert.equal(isAgentManifestAvailableInChatMode("conversation", downloadableAgent), false);
assert.equal(isAgentManifestAvailableInChatMode("roleplay", downloadableAgent), true);
assert.equal(isAgentManifestAvailableInChatMode("game", downloadableAgent), false);
assert.equal(
  isAgentManifestAvailableInChatMode("game", { id: "spotify", execution: "pipeline" }),
  true,
  "Game mode must retain its opt-in Spotify agent",
);
assert.equal(
  isAgentManifestAvailableInChatMode("game", {
    id: "mode-limited-feature",
    execution: "feature",
    modeAllowlist: ["roleplay"],
  }),
  false,
  "An explicit mode allowlist must still take precedence over feature-agent availability",
);
assert.equal(
  isAgentManifestAvailableInChatMode(null, downloadableAgent),
  true,
  "Missing legacy mode metadata must retain the Roleplay agent policy",
);
