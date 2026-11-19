// The agent editor: a custom lorebook writer saves Read Behind, the folder picker goes through the api client, and
// custom Image Prompt agents show the shared Illustrator image settings, and Feature agent editors use the shared
// editor shell, each result type's response example, and Lorebook Update for create-only agents. Reads component
// source until a test can drive these.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CUSTOM_AGENT_RESULT_EXAMPLES,
  CUSTOM_AGENT_RESULT_TYPE_IDS,
} from "../../../packages/client/src/lib/custom-agent-result-examples.js";

const agentEditorSource = readFileSync(
  new URL("../../../packages/client/src/components/agents/AgentEditor.tsx", import.meta.url),
  "utf8",
);
assert.match(
  agentEditorSource,
  /lorebookReadBehindMessages:\s*localLorebookReadBehindMessages/u,
  "Custom lorebook writer settings must persist Read Behind",
);
assert.match(agentEditorSource, /api\.post<[^>]+>\(["']\/game-assets\/pick-local-music-folder["']\)/u);
assert.match(
  agentEditorSource,
  /isCustomImagePromptAgent[\s\S]{0,180}supportsImagePromptSettings/u,
  "Custom Image Prompt agents must expose the shared Illustrator image settings",
);

const featureAgentDetailHostSource = readFileSync(
  new URL("../../../packages/client/src/components/agents/FeatureAgentDetailHost.tsx", import.meta.url),
  "utf8",
);
assert.match(featureAgentDetailHostSource, /mari-editor-shell mari-editor-legacy-bridge/u);
assert.match(featureAgentDetailHostSource, /<AgentDetailHeader\b/u);
assert.doesNotMatch(featureAgentDetailHostSource, /\bPuzzle\b/u);
assert.doesNotMatch(featureAgentDetailHostSource, /featureagentdetailhost\.feature"/u);

// #5225: every custom-agent result type has a response example, and the editor's prompt preview and placeholder follow the chosen type. Lorebook Update is offered to agents that may only create lorebooks.
{
  for (const resultType of CUSTOM_AGENT_RESULT_TYPE_IDS) {
    const example = CUSTOM_AGENT_RESULT_EXAMPLES[resultType];
    assert.ok(example.value.trim(), `${resultType} must expose a non-empty custom-agent response example`);
    if (example.format === "json") {
      const parsed = JSON.parse(example.value);
      assert.ok(parsed && typeof parsed === "object" && !Array.isArray(parsed));
    }
  }
  const lorebookResultExample = JSON.parse(CUSTOM_AGENT_RESULT_EXAMPLES.lorebook_update.value);
  assert.equal(lorebookResultExample.updates[0]?.order, 200);
  const customResultInitializer =
    /const customResultExample =[^;]{0,400}CUSTOM_AGENT_RESULT_EXAMPLES\[localResultType\]/u;
  assert.doesNotMatch(
    "const customResultExample = null; const unrelated = CUSTOM_AGENT_RESULT_EXAMPLES[localResultType];",
    customResultInitializer,
    "A later unrelated lookup must not satisfy the initializer check",
  );
  assert.match(
    agentEditorSource,
    customResultInitializer,
    "The prompt preview must select the response example for the active result type",
  );
  assert.match(
    agentEditorSource,
    /isCustomAgent \|\| isNewCustomAgent[\s\S]{0,160}customPromptPlaceholder/u,
    "The custom-agent prompt placeholder must follow the selected result type's response example",
  );
  assert.match(
    agentEditorSource,
    /requiredAnyCapability:\s*\["edit_lorebooks",\s*"create_lorebooks"\]/u,
    "Lorebook Update must be configurable by create-only custom lorebook agents",
  );
}

// #4237-#4240: Add as Prompt Section saves and exports for every agent, Narrative Director included.
{
  assert.doesNotMatch(
    agentEditorSource,
    /!isDirectorAgent && localInjectAsSection/u,
    "Narrative Director must be allowed to save and export Add as Prompt Section",
  );
  assert.ok(
    (agentEditorSource.match(/\.\.\.\(localInjectAsSection \? \{ injectAsSection: true \} : \{\}\)/gu)?.length ?? 0) >=
      2,
    "Agent save and export paths must preserve Add as Prompt Section",
  );
}
