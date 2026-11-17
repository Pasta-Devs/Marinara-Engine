// The agent editor: a custom lorebook writer saves Read Behind, the folder picker goes through the api client, and
// custom Image Prompt agents show the shared Illustrator image settings, and Feature agent editors use the shared
// editor shell. Reads component source until a test can drive these.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
