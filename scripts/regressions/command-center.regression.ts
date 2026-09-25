import assert from "node:assert/strict";
import {
  COMMAND_CENTER_MAX_RESULTS,
  isOmnibarShortcut,
  normalizeCommandCenterSessionState,
  normalizeCommandRankingState,
  presentCommandCenterResults,
  rankCommandResults,
  readCommandRankingState,
  recordCommandUse,
  setCommandPinned,
  writeCommandRankingState,
  type CommandDefinition,
  type CommandCenterPresentableResult,
} from "../../packages/client/src/lib/command-center.js";
import { createSystemCommandDefinitions } from "../../packages/client/src/lib/command-center-system-commands.js";
import {
  createOmnibarContext,
  filterOmnibarFuzzyFallback,
  getOmnibarActiveChatContextResultIds,
  getUnambiguousOmnibarResult,
  isDirectActiveChatAction,
  parseOmnibarIntent,
  searchOmnibar,
} from "../../packages/client/src/lib/omnibar-search.js";
import { getOmnibarSettingsDestinations } from "../../packages/client/src/lib/omnibar-settings.js";
import {
  SETTINGS_SEARCHABLE_CONTROLS,
  SETTINGS_SECTIONS,
  SETTINGS_TABS,
} from "../../packages/client/src/lib/settings-registry.js";
import {
  getCharacterDisplayIdentity,
  parseCharacterDisplayData,
} from "../../packages/client/src/lib/character-display.js";
import { reconcileActiveResultId, resolveOmnibarRowState } from "../../packages/client/src/lib/omnibar-row-state.js";
import {
  buildProfessorMariCommandCenterContext,
  inferProfessorMariCommandCenterCapability,
} from "../../packages/client/src/lib/professor-mari-command-center-context.js";

const commands: CommandDefinition[] = [
  { id: "home", title: "Home", kind: "navigation", icon: "home", target: { kind: "home" } },
  { id: "settings", title: "Settings", kind: "settings", icon: "settings" },
];
const malformed = normalizeCommandRankingState({
  pinnedIds: ["home", "home", 42, ""],
  recent: [
    { id: "home", lastUsedAt: 10, useCount: 2 },
    { id: "home", lastUsedAt: 20, useCount: 3 },
    { id: "settings", lastUsedAt: "bad", useCount: 1 },
  ],
});
assert.deepEqual(malformed, { pinnedIds: ["home"], recent: [{ id: "home", lastUsedAt: 20, useCount: 3 }] });

const used = recordCommandUse(malformed, "settings", 30);
const ranked = rankCommandResults(
  commands.map((command) => ({ command, score: command.id === "settings" ? 300 : 1 })),
  setCommandPinned(used, "home", true),
  30,
);
assert.equal(ranked[0]?.result.command.id, "home");
assert.equal(ranked[0]?.pinned, true);

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => void values.set(key, value),
};
assert.equal(writeCommandRankingState(used, storage), true);
assert.deepEqual(readCommandRankingState(storage), used);
assert.deepEqual(readCommandRankingState({ getItem: () => "{", setItem: () => undefined }), {
  pinnedIds: [],
  recent: [],
});

const systemCommands = createSystemCommandDefinitions({});
assert.deepEqual(systemCommands.find((command) => command.id === "spotify-settings")?.availability, {
  status: "requires-capability",
  capability: "spotify",
  setupTarget: true,
});
assert.equal(systemCommands.find((command) => command.id === "spotify-settings")?.action.kind, "navigate");
assert.equal(systemCommands.find((command) => command.id === "tts-settings")?.action.kind, "navigate");

