import assert from "node:assert/strict";
import { replaceBuiltInAgentDefinitions } from "../../packages/shared/dist/index.js";
import { createDuplicateAgentInput } from "../../packages/client/src/lib/agent-transfer.js";
import type { AgentConfigRow } from "../../packages/client/src/hooks/use-agents.js";

replaceBuiltInAgentDefinitions([
  {
    id: "copy-fixture",
    name: "Package Agent",
    description: "Fixture",
    phase: "pre_generation",
    category: "misc",
    enabledByDefault: true,
    author: "Package Author",
    defaultPromptTemplate: "Package default prompt",
    defaultTools: ["fixture_tool"],
    defaultSettings: { contextSize: 4096, temperature: 0.8, resultType: "text", customSetting: "package value" },
    promptTemplates: [{ id: "alternative", name: "Alternative", promptTemplate: "Alternative prompt" }],
  },
  {
    id: "spotify",
    name: "Music DJ",
    description: "Fixture",
    phase: "post_processing",
    category: "misc",
    enabledByDefault: true,
    defaultPromptTemplate: "Spotify prompt",
    defaultSettings: {
      promptTemplates: [
        { id: "youtube", name: "YouTube", promptTemplate: "YouTube prompt" },
        { id: "custom", name: "Custom", promptTemplate: "Local music prompt" },
      ],
    },
  },
]);
const row: AgentConfigRow = {
  id: "copy-fixture",
  type: "copy-fixture",
  name: "Stored name",
  description: "User description",
  phase: "pre_generation",
  enabled: "false",
  connectionId: "connection",
  imagePath: "/api/agent-image",
  promptTemplate: "",
  settings: "{}",
  createdAt: "",
  updatedAt: "",
};
const defaults = createDuplicateAgentInput(row);
assert.equal(defaults.type, "copy-fixture-copy");
assert.equal(defaults.name, "Package Agent (Copy)");
assert.equal(defaults.promptTemplate, "Package default prompt");
assert.equal(defaults.settings.contextSize, 4096);
assert.equal(defaults.settings.customSetting, "package value");
assert.equal(defaults.settings.author, "Package Author");
assert.deepEqual(defaults.settings.enabledTools, ["fixture_tool"]);
assert.equal((defaults.settings.promptTemplates as unknown[]).length, 1);
assert.equal(defaults.connectionId, row.connectionId);
assert.equal(defaults.imagePath, row.imagePath);
assert.equal(defaults.enabled, true);

const overrides = createDuplicateAgentInput({
  ...row,
  promptTemplate: "User prompt",
  settings: JSON.stringify({
    temperature: 0,
    enabledTools: [],
    contextSize: 2000,
    spotifyAccessToken: "secret",
    sourceLorebookIds: ["private"],
  }),
});
assert.equal(overrides.promptTemplate, "User prompt");
assert.equal(overrides.settings.temperature, 0);
assert.equal(overrides.settings.contextSize, 2000);
assert.deepEqual(overrides.settings.enabledTools, []);
assert.equal("spotifyAccessToken" in overrides.settings, false);
assert.equal("sourceLorebookIds" in overrides.settings, false);
for (const [provider, prompt] of [
  ["youtube", "YouTube prompt"],
  ["custom", "Local music prompt"],
]) {
  assert.equal(
    createDuplicateAgentInput({ ...row, type: "spotify", settings: JSON.stringify({ musicProvider: provider }) })
      .promptTemplate,
    prompt,
  );
}
const custom = createDuplicateAgentInput({
  ...row,
  type: "my-custom",
  promptTemplate: "Custom prompt",
  settings: '{"customSetting":"mine"}',
});
assert.equal(custom.promptTemplate, "Custom prompt");
assert.equal(custom.settings.customSetting, "mine");
assert.equal("contextSize" in custom.settings, false);
console.info("Agent duplicate effective-default regressions passed.");
