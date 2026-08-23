import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DISCORD_SUBTEXT_RE, INLINE_MD_RE } from "../../packages/client/src/lib/inline-markdown-regex.js";
import { applyInlineMarkdownHTML } from "../../packages/client/src/lib/markdown.js";
import { mergeUndatedSyncedSettings } from "../../packages/client/src/hooks/use-settings-sync.js";
import {
  formatRuntimeBuild,
  getServerRuntimeBuild,
  isRuntimeBuildCurrent,
} from "../../packages/client/src/lib/runtime-build.js";
import {
  ANDROID_HOST_HEARTBEAT_INTERVAL_MS,
  createAndroidHostHeartbeat,
  isLoopbackHostname,
  shouldRunAndroidHostHeartbeat,
} from "../../packages/client/src/lib/keep-alive.js";
import { useAgentStore } from "../../packages/client/src/stores/agent.store.js";
import { agentResultMatchesVisibleSwipe } from "../../packages/client/src/lib/agent-result-ownership.js";
import { createAgentEventDispatcher } from "../../packages/server/src/services/generation/agent-event-dispatcher.js";
import { resolveMacrosForPreview } from "../../packages/server/src/services/prompt/macro-context.js";
import {
  isStockMarinaraUniversalPreset,
  MARINARA_UNIVERSAL_PRESET_SYSTEM_KEY,
} from "../../packages/shared/src/types/prompt.js";
import {
  mergeGameSetupConfigPreservingDynamicPrompt,
  resolveGameImageDynamicPromptEnabled,
} from "../../packages/shared/src/types/game.js";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

const dispatchedAgentEvents: Array<Record<string, unknown>> = [];
const immutableAgentOwnership = {
  chatId: "roleplay-chat",
  messageId: "assistant-message",
  swipeIndex: 1,
  generationId: "generation-one",
};
let ownershipResultAgentId: string | null = null;
createAgentEventDispatcher({
  resolvedAgents: [],
  sendEvent: (payload) => dispatchedAgentEvents.push(payload),
  getOwnership: (result) => {
    ownershipResultAgentId = result.agentId;
    return immutableAgentOwnership;
  },
}).sendAgentResultEvent({
  agentId: "quest",
  agentType: "quest",
  type: "quest_update",
  data: {},
  tokensUsed: 0,
  durationMs: 1,
  success: true,
  error: null,
});
assert.equal(ownershipResultAgentId, "quest", "agent event ownership may be resolved from the individual result");
assert.deepEqual(
  (dispatchedAgentEvents[0]?.data as Record<string, unknown> | undefined) ?? {},
  {
    agentType: "quest",
    agentName: "quest",
    resultType: "quest_update",
    data: {},
    success: true,
    error: null,
    durationMs: 1,
    ...immutableAgentOwnership,
  },
  "agent result events must carry the immutable message, swipe, and generation owner",
);
const ownershipMessages = [{ id: "assistant-message", activeSwipeIndex: 1 }] as never;
assert.equal(agentResultMatchesVisibleSwipe(ownershipMessages, immutableAgentOwnership), true);
assert.equal(
  agentResultMatchesVisibleSwipe(ownershipMessages, { ...immutableAgentOwnership, swipeIndex: 2 }),
  false,
  "an old agent result must not update UI stores after the user changes swipes",
);

useAgentStore.getState().reset();
useAgentStore.getState().setProcessingRun("older-swipe", true, "roleplay-chat");
useAgentStore.getState().setProcessingRun("newer-swipe", true, "roleplay-chat");
useAgentStore.getState().setProcessingRun("older-swipe", false, "roleplay-chat");
assert.equal(
  useAgentStore.getState().isProcessing,
  true,
  "finishing an older swipe pipeline must not clear a newer pipeline's processing state",
);
assert.deepEqual(useAgentStore.getState().processingChatIds, ["roleplay-chat"]);
useAgentStore.getState().setProcessingRun("newer-swipe", false, "roleplay-chat");
assert.equal(useAgentStore.getState().isProcessing, false);
useAgentStore.getState().reset();