const presentationResults: CommandCenterPresentableResult[] = [
  { id: "chat:pinned", category: "chat", metadata: [{ label: "rank", value: "first" }] },
  { id: "chat:recent", category: "chat" },
  { id: "control:theme", category: "settings", control: {} },
  { id: "characters", category: "navigation" },
  { id: "chat:pinned", category: "chat" },
];
const emptyPresentation = presentCommandCenterResults(presentationResults, {
  query: "",
  rankingState: {
    pinnedIds: ["chat:pinned"],
    recent: [
      { id: "chat:pinned", lastUsedAt: 20, useCount: 2 },
      { id: "chat:recent", lastUsedAt: 10, useCount: 1 },
    ],
  },
});
assert.deepEqual(
  emptyPresentation.groups.map((group) => [group.id, group.results.map((result) => result.id)]),
  [
    ["pinned", ["chat:pinned"]],
    ["recent", ["chat:recent"]],
    ["quick-controls", ["control:theme"]],
    ["create-navigation", ["characters"]],
  ],
);
const contextualPresentation = presentCommandCenterResults(
  [
    { id: "context:chat:one", category: "chat", group: "current-work" },
    { id: "ask-professor-mari", category: "professor", group: "continue" },
    { id: "create-character", category: "navigation" },
  ],
  { query: "" },
);
assert.deepEqual(
  contextualPresentation.groups.map((group) => [group.id, group.results.map((result) => result.id)]),
  [
    ["current-work", ["context:chat:one"]],
    ["continue", ["ask-professor-mari"]],
    ["create-navigation", ["create-character"]],
  ],
);
assert.deepEqual(
  contextualPresentation.results.map((result) => result.id),
  ["context:chat:one", "ask-professor-mari", "create-character"],
);
assert.equal(contextualPresentation.results[0]?.id, contextualPresentation.groups[0]?.results[0]?.id);
assert.equal(
  reconcileActiveResultId(
    null,
    contextualPresentation.results.map((result) => result.id),
  ),
  "context:chat:one",
);
assert.deepEqual(
  presentCommandCenterResults(
    [
      { id: "chat:recent", category: "chat" },
      { id: "chat:current", category: "chat", group: "current-work" },
      { id: "control:theme", category: "settings", control: {} },
    ],
    {
      query: "",
      rankingState: { pinnedIds: [], recent: [{ id: "chat:recent", lastUsedAt: 1, useCount: 1 }] },
    },
  ).results.map((result) => result.id),
  ["chat:current", "chat:recent", "control:theme"],
);
assert.deepEqual(
  buildProfessorMariCommandCenterContext(
    "compare these presets",
    { id: "preset:one", title: "One", category: "preset" },
    [
      { id: "preset:two", title: "Two", category: "preset" },
      { id: "preset:three", title: "Three", category: "preset" },
    ],
  ),
  {
    source: "command-center",
    capability: "recommend",
    query: "compare these presets",
    commandCenterResultId: "preset:one",
    resource: { kind: "preset", id: "one", label: "One" },
    relatedResources: [
      { kind: "preset", id: "two", label: "Two" },
      { kind: "preset", id: "three", label: "Three" },
    ],
    action: "Selected Command Center result: One",
  },
);
assert.equal(emptyPresentation.results.length, 4);
assert.equal(emptyPresentation.results[0]?.metadata?.[0]?.value, "first");
assert.equal(emptyPresentation.categoryAvailability.all, 4);
assert.equal(emptyPresentation.categoryAvailability.chats, 2);

const searchPresentation = presentCommandCenterResults(
  [
    { id: "docs:guide", category: "docs" },
    { id: "persona:one", category: "persona" },
    { id: "chat:one", category: "chat" },
    { id: "ask-professor-mari", category: "professor" },
    { id: "character:one", category: "character" },
  ],
  { query: "one" },
);
assert.deepEqual(
  searchPresentation.groups.map((group) => group.id),
  ["chats", "characters", "personas", "docs", "professor-fallback"],
);

const resourceBeforeMessage = presentCommandCenterResults(
  [
    { id: "message:one:1", category: "chat", group: "messages" },
    { id: "chat:mira", category: "chat" },
    { id: "character:mira", category: "character" },
  ],
  { query: "mira" },
);
assert.deepEqual(
  resourceBeforeMessage.results.map((result) => result.id),
  ["chat:mira", "character:mira", "message:one:1"],
);

const fuzzyFallbackResults = searchOmnibar("mira", {
  commands: [],
  chats: [{ id: "mira", name: "Mira" }],
  resources: [{ id: "archive", kind: "character", name: "My interesting roleplay archive" }],
  connections: [],
});
assert.deepEqual(
  filterOmnibarFuzzyFallback(fuzzyFallbackResults).map((result) => result.id),
  ["chat:mira", "ask-professor-mari"],
);
const typoFallbackResults = searchOmnibar("mra", {
  commands: [],
  chats: [{ id: "mira", name: "Mira" }],
  resources: [],
  connections: [],
});
assert.equal(
  filterOmnibarFuzzyFallback(typoFallbackResults)[0]?.id,
  "chat:mira",
  "a fuzzy match remains when no literal result exists",
);

