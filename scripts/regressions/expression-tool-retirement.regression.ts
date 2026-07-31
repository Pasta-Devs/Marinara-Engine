import assert from "node:assert/strict";
import {
  DEFAULT_AGENT_TOOLS,
  mergeBuiltInAgentSettings,
  normalizeBuiltInAgentEnabledTools,
  replaceBuiltInAgentDefinitions,
} from "../../packages/shared/src/types/agent.js";
import type { BuiltInAgentManifest } from "../../packages/shared/src/features/agents/agent-manifest.types.js";

const legacyExpressionManifest = {
  id: "expression",
  name: "Expression Engine",
  description: "Selects sprite expressions.",
  phase: "post_processing",
  enabledByDefault: false,
  category: "tracker",
  defaultTools: ["set_expression"],
  defaultPromptTemplate: "Respond with expression JSON.",
} satisfies BuiltInAgentManifest;

assert.deepEqual(
  normalizeBuiltInAgentEnabledTools("expression", ["set_expression"]),
  [],
  "legacy Expression Engine settings must drop the retired tool so the agent remains batch-compatible",
);
assert.deepEqual(
  normalizeBuiltInAgentEnabledTools("expression", ["set_expression", "search_lorebook"]),
  ["search_lorebook"],
  "retiring the legacy Expression Engine tool must preserve independently enabled tools",
);
assert.deepEqual(
  normalizeBuiltInAgentEnabledTools("world-state", ["update_game_state"]),
  ["update_game_state"],
  "legacy-tool normalization must not alter other tracker agents",
);

replaceBuiltInAgentDefinitions([legacyExpressionManifest]);
assert.deepEqual(
  DEFAULT_AGENT_TOOLS.expression,
  [],
  "an older installed Expression Engine package must not restore the retired default tool",
);
assert.deepEqual(
  mergeBuiltInAgentSettings("expression", {
    enabledTools: ["set_expression"],
    resultType: "sprite_change",
  }),
  {
    maxTokens: 4096,
    author: "Pasta Devs",
    enabledTools: [],
    resultType: "sprite_change",
  },
  "saved Expression Engine settings must migrate to the JSON-only execution path",
);

console.info("Expression Engine tool-retirement regression passed.");