assert.equal(
  resolveGameImageDynamicPromptEnabled({}),
  false,
  "dynamic Game Illustrator prompts remain off when setup does not choose them",
);
const retainedExistingImageSetup = mergeGameSetupConfigPreservingDynamicPrompt(
  {
    enableSpriteGeneration: true,
    gameImageDynamicPromptEnabled: true,
    enableSpotifyDj: true,
    activeLorebookIds: ["old-lorebook"],
    sceneConnectionId: "old-connection",
  },
  {
    enableSpriteGeneration: true,
    gameImageDynamicPromptEnabled: undefined,
    enableSpotifyDj: undefined,
    activeLorebookIds: undefined,
    sceneConnectionId: undefined,
  },
);
assert.equal(
  resolveGameImageDynamicPromptEnabled(retainedExistingImageSetup),
  true,
  "an omitted wizard field preserves the effective stored Illustrator prompt choice",
);
assert.equal(retainedExistingImageSetup.enableSpotifyDj, undefined, "an established omitted toggle still clears");
assert.equal(retainedExistingImageSetup.activeLorebookIds, undefined, "an established omitted selection still clears");
assert.equal(retainedExistingImageSetup.sceneConnectionId, undefined, "an established omitted connection still clears");
const disabledExistingImageSetup = mergeGameSetupConfigPreservingDynamicPrompt(retainedExistingImageSetup, {
  enableSpriteGeneration: false,
  gameImageDynamicPromptEnabled: false,
});
assert.equal(
  resolveGameImageDynamicPromptEnabled(disabledExistingImageSetup),
  false,
  "an explicit wizard toggle-off still disables the Illustrator prompt choice",
);
assert.equal(
  resolveGameImageDynamicPromptEnabled({ gameImageDynamicPromptEnabled: true }),
  false,
  "the dynamic-prompt choice cannot enable a disabled Illustrator",
);
assert.equal(
  resolveGameImageDynamicPromptEnabled({
    enableSpriteGeneration: true,
    gameImageDynamicPromptEnabled: true,
  }),
  true,
  "an enabled Illustrator carries the explicit dynamic-prompt choice into runtime metadata",
);

assert.equal(
  ANDROID_HOST_HEARTBEAT_INTERVAL_MS,
  10_000,
  "the Android host heartbeat stays slower than the removed 2-second extension polling",
);
assert.equal(
  shouldRunAndroidHostHeartbeat({ isAndroid: true, isHostDevice: true, pageVisible: true, requestPending: false }),
  true,
  "a visible Android client on the host device receives the lightweight heartbeat",
);
for (const hostname of [
  "localhost",
  "marinara.localhost",
  "127.0.0.1",
  "127.0.0.2",
  "127.255.255.255",
  "::1",
  "[::1]",
]) {
  assert.equal(isLoopbackHostname(hostname), true, `${hostname} is an explicit loopback host`);
}
for (const hostname of [
  "",
  "0.0.0.0",
  "127.0.0",
  "127.0.0.256",
  "127.0.0.1.2",
  "192.168.1.7",
  "100.64.0.7",
  "marinara.example",
]) {
  assert.equal(isLoopbackHostname(hostname), false, `${hostname || "an empty hostname"} is not a loopback client`);
}
for (const blocked of [
  { isAndroid: false, isHostDevice: true, pageVisible: true, requestPending: false },
  { isAndroid: true, isHostDevice: false, pageVisible: true, requestPending: false },
  { isAndroid: true, isHostDevice: true, pageVisible: false, requestPending: false },
  { isAndroid: true, isHostDevice: true, pageVisible: true, requestPending: true },
]) {
  assert.equal(
    shouldRunAndroidHostHeartbeat(blocked),
    false,
    "non-Android, remote, hidden, and in-flight heartbeat paths remain quiet",
  );
}

let heartbeatRequests = 0;
let releaseHeartbeatRequest: (() => void) | undefined;
let heartbeatVisible = true;
const runHeartbeat = createAndroidHostHeartbeat({
  isAndroid: true,
  isHostDevice: true,
  isPageVisible: () => heartbeatVisible,
  request: () => {
    heartbeatRequests += 1;
    return new Promise<void>((resolve) => {
      releaseHeartbeatRequest = resolve;
    });
  },
});
runHeartbeat();
runHeartbeat();
assert.equal(heartbeatRequests, 1, "an in-flight health request suppresses overlapping heartbeats");
releaseHeartbeatRequest?.();
await Promise.resolve();
await Promise.resolve();
heartbeatVisible = false;
runHeartbeat();
assert.equal(heartbeatRequests, 1, "a hidden page does not send a heartbeat");
heartbeatVisible = true;
runHeartbeat();
assert.equal(heartbeatRequests, 2, "a visible-page resume can send a heartbeat immediately");
releaseHeartbeatRequest?.();