const summaryMatchResults = searchOmnibar("sarcastic vampire", {
  commands: [],
  chats: [],
  resources: [
    {
      id: "eliza",
      kind: "character",
      name: "Eliza",
      description: "A dry-witted immortal with a guarded heart.",
      searchText: ["A sarcastic vampire who owns a midnight bookshop.", "gothic", "SpicyMarinara"],
    },
    { id: "sarcastic-vampire", kind: "character", name: "Sarcastic Vampire" },
  ],
  connections: [],
});
assert.deepEqual(
  summaryMatchResults.slice(0, 2).map((result) => result.id),
  ["character:sarcastic-vampire", "character:eliza"],
  "character names outrank summary metadata while summaries remain searchable",
);
assert.equal(
  summaryMatchResults.find((result) => result.id === "character:eliza")?.description,
  "A dry-witted immortal with a guarded heart.",
  "summary-backed preview text survives search result construction",
);

const filteredPresentation = presentCommandCenterResults(searchPresentation.results, {
  query: "one",
  filter: "characters",
});
assert.equal(filteredPresentation.filter, "characters");
assert.deepEqual(
  filteredPresentation.results.map((result) => result.id),
  ["character:one"],
);
assert.equal(filteredPresentation.categoryAvailability.chats, 1);
assert.equal(filteredPresentation.categoryAvailability.characters, 1);

const cappedPresentation = presentCommandCenterResults(
  Array.from({ length: COMMAND_CENTER_MAX_RESULTS + 10 }, (_, index) => ({
    id: `chat:${index}`,
    category: "chat" as const,
  })),
  { query: "chat" },
);
assert.equal(cappedPresentation.results.length, COMMAND_CENTER_MAX_RESULTS);
assert.equal(cappedPresentation.categoryAvailability.chats, COMMAND_CENTER_MAX_RESULTS + 10);

const localizedConnectionPreview = {
  kind: "connection" as const,
  facts: [{ label: "Localized model", value: "example-model" }],
};
const connectionResults = searchOmnibar("primary", {
  commands: [],
  chats: [],
  resources: [],
  connections: [{ id: "primary", name: "Primary", preview: localizedConnectionPreview }],
  askProfessorTitle: "Ask",
});
assert.equal(
  connectionResults.find((result) => result.id === "connection:primary")?.preview,
  localizedConnectionPreview,
);
assert.deepEqual(
  presentCommandCenterResults(connectionResults, { query: "primary" }).groups.map((group) => group.id),
  ["connections", "professor-fallback"],
);

const categorizedCommands = searchOmnibar("command", {
  commands: [
    { id: "custom-settings-command", title: "Command settings", kind: "settings", icon: "settings" },
    { id: "settings-looking-navigation", title: "Command navigation", kind: "navigation", icon: "home" },
  ],
  chats: [],
  resources: [],
  connections: [],
});
assert.equal(categorizedCommands.find((result) => result.id === "custom-settings-command")?.category, "settings");
assert.equal(categorizedCommands.find((result) => result.id === "settings-looking-navigation")?.category, "navigation");

const naturalRequestResults = searchOmnibar("make Luna warmer", {
  commands: [],
  chats: [],
  resources: [
    { kind: "character", id: "luna", name: "Luna" },
    { kind: "character", id: "mara", name: "Mara" },
  ],
  connections: [],
  context: createOmnibarContext({
    surface: "editor",
    openResource: { kind: "character", id: "luna", resultId: "character:luna" },
  }),
});
assert.equal(naturalRequestResults[0]?.id, "character:luna");
assert.equal(naturalRequestResults[0]?.score, 234);

