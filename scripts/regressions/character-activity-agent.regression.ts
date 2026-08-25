import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  getCustomAgentResultCapability,
  normalizeCustomAgentCapabilities,
} from "../../packages/shared/src/types/agent.js";
import { CUSTOM_AGENT_RESULT_EXAMPLES } from "../../packages/client/src/lib/custom-agent-result-examples.js";
import {
  resolveActiveCharacterIds,
  resolveCharacterActivityUpdate,
  shouldRunCharacterActivityAgents,
} from "../../packages/server/src/routes/generate/generate-route-utils.js";

const chatCharacterIds = ["char-a", "char-b", "char-c"];

assert.deepEqual(
  resolveActiveCharacterIds(chatCharacterIds, { inactiveCharacterIds: ["char-b"] }, { mode: "roleplay" }),
  ["char-a", "char-c"],
  "Disabled Roleplay characters must not be eligible for sequential replies",
);
assert.deepEqual(
  resolveActiveCharacterIds(
    chatCharacterIds,
    { inactiveCharacterIds: ["char-b", "char-c"] },
    { mode: "roleplay", allowEmpty: true },
  ),
  ["char-a"],
  "A group chat must retain its sole enabled character",
);

assert.deepEqual(
  resolveCharacterActivityUpdate({ activeCharacterIds: ["char-c", "char-a", "char-a"] }, chatCharacterIds),
  {
    activeCharacterIds: ["char-a", "char-c"],
    inactiveCharacterIds: ["char-b"],
  },
);
assert.equal(resolveCharacterActivityUpdate({ activeCharacterIds: [] }, chatCharacterIds), null);
assert.equal(resolveCharacterActivityUpdate({ activeCharacterIds: ["char-a", "unknown"] }, chatCharacterIds), null);
assert.equal(resolveCharacterActivityUpdate({ activeCharacterIds: ["char-a", 2] }, chatCharacterIds), null);

assert.equal(
  shouldRunCharacterActivityAgents({ mode: "conversation", impersonate: false }),
  true,
  "Conversation replies should allow pre-generation character routing",
);
assert.equal(
  shouldRunCharacterActivityAgents({ mode: "roleplay", impersonate: false }),
  true,
  "Roleplay replies should allow pre-generation character routing",
);
assert.equal(
  shouldRunCharacterActivityAgents({ mode: "game", impersonate: false }),
  false,
  "Game mode must retain its existing character behavior",
);
assert.equal(
  shouldRunCharacterActivityAgents({ mode: "roleplay", impersonate: false, regenerateMessageId: "message-1" }),
  false,
  "Swipes should retain the active set chosen for the original reply",
);
assert.equal(
  shouldRunCharacterActivityAgents({ mode: "conversation", impersonate: true }),
  false,
  "Impersonation must not change the chat's active character set",
);
assert.equal(
  shouldRunCharacterActivityAgents({ mode: "roleplay", impersonate: false, continueMessageId: "message-1" }),
  false,
  "Continuations should retain the active set chosen for the original reply",
);

assert.equal(getCustomAgentResultCapability("character_activity_update"), "manage_chat_characters");
assert.equal(
  normalizeCustomAgentCapabilities({ customCapabilities: { manage_chat_characters: true } }).manage_chat_characters,
  true,
);
assert.match(CUSTOM_AGENT_RESULT_EXAMPLES.character_activity_update.value, /activeCharacterIds/u);

const generateRouteSource = readFileSync(
  fileURLToPath(new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url)),
  "utf8",
);
assert.ok(
  generateRouteSource.indexOf("eligibleCharacterActivityConfigs.length > 0") <
    generateRouteSource.indexOf("while (true)"),
  "Character routing must finish before the main prompt-assembly loop starts",
);
assert.match(
  generateRouteSource,
  /const isGroupChat = chatMode === "roleplay" \? allCharacterIds\.length > 1 : characterIds\.length > 1;/u,
  "Temporarily disabled characters must not collapse a group chat into single-character behavior",
);
assert.doesNotMatch(
  generateRouteSource,
  /const isGroupChat = allCharacterIds\.length > 1;/u,
  "Game generation must not enter an empty individual responder loop when every character is disabled",
);

console.log("Character activity agent regression checks passed.");