const clientBuild = formatRuntimeBuild("2.4.2", "aaaaaaaaaaaa");
assert.equal(clientBuild, "2.4.2+aaaaaaaaaaaa");
assert.equal(
  isRuntimeBuildCurrent("2.4.2", clientBuild, { version: "2.4.2", build: "2.4.2+aaaaaaaaaaaa" }),
  true,
  "matching same-version builds do not refresh",
);
assert.equal(
  isRuntimeBuildCurrent("2.4.2", clientBuild, { version: "2.4.2", build: "2.4.2+bbbbbbbbbbbb" }),
  false,
  "a newer commit with the same release version refreshes the stale client",
);
assert.equal(
  isRuntimeBuildCurrent("2.4.2", clientBuild, { version: "2.4.2" }),
  true,
  "older servers without build metadata retain version-only compatibility",
);
assert.equal(
  getServerRuntimeBuild({ version: "2.4.2", build: " 2.4.2+bbbbbbbbbbbb " }),
  "2.4.2+bbbbbbbbbbbb",
  "the server build identity is normalized for the recovery key",
);

const outerMarkdownMatch = new RegExp(INLINE_MD_RE.source, INLINE_MD_RE.flags).exec("*This is **bold** in italic.*");
assert.equal(
  outerMarkdownMatch?.[11],
  "This is **bold** in italic.",
  "single-star delimiters keep the full italic span",
);
const innerMarkdownMatch = new RegExp(INLINE_MD_RE.source, INLINE_MD_RE.flags).exec(outerMarkdownMatch?.[11] ?? "");
assert.equal(innerMarkdownMatch?.[9], "bold", "double-star delimiters remain bold inside italic text");

const underlineMatch = new RegExp(INLINE_MD_RE.source, INLINE_MD_RE.flags).exec("__underlined__");
assert.equal(underlineMatch?.[10], "underlined", "double underscores retain the underline span");
assert.equal(DISCORD_SUBTEXT_RE.exec("-# quiet context")?.[1], "quiet context", "Discord-style subtext is recognized");
const bareSubtextMatch = DISCORD_SUBTEXT_RE.exec("-#");
assert.ok(bareSubtextMatch, "bare Discord-style subtext is recognized");
assert.equal(bareSubtextMatch[1], undefined, "bare Discord-style subtext has no content");
assert.equal(DISCORD_SUBTEXT_RE.exec("-# ")?.[1], "", "empty Discord-style subtext with spacing is recognized");
assert.equal(DISCORD_SUBTEXT_RE.test("- ordinary list item"), false, "ordinary list items remain ordinary lists");
assert.match(
  applyInlineMarkdownHTML("<span>HTML</span><br>-# quiet context"),
  /<small class="mari-md-subtext">quiet context<\/small>/u,
  "embedded-HTML chat content receives the same Discord-style subtext rendering",
);
assert.equal(applyInlineMarkdownHTML("-#"), '<small class="mari-md-subtext"></small>');
assert.equal(applyInlineMarkdownHTML("-# "), '<small class="mari-md-subtext"></small>');

const markdownSource = readFileSync(join(repositoryRoot, "packages/client/src/lib/markdown.tsx"), "utf8");
assert.match(
  markdownSource,
  /<u key=\{`\$\{keyPrefix\}u\$\{key\+\+\}`\} className="mari-md-underline">/u,
  "the React Markdown path renders double underscores as underline",
);
assert.match(
  markdownSource,
  /<small key=\{`\$\{keyBase\}sub\$\{key\+\+\}`\} className="mari-md-subtext">/u,
  "the React Markdown path renders Discord-style subtext as a semantic small block",
);

const gameNarrationFormatSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/game/game-narration-format.ts"),
  "utf8",
);
assert.match(gameNarrationFormatSource, /mari-md-underline/u, "Game chat narration retains underline markup");
assert.match(gameNarrationFormatSource, /mari-md-subtext/u, "Game chat narration retains Discord-style subtext markup");