const contextRankedResults = searchOmnibar("Luna", {
  commands: [],
  chats: [],
  resources: [
    { kind: "character", id: "other-luna", name: "Luna" },
    { kind: "character", id: "current-luna", name: "Luna" },
  ],
  connections: [],
  context: createOmnibarContext({
    surface: "chat",
    activeChat: { id: "chat-one", resultIds: ["character:current-luna"] },
  }),
});
assert.equal(contextRankedResults[0]?.id, "character:current-luna");
assert.equal(contextRankedResults[0]?.score, 359);
const exactBeforePinnedPrefix = searchOmnibar("Luna", {
  commands: [],
  chats: [],
  resources: [
    { kind: "character", id: "exact", name: "Luna" },
    { kind: "character", id: "pinned-prefix", name: "Luna Park" },
  ],
  connections: [],
  context: createOmnibarContext({ surface: "home", pinnedResultIds: ["character:pinned-prefix"] }),
});
assert.deepEqual(
  exactBeforePinnedPrefix.slice(0, 2).map((result) => result.id),
  ["character:exact", "character:pinned-prefix"],
);
assert.deepEqual(parseOmnibarIntent("Go to the Moonlight preset"), {
  kind: "navigate",
  verb: "go to",
  targetQuery: "moonlight preset",
});
assert.deepEqual(parseOmnibarIntent("add Luna to this chat"), {
  kind: "action",
  verb: "add",
  targetQuery: "luna",
});
assert.equal(parseOmnibarIntent("new character")?.kind, "create");
assert.equal(parseOmnibarIntent("how do presets work")?.kind, "explain");
assert.equal(parseOmnibarIntent("recommend a preset")?.kind, "recommend");
assert.equal(parseOmnibarIntent("image generation failed")?.kind, "repair");
assert.equal(parseOmnibarIntent("add Luna to this chat")?.kind, "action");
assert.equal(parseOmnibarIntent("profile Luna"), null);

const directOpenResults = searchOmnibar("open Luna", {
  commands: [],
  chats: [],
  resources: [
    { kind: "character", id: "luna", name: "Luna" },
    { kind: "character", id: "lunar", name: "Lunar" },
  ],
  connections: [],
});
assert.equal(directOpenResults[0]?.id, "character:luna");
assert.ok(directOpenResults[0]!.score > directOpenResults.at(-1)!.score);
assert.equal(getUnambiguousOmnibarResult(directOpenResults)?.id, "character:luna");

const ambiguousResults = searchOmnibar("open Luna", {
  commands: [],
  chats: [],
  resources: [
    { kind: "character", id: "luna-one", name: "Luna" },
    { kind: "character", id: "luna-two", name: "Luna" },
  ],
  connections: [],
});
assert.equal(getUnambiguousOmnibarResult(ambiguousResults), null);
assert.equal(isDirectActiveChatAction("add Luna", directOpenResults[0]!, directOpenResults), true);
assert.equal(isDirectActiveChatAction("use Luna", directOpenResults[0]!, directOpenResults), false);
assert.equal(isDirectActiveChatAction("add Luna", ambiguousResults[0]!, ambiguousResults), false);
assert.equal(isDirectActiveChatAction("use Luna in this chat", ambiguousResults[0]!, ambiguousResults), false);
assert.equal(isDirectActiveChatAction("use Luna in this chat", directOpenResults[0]!, directOpenResults), true);

const repairResults = searchOmnibar("fix speech error", {
  commands: [
    {
      id: "tts-settings",
      title: "Text to speech",
      kind: "settings",
      availability: { status: "requires-capability", capability: "tts", setupTarget: true },
    },
    { id: "diagnostics", title: "Support diagnostics", kind: "settings" },
  ],
  chats: [],
  resources: [],
  connections: [],
  context: createOmnibarContext({
    surface: "settings",
    setupResultIds: ["tts-settings"],
    error: { resultIds: ["diagnostics"], message: "Connection failed" },
  }),
});
assert.equal(repairResults[0]?.id, "tts-settings");
assert.ok(repairResults.some((result) => result.id === "diagnostics"));

const boundedContext = createOmnibarContext({
  surface: "home",
  surfaceResultIds: Array.from({ length: 40 }, (_, index) => `result:${index}`),
  openResource: { kind: "character", id: "x".repeat(300), resultId: "character:" + "x".repeat(300) },
  error: { resultIds: [], message: "x".repeat(200) },
});
assert.equal(boundedContext.surfaceResultIds.length, 32);
assert.equal(boundedContext.openResource?.id.length, 256);
assert.equal(boundedContext.openResource?.resultId.length, 256);
assert.equal(boundedContext.error?.message?.length, 160);
assert.deepEqual(
  [
    ...getOmnibarActiveChatContextResultIds("chat-one", {
      id: "chat-one",
      characterIds: ["luna"],
      personaId: "hero",
      promptPresetId: "moonlight",
      connectionId: "primary",
      lorebookIds: ["world"],
      enableAgents: true,
      activeAgentIds: ["world-state"],
    }),
  ].sort(),
  [
    "agent:world-state",
    "character:luna",
    "chat:chat-one",
    "connection:primary",
    "lorebook:world",
    "persona:hero",
    "preset:moonlight",
  ],
);
assert.deepEqual([...getOmnibarActiveChatContextResultIds("chat-two", { id: "chat-one", characterIds: ["luna"] })], []);
assert.equal(
  getOmnibarActiveChatContextResultIds("chat-one", {
    id: "chat-one",
    enableAgents: false,
    activeAgentIds: ["world-state"],
  }).has("agent:world-state"),
  false,
);

