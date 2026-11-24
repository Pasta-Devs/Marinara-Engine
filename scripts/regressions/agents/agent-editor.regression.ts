// The agent editor: a custom lorebook writer saves Read Behind, the folder picker goes through the api client, and
// custom Image Prompt agents show the shared Illustrator image settings, and Feature agent editors use the shared
// editor shell, each result type's response example, and Lorebook Update for create-only agents. Reads component
// source until a test can drive these.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_TRACKER_PORTRAIT_REWRITE_PROMPT,
  isCustomTrackerPortraitRewritePrompt,
  serializeTrackerPortraitRewriteSettings,
  shouldClearTrackerPortraitRewriteDraftAfterSave,
  shouldShowTrackerPortraitRewriteEditor,
} from "../../../packages/shared/dist/index.js";
import {
  CUSTOM_AGENT_RESULT_EXAMPLES,
  CUSTOM_AGENT_RESULT_TYPE_IDS,
} from "../../../packages/client/src/lib/custom-agent-result-examples.js";
import { rebaseUntouchedKeys } from "../../../packages/client/src/lib/mari-editor-fields.js";

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

// #9748: Character Tracker portrait rewrite switch sits outside the autoGenerateAvatars gate,
// keeps stored custom prompts visible for editing/resetting, omits unmodified defaults, and clears cleanly through rebaseUntouchedKeys.
{
  const fieldGroupMatch = agentEditorSource.match(
    /\{\/\* ── NPC Avatar Generation \(Character Tracker only\) ── \*\/\}[\s\S]*?<\/FieldGroup>/u,
  );
  assert.ok(fieldGroupMatch, "Character Tracker NPC Avatar FieldGroup must exist");
  const fieldGroup = fieldGroupMatch[0];
  assert.match(
    fieldGroup,
    /\{localAutoGenerateAvatars && \(\s*<EditorSwitchRow[\s\S]*?localUseCardReferenceInPortraits[\s\S]*?\)\}\s*<div className="grid gap-2">\s*<EditorSwitchRow[\s\S]*?localRewritePortraitPrompts/u,
    "rewritePortraitPrompts switch must render outside the localAutoGenerateAvatars conditional block",
  );
  assert.ok(
    (agentEditorSource.match(/\.\.\.serializeTrackerPortraitRewriteSettings\(/gu)?.length ?? 0) >= 2,
    "Agent save and export paths must serialize portrait rewrite settings consistently",
  );

  // An unmodified copy of the default is not pinned, while modified text persists.
  assert.equal(isCustomTrackerPortraitRewritePrompt(DEFAULT_TRACKER_PORTRAIT_REWRITE_PROMPT), false);
  assert.deepEqual(
    serializeTrackerPortraitRewriteSettings({
      enabled: true,
      prompt: `  ${DEFAULT_TRACKER_PORTRAIT_REWRITE_PROMPT}  `,
    }),
    { rewritePortraitPrompts: true },
  );
  assert.deepEqual(serializeTrackerPortraitRewriteSettings({ enabled: true, prompt: "  Use watercolor tags.  " }), {
    rewritePortraitPrompts: true,
    portraitRewritePrompt: "Use watercolor tags.",
  });

  // Turning rewritePortraitPrompts off clears it via rebaseUntouchedKeys while preserving untouched server updates.
  const loadedSettings = {
    autoGenerateAvatars: false,
    rewritePortraitPrompts: true,
    portraitRewritePrompt: "Use watercolor tags.",
  };
  const updatedServerSettings = { ...loadedSettings, imageConnectionId: "img-conn-new" };
  const toggledOffSent = {
    ...serializeTrackerPortraitRewriteSettings({ enabled: false, prompt: "Use watercolor tags." }),
  };
  const rebasedOff = rebaseUntouchedKeys(toggledOffSent, loadedSettings, loadedSettings, updatedServerSettings);
  assert.equal("rewritePortraitPrompts" in rebasedOff, false, "disabling rewrite removes rewritePortraitPrompts");
  assert.equal(rebasedOff.portraitRewritePrompt, "Use watercolor tags.");
  assert.equal(rebasedOff.imageConnectionId, "img-conn-new", "untouched concurrent settings survive rebase");

  // Stored custom prompt stays visible while the switch and auto-generate avatars are both off.
  assert.equal(
    shouldShowTrackerPortraitRewriteEditor({ enabled: false, editing: false, prompt: "Use watercolor tags." }),
    true,
  );

  // Post-save cleanup clears unmodified defaults only when agent identity and prompt revision are unchanged.
  assert.equal(
    shouldClearTrackerPortraitRewriteDraftAfterSave({
      savedPrompt: DEFAULT_TRACKER_PORTRAIT_REWRITE_PROMPT,
      startedAgentId: "character-tracker",
      currentAgentId: "character-tracker",
      startedRevision: 2,
      currentRevision: 2,
    }),
    true,
  );
  assert.equal(
    shouldClearTrackerPortraitRewriteDraftAfterSave({
      savedPrompt: "",
      startedAgentId: "character-tracker",
      currentAgentId: "character-tracker",
      startedRevision: 1,
      currentRevision: 1,
    }),
    true,
  );
  assert.equal(
    shouldClearTrackerPortraitRewriteDraftAfterSave({
      savedPrompt: DEFAULT_TRACKER_PORTRAIT_REWRITE_PROMPT,
      startedAgentId: "character-tracker",
      currentAgentId: "character-tracker",
      startedRevision: 2,
      currentRevision: 3,
    }),
    false,
    "concurrent edit while Save is in flight must not be cleared",
  );
  assert.equal(
    shouldClearTrackerPortraitRewriteDraftAfterSave({
      savedPrompt: DEFAULT_TRACKER_PORTRAIT_REWRITE_PROMPT,
      startedAgentId: "character-tracker",
      currentAgentId: "illustrator",
      startedRevision: 2,
      currentRevision: 2,
    }),
    false,
    "switching agents while Save is in flight must not clear the new view",
  );
  assert.equal(
    shouldClearTrackerPortraitRewriteDraftAfterSave({
      savedPrompt: "Custom prompt override",
      startedAgentId: "character-tracker",
      currentAgentId: "character-tracker",
      startedRevision: 2,
      currentRevision: 2,
    }),
    false,
  );

  assert.doesNotMatch(
    fieldGroup,
    /\b(?:amber|emerald)-\d+/u,
    "Character Tracker portrait rewrite badges must use theme tokens rather than palette colors",
  );
  assert.match(
    agentEditorSource,
    /shouldClearTrackerPortraitRewriteDraftAfterSave\(/u,
    "AgentEditor handleSave must guard post-save portrait rewrite cleanup",
  );
  assert.match(
    agentEditorSource,
    /const saveSnapshotCurrent =\s*activeAgentDetailIdRef\.current === saveAgentDetailId &&\s*portraitRewritePromptRevRef\.current === savePortraitRewritePromptRev &&\s*editRevisionRef\.current === saveEditRevision;[\s\S]*?if \(saveSnapshotCurrent\) \{\s*setDirty\(false\);/u,
    "AgentEditor handleSave must clear dirty only when agent identity and edit revisions still match",
  );
}