const mergedSettings = mergeUndatedSyncedSettings({ accentColor: "local", homeGreetingEnabled: true } as never, {
  accentColor: "server",
}) as unknown as Record<string, unknown>;
assert.equal(mergedSettings.accentColor, "server", "server-present settings win over an undated browser cache");
assert.equal(mergedSettings.homeGreetingEnabled, true, "local settings fill only fields absent from the server");

assert.equal(
  isStockMarinaraUniversalPreset({ systemKey: MARINARA_UNIVERSAL_PRESET_SYSTEM_KEY }),
  true,
  "the bundled universal preset is recognized as stock",
);
assert.equal(
  isStockMarinaraUniversalPreset({
    name: "Marinara's Universal Preset",
    author: "Marinara",
    systemKey: "",
  }),
  false,
  "editable name and author fields cannot make a user preset protected stock",
);

const agentsPanelSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/panels/AgentsPanel.tsx"),
  "utf8",
);
const managedAgentFilter = /const visibleBuiltInAgents = useMemo[\s\S]*?\n  \/\/ Custom agents/u.exec(
  agentsPanelSource,
)?.[0];
assert.ok(managedAgentFilter, "the installed-agent management filter remains discoverable");
assert.match(
  managedAgentFilter,
  /availableBuiltInAgents\.filter\(\(agent\) => !deletedBuiltInTypes\.has\(agent\.id\)\)/u,
  "feature-only installed Agents remain visible in the management pane",
);

const characterEditorSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/characters/CharacterEditor.tsx"),
  "utf8",
);
const lorebookCallbacks = /const handleLorebookEmbedded[\s\S]*?\n  const updateExtension/u.exec(
  characterEditorSource,
)?.[0];
assert.ok(lorebookCallbacks, "the embedded-lorebook reconciliation callbacks remain discoverable");
assert.doesNotMatch(
  lorebookCallbacks,
  /if \(!dirtyRef\.current\) return;/u,
  "embedded-lorebook controls reconcile immediately even when the editor is clean",
);

const presetEditorSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/presets/PresetEditor.tsx"),
  "utf8",
);
assert.match(
  presetEditorSource,
  /useLayoutEffect\(\(\) => \{\s*currentPresetIdRef\.current = presetId;\s*\}, \[presetId\]\)/u,
  "quick preset copy ownership updates only after the selected preset commits",
);
assert.equal(
  presetEditorSource.match(/showMarkdownPreview/gu)?.length,
  3,
  "Conversation, Game, and section preset content expose Markdown previews",
);

const professorMariChatSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/chat/HomeProfessorMariChat.tsx"),
  "utf8",
);
assert.match(
  professorMariChatSource,
  /inputDrafts\.get\(PROFESSOR_MARI_DRAFT_KEY\)/u,
  "Home Professor Mari restores her composer from the persisted draft store",
);
assert.match(
  professorMariChatSource,
  /setInputDraft\(PROFESSOR_MARI_DRAFT_KEY,/u,
  "Home Professor Mari saves composer changes through the persisted draft store",
);

const continuationChips = [{ id: "continue", label: "Continue", prompt: "Continue with the current lorebook." }];
const guidedPlan = [
  {
    fieldKey: "setting",
    question: "Where should the story take place?",
    chips: [{ id: "setting-library", label: "Library", prompt: "A candlelit library" }],
  },
  {
    fieldKey: "tone",
    question: "What tone should it use?",
    chips: [{ id: "tone-mysterious", label: "Mysterious", prompt: "Mysterious" }],
  },
];
useAgentStore.getState().reset();
useAgentStore.getState().setMariChips("professor-chat", continuationChips);
useAgentStore.getState().setMariPlan("professor-chat", guidedPlan);
assert.equal(useAgentStore.getState().recordMariPlanAnswer("setting", "A candlelit library"), "advanced");
useAgentStore.getState().setActiveAgents(["professor_mari"]);
useAgentStore.getState().resetForChatChange();
assert.deepEqual(
  useAgentStore.getState().mariChips,
  continuationChips,
  "temporary chat/editor navigation retains Professor Mari continuation suggestions",
);
assert.equal(useAgentStore.getState().mariChipsChatId, "professor-chat");
assert.deepEqual(useAgentStore.getState().mariPlan, guidedPlan);
assert.equal(useAgentStore.getState().mariPlanChatId, "professor-chat");
assert.equal(useAgentStore.getState().mariPlanCursor, 1);
assert.deepEqual(useAgentStore.getState().mariPlanAnswers, { setting: "A candlelit library" });
assert.deepEqual(useAgentStore.getState().activeAgents, [], "other Agent runtime state still resets between chats");
useAgentStore.getState().reset();
assert.equal(useAgentStore.getState().mariPlan, null, "full Agent reset clears Professor Mari's guided plan");
assert.equal(useAgentStore.getState().mariPlanChatId, null);
assert.equal(useAgentStore.getState().mariPlanCursor, 0);
assert.deepEqual(useAgentStore.getState().mariPlanAnswers, {});

const chatStoreSource = readFileSync(join(repositoryRoot, "packages/client/src/stores/chat.store.ts"), "utf8");
assert.match(
  chatStoreSource,
  /useAgentStore\.getState\(\)\.resetForChatChange\(\)/u,
  "chat navigation uses the continuation-preserving Agent reset",
);

const presetsPanelSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/panels/PresetsPanel.tsx"),
  "utf8",
);
const unsupportedRegexPlacementGate =
  /const unsupportedPlacements = getUnsupportedStRegexPlacements\(entry\);[\s\S]*?const normalized =/u.exec(
    presetsPanelSource,
  )?.[0];