assert.equal(
  getCharacterDisplayIdentity({ data: JSON.stringify({ name: "Card Name" }), comment: "Database label" }),
  "Card Name",
);
assert.equal(parseCharacterDisplayData({ data: "not-json" }).name, "Unknown");
assert.deepEqual(
  resolveOmnibarRowState({ resource: "character", id: "luna", activeChat: { characterIds: ["luna"] } }),
  { inActiveChat: true, globallyActive: false, canAddToChat: false, globalAction: null },
);
assert.deepEqual(
  resolveOmnibarRowState({ resource: "persona", id: "hero", activeChat: { personaId: "other" }, globallyActive: true }),
  { inActiveChat: false, globallyActive: true, canAddToChat: true, globalAction: null },
);
assert.deepEqual(resolveOmnibarRowState({ resource: "persona", id: "hero", activeChat: { personaId: "hero" } }), {
  inActiveChat: true,
  globallyActive: false,
  canAddToChat: false,
  globalAction: "activate-persona",
});
assert.deepEqual(
  resolveOmnibarRowState({ resource: "preset", id: "moonlight", activeChat: { promptPresetId: "moonlight" } }),
  { inActiveChat: true, globallyActive: false, canAddToChat: false, globalAction: "set-default-preset" },
);
assert.deepEqual(
  resolveOmnibarRowState({ resource: "connection", id: "primary", activeChat: { connectionId: "other" } }),
  { inActiveChat: false, globallyActive: false, canAddToChat: true, globalAction: null },
);

const settingsDestinations = getOmnibarSettingsDestinations();
const streamingSetting = settingsDestinations.find((setting) => setting.controlId === "streaming-speed");
assert.deepEqual(streamingSetting && { tab: streamingSetting.tab, controlId: streamingSetting.controlId }, {
  tab: "general",
  controlId: "streaming-speed",
});
assert.equal(settingsDestinations.find((setting) => setting.controlId === "font-family")?.sectionLabel, "Text & Scale");
// Tab rows open the tab and nothing else. They used to scroll to a hand-picked
// "representative" control; the 32 real section rows do that job properly now.
const appearanceTabRow = settingsDestinations.find((setting) => setting.id === "settings-section:appearance");
assert.ok(appearanceTabRow, "the appearance tab row exists");
// A tab row names neither a control nor a section: it just opens the tab.
assert.equal(appearanceTabRow.controlId, undefined);
assert.equal(appearanceTabRow.sectionId, undefined);
const textScaleRow = settingsDestinations.find((setting) => setting.id === "settings-section-detail:text-scale");
assert.ok(textScaleRow, "the text-scale section row exists");
assert.equal(textScaleRow.sectionId, "text-scale");
assert.equal(textScaleRow.controlId, undefined);
assert.equal(textScaleRow.tab, "appearance");
// Derived from the registry, so every settings control is reachable, not the 22
// that the old hand-written list happened to name. Comparing against the
// registry rather than a fixed number keeps this true as settings are added.
assert.equal(
  new Set(settingsDestinations.map((setting) => setting.id)).size,
  settingsDestinations.length,
  "destination ids are unique",
);
// Identity, not just counts: every registered tab, section and control has
// exactly one row, so a rename cannot be masked by a coincidental total.
assert.deepEqual(
  new Set(settingsDestinations.flatMap((setting) => (setting.controlId ? [setting.controlId] : []))),
  new Set(SETTINGS_SEARCHABLE_CONTROLS.map((control) => control.id)),
);
assert.deepEqual(
  new Set(settingsDestinations.flatMap((setting) => (setting.sectionId ? [setting.sectionId] : []))),
  new Set(SETTINGS_SECTIONS.map((section) => section.id)),
);
for (const tab of SETTINGS_TABS) {
  assert.ok(
    settingsDestinations.some((setting) => setting.id === `settings-section:${tab.id}`),
    `tab ${tab.id} has a row`,
  );
}
assert.equal(
  settingsDestinations.length,
  SETTINGS_TABS.length + SETTINGS_SECTIONS.length + SETTINGS_SEARCHABLE_CONTROLS.length,
);

assert.equal(inferProfessorMariCommandCenterCapability("make Luna's greeting shorter"), "edit");
assert.equal(inferProfessorMariCommandCenterCapability("make a new character"), "create");
assert.equal(inferProfessorMariCommandCenterCapability("which preset is best"), "recommend");
assert.equal(inferProfessorMariCommandCenterCapability("why did image generation fail"), "repair");
assert.deepEqual(
  buildProfessorMariCommandCenterContext("make Luna warmer", {
    id: "character:luna-id",
    title: "Luna",
    category: "character",
  }),
  {
    source: "command-center",
    capability: "edit",
    query: "make Luna warmer",
    commandCenterResultId: "character:luna-id",
    resource: { kind: "character", id: "luna-id", label: "Luna" },
    action: "Selected Command Center result: Luna",
  },
);
assert.deepEqual(
  buildProfessorMariCommandCenterContext("explain this", {
    id: "settings-control:theme-mode",
    title: "Color scheme",
    category: "settings",
  }).resource,
  { kind: "setting", id: "theme-mode", label: "Color scheme" },
);
assert.equal(buildProfessorMariCommandCenterContext("explain this", undefined)?.commandCenterResultId, undefined);
assert.deepEqual(
  buildProfessorMariCommandCenterContext("explain this", undefined, [], undefined, {
    activeChat: { id: "chat-one", label: "Moonlit room", mode: "roleplay" },
    settingsLocation: { tab: "appearance", controlId: "theme-mode" },
  }),
  {
    source: "command-center",
    capability: "explain",
    query: "explain this",
    resource: undefined,
    action: undefined,
    activeChat: { id: "chat-one", label: "Moonlit room", mode: "roleplay" },
    settingsLocation: { tab: "appearance", controlId: "theme-mode" },
  },
);

// The list and Mari are the only panes. A session persisted with a removed one
// falls back to the list rather than resurrecting a surface that no longer exists.
assert.equal(normalizeCommandCenterSessionState({ pane: "mari" }).pane, "mari");
assert.equal(normalizeCommandCenterSessionState({ pane: "browse" }).pane, "results");
assert.equal(normalizeCommandCenterSessionState({ pane: "quick" }).pane, "results");
assert.equal(normalizeCommandCenterSessionState({ pane: "detail" }).pane, "results");
// `returnStack`, `mariDestination` and `mariDetailId` were persisted and
// normalized but never read: Escape steps back one level and the Mari pane owns
// its own destination. Unknown fields are dropped rather than carried forward.
const mariSession = normalizeCommandCenterSessionState({
  pane: "mari",
  mariDestination: "memories",
  mariDetailId: "memory-one",
  returnStack: [{ pane: "results", resultId: "character:luna" }],
});
assert.equal(mariSession.pane, "mari");
assert.ok(!("returnStack" in mariSession));
assert.ok(!("mariDestination" in mariSession));
assert.ok(!("mariDetailId" in mariSession));

{
  const key = (overrides: Partial<Parameters<typeof isOmnibarShortcut>[0]>) => ({
    key: "k",
    code: "KeyK",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  });
  assert.equal(isOmnibarShortcut(key({ ctrlKey: true }), false), true);
  assert.equal(isOmnibarShortcut(key({ metaKey: true }), true), true);
  // Only the platform's own modifier: macOS keeps Ctrl+K for "delete to end of line".
  assert.equal(isOmnibarShortcut(key({ ctrlKey: true }), true), false);
  assert.equal(isOmnibarShortcut(key({ metaKey: true }), false), false);
  assert.equal(isOmnibarShortcut(key({ ctrlKey: true, shiftKey: true }), false), false);
  assert.equal(isOmnibarShortcut(key({ ctrlKey: true, repeat: true }), false), false);
  // Non-Latin layouts report the local letter; the physical K key still counts.
  assert.equal(isOmnibarShortcut(key({ ctrlKey: true, key: "л" }), false), true);
  // A Latin layout with a different letter on the K position does not.
  assert.equal(isOmnibarShortcut(key({ ctrlKey: true, key: "t" }), false), false);
}

console.info("Command Center regression checks passed.");