assert.ok(unsupportedRegexPlacementGate, "the preset regex placement import branch remains discoverable");
assert.doesNotMatch(
  unsupportedRegexPlacementGate,
  /continue;/u,
  "unsupported SillyTavern placements must not discard the entire preset regex entry",
);
const regexBeforeSuccessfulImport =
  /const unsupportedPlacements = getUnsupportedStRegexPlacements\(entry\);[\s\S]*?await importRegexScript\.mutateAsync\(normalized\);/u.exec(
    presetsPanelSource,
  )?.[0];
assert.ok(regexBeforeSuccessfulImport, "the preset regex pre-import path remains discoverable");
assert.doesNotMatch(
  regexBeforeSuccessfulImport,
  /warnings\.push/u,
  "unsupported placement warnings must not be emitted before the regex imports successfully",
);
const successfulRegexImportWarning =
  /await importRegexScript\.mutateAsync\(normalized\);[\s\S]*?warnings\.push\([\s\S]*?ignoredUnsupportedRegexPlacements"/u.exec(
    presetsPanelSource,
  )?.[0];
assert.ok(successfulRegexImportWarning, "the successful preset regex import warning remains discoverable");
assert.match(
  successfulRegexImportWarning,
  /await importRegexScript\.mutateAsync\(normalized\);[\s\S]*?warnings\.push/u,
  "ignored SillyTavern placements produce a warning only after the regex imports successfully",
);
assert.match(
  successfulRegexImportWarning,
  /localizeUi\("ui\.panels\.presetspanel\.ignoredUnsupportedRegexPlacements"/u,
  "unsupported placement warnings must use the localized message",
);

const characterRegexSectionSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/characters/CharacterRegexSection.tsx"),
  "utf8",
);
const scopedUnsupportedRegexPlacementGate =
  /const unsupportedPlacements = getUnsupportedStRegexPlacements\(entry\);[\s\S]*?const normalized =/u.exec(
    characterRegexSectionSource,
  )?.[0];
assert.ok(scopedUnsupportedRegexPlacementGate, "the character-scoped regex placement branch remains discoverable");
assert.doesNotMatch(
  scopedUnsupportedRegexPlacementGate,
  /continue;/u,
  "unsupported SillyTavern placements must not discard an entire character-scoped regex entry",
);
const scopedRegexBeforeSuccessfulImport =
  /const unsupportedPlacements = getUnsupportedStRegexPlacements\(entry\);[\s\S]*?await importRegex\.mutateAsync\(\{ \.\.\.normalized, targetCharacterIds: \[characterId\] \}\);/u.exec(
    characterRegexSectionSource,
  )?.[0];
assert.ok(scopedRegexBeforeSuccessfulImport, "the character-scoped regex pre-import path remains discoverable");
assert.doesNotMatch(
  scopedRegexBeforeSuccessfulImport,
  /warnings\.push/u,
  "character-scoped placement warnings must not be emitted before the regex imports successfully",
);
const scopedSupportedImportPath = scopedRegexBeforeSuccessfulImport.replace(
  /if \(!normalized\) \{[\s\S]*?continue;\s*\}/u,
  "",
);
assert.doesNotMatch(
  scopedSupportedImportPath,
  /continue;/u,
  "supported character-scoped regex entries must reach the import even when some placements are unsupported",
);
const successfulScopedRegexImportWarning =
  /await importRegex\.mutateAsync\(\{ \.\.\.normalized, targetCharacterIds: \[characterId\] \}\);[\s\S]*?warnings\.push\([\s\S]*?ignoredUnsupportedRegexPlacements"/u.exec(
    characterRegexSectionSource,
  )?.[0];
assert.ok(
  successfulScopedRegexImportWarning,
  "the successful character-scoped regex import warning remains discoverable",
);
assert.match(
  successfulScopedRegexImportWarning,
  /localizeUi\("ui\.panels\.presetspanel\.ignoredUnsupportedRegexPlacements"/u,
  "character-scoped imports use the localized unsupported-placement warning",
);

const gameSetupWizardSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/game/GameSetupWizard.tsx"),
  "utf8",
);
assert.match(
  gameSetupWizardSource,
  /const \[gameImageDynamicPromptEnabled, setGameImageDynamicPromptEnabled\] = useState\(false\)/u,
  "new games keep the existing dynamic-prompt default until the player chooses otherwise",
);
assert.match(
  gameSetupWizardSource,
  /aria-pressed=\{gameImageDynamicPromptEnabled\}/u,
  "the Game Illustrator exposes its dynamic-prompt choice as an accessible wizard toggle",
);
assert.match(
  gameSetupWizardSource,
  /gameImageDynamicPromptEnabled:\s*illustratorEnabled && gameImageDynamicPromptEnabled/u,
  "the wizard carries an explicit dynamic-prompt choice into game setup",
);

const gameSurfaceSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/game/GameSurface.tsx"),
  "utf8",
);
assert.match(
  gameSurfaceSource,
  /gameSetupConfig:\s*effectiveSetupConfig,[\s\S]*gameImageDynamicPromptEnabled:\s*resolveGameImageDynamicPromptEnabled\(effectiveSetupConfig\)/u,
  "continuing setup for an existing game resolves the Illustrator choice from the same effective config it persists",
);

const gameRoutesSource = readFileSync(join(repositoryRoot, "packages/server/src/routes/game.routes.ts"), "utf8");
assert.match(
  gameRoutesSource,
  /gameImageDynamicPromptEnabled: z\.boolean\(\)\.optional\(\)/u,
  "new-game setup accepts the dynamic Illustrator prompt choice",
);
assert.match(
  gameRoutesSource,
  /gameImageDynamicPromptEnabled:\s*resolveGameImageDynamicPromptEnabled\(setupConfig\)/u,
  "new-game creation stores the choice before initial Illustrator generation",
);

const canonicalEnglish = JSON.parse(
  readFileSync(join(repositoryRoot, "packages/client/src/localization/locales/en.json"), "utf8"),
) as Record<string, string>;
assert.equal(
  canonicalEnglish["ui.chat.edittextarea.saveCmdEnter"],
  "Save (Cmd/Ctrl+Enter)",
  "the message editor shortcut hint covers both macOS and Windows modifiers",
);

const liveMacroContext = {
  user: "Mari",
  char: "Dottore",
  characters: ["Dottore"],
  variables: {},
  localVariables: { existing: "kept" },
};
const previewMacroResult = resolveMacrosForPreview(
  "{{setvar::previewOnly::yes}}{{getvar::previewOnly}}",
  liveMacroContext,
);
assert.equal(previewMacroResult, "yes", "the production preview resolver evaluates against its isolated clone");
assert.deepEqual(
  liveMacroContext.localVariables,
  { existing: "kept" },
  "preview macro resolution cannot mutate the live chat-local variables",
);

console.info("Assigned issue-sweep regressions passed.");
