import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  COMMAND_CENTER_MAX_RESULTS,
  isAskMariShortcut,
  isOmnibarShortcut,
  normalizeCommandCenterSessionState,
  normalizeCommandRankingState,
  presentCommandCenterResults,
  rankCommandResults,
  readCommandRankingState,
  recordCommandUse,
  writeCommandRankingState,
  type CommandDefinition,
  type CommandCenterPresentableResult,
} from "../../packages/client/src/lib/command-center.js";
import { createSystemCommandDefinitions } from "../../packages/client/src/lib/command-center-system-commands.js";
import {
  formatShortcutKey,
  isShortcutsHelpKey,
  isTypingTarget,
} from "../../packages/client/src/lib/keyboard-shortcuts.js";
import {
  createOmnibarContext,
  resolveOmnibarScreen,
  filterOmnibarFuzzyFallback,
  getOmnibarActiveChatContextResultIds,
  getUnambiguousOmnibarResult,
  isDirectActiveChatAction,
  findOmnibarMatchRange,
  parseOmnibarIntent,
  resultOpensDirectlyOnTap,
  searchOmnibar,
  splitOmnibarAddTarget,
  type OmnibarResult,
} from "../../packages/client/src/lib/omnibar-search.js";
import { resolveChatResourceDropAction } from "../../packages/client/src/lib/chat-resource-drop-capabilities.js";
import { extractDocsSearchQuery } from "../../packages/client/src/lib/docs-command-search.js";
import { resolveRunAnchorMs, resolveRunSeconds } from "../../packages/client/src/lib/mari-work-card-timing.js";
import { resolveMariEdgeGlow, type MariRunState } from "../../packages/client/src/lib/mari-presence-seen.js";
import { getOmnibarSettingsDestinations } from "../../packages/client/src/lib/omnibar-settings.js";
import { isMariInstruction, parseOmnibarScope } from "../../packages/client/src/lib/omnibar-scope.js";
import {
  buildOmnibarAddSuggestions,
  buildOmnibarContinueResult,
  buildOmnibarGlobalMessageResults,
  buildOmnibarLorebookEntryResults,
  buildOmnibarMariChatResults,
  buildOmnibarRemovalSuggestions,
  resolveOmnibarUnderstoodLine,
  buildOmnibarContextResults,
  buildOmnibarControlResults,
  buildOmnibarIntentShortcuts,
  buildOmnibarNewChatCommands,
  buildOmnibarSearchResults,
  buildOmnibarVerbSuggestions,
  findMentionedResults,
  idleOmnibarContextResults,
  matchesAtWordStart,
  buildOmnibarSlashResults,
} from "../../packages/client/src/lib/omnibar-results.js";
import {
  FRECENCY_BOOST_CAP,
  FRECENCY_EXCLUDED_RESULT_IDS,
  frecencyBoost,
  frecencyScore,
  normalizeOmnibarFrecencyEntries,
  topFrecentResultIds,
  type OmnibarFrecencyEntry,
} from "../../packages/client/src/lib/omnibar-frecency.js";
import {
  OMNIBAR_TRY_MAX_OPENS,
  buildOmnibarTryResults,
  countOmnibarTryOpen,
  isOmnibarCommandPick,
  lastEditedRecordId,
  markOmnibarTryUsed,
  pickOmnibarNowResult,
  readOmnibarTryState,
  visibleOmnibarTryKinds,
} from "../../packages/client/src/lib/omnibar-empty-state.js";
import { OMNIBAR_SETTINGS_TOGGLE_BINDINGS } from "../../packages/client/src/lib/omnibar-settings-toggle-bindings.js";
import {
  OMNIBAR_SETTINGS_SECTION_ID,
  SETTINGS_SEARCHABLE_CONTROLS,
  SETTINGS_SECTIONS,
  SETTINGS_TABS,
  isOmnibarSettingsTarget,
} from "../../packages/client/src/lib/settings-registry.js";
import {
  getCharacterDisplayIdentity,
  parseCharacterDisplayData,
} from "../../packages/client/src/lib/character-display.js";
import { omnibarRecordRowId, resolveOmnibarRowVisual } from "../../packages/client/src/lib/omnibar-row-visual.js";
import { reconcileActiveResultId, resolveOmnibarRowState } from "../../packages/client/src/lib/omnibar-row-state.js";
import {
  buildProfessorMariCommandCenterContext,
  inferProfessorMariCommandCenterCapability,
} from "../../packages/client/src/lib/professor-mari-command-center-context.js";
import {
  OMNIBAR_ASIDE_DELAY_CHOICES_MS,
  OMNIBAR_ASIDE_DELAY_MS,
  OmnibarAsideAnswerCache,
  marisConnectionFor,
  stripStrayMarkdown,
} from "../../packages/client/src/lib/omnibar-aside-text.js";
import {
  assignReviewsToTurns,
  professorMariContextFacets,
  professorMariFacetSendsContentLater,
  shouldAppendMariArrival,
  summarizeDeleteReview,
  withoutProfessorMariContextFacet,
  reviewRecordKeys,
  withoutReviewedResults,
  resolveProfessorMariPresentationState,
  countBlockingReviews,
} from "../../packages/client/src/lib/professor-mari-presentation.js";
import {
  formatDocumentationGroundingExcerpts,
  type DocumentationSearchResult,
} from "../../packages/server/src/services/professor-mari/documentation-tools.js";
import {
  computeFieldChanges,
  fieldChangeStyle,
  replyFixChat,
  reviewRowFact,
  trackListChange,
  trackProseChange,
} from "../../packages/client/src/lib/mari-edit-diff.js";
import { replyCheckupRow } from "../../packages/client/src/lib/reply-checkup.js";
import {
  getMariAppearancePack,
  isMariPackUnlocked,
  playHoursFromMs,
  resolveMariAppearancePack,
} from "../../packages/client/src/lib/mari-work-animations.js";
import {
  groupRunPhases,
  pastTenseStepTitle,
  splitMariAnswerWhy,
  type WorkTimelineItem,
} from "../../packages/client/src/lib/mari-work-timeline.js";
import {
  collectMariReferencedResources,
  findMariSettingReferences,
  isWorkspaceTraceItem,
  firstSentence,
  mariReferenceFact,
  mariReferenceTarget,
  selectMariReplyLinks,
} from "../../packages/client/src/lib/mari-referenced-resources.js";
import {
  createPullRecognizer,
  holdPullGaze,
  PULL_GAZE_FRAMES,
  PULL_GAZE_HOLD_MS,
  pullCircleTarget,
  pullGazeFrame,
  pullMorphFrame,
  pullOnScreenX,
  pullOpenThreshold,
  pullSheetBase,
  pullSheetPath,
  pullTarget,
} from "../../packages/client/src/lib/pull-to-open.js";
import { QUICK_ANSWER_SETTINGS_LABELS } from "../../packages/server/src/services/professor-mari/quick-answer-settings-labels.js";
import { formatCapabilityAgentGroundingLines } from "../../packages/server/src/services/professor-mari/official-agent-knowledge.js";
import {
  buildOmnibarChatRows,
  buildOmnibarLorebookRows,
  chatRowContextLine,
} from "../../packages/client/src/lib/omnibar-entity-rows.js";
import {
  chatResultType,
  COMMAND_ICONS,
  recordFaceResultType,
  RESULT_TYPE_ICONS,
  resourceResultType,
} from "../../packages/client/src/lib/command-icons.js";
import {
  buildMariArrival,
  chooseMariThread,
  isMariReplyFailure,
  mariCardIntent,
  mariFallbackFocus,
  mariFixRowId,
  mariPullAbout,
  mariThreadContextFor,
  readMariThread,
  type MariArrivalData,
} from "../../packages/client/src/lib/mari-arrival.js";
import {
  matchOmnibarCapabilityAgentPackageIds,
  OMNIBAR_CAPABILITY_AGENT_KEYWORDS,
  type Chat,
} from "../../packages/shared/src/index.js";
import { OFFICIAL_AGENT_KNOWLEDGE_ENTRIES } from "../../packages/server/src/services/professor-mari/official-agent-knowledge.js";
import {
  summarizeMergedAgentRow,
  guardRawMessageTableWrite,
  resolveTransformTables,
} from "../../packages/server/src/services/mari-db/mari-db.service.js";
import {
  appDataActionLooksReadOnly,
  emitRoundText,
} from "../../packages/server/src/services/professor-mari/workspace-agent.service.js";
import {
  followTranscriptGrowth,
  transcriptScrollAction,
} from "../../packages/client/src/lib/professor-mari-transcript-scroll.js";
import { sanitizeMariSuggestionChips } from "../../packages/shared/src/types/professor-mari-workspace.js";
import type { BuiltInAgentManifest } from "@marinara-engine/shared";

const commands: CommandDefinition[] = [
  { id: "home", title: "Home", kind: "navigation", icon: "home", target: { kind: "home" } },
  { id: "settings", title: "Settings", kind: "settings", icon: "settings" },
];
const malformed = normalizeCommandRankingState({
  recent: [
    { id: "home", lastUsedAt: 10, useCount: 2 },
    { id: "home", lastUsedAt: 20, useCount: 3 },
    { id: "settings", lastUsedAt: "bad", useCount: 1 },
  ],
});
assert.deepEqual(malformed, { recent: [{ id: "home", lastUsedAt: 20, useCount: 3 }] });

// R9: a state object saved before the pin feature was removed still carries a
// `pinnedIds` array. Normalizing it must not error, and must strip the field
// rather than carry it forward, so a stale "Pinned" group can never reappear.
const legacyPinnedState = normalizeCommandRankingState({
  pinnedIds: ["home"],
  recent: [{ id: "home", lastUsedAt: 10, useCount: 1 }],
});
assert.deepEqual(legacyPinnedState, { recent: [{ id: "home", lastUsedAt: 10, useCount: 1 }] });
assert.ok(!("pinnedIds" in legacyPinnedState), "a stale pinnedIds field is dropped, not carried forward");

const used = recordCommandUse(malformed, "settings", 30);
const ranked = rankCommandResults(
  commands.map((command) => ({ command, score: command.id === "settings" ? 300 : 1 })),
  used,
  30,
);
assert.equal(ranked[0]?.result.command.id, "settings");

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => void values.set(key, value),
};
assert.equal(writeCommandRankingState(used, storage), true);
assert.deepEqual(readCommandRankingState(storage), used);
assert.deepEqual(readCommandRankingState({ getItem: () => "{", setItem: () => undefined }), {
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
  { id: "chat:dup", category: "chat", metadata: [{ label: "rank", value: "first" }] },
  { id: "chat:recent", category: "chat" },
  { id: "control:theme", category: "settings", control: {} },
  { id: "characters", category: "navigation" },
  { id: "chat:dup", category: "chat" },
];
// R9: a rankingState saved before pinning was removed still carries `pinnedIds` (cast past
// the type, which no longer has that field). It must be fully ignored: no "pinned" group,
// and the row it once named ranks exactly like any other recently used row.
const emptyPresentation = presentCommandCenterResults(presentationResults, {
  query: "",
  rankingState: {
    pinnedIds: ["chat:dup"],
    recent: [
      { id: "chat:dup", lastUsedAt: 20, useCount: 2 },
      { id: "chat:recent", lastUsedAt: 10, useCount: 1 },
    ],
  } as never,
});
assert.deepEqual(
  emptyPresentation.groups.map((group) => [group.id, group.results.map((result) => result.id)]),
  [
    ["recent", ["chat:dup", "chat:recent"]],
    ["quick-controls", ["control:theme"]],
    ["create-navigation", ["characters"]],
  ],
);
// Slice 78: the empty list reads Now, Try, Continue, then this screen's work, then Recent. A row
// marked `now` leads whatever group it came from, so the Mari row keeps its "continue" group
// (her resume-not-send rules key on it) and still renders first.
const contextualPresentation = presentCommandCenterResults(
  [
    { id: "chat:recent", category: "chat", group: "recent" },
    { id: "context:chat:one", category: "chat", group: "current-work" },
    { id: "chat:last", category: "chat", group: "continue" },
    { id: "try:search", category: "navigation", group: "try" },
    { id: "ask-professor-mari", category: "professor", group: "continue", now: "review" },
    { id: "create-character", category: "navigation" },
  ],
  { query: "" },
);
assert.deepEqual(
  contextualPresentation.groups.map((group) => [group.id, group.results.map((result) => result.id)]),
  [
    ["now", ["ask-professor-mari"]],
    ["continue", ["chat:last"]],
    ["current-work", ["context:chat:one"]],
    ["try", ["try:search"]],
    ["recent", ["chat:recent"]],
    ["create-navigation", ["create-character"]],
  ],
);
assert.equal(contextualPresentation.results[0]?.id, contextualPresentation.groups[0]?.results[0]?.id);

// UX-07: a question puts Ask Mari above the docs group; a bare search keeps Ask Mari last.
const questionPresentation = presentCommandCenterResults(
  [
    { id: "docs:lorebooks", category: "docs", group: "docs" },
    { id: "ask-professor-mari", category: "professor", group: "professor-fallback" },
  ],
  { query: "why is my lorebook empty" },
);
assert.deepEqual(
  questionPresentation.groups.map((group) => group.id),
  ["professor-fallback", "docs"],
  "a question presents Ask Mari above docs",
);
const bareSearchPresentation = presentCommandCenterResults(
  [
    { id: "docs:lorebooks", category: "docs", group: "docs" },
    { id: "ask-professor-mari", category: "professor", group: "professor-fallback" },
  ],
  { query: "lorebook" },
);
assert.deepEqual(
  bareSearchPresentation.groups.map((group) => group.id),
  ["docs", "professor-fallback"],
  "a bare search keeps the docs group above Ask Mari",
);
assert.equal(
  reconcileActiveResultId(
    null,
    contextualPresentation.results.map((result) => result.id),
  ),
  "ask-professor-mari",
  "Enter on an empty list runs the Now row",
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
      rankingState: { recent: [{ id: "chat:recent", lastUsedAt: 1, useCount: 1 }] },
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

// Top hit: the best strong match leads, even when its category renders later.
const themeSearch = presentCommandCenterResults(
  [
    { id: "settings-control:theme", category: "settings", score: 305, title: "Theme" },
    { id: "chat:theme-park", category: "chat", score: 210, title: "Theme park" },
    { id: "docs:themes", category: "docs", score: 320, title: "Themes" },
  ],
  { query: "theme" },
);
assert.deepEqual(
  themeSearch.groups.map((group) => group.id),
  ["top-hit", "chats", "docs"],
  "an exact setting beats the chat that only starts with the word",
);
assert.equal(themeSearch.results[0]?.id, "settings-control:theme");
// Docs arrive late, so they never become the Top hit, however well they score.
assert.equal(
  themeSearch.groups[0]?.results.some((result) => result.id === "docs:themes"),
  false,
);
// A weak match is not a Top hit, and a best match already on top is left alone.
assert.deepEqual(
  presentCommandCenterResults(
    [
      { id: "settings-control:theme", category: "settings", score: 120, title: "Theme" },
      { id: "chat:theme-park", category: "chat", score: 110, title: "Theme park" },
    ],
    { query: "them" },
  ).groups.map((group) => group.id),
  ["chats", "settings"],
);
assert.deepEqual(
  presentCommandCenterResults(
    [
      { id: "chat:eliza", category: "chat", score: 310, title: "Eliza" },
      { id: "character:eliza", category: "character", score: 305, title: "Eliza" },
    ],
    { query: "eliza" },
  ).groups.map((group) => group.id),
  ["chats", "characters"],
);

// A title that starts with the text beats a stronger row where only a later word does.
assert.equal(
  presentCommandCenterResults(
    [
      {
        id: "settings-control:persona-pickers",
        category: "settings",
        score: 310,
        title: "Show Characters in Persona Pickers",
      },
      { id: "chat:persona-notes", category: "chat", score: 150, title: "Notes about personas" },
      { id: "navigation:persona-library", category: "navigation", score: 207, title: "Persona library" },
    ],
    { query: "persona" },
  ).groups[0]?.results[0]?.id,
  "navigation:persona-library",
);

// An alias match ranks, but it is never the Top hit: the typed text must lead the visible title.
assert.deepEqual(
  presentCommandCenterResults(
    [
      { id: "settings-control:accent", category: "settings", score: 305, title: "Accent Color" },
      { id: "chat:theme-park", category: "chat", score: 210, title: "Theme park" },
    ],
    { query: "theme" },
  ).groups.map((group) => group.id),
  ["chats", "settings"],
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

// Slice 68: every typed word starting a word of the title is a literal hit, so a late literal
// hit elsewhere (docs) cannot drop "Reduced ambient effects" for "reduced effects" as fuzzy noise.
const wordStartResults = searchOmnibar("reduced effects", {
  commands: [],
  chats: [
    { id: "reduced", name: "Reduced ambient effects" },
    { id: "effects", name: "Effects reduced" },
    { id: "noise", name: "Red user ideas effect" },
  ],
  resources: [],
  connections: [],
});
assert.deepEqual(
  filterOmnibarFuzzyFallback(wordStartResults)
    .map((result) => result.id)
    .filter((id) => id !== "ask-professor-mari")
    .sort(),
  ["chat:effects", "chat:reduced"],
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

// N2 (slice 43): omnibar commands to start a new chat of each mode. These are
// doors into the same `useStartNewChatMode` flow Home's Conversation/Roleplay/
// Game buttons use, not a new modal, so they are built directly as rows
// (action.kind: "start-chat") rather than through the create-* modal pipeline.
const stubT = (key: string, fallback: string) => fallback;
const unrelatedCreateCommands = searchOmnibar("new chat", {
  commands: systemCommands,
  chats: [],
  resources: [],
  connections: [],
}).filter((result) => /^create-/.test(result.id));
const newChatRows = buildOmnibarNewChatCommands({ query: "new chat", t: stubT });
assert.deepEqual(
  newChatRows.map((row) => row.id),
  ["create-conversation"],
  "a phrase match returns only the matching row (A1/A4), not the other two modes",
);
const conversationRow = newChatRows.find((row) => row.id === "create-conversation")!;
assert.equal(conversationRow.title, "New conversation");
assert.equal(conversationRow.action?.kind, "start-chat");
assert.deepEqual(conversationRow.action, { kind: "start-chat", mode: "conversation" });
assert.ok(unrelatedCreateCommands.every((command) => command.score < conversationRow.score));

const newRpRow = buildOmnibarNewChatCommands({ query: "new rp", t: stubT }).find(
  (row) => row.id === "create-roleplay",
)!;
const newRoleplayRow = buildOmnibarNewChatCommands({ query: "new roleplay", t: stubT }).find(
  (row) => row.id === "create-roleplay",
)!;
const bareRoleplayRow = buildOmnibarNewChatCommands({ query: "roleplay", t: stubT }).find(
  (row) => row.id === "create-roleplay",
)!;
assert.ok(newRpRow.score > bareRoleplayRow.score, "a deliberate phrase outranks the bare word (A4)");
assert.ok(newRoleplayRow.score > bareRoleplayRow.score);
assert.ok(bareRoleplayRow.score <= 290, "a bare-word exact match never outranks an exact entity name (A4)");

const newGameRow = buildOmnibarNewChatCommands({ query: "new game", t: stubT }).find(
  (row) => row.id === "create-game",
)!;
const bareGameRow = buildOmnibarNewChatCommands({ query: "game", t: stubT }).find((row) => row.id === "create-game")!;
assert.ok(newGameRow.score > bareGameRow.score);
assert.ok(bareGameRow.score <= 290);

// A1 (high): these rows must never show for every query — only on a real match — or they drown
// out the typo-fallback for every search (filterOmnibarFuzzyFallback treats any score>=100,
// matchKind-less row as a literal hit and drops every fuzzy row behind it).
assert.deepEqual(
  buildOmnibarNewChatCommands({ query: "zzzz", t: stubT }),
  [],
  "no rows on a query that matches nothing",
);
const lunaFuzzySearch = searchOmnibar("lna", {
  commands: [],
  chats: [],
  resources: [{ id: "luna", kind: "character", name: "Luna" }],
  connections: [],
});
const lunaFuzzyResult = lunaFuzzySearch.find((result) => result.id === "character:luna")!;
assert.equal(lunaFuzzyResult?.matchKind, "fuzzy", "sanity: the typo still resolves to a fuzzy character match");
assert.ok(
  filterOmnibarFuzzyFallback([...buildOmnibarNewChatCommands({ query: "lna", t: stubT }), lunaFuzzyResult]).some(
    (result) => result.id === "character:luna",
  ),
  "the new-chat rows no longer suppress a typo's fuzzy fallback (A1)",
);

// A4 (medium): a substring/bare-word alias must never outrank a real entity with that name —
// "harp" must not fuzzy-match "rp" as a substring, and "game" must not beat a character named "Game".
const harperResults = filterOmnibarFuzzyFallback([
  ...buildOmnibarNewChatCommands({ query: "harp", t: stubT }),
  ...searchOmnibar("harp", {
    commands: [],
    chats: [],
    resources: [{ id: "harper", kind: "character", name: "Harper" }],
    connections: [],
  }),
]).sort((a, b) => b.score - a.score);
assert.equal(harperResults[0]?.id, "character:harper", '"harp" ranks the character Harper above New roleplay (A4)');
const gameCharacterResults = filterOmnibarFuzzyFallback([
  ...buildOmnibarNewChatCommands({ query: "game", t: stubT }),
  ...searchOmnibar("game", {
    commands: [],
    chats: [],
    resources: [{ id: "game-char", kind: "character", name: "Game" }],
    connections: [],
  }),
]).sort((a, b) => b.score - a.score);
assert.equal(
  gameCharacterResults[0]?.id,
  "character:game-char",
  '"game" ranks a character literally named "Game" above New game (A4)',
);

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
const exactBeforeRecentPrefix = searchOmnibar("Luna", {
  commands: [],
  chats: [],
  resources: [
    { kind: "character", id: "exact", name: "Luna" },
    { kind: "character", id: "recent-prefix", name: "Luna Park" },
  ],
  connections: [],
  context: createOmnibarContext({ surface: "home", recentResultIds: ["character:recent-prefix"] }),
});
assert.deepEqual(
  exactBeforeRecentPrefix.slice(0, 2).map((result) => result.id),
  ["character:exact", "character:recent-prefix"],
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

// Slice 75: "add X in/to/into Y" names a chat to attach to, not more of the entity name.
const slice75Chats = [
  { id: "chat-tavern", name: "Tavern Night" },
  { id: "chat-study", name: "Study Group" },
  { id: "chat-crawl", name: "Tavern Crawl" },
];
assert.deepEqual(splitOmnibarAddTarget("eliza to tavern night", slice75Chats), {
  entityQuery: "eliza",
  chatId: "chat-tavern",
  chatName: "Tavern Night",
});
// No chat is actually named "Tokyo": the name stays whole rather than a false split.
assert.deepEqual(splitOmnibarAddTarget("lost in tokyo", slice75Chats), { entityQuery: "lost in tokyo" });
// Two chats share "Tavern": list both instead of guessing one.
const slice75Ambiguous = splitOmnibarAddTarget("eliza to tavern", slice75Chats);
assert.equal(slice75Ambiguous.entityQuery, "eliza");
assert.equal(slice75Ambiguous.ambiguousChats?.length, 2);
// A dangling "to " with nothing named yet offers every recent chat as the next step.
assert.deepEqual(
  splitOmnibarAddTarget("eliza to ", slice75Chats).ambiguousChats?.map((chat) => chat.id),
  ["chat-tavern", "chat-study", "chat-crawl"],
);
// The split feeds the entity search too, so "Eliza" (not "Eliza to Tavern Night") is what matches.
const slice75SearchResults = searchOmnibar("add eliza to tavern night", {
  commands: [],
  chats: slice75Chats,
  resources: [{ kind: "character", id: "eliza", name: "Eliza" }],
  connections: [],
});
assert.ok(
  slice75SearchResults.some((result) => result.id === "character:eliza" && result.titleMatch?.[0] === 0),
  "the entity row is found and keeps a highlight range for its own matched title",
);
assert.deepEqual(findOmnibarMatchRange("liz", "Eliza"), [1, 4]);
assert.equal(findOmnibarMatchRange("zzz", "Eliza"), null);
const slice75NamedChatAdd = buildOmnibarAddSuggestions({
  activeChat: null,
  attachedResultIds: new Set(),
  chats: slice75Chats,
  deferredQuery: "add eliza to tavern night",
  omnibarSuggestionsEnabled: true,
  searchResults: [{ id: "character:eliza", title: "Eliza", category: "character", score: 200, icon: "character" }],
  t: (_key: string, fallback?: string) => fallback ?? "",
});
assert.equal(slice75NamedChatAdd[0]?.action?.kind, "add-to-chat");
assert.equal(
  (slice75NamedChatAdd[0]?.action as { chatId?: string } | undefined)?.chatId,
  "chat-tavern",
  "a named chat attaches there even with no chat open",
);

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
assert.deepEqual(
  buildProfessorMariCommandCenterContext("why did the replies get worse?", {
    id: "chat-tool:reply-checkup:chat-one",
    title: "Fix: Check the last reply",
    category: "chat",
  }).resource,
  { kind: "chat", id: "chat-one", label: "Fix: Check the last reply" },
  "slice 65: a chat tool row hands Mari its chat id, not `<tool>:<chatId>`",
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
// C1: escalating a live omnibar aside answer into Mari carries it along.
assert.deepEqual(
  buildProfessorMariCommandCenterContext("what does temperature do", undefined, [], undefined, {
    asideAnswer: { query: "what does temperature do", answer: "It controls randomness.", tier: "local" },
  }).asideAnswer,
  { query: "what does temperature do", answer: "It controls randomness.", tier: "local" },
);
// C1b: the docs pages the quick answer used travel with it, so Mari's card can name them.
assert.deepEqual(
  buildProfessorMariCommandCenterContext("what does temperature do", undefined, [], undefined, {
    asideAnswer: {
      query: "what does temperature do",
      answer: "It controls randomness.",
      tier: "local",
      sources: [{ path: "docs/a.md", heading: "Temperature" }],
    },
  }).asideAnswer?.sources,
  [{ path: "docs/a.md", heading: "Temperature" }],
);
// C2: the chip lists every facet a context carries, not just the first one found.
assert.deepEqual(
  professorMariContextFacets({
    source: "command-center",
    capability: "explain",
    resource: { kind: "character", id: "luna-id", label: "Luna" },
    activeChat: { id: "chat-one", label: "Moonlit room", mode: "roleplay" },
    field: "Greeting",
    settingsLocation: { tab: "appearance" },
    error: { message: "Generation failed" },
    asideAnswer: { query: "q", answer: "Answer text", tier: "remote" },
  }),
  [
    // Q6: each item facet names its kind, so its chip shows that kind's icon (a chat its mode).
    { kind: "resource", text: "Luna", type: "character" },
    { kind: "chat", text: "Moonlit room", type: "roleplay" },
    { kind: "field", text: "Greeting" },
    { kind: "settings", text: "Appearance", type: "setting" },
    { kind: "error", text: "Generation failed" },
    { kind: "asideAnswer", text: "Answer text" },
  ],
);
assert.deepEqual(professorMariContextFacets(null), []);
// UX-24: the open chat picked as the resource is not shown twice.
assert.deepEqual(
  professorMariContextFacets({
    source: "command-center",
    resource: { kind: "chat", id: "chat-one", label: "Current chat: Moonlit room" },
    activeChat: { id: "chat-one", label: "Moonlit room", mode: "roleplay" },
  }).map((facet) => facet.text),
  ["Moonlit room"],
);
// Q6: one type per kind; an unknown chat mode falls back to the plain chat, entries map to their own type.
assert.equal(chatResultType("game"), "game");
assert.equal(chatResultType(undefined), "chat");
assert.equal(chatResultType("toString"), "chat");
assert.equal(resourceResultType("lorebookEntry"), "lorebook-entry");
assert.equal(resourceResultType("setting"), "setting");
assert.equal(resourceResultType("mystery"), "command");
assert.equal(RESULT_TYPE_ICONS.persona, COMMAND_ICONS.persona);
// Q6: Mari's edit-review faces share the same type map, so an edited lorebook entry or agent gets
// its own type icon instead of a letter monogram.
assert.equal(recordFaceResultType("characters"), "character");
assert.equal(recordFaceResultType("lorebook_entries"), "lorebook-entry");
assert.equal(recordFaceResultType("agent_configs"), "agent");
assert.equal(recordFaceResultType("mystery_table"), "command");
// Q6: a chat row says where it left off (speaker + one line), else names its cast.
assert.equal(
  chatRowContextLine({
    message: { role: "assistant", content: "Through the\n  nebula gate." },
    speakerName: "Nerissa",
    youLabel: "You",
    castNames: ["Elara"],
  }),
  "Nerissa: Through the nebula gate.",
);
assert.equal(
  chatRowContextLine({ message: { role: "user", content: "Hi" }, speakerName: null, youLabel: "You", castNames: [] }),
  "You: Hi",
);
assert.equal(
  chatRowContextLine({
    message: { role: "narrator", content: "Rain." },
    speakerName: "X",
    youLabel: "You",
    castNames: [],
  }),
  "Rain.",
);
assert.equal(
  chatRowContextLine({ message: null, speakerName: null, youLabel: "You", castNames: ["Elara", "Nerissa"] }),
  "Elara, Nerissa",
);
assert.equal(
  chatRowContextLine({ message: { role: "user", content: "  " }, speakerName: null, youLabel: "You", castNames: [] }),
  undefined,
);
// M7: the composer's X on one facet keeps the others; removing the last one clears the context.
{
  const handoff = {
    source: "command-center" as const,
    capability: "repair" as const,
    activeChat: { id: "chat-one", label: "Moonlit room" },
    field: "Greeting",
    fieldId: "greeting",
    error: { message: "Generation failed" },
  };
  const withoutChat = withoutProfessorMariContextFacet(handoff, "chat");
  assert.equal(withoutChat?.activeChat, undefined);
  assert.deepEqual(withoutChat?.error, handoff.error);
  assert.equal(withoutChat?.fieldId, "greeting");
  assert.equal(handoff.activeChat.id, "chat-one", "removing a facet must not mutate the original context");
  const withoutField = withoutProfessorMariContextFacet(handoff, "field");
  assert.equal(withoutField?.field, undefined);
  assert.equal(withoutField?.fieldId, undefined);
  assert.deepEqual(
    professorMariContextFacets(withoutField).map((facet) => facet.kind),
    ["chat", "error"],
  );
  assert.equal(
    withoutProfessorMariContextFacet(
      { source: "command-center", capability: "repair", error: { message: "x" } },
      "error",
    ),
    null,
  );
  // R22 made visible: chat text, error text and field values only leave on Send.
  assert.deepEqual(
    (["resource", "chat", "field", "settings", "error", "asideAnswer"] as const).filter(
      professorMariFacetSendsContentLater,
    ),
    ["chat", "field", "error"],
  );
}

// A5: a typed scope prefix like "faq:" is omnibar search syntax, not message text
// — every door into Mari (including the Ask-Mari row's own query) must strip it
// with the same helper before it reaches the composer.
assert.equal(parseOmnibarScope("faq: import").query, "import");
assert.equal(parseOmnibarScope("plain question").query, "plain question");

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
  // M18: ⌘J / Ctrl+J asks Mari, by the same rules; it is not ⌘K.
  const j = (overrides: Partial<Parameters<typeof isAskMariShortcut>[0]>) =>
    key({ key: "j", code: "KeyJ", ...overrides });
  assert.equal(isAskMariShortcut(j({ ctrlKey: true }), false), true);
  assert.equal(isAskMariShortcut(j({ metaKey: true }), true), true);
  assert.equal(isAskMariShortcut(j({ ctrlKey: true }), true), false, "macOS: Ctrl+J is not ⌘J");
  assert.equal(isAskMariShortcut(j({ ctrlKey: true, shiftKey: true }), false), false);
  assert.equal(isAskMariShortcut(j({ ctrlKey: true, repeat: true }), false), false);
  assert.equal(isAskMariShortcut(j({ ctrlKey: true, key: "о" }), false), true, "physical J on a non-Latin layout");
  assert.equal(isAskMariShortcut(key({ ctrlKey: true }), false), false, "Ctrl+K is not Ask Mari");
  assert.equal(isOmnibarShortcut(j({ ctrlKey: true }), false), false, "Ctrl+J is not the omnibar");
}

{
  const key = (overrides: Partial<Parameters<typeof isShortcutsHelpKey>[0]>) => ({
    key: "?",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...overrides,
  });
  assert.equal(isShortcutsHelpKey(key({})), true);
  assert.equal(isShortcutsHelpKey(key({ ctrlKey: true })), false);
  assert.equal(isShortcutsHelpKey(key({ repeat: true })), false);
  assert.equal(isShortcutsHelpKey(key({ key: "/" })), false);
  // "?" must reach text fields; buttons and checkboxes do not type it.
  const input = (type: string | null) => ({ tagName: "INPUT", getAttribute: () => type });
  assert.equal(isTypingTarget(input(null)), true);
  assert.equal(isTypingTarget(input("search")), true);
  assert.equal(isTypingTarget(input("checkbox")), false);
  assert.equal(isTypingTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(isTypingTarget({ tagName: "DIV", closest: () => ({}) }), true);
  assert.equal(isTypingTarget({ tagName: "BUTTON", closest: () => null }), false);
  assert.equal(formatShortcutKey("Mod", true), "⌘");
  assert.equal(formatShortcutKey("Mod", false), "Ctrl");
}

{
  // Handing typed text to Professor Mari sends it only when it asks for something.
  assert.equal(isMariInstruction("", "Eliza"), false, "nothing typed opens her with nothing to send");
  assert.equal(isMariInstruction("eliza", "Eliza"), false, "the row's own name is a search, not a request");
  assert.equal(isMariInstruction("char: Eli", "Eliza"), false, "a scope prefix is not part of the request");
  assert.equal(isMariInstruction("make eliza meaner", "Eliza"), true, "more than the name is a request");
  assert.equal(isMariInstruction("how do lorebooks work", null), true, "with no row, any text is a request");
}

{
  // FAQ and short docs matches need a word start, so a name search is not buried.
  assert.equal(matchesAtWordStart("Eliza Moreau", "eli"), true);
  assert.equal(matchesAtWordStart("One of the more reliable fixes", "eli"), false, "no match inside a word");
  assert.equal(matchesAtWordStart("Use the (beta) mode", "beta"), true, "after punctuation");
  assert.equal(matchesAtWordStart("a+b costs", "a+b"), true, "regex characters are literal");
  assert.equal(matchesAtWordStart("Éclair", "écl"), true, "letters beyond ASCII");
}

{
  // A quick answer offers the things it names, in the order it names them.
  const rows = [
    { id: "settings-control:streaming-speed", title: "Streaming speed" },
    { id: "character:eliza", title: "Eliza Moreau" },
    { id: "control:theme", title: "Theme", control: {} as never },
    { id: "chat:tea", title: "Tea" },
    { id: "settings-section:streaming-speed", title: "Streaming Speed" },
  ];
  assert.deepEqual(
    findMentionedResults("Ask Eliza Moreau, then lower Streaming speed in Settings.", rows).map((row) => row.id),
    ["character:eliza", "settings-control:streaming-speed"],
    "answer order; one row per name",
  );
  assert.deepEqual(
    findMentionedResults("Have some tea and change the theme.", rows),
    [],
    "short names and controls never count",
  );
  assert.deepEqual(
    findMentionedResults("Try streaming speedrun mode.", rows),
    [],
    "a name inside a longer word does not count",
  );
  // Slice 84 rule 3: no word-fragment chips. A name inside a longer Title Case name is a different thing.
  const sections = [
    { id: "settings-section:advanced", title: "Advanced" },
    { id: "settings-section:parameters", title: "Parameters" },
    { id: "settings-tab:settings", title: "Settings" },
  ];
  assert.deepEqual(
    findMentionedResults("Raise **Max tokens** in Chat Settings → **Advanced Parameters**.", sections),
    [],
    "fragments of longer names do not count",
  );
  assert.deepEqual(
    findMentionedResults("Settings has it. Open Advanced, then Parameters.", sections).map((row) => row.id),
    ["settings-tab:settings", "settings-section:advanced", "settings-section:parameters"],
    "a capital that starts a sentence joins nothing",
  );
}

{
  // "new character Bob" and "chat with Shrek" become rows, with the typed casing kept.
  const t = ((key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values?.[name] ?? ""))) as never;
  const characters = [
    { id: "c1", name: "Shrek" },
    { id: "c2", name: "Dottore" },
    { id: "c3", name: "Donkey" },
  ];
  const created = buildOmnibarIntentShortcuts({ query: "new character Bob the Builder", characters, t });
  assert.deepEqual(created[0]?.action, { kind: "create-named", modal: "create-character", name: "Bob the Builder" });
  assert.equal(
    (
      buildOmnibarIntentShortcuts({ query: "create a lorebook called Silver Court", characters, t })[0]?.action as {
        name?: string;
      }
    )?.name,
    "Silver Court",
  );
  assert.deepEqual(
    buildOmnibarIntentShortcuts({ query: "chat with shrek", characters, t }).map((row) => row.id),
    ["shortcut:start-chat:c1"],
  );
  assert.deepEqual(
    buildOmnibarIntentShortcuts({ query: "new chat do", characters, t }).map((row) => row.id),
    ["shortcut:start-chat:c2", "shortcut:start-chat:c3"],
    "a partial name offers every character it starts",
  );
  assert.deepEqual(buildOmnibarIntentShortcuts({ query: "shrek", characters, t }), [], "a bare name is a search");
  assert.deepEqual(buildOmnibarIntentShortcuts({ query: "new character", characters, t }), [], "no name, no row");
}

{
  // The omnibar aside's answer cache: an LRU with a short TTL, keyed by connection + query.
  const cache = new OmnibarAsideAnswerCache(2, 1_000);
  assert.equal(cache.get("conn-a", "how do i export"), undefined, "a miss returns undefined");
  cache.set("conn-a", "how do i export", { answer: "Settings > Export", tier: "remote" });
  assert.deepEqual(cache.get("conn-a", "how do i export"), { answer: "Settings > Export", tier: "remote" });
  assert.equal(
    cache.get("conn-b", "how do i export"),
    undefined,
    "the same query on a different connection is a different entry",
  );

  // Over capacity evicts the least-recently-used entry, not the newest.
  cache.set("conn-a", "second query", { answer: "second", tier: "remote" });
  cache.get("conn-a", "how do i export"); // touch the first entry so it is now most-recently-used
  cache.set("conn-a", "third query", { answer: "third", tier: "remote" });
  assert.equal(cache.get("conn-a", "second query"), undefined, "the untouched entry is evicted, not the touched one");
  assert.deepEqual(cache.get("conn-a", "how do i export"), { answer: "Settings > Export", tier: "remote" });
  assert.deepEqual(cache.get("conn-a", "third query"), { answer: "third", tier: "remote" });

  // TTL expiry.
  const ttlCache = new OmnibarAsideAnswerCache(10, 0);
  ttlCache.set("conn-a", "expires now", { answer: "gone", tier: "local" });
  assert.equal(ttlCache.get("conn-a", "expires now"), undefined, "an expired entry is treated as a miss");
}

{
  // The omnibar aside strips markdown the plain-text prompt instruction failed to prevent.
  assert.equal(stripStrayMarkdown("**Settings** has it."), "Settings has it.");
  assert.equal(stripStrayMarkdown("Go to *Settings* > *Export*."), "Go to Settings > Export.");
  assert.equal(stripStrayMarkdown("Use `docs_search` first."), "Use docs_search first.");
  assert.equal(stripStrayMarkdown("# Heading\nBody text"), "Heading\nBody text");
  assert.equal(stripStrayMarkdown("- one\n- two"), "one\ntwo");
  assert.equal(stripStrayMarkdown("1. first\n2. second"), "first\nsecond");
  assert.equal(stripStrayMarkdown("Plain sentence, nothing to strip."), "Plain sentence, nothing to strip.");
}

{
  // Without a local model the aside offers Mari's own connection: the agents default, then the default, then the first.
  const plain = { isDefault: false, defaultForAgents: false };
  assert.equal(marisConnectionFor([]), null, "no connection, nothing to offer");
  assert.equal(marisConnectionFor([{ id: "a", ...plain }])?.id, "a", "a lone connection is the one offered");
  assert.equal(
    marisConnectionFor([
      { id: "a", ...plain },
      { id: "b", ...plain, isDefault: true },
    ])?.id,
    "b",
  );
  assert.equal(
    marisConnectionFor([
      { id: "a", ...plain, isDefault: true },
      { id: "b", ...plain, defaultForAgents: true },
    ])?.id,
    "b",
    "the agents default wins over the default",
  );
  const both = [
    { id: "a", ...plain },
    { id: "b", ...plain, defaultForAgents: true },
  ];
  assert.equal(marisConnectionFor(both, "a")?.id, "a", "the connection her window uses wins");
  assert.equal(marisConnectionFor(both, "gone")?.id, "b", "a deleted choice falls back to the agents default");
  // G5: the idle delay is a user-facing knob (R23) whose default is one of its choices.
  assert.equal(OMNIBAR_ASIDE_DELAY_MS, 3_000);
  assert.ok((OMNIBAR_ASIDE_DELAY_CHOICES_MS as readonly number[]).includes(OMNIBAR_ASIDE_DELAY_MS));
}

{
  // B6: the unasked quick-answer aside grounds its prompt in the real docs corpus
  // and real Settings labels only. formatDocumentationGroundingExcerpts's only
  // input is a docs_search result (path/heading/excerpt from README.md or
  // docs/**.md) - structurally it has no way to see chat, character, or other
  // user data, so a call site that never hands it anything else cannot leak.
  const results: DocumentationSearchResult[] = [
    {
      path: "docs/CONFIGURATION.md",
      heading: "Logging Levels",
      excerpt: "Set LOG_LEVEL to control verbosity.",
      startLine: 10,
      score: 90,
    },
    {
      path: "docs/FAQ.md",
      heading: "Export a chat",
      excerpt: "Use Settings > Backup & Export.",
      startLine: 4,
      score: 80,
    },
    {
      path: "README.md",
      heading: "Install",
      excerpt: "Download the installer for your platform.",
      startLine: 1,
      score: 70,
    },
    {
      path: "docs/TROUBLESHOOTING.md",
      heading: "Connection errors",
      excerpt: "Check the connection's base URL.",
      startLine: 2,
      score: 60,
    },
  ];

  const top3 = formatDocumentationGroundingExcerpts(results);
  const lines = top3.split("\n");
  assert.equal(lines.length, 3, "grounding keeps only the top 3 excerpts, not the full result set");
  assert.ok(
    lines[0]!.includes("docs/CONFIGURATION.md") && lines[0]!.includes("Logging Levels"),
    "each line cites its source path and heading",
  );
  assert.ok(!top3.includes("TROUBLESHOOTING"), "the 4th-ranked result is dropped");

  // An excerpt with embedded newlines (a real multi-line markdown section) is
  // flattened to one line per result and capped, so the grounding block stays
  // small and bounded rather than growing into a full-document dump.
  const longExcerpt = `First line of the section.\n${"word ".repeat(100)}`.trim();
  const flattened = formatDocumentationGroundingExcerpts([
    { path: "docs/FAQ.md", heading: "Long section", excerpt: longExcerpt, startLine: 1, score: 60 },
  ]);
  assert.equal(flattened.split("\n").length, 1, "one docs result is always rendered as exactly one line");
  assert.ok(flattened.length < longExcerpt.length, "an oversized excerpt is truncated, not passed through whole");
  assert.ok(flattened.endsWith("…"), "a truncated excerpt is marked with an ellipsis");

  assert.deepEqual(
    formatDocumentationGroundingExcerpts([]),
    "",
    "no matches renders an empty block, not a placeholder line",
  );
  // UX-12: a weak match (one stray word) is not a source for a quick answer.
  assert.deepEqual(
    formatDocumentationGroundingExcerpts([
      { path: "docs/Writing.md", heading: "Rulesets", excerpt: "A stray word.", startLine: 1, score: 5 },
    ]),
    "",
    "a weak docs match is not grounding",
  );
}

{
  // The unasked aside's compact Settings label list is grouped by real tab
  // labels and lists real section labels - no ids, no descriptions, no aliases -
  // so it stays small and only ever names things the user can actually see.
  assert.ok(QUICK_ANSWER_SETTINGS_LABELS.includes("General:"), "a real tab label heads its group");
  assert.ok(QUICK_ANSWER_SETTINGS_LABELS.includes("Backup & Export"), "a real section label is present");
  assert.ok(
    !QUICK_ANSWER_SETTINGS_LABELS.includes("backup-export"),
    "the internal section id does not leak into the prompt",
  );
  assert.ok(
    QUICK_ANSWER_SETTINGS_LABELS.length < 2_000,
    "the settings-label hint stays compact enough for a quick-answer prompt",
  );
}

{
  // K4: a capability word in the typed query grounds the unasked aside with
  // real catalog lines, and the same shared detector is what the client reads
  // to decide whether to show the Download Agents chip - no extra data sent.
  assert.deepEqual(matchOmnibarCapabilityAgentPackageIds("can Marinara make images?"), ["illustrator"]);
  assert.deepEqual(matchOmnibarCapabilityAgentPackageIds("does it play music"), ["spotify"]);
  assert.deepEqual(matchOmnibarCapabilityAgentPackageIds("world maps"), ["hierarchical-maps"]);
  assert.deepEqual(
    matchOmnibarCapabilityAgentPackageIds("music and images"),
    ["spotify", "illustrator"],
    "order follows the query; both capabilities are returned",
  );
  assert.deepEqual(matchOmnibarCapabilityAgentPackageIds("what's the weather"), [], "no capability word, no match");

  const imagesLines = formatCapabilityAgentGroundingLines("how do I generate images");
  assert.ok(imagesLines, "a capability query returns a grounding block");
  assert.ok(imagesLines!.includes("Illustrator") && imagesLines!.includes("`illustrator`"));
  assert.equal(imagesLines!.split("\n").length, 1, "one matched capability is one line, not the whole catalog");
  assert.equal(
    formatCapabilityAgentGroundingLines("what time is it"),
    null,
    "a query with no capability word grounds nothing",
  );

  // Slice 22 fix: every package id a keyword can match must actually exist in
  // the catalog, or the grounding line (and the Download Agents chip) would
  // silently point at nothing.
  const knownAgentIds = new Set(OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.map((entry) => entry.id));
  for (const [word, ids] of Object.entries(OMNIBAR_CAPABILITY_AGENT_KEYWORDS)) {
    for (const id of ids) {
      assert.ok(knownAgentIds.has(id), `keyword "${word}" names unknown catalog id "${id}"`);
    }
  }
}

{
  // Slice 6: the expanded row shows FAQ steps as a short list and no doc fact that
  // repeats the description.
  const identity = (text: string) => text;
  const results = buildOmnibarSearchResults({
    chatControls: [],
    contextLabels: {},
    controls: [],
    data: { commands: [], chats: [], resources: [], connections: [], askProfessorTitle: "Ask" },
    deferredQuery: "backups",
    docsResults: [
      {
        id: "doc:backups",
        title: "Backups",
        source: "Guides",
        snippet: "How backups work",
        path: "docs/BACKUPS.md",
        line: 4,
      } as never,
    ],
    faqItems: [
      {
        id: "backups",
        category: "data",
        question: "How do backups work?",
        answer: "Automatic backups run daily.",
        bullets: ["One", "Two", "Three", "Four", "Five"],
      },
    ],
    getFaqSearchText: (item) => `${item.question} ${item.answer}`,
    localize: identity,
    mariEnabled: false,
    omnibarContext: {
      surface: "home",
      surfaceResultIds: [],
      editorDirty: false,
      recentResultIds: [],
      setupResultIds: [],
    } as never,
    t: ((_key: string, fallback?: string) => fallback ?? _key) as never,
  });
  const faqPreview = results.find((result) => result.id === "faq:backups")?.preview?.();
  assert.deepEqual(faqPreview?.steps, ["One", "Two", "Three"], "FAQ steps are a short list");
  assert.equal(faqPreview?.facts, undefined, "FAQ steps are not facts");
  const docPreview = results.find((result) => result.id === "doc:backups")?.preview?.();
  assert.ok(docPreview, "the doc passage is a result");
  assert.deepEqual(
    docPreview.facts?.map((fact) => fact.label),
    ["Source", "Line"],
    "no Category or Match fact repeats the path or the description",
  );
}

// UX-06: the tour's search step tells a phone user about the pull-down, and the last step uses the keyed copy
// that already names both doors ({{mod}}+K and the phone pull).
{
  const tourSource = readFileSync(
    new URL("../../packages/client/src/components/onboarding/OnboardingTutorial.tsx", import.meta.url),
    "utf8",
  );
  assert.match(tourSource, /phoneBodyKey: "onboarding\.homeNavigation\.phoneBody"/u);
  assert.match(tourSource, /titleKey: "onboarding\.finish\.title",\s*bodyKey: "onboarding\.finish\.body"/u);
  const en = JSON.parse(
    readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
  );
  assert.match(en["onboarding.homeNavigation.phoneBody"], /pull down from the top bar/iu);
  assert.match(en["onboarding.finish.body"], /On a phone, pull down from the top bar\./u);
}

// Search lists none of Professor Mari's changes (applied, held, delete, install or file write) in any mode;
// her window shows and undoes them. The Continue row stays the way in, and it still names a waiting review.
{
  const t = ((_key: string, fallback?: string) => fallback ?? _key) as never;
  const omnibarDir = new URL("../../packages/client/src/components/layout/", import.meta.url);
  for (const file of ["GlobalOmnibar.tsx", "omnibar/omnibar-keyboard.ts", "omnibar/omnibar-dialog-rules.ts"]) {
    const source = readFileSync(new URL(file, omnibarDir), "utf8");
    assert.doesNotMatch(source, /mari-approval:|ApprovalResults|useMariApprovals/u, `${file} builds no change rows`);
  }
  const resultsSource = readFileSync(
    new URL("../../packages/client/src/lib/omnibar-results.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(resultsSource, /commandCenter\.approval\./u, "no change-row copy is left in the builders");
  const held = { id: "h1", kind: "approval", diffPreview: [], affectedTables: { characters: 1 }, affectedRows: 1 };
  const row = buildOmnibarContinueResult({
    mariEnabled: true,
    t,
    workspaceStatus: { active: false, pendingApprovals: [held] as never },
  });
  assert.equal(row?.id, "ask-professor-mari", "a held change still leaves the way into her window");
  assert.equal(row?.control, undefined, "the way in decides nothing in place");
}

// UX-28: the live count has a singular form, so one result reads "1 result".
{
  const en = JSON.parse(
    readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
  );
  assert.equal(en["commandCenter.live.resultCount_one"], "{{count}} result");
  assert.equal(en["commandCenter.live.resultCount_other"], "{{count}} results");
}

// UX-01: typing her name first opens her; the row is the same door as Ctrl+J.
{
  const searchInput = (deferredQuery: string, mariOn = true) => ({
    chatControls: [],
    contextLabels: {},
    controls: [],
    data: { commands: [], chats: [], resources: [], connections: [], askProfessorTitle: "Ask" },
    deferredQuery,
    docsResults: [],
    faqItems: [],
    getFaqSearchText: () => "",
    localize: (text: string) => text,
    mariEnabled: mariOn,
    omnibarContext: {
      surface: "home",
      surfaceResultIds: [],
      editorDirty: false,
      recentResultIds: [],
      setupResultIds: [],
    } as never,
    t: ((_key: string, fallback?: string) => fallback ?? _key) as never,
  });
  for (const word of ["mari", "Professor", "ask mari", "open mari"]) {
    assert.equal(
      buildOmnibarSearchResults(searchInput(word))[0]?.id,
      "open-professor-mari",
      `UX-01: "${word}" opens Mari first`,
    );
  }
  // The presenter must not pick a title-prefix Top hit over her ("Mari changed Shrek", "Ask Professor Mari from Search").
  const presented = presentCommandCenterResults(
    [
      { id: "approval:1", title: "Mari changed Shrek", category: "professor", score: 900 },
      ...buildOmnibarSearchResults(searchInput("mari")),
    ],
    { query: "mari" },
  );
  assert.equal(presented.groups[0]?.id, "top-hit");
  assert.equal(presented.results[0]?.id, "open-professor-mari", "UX-01: Open Mari is the Top hit");
  assert.equal(
    buildOmnibarSearchResults(searchInput("mari", false)).some((result) => result.id === "open-professor-mari"),
    false,
    "UX-01: no Open Mari row while Mari is off",
  );
  assert.notEqual(
    buildOmnibarSearchResults(searchInput("mari appearance"))[0]?.id,
    "open-professor-mari",
    "UX-01: a longer query keeps its own first row",
  );
}

// Slice 41 (F1): a direct message/entry hit must outrank the Mari fallback promotion.
{
  const identity = (text: string) => text;
  const baseSearchInput = {
    chatControls: [],
    contextLabels: {},
    controls: [],
    data: { commands: [], chats: [], resources: [], connections: [], askProfessorTitle: "Ask" },
    deferredQuery: "silver compass",
    docsResults: [],
    faqItems: [],
    getFaqSearchText: () => "",
    localize: identity,
    mariEnabled: true,
    omnibarContext: {
      surface: "home",
      surfaceResultIds: [],
      editorDirty: false,
      recentResultIds: [],
      setupResultIds: [],
    } as never,
    t: ((_key: string, fallback?: string) => fallback ?? _key) as never,
  };
  const withoutDirectHit = buildOmnibarSearchResults(baseSearchInput);
  const mariRow = withoutDirectHit.find((result) => result.id === "ask-professor-mari");
  assert.equal(
    mariRow?.group,
    "professor-suggested",
    "with nothing scoring well and no direct hit, Mari is still promoted",
  );
  const withDirectHit = buildOmnibarSearchResults({ ...baseSearchInput, directHitCount: 1 });
  const mariRowWithHit = withDirectHit.find((result) => result.id === "ask-professor-mari");
  assert.notEqual(
    mariRowWithHit?.group,
    "professor-suggested",
    "a direct hit elsewhere (the message row) keeps Mari out of the suggested group",
  );
}

// Slice 65 (R6): with no model, a question no longer lifts "Ask Prof. Mari" above docs/FAQ rows; a dead end still does.
{
  const identity = (text: string) => text;
  const input = {
    chatControls: [],
    contextLabels: {},
    controls: [],
    data: { commands: [], chats: [], resources: [], connections: [], askProfessorTitle: "Ask" },
    deferredQuery: "how do lorebooks work?",
    docsResults: [],
    faqItems: [],
    getFaqSearchText: () => "",
    localize: identity,
    mariEnabled: true,
    omnibarContext: {
      surface: "home",
      surfaceResultIds: [],
      editorDirty: false,
      recentResultIds: [],
      setupResultIds: [],
    } as never,
    t: ((_key: string, fallback?: string) => fallback ?? _key) as never,
  };
  const mariGroup = (results: OmnibarResult[]) => results.find((result) => result.id === "ask-professor-mari")?.group;
  const doc = { id: "doc:lorebooks", title: "Lorebooks Overview", source: "Guides", snippet: "How lorebooks work" };
  assert.equal(
    mariGroup(buildOmnibarSearchResults({ ...input, docsResults: [doc as never], directHitCount: 1 })),
    "professor-suggested",
    "with a model, a question still promotes Mari",
  );
  assert.notEqual(
    mariGroup(
      buildOmnibarSearchResults({ ...input, docsResults: [doc as never], directHitCount: 1, mariHasModel: false }),
    ),
    "professor-suggested",
    "with no model, docs rows lead and Mari is not promoted",
  );
  assert.notEqual(
    mariGroup(
      buildOmnibarSearchResults({
        ...input,
        mariHasModel: false,
        faqItems: [{ id: "lb", category: "data", question: "How do lorebooks work?", answer: "Entries." }],
        getFaqSearchText: (item) => item.question,
      }),
    ),
    "professor-suggested",
    "with no model, an FAQ hit leads too",
  );
  assert.equal(
    mariGroup(buildOmnibarSearchResults({ ...input, mariHasModel: false })),
    "professor-suggested",
    "with no model and nothing else, the dead end still offers her row (and its Choose a model hint)",
  );
}

// Slice 65 (R6): the empty list drops the chat's own model, preset and persona rows, but keeps a Fix row.
{
  const row = (id: string) => ({ id, title: id, category: "chat", score: 0 }) as OmnibarResult;
  const rows = ["chat:c1", "character:a", "persona:p1", "preset:s1", "connection:k1", "chat-tool:search:c1"].map(row);
  const chat = { connectionId: "k1", promptPresetId: "s1", personaId: "p1" };
  assert.deepEqual(
    idleOmnibarContextResults(rows, chat, null).map((result) => result.id),
    ["chat:c1", "character:a", "chat-tool:search:c1"],
    "composer duplicates are gone from the empty list",
  );
  assert.ok(
    idleOmnibarContextResults([row("connection:k1"), ...rows], chat, "connection:k1").some(
      (result) => result.id === "connection:k1",
    ),
    "a Fix row on the chat's connection stays",
  );
  assert.equal(idleOmnibarContextResults(rows, null, null).length, rows.length, "no active chat, nothing dropped");
}

// Slice 41 (F2): "import" lists import rows, not create rows; "new" stays create-only.
{
  const createCharacter: OmnibarResult = {
    id: "create-character",
    title: "Create Character",
    category: "character",
    score: 1,
  };
  const createPersona: OmnibarResult = { id: "create-persona", title: "Create Persona", category: "persona", score: 1 };
  const importData: OmnibarResult = { id: "import-data", title: "Import data", category: "data", score: 1 };
  const verbInput = { allLocalResults: [createCharacter, createPersona, importData] };
  const importVerb = buildOmnibarVerbSuggestions({ ...verbInput, deferredQuery: "import" });
  assert.deepEqual(
    importVerb.map((result) => result.id),
    ["import-data"],
    "a bare import lists only import rows",
  );
  const newVerb = buildOmnibarVerbSuggestions({ ...verbInput, deferredQuery: "new" });
  assert.deepEqual(
    newVerb.map((result) => result.id).sort(),
    ["create-character", "create-persona"],
    "a bare new/create lists only create rows, never import",
  );
}

// Slice 41 (F5): the "Fix" row shows the real error text, not the connection's provider name.
{
  const contextBase = {
    activeChat: null,
    activeChatId: null,
    agents: [],
    allLocalResults: [
      {
        id: "connection:conn1",
        title: "My Connection",
        category: "connection",
        score: 0,
        description: "openai",
      } as OmnibarResult,
    ],
    characterById: new Map(),
    connectionById: new Map([["conn1", { id: "conn1", provider: "openai" }]]) as never,
    connections: [{ id: "conn1", name: "My Connection", provider: "openai" }] as never,
    lastAppError: {
      action: "Generate reply",
      message: "fetch failed: bad port",
      retry: { kind: "open-connection" as const, id: "conn1" },
    },
    lorebookById: new Map(),
    lorebooks: [],
    mariEnabled: false,
    omnibarSuggestionsEnabled: true,
    openAgentId: null,
    openCharacterId: null,
    openConnectionId: null,
    openLorebookId: null,
    openPersonaId: null,
    openPresetId: null,
    personaById: new Map(),
    personas: [],
    presets: [],
    surface: "home" as const,
    t: ((_key: string, fallback?: string) => fallback ?? _key) as never,
  };
  const fixRow = buildOmnibarContextResults(contextBase as never).find((result) => result.id === "connection:conn1");
  assert.equal(
    fixRow?.description,
    "fetch failed: bad port",
    "the Fix row keeps the real error text instead of the canonical connection's description",
  );
}

// Slice 41 (F10): "Send on Enter" is reachable from the omnibar settings search.
{
  assert.ok(
    SETTINGS_SEARCHABLE_CONTROLS.some((control) => control.id === "send-on-enter"),
    "send-on-enter is registered",
  );
  const sendOnEnterDestination = getOmnibarSettingsDestinations().find(
    (setting) => setting.id === "settings-control:send-on-enter",
  );
  assert.ok(sendOnEnterDestination, "searching settings resolves send-on-enter to a destination row");
}

// Slice 7b (I4): a finished step reads in the past tense; other titles stay as they are.
{
  assert.equal(pastTenseStepTitle("Reading character"), "Read character");
  assert.equal(pastTenseStepTitle("Searching lorebooks"), "Searched lorebooks");
  assert.equal(pastTenseStepTitle("Creating character"), "Created character");
  assert.equal(pastTenseStepTitle("Updating preset"), "Updated preset");
  assert.equal(pastTenseStepTitle("Running command"), "Ran command");
  assert.equal(pastTenseStepTitle("Planning changes"), "Planned changes");
  assert.equal(pastTenseStepTitle("Copying file"), "Copied file");
  assert.equal(pastTenseStepTitle("Adding entry"), "Added entry");
  assert.equal(pastTenseStepTitle("Setting theme"), "Set theme");
  assert.equal(pastTenseStepTitle("Writing file"), "Wrote file");
  assert.equal(pastTenseStepTitle("Making changes"), "Made changes");
  assert.equal(pastTenseStepTitle("Taking notes"), "Took notes");
  assert.equal(pastTenseStepTitle("String search"), "String search", "no vowel before -ing: not a verb");
  assert.equal(pastTenseStepTitle("docs_search"), "docs_search");
}

// Slice 36 (M5a): steps fold into phases by verb class; only the phase she is still in stays open.
{
  type Step = { title: string; status: string };
  const step = (id: string, title: string, status = "done"): WorkTimelineItem<Step> => ({
    id,
    type: "tool",
    tool: { title, status },
  });
  const describe = (tool: Step) => ({ title: tool.title, failed: tool.status === "error" });
  const run: WorkTimelineItem<Step>[] = [
    { id: "t0", type: "thinking", content: "Read the character first." },
    step("s1", "Reading character"),
    step("s2", "Searching lorebooks"),
    { id: "say", type: "text", content: "Now I'll fix the greeting." },
    step("s3", "Updating character"),
    step("s4", "Creating lorebook entry", "error"),
    step("s5", "Running command"),
  ];
  const live = groupRunPhases(run, { active: true, describe });
  assert.deepEqual(
    live.phases.map((phase) => [phase.kind, phase.steps, phase.failed]),
    [
      ["look", 2, 0],
      ["change", 2, 1],
      ["other", 1, 0],
    ],
    "read/search look, edit/create change, anything else is its own phase; a failed step counts on its phase",
  );
  assert.deepEqual(
    live.intro.map((item) => item.id),
    ["t0"],
    "what came before the first step stays where it was",
  );
  assert.deepEqual(
    live.phases[1]!.items.map((item) => item.id),
    ["say", "s3", "s4"],
    "words she said before a step belong to that step's phase",
  );
  assert.deepEqual(
    live.phases.map((phase) => [phase.open, phase.live]),
    [
      [true, false],
      [true, false],
      [true, true],
    ],
    "R13: while she runs every phase stays open (done marks visible); only the one she is in is live",
  );
  const answering = groupRunPhases(
    [...run, { id: "a", type: "text", content: "Done: the greeting opens the scene." }],
    {
      active: true,
      describe,
    },
  );
  assert.deepEqual(
    [answering.phases.at(-1)!.open, answering.phases.at(-1)!.live],
    [true, false],
    "R13: once she starts answering the last phase is done but stays open until the run ends",
  );
  assert.deepEqual(
    answering.tail.map((item) => item.id),
    ["a"],
    "her answer is the tail",
  );
  assert.ok(
    groupRunPhases(run, { active: false, describe }).phases.every((phase) => phase.open && !phase.live),
    "R14: a finished run keeps short phases (up to three steps) open, none live",
  );
  const longLook = Array.from({ length: 4 }, (_, index) => step(`l${index}`, "Reading character"));
  assert.equal(
    groupRunPhases(longLook, { active: false, describe }).phases[0]!.open,
    false,
    "R14: a finished phase of more than three steps folds",
  );
  const noSteps = groupRunPhases<Step>(
    [
      { id: "t", type: "thinking", content: "Easy one." },
      { id: "a", type: "text", content: "Yes." },
      { id: "st", type: "status", content: "pacing" },
    ],
    { active: true, describe },
  );
  assert.deepEqual(
    [noSteps.intro.length, noSteps.phases.length, noSteps.tail.map((item) => item.id)],
    [0, 0, ["t", "a"]],
    "a run without steps has no phases; status lines stay out",
  );
  assert.deepEqual(
    groupRunPhases([step("x", "Reading a"), step("y", "Reading b")], { active: true, describe }).phases.length,
    1,
    "back-to-back steps of one kind share one phase",
  );
  // Slice 70: a finished, answered run shows steps and the answer, not each round's narration.
  const narrated: WorkTimelineItem<Step>[] = [
    { id: "n0", type: "text", content: "Let me pull up her card." },
    step("r1", "Reading character"),
    { id: "n1", type: "text", content: "One sec - reading the rest." },
    step("r2", "Reading character"),
    { id: "n2", type: "text", content: "Got the full card." },
    { id: "a", type: "text", content: "Here is what I would change." },
  ];
  const finished = groupRunPhases(narrated, { active: false, describe });
  assert.deepEqual(
    [finished.intro.length, finished.phases[0]!.items.map((item) => item.id), finished.tail.map((item) => item.id)],
    [0, ["r1", "r2"], ["a"]],
    "slice 70: a finished answered run drops interim narration",
  );
  assert.deepEqual(
    groupRunPhases(narrated, { active: true, describe }).intro.map((item) => item.id),
    ["n0"],
    "slice 70: while she runs, her narration stays as live status",
  );
  assert.deepEqual(
    groupRunPhases(narrated.slice(0, 4), { active: false, describe }).phases[0]!.items.map((item) => item.id),
    ["r1", "n1", "r2"],
    "slice 70: a run that ended without an answer keeps her last words",
  );
  // Slice 72: the server sends a round's words after its steps and marks them; they caption that phase.
  const marked: WorkTimelineItem<Step>[] = [
    step("m1", "Reading character"),
    step("m2", "Reading character", "error"),
    { id: "say", type: "text", content: "Let me look at both of them first.", narration: true },
    step("m3", "Updating character"),
  ];
  const markedLive = groupRunPhases(marked, { active: true, describe });
  assert.deepEqual(
    markedLive.phases.map((phase) => [phase.kind, phase.caption ?? null, phase.failed, phase.missed]),
    [
      ["look", "Let me look at both of them first.", 0, 1],
      ["change", null, 0, 0],
    ],
    "slice 72: marked words caption the phase whose steps came before them; a failed read is missed, not failed",
  );
  assert.equal(
    markedLive.phases[1]!.items.some((item) => item.type === "text"),
    false,
    "slice 72: marked words never land in the next phase",
  );
  assert.equal(
    groupRunPhases([...marked, { id: "a", type: "text", content: "Done." }], { active: false, describe }).phases[0]!
      .caption,
    undefined,
    "slice 72: a finished answered run drops the captions (slice 70)",
  );
}

// Slice 36 (M5a): a trailing "Why" list folds into one line; anything else stays in the answer.
{
  assert.deepEqual(splitMariAnswerWhy("**Illustrator** fits.\n\nWhy:\n- It draws scenes.\n- It is installed."), {
    answer: "**Illustrator** fits.",
    why: ["It draws scenes.", "It is installed."],
  });
  assert.deepEqual(splitMariAnswerWhy("Lead.\n\n**Why**\n1. One").why, ["One"], "bold heading and numbers");
  assert.deepEqual(
    splitMariAnswerWhy("Lead.\n\nWhy:\n- One\n\nThen more text.").why,
    [],
    "a Why list followed by more prose is not folded",
  );
  assert.deepEqual(
    splitMariAnswerWhy("Why do agents fail? They run out of tokens.").why,
    [],
    "a question is not a heading",
  );
}

// Slice 36: agents, chats and lorebook entries she read become cards; settings come from bold labels.
{
  const tool = (action: string, input: Record<string, unknown>, output: unknown) => ({
    name: "app_data",
    status: "done",
    input: { action, ...input },
    output: `stdout:\n${JSON.stringify(output)}`,
  });
  const refs = collectMariReferencedResources([
    tool("agent.list", {}, [
      { id: null, type: "illustrator", name: "Illustrator", enabled: true, description: "Draws scenes" },
      { id: "cfg-2", type: "music-dj", name: "Music DJ", enabled: false },
    ]),
    tool("agent.runs", { type: "illustrator" }, [{ success: false, error: "No image connection" }]),
    tool("lorebook.getEntry", { entryId: "e1" }, { id: "e1", lorebookId: "lb1", name: "Harbor gate" }),
    tool("chat.get", { id: "c1" }, { id: "c1", name: "Night at the docks" }),
  ]);
  const illustrator = refs.find((ref) => ref.kind === "agent" && ref.id === "illustrator");
  assert.equal(illustrator?.name, "Illustrator", "agents are keyed by type, the id their editor opens");
  assert.equal(illustrator?.state, "failed", "a failed last run is the news, over the list's 'on'");
  assert.equal(illustrator?.fromList, false, "a direct run read makes the agent a card even when unnamed");
  assert.equal(refs.find((ref) => ref.id === "music-dj")?.state, "off");
  const entry = refs.find((ref) => ref.kind === "lorebookEntry");
  assert.equal(entry?.parentId, "lb1", "an entry keeps its lorebook");
  assert.deepEqual(mariReferenceTarget(entry!, []), {
    kind: "resource",
    resource: "lorebook",
    id: "lb1",
    entryId: "e1",
  });
  assert.deepEqual(
    mariReferenceTarget(
      refs.find((ref) => ref.kind === "chat")!,
      [],
    ),
    { kind: "chat", chatId: "c1" },
  );
  assert.deepEqual(
    selectMariReplyLinks(refs, "Turn on **Music DJ**; **Illustrator** failed. Night at the docks is quiet.").map(
      (link) => [link.resource.id, link.term],
    ),
    [
      ["illustrator", "Illustrator"],
      ["music-dj", "Music DJ"],
      ["c1", "Night at the docks"],
    ],
    "slice 72: bold names link (a listed one only when bold); a direct read links by its whole name",
  );
  // Slice 72: the swamp-lore run - plain words never link a listed entry, a first name links a direct read.
  const swamp = [
    { kind: "character", id: "g", name: "Gandalf the Confused", fromList: false },
    { kind: "lorebookEntry", id: "e-swamp", name: "Swamp", fromList: true, parentId: "lb" },
    { kind: "lorebookEntry", id: "e-the", name: "The swamp", fromList: true, parentId: "lb" },
    { kind: "character", id: "x", name: "Ox", fromList: false },
  ] as const;
  assert.deepEqual(
    selectMariReplyLinks(swamp, "Gandalf does not touch the swamp. Ox stays.").map((link) => [
      link.resource.id,
      link.term,
    ]),
    [["g", "Gandalf"]],
    "slice 72: 'the swamp' in her words is not a link; a name under 4 letters never links alone",
  );
  assert.deepEqual(
    selectMariReplyLinks(swamp, "I left **Gandalf the Confused** alone; Gandalfish is a word.").map(
      (link) => link.term,
    ),
    ["Gandalf the Confused"],
    "slice 72: whole words only",
  );
  const settings = getOmnibarSettingsDestinations();
  const hideHelp = settings.find((setting) => setting.controlId === "hide-chat-help-button")!;
  const settingRefs = findMariSettingReferences(`Turn on **${hideHelp.title}**. The language stays.`, settings);
  assert.deepEqual(
    settingRefs.map((ref) => ref.id),
    [hideHelp.id],
    "only a bold exact label is a setting card",
  );
  assert.equal(mariReferenceTarget(settingRefs[0]!, settings)?.kind, "settings", "a setting card opens Settings");
}

// Slice 7b (I2): tracked changes keep a small edit word by word, but strike a rewrite whole.
{
  const greeting = trackProseChange(
    "Zylo waves. Hello, traveler! Want to buy something?",
    "Zylo waves. Hello, traveler. Want to buy something?",
  );
  assert.ok(
    greeting.some((segment) => segment.type === "equal" && segment.value.includes("Want to buy")),
    "a tweak keeps the shared words",
  );
  const greetingRework = trackProseChange(
    "*Zylo waves.* Hello, traveler! Want to buy something?",
    "*Zylo slides a crate lid shut with his boot.* Hello, traveler. You didn't see that. Want to buy something, or sell me your silence?",
  );
  assert.ok(
    greetingRework.some((segment) => segment.type === "equal" && segment.value.includes("Want to buy")),
    "a greeting reworked around its old lines stays word by word",
  );
  const rewrite = trackProseChange(
    "Zylo is a merchant who sells things at the market.",
    "Zylo Vantrell runs contraband under the lantern boats of the floating market.",
  );
  assert.deepEqual(
    rewrite.map((segment) => segment.type),
    ["removed", "equal", "added"],
    "a rewrite is the old text struck whole, then the new text",
  );
  assert.deepEqual(trackProseChange("", "New"), [{ type: "added", value: "New" }]);
  assert.deepEqual(trackListChange("human, merchant", "human, smuggler"), [
    { type: "equal", value: "human" },
    { type: "removed", value: "merchant" },
    { type: "added", value: "smuggler" },
  ]);
}

// Slices 10 and 15: pull down on the phone top bar to open the omnibar or Mari.
{
  assert.equal(pullOpenThreshold(844), 253.2, "30% of a phone's height");
  assert.equal(pullOpenThreshold(1200), 280, "capped at 280 px");
  assert.equal(pullOpenThreshold(390), 160, "a phone in landscape still needs 160 px");

  // A finger down at (100, 20) at t=0, threshold 200; each point is [x, y, t].
  const pull = (releaseAt: number, ...points: Array<[number, number, number]>) => {
    const recognizer = createPullRecognizer(100, 20, 0, 200);
    const steps = points.map(([x, y, t]) => recognizer.move(x, y, t));
    return { steps, opens: recognizer.release(releaseAt) };
  };

  // Direction lock after 10 px; 45° down is enough, so a pull can aim diagonally at Mari.
  assert.deepEqual(pull(20, [103, 26, 10]).steps, ["pending"], "under 10 px nothing is decided");
  assert.deepEqual(pull(40, [112, 30, 20]).steps, ["rejected"], "a sideways swipe is never a pull");
  assert.deepEqual(pull(40, [100, 8, 20]).steps, ["rejected"], "an upward swipe is never a pull");
  assert.equal(pull(1000, [140, 50, 200], [100, 300, 800]).opens, false, "rejected stays rejected");
  assert.deepEqual(pull(60, [109, 31, 50]).steps, ["pulling"], "down by more than sideways locks");

  // Threshold.
  assert.equal(pull(1000, [100, 60, 400], [100, 210, 800]).opens, false, "a slow pull short of it does not open");
  const long = pull(1000, [100, 60, 400], [100, 230, 800]);
  assert.deepEqual(long.steps, ["pulling", "armed"]);
  assert.equal(long.opens, true, "releasing past the threshold opens, however slowly");

  // Flick.
  assert.equal(pull(70, [100, 40, 20], [100, 70, 60]).opens, true, "a fast flick after 40 px opens early");
  assert.equal(pull(50, [100, 40, 20], [100, 55, 40]).opens, false, "a flick under 40 px does not");
  assert.equal(pull(400, [100, 40, 20], [100, 70, 60]).opens, false, "stopping before release is not a flick");

  // Cancel, with room for a jitter: an armed pull holds down to 85% of the threshold.
  const jitter = pull(900, [100, 60, 200], [100, 230, 500], [100, 205, 700]);
  assert.deepEqual(jitter.steps, ["pulling", "armed", "armed"], "a small slip back stays armed");
  assert.equal(jitter.opens, true);
  const back = pull(900, [100, 60, 200], [100, 230, 500], [100, 180, 700]);
  assert.deepEqual(back.steps, ["pulling", "armed", "cancelled"], "pulling back under 85% cancels");
  assert.equal(back.opens, false);
  const again = pull(900, [100, 60, 200], [100, 230, 500], [100, 180, 700], [100, 300, 800]);
  assert.equal(again.opens, false, "a cancelled pull stays cancelled");

  // Target: left half search, right half Mari, a 28 px dead zone around the middle.
  assert.equal(pullTarget(null, 100, 390, true), "search");
  assert.equal(pullTarget(null, 300, 390, true), "mari");
  assert.equal(pullTarget("search", 215, 390, true), "search", "inside the dead zone the side holds");
  assert.equal(pullTarget("search", 224, 390, true), "mari", "past it the side switches");
  assert.equal(pullTarget("mari", 175, 390, true), "mari");
  assert.equal(pullTarget("mari", 166, 390, true), "search");
  assert.equal(pullTarget(null, 300, 390, false), "search", "without Mari the whole bar is search");

  // The circle sits above the fingertip and never above the bar edge.
  const early = pullCircleTarget(20, 0.1);
  assert.ok(early.centerY - early.radius >= -early.radius * 0.25, "early on it grows out of the bar edge");
  assert.equal(early.tag, 0, "no small bar before there is room for it");
  const full = pullCircleTarget(230, 1);
  assert.equal(full.radius, 40);
  assert.equal(full.tag, 1);
  assert.ok(full.centerY + full.radius + 8 + 30 <= 230 - 32, "the small bar ends 32 px above the touch point");
  assert.ok(pullSheetBase(40, 1, 390) > pullSheetBase(40, 0.3, 390), "the sheet widens with the pull");

  // The sheet: one symmetric outline from the bar edge to the circle, no bumps.
  const sheet = { cx: 195, cy: 120, rx: 40, ry: 40, base: 160, pinch: 0, sag: 0 };
  const { d } = pullSheetPath(sheet);
  assert.match(d, /^M35 -3L355 -3L355 0C.*A40 40 0 0 1 .*Z$/, "a stretch of the bar edge, two sides and the arc");
  const xs = [...d.replace(/A[\d.]+ [\d.]+ 0 0 1 /, "L").matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(
    xs.every((x) => x >= 35 && x <= 355),
    "nothing reaches past the sheet's base on the bar",
  );
  const mirrored = pullSheetPath({ ...sheet, cx: 200 }).d;
  assert.notEqual(mirrored, d);
  const pinched = pullSheetPath({ ...sheet, pinch: 1 });
  assert.ok(pinched.waistY > 0 && pinched.waistY < 120, "it lets go between the bar and the circle");

  // Slice 33b (M13): at the screen's sides the circle follows the finger and stays whole on screen,
  // and the sheet keeps its full width and runs off the edge instead of narrowing.
  assert.equal(pullOnScreenX(195, 40, 390), 195, "in the middle it is the finger");
  assert.equal(pullOnScreenX(2, 40, 390), 46, "at the left side it stops 6 px in, not further");
  assert.equal(pullOnScreenX(388, 40, 390), 344, "at the right side too");
  assert.equal(pullOnScreenX(60, 40, 390), 60, "near the side it still follows the finger");
  for (const x of [-20, 0, 2, 20, 370, 388, 390, 410]) {
    const cx = pullOnScreenX(x, 40, 390);
    assert.ok(cx - 40 >= 0 && cx + 40 <= 390, `the circle stays on screen for a finger at ${x}`);
  }
  const label = pullOnScreenX(46, 75, 390);
  assert.ok(label - 75 >= 0 && label + 75 <= 390, "the small bar stays on screen where the circle does");
  for (const cx of [46, 100, 195, 290, 344]) {
    const top = pullSheetPath({ ...sheet, cx }).d.match(/^M(-?[\d.]+) -3L(-?[\d.]+) -3/u);
    assert.ok(top, "the sheet starts on the bar edge");
    assert.equal(Number(top[2]) - Number(top[1]), 320, `the sheet keeps its width at cx ${cx}`);
  }
  const clientSource = (relativePath: string) =>
    readFileSync(new URL(`../../packages/client/src/${relativePath}`, import.meta.url), "utf8");
  assert.doesNotMatch(
    clientSource("hooks/use-pull-to-open-omnibar.ts"),
    /g\.width - cx/u,
    "the hook must not narrow the sheet towards the screen's sides",
  );
  // R8 (slice 62c): the rim's shimmer takes the top-bar edge's state colour, not the accent.
  assert.match(
    clientSource("components/layout/OmnibarPullDrop.tsx"),
    /stopColor: "var\(--mari-pull-rim-color\)"/u,
    "the rim's shimmer takes the edge state colour",
  );
}

{
  // Slice 13: lists, switches and one-word values read as chips; names and prose as tracked text.
  const field = (path: string, before: string, after: string) =>
    ({ path, label: path, before, after, kind: "changed" }) as const;
  assert.equal(fieldChangeStyle(field("keys", "market", "market, bazaar")), "list");
  assert.equal(fieldChangeStyle(field("data.tags", "a", "b")), "list");
  assert.equal(fieldChangeStyle(field("caseSensitive", "off", "on")), "toggle");
  assert.equal(fieldChangeStyle(field("selectiveLogic", "and_any", "not_all")), "enum");
  assert.equal(fieldChangeStyle(field("probability", "100", "50")), "enum");
  assert.equal(fieldChangeStyle(field("name", "Zylo", "Zyla")), "text", "a rename is tracked text");
  assert.equal(fieldChangeStyle(field("content", "old", "new")), "text", "prose is never chips");
  assert.equal(fieldChangeStyle(field("position", "before char", "after")), "text", "spaces mean text");

  // A review belongs to the reply of the turn it was requested in, never the transcript's end.
  const at = (minute: number) => `2026-10-01T10:${String(minute).padStart(2, "0")}:00.000Z`;
  const messages = [
    { id: "u1", role: "user", createdAt: at(0) },
    { id: "a1", role: "assistant", createdAt: at(2) },
    { id: "u2", role: "user", createdAt: at(5) },
    { id: "a2", role: "assistant", createdAt: at(5) },
    { id: "u3", role: "user", createdAt: at(9) },
  ];
  const turns = assignReviewsToTurns(messages, [
    { id: "r1", requestedAt: at(1) },
    { id: "r2", requestedAt: at(6) },
    { id: "r3", requestedAt: at(10) },
    { id: "r4", requestedAt: "not a date" },
  ]);
  assert.deepEqual(
    turns.byMessageId.get("a1")?.map((review) => review.id),
    ["r1"],
  );
  assert.deepEqual(
    turns.byMessageId.get("a2")?.map((review) => review.id),
    ["r2"],
    "the reply may predate it",
  );
  assert.deepEqual(
    turns.unassigned.map((review) => review.id),
    ["r3", "r4"],
    "a turn with no reply, or an unreadable time, stays after the transcript",
  );
}

{
  // A 120-entry lorebook delete: the preview stops at 50 rows, the card still names the lorebook
  // and counts every entry.
  const lorebookDelete = summarizeDeleteReview({
    affectedRows: 121,
    diffPreview: [
      { table: "lorebooks", action: "delete" },
      ...Array.from({ length: 49 }, () => ({ table: "lorebook_entries", action: "delete" })),
    ],
  });
  assert.equal(lorebookDelete?.parent.table, "lorebooks");
  assert.deepEqual(
    [lorebookDelete?.selected.length, lorebookDelete?.count, lorebookDelete?.linkedCount],
    [1, 121, 120],
  );
  // A section delete also edits the preset first: the edit is not a deleted row.
  const sectionDelete = summarizeDeleteReview({
    affectedRows: 2,
    diffPreview: [
      { table: "prompt_presets", action: "update" },
      { table: "prompt_sections", action: "delete" },
    ],
  });
  assert.deepEqual(
    [sectionDelete?.parent.table, sectionDelete?.count, sectionDelete?.linkedCount],
    ["prompt_sections", 1, 0],
  );
  assert.equal(summarizeDeleteReview({ affectedRows: 1, diffPreview: [{ table: "x", action: "update" }] }), null);
}

{
  // K1: a failed generate reply feeds the same "fix this" context row as a
  // failed connection test, so ⌘K surfaces it and ⌘↵ can hand it to Mari.
  const t = ((key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values?.[name] ?? ""))) as never;
  const baseInput = {
    activeChat: null,
    activeChatId: null,
    activeEditorField: null,
    agents: undefined,
    allLocalResults: [],
    characterNameById: new Map<string, string>(),
    connectionById: new Map(),
    lorebooks: undefined,
    mariEnabled: false,
    omnibarSuggestionsEnabled: false,
    openAgentId: null,
    openCharacterId: null,
    openConnectionId: null,
    openLorebookId: null,
    openPersonaId: null,
    openPresetId: null,
    personaById: new Map(),
    personas: undefined,
    presets: undefined,
    surface: "home" as const,
    t,
  };
  const withoutError = buildOmnibarContextResults({ ...baseInput, lastAppError: null });
  assert.equal(
    withoutError.some((row) => row.id === "connection:conn-1"),
    false,
    "no failure, no fix-this row",
  );
  const withGenerateFailure = buildOmnibarContextResults({
    ...baseInput,
    lastAppError: {
      message: "The connection timed out.",
      action: "Generate reply",
      retry: { kind: "open-connection", id: "conn-1" },
    },
  });
  const fixRow = withGenerateFailure[0];
  assert.equal(fixRow?.id, "connection:conn-1", "the error row leads, same as a failed connection test");
  assert.equal(fixRow?.title, "Fix: Generate reply failed");
  assert.equal(fixRow?.description, "The connection timed out.");
}

{
  // L2: a failed agent run feeds the same "fix this" context row, but keyed on
  // "agent:<type>" so Enter opens the agent editor instead of a connection.
  const t = ((key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values?.[name] ?? ""))) as never;
  const baseInput = {
    activeChat: null,
    activeChatId: null,
    activeEditorField: null,
    agents: undefined,
    allLocalResults: [],
    characterNameById: new Map<string, string>(),
    connectionById: new Map(),
    lorebooks: undefined,
    mariEnabled: false,
    omnibarSuggestionsEnabled: false,
    openAgentId: null,
    openCharacterId: null,
    openConnectionId: null,
    openLorebookId: null,
    openPersonaId: null,
    openPresetId: null,
    personaById: new Map(),
    personas: undefined,
    presets: undefined,
    surface: "home" as const,
    t,
  };
  const withAgentFailure = buildOmnibarContextResults({
    ...baseInput,
    lastAppError: {
      message: "Illustrator failed: Timeout: the request took too long.",
      action: "Run Illustrator",
      retry: { kind: "open-agent", id: "illustrator" },
    },
  });
  const agentFixRow = withAgentFailure[0];
  assert.equal(agentFixRow?.id, "agent:illustrator", "keyed on the agent type, not a connection id");
  assert.equal(agentFixRow?.category, "agent");
  assert.equal(agentFixRow?.title, "Fix: Run Illustrator failed");
}

{
  // K2: recent-chat rows show a relative time ("5m ago") instead of an
  // absolute date, with a fixed `now` for determinism.
  const t = ((key: string, fallback: string) => fallback) as never;
  const now = new Date("2026-10-01T12:00:00.000Z").getTime();
  const chat: Chat = {
    id: "chat-1",
    name: "A story so far",
    mode: "roleplay",
    characterIds: [],
    groupId: null,
    personaId: null,
    personaCharacterId: null,
    promptPresetId: null,
    connectionId: null,
    connectedChatId: null,
    folderId: null,
    sortOrder: 0,
    lastMessageAt: "2026-10-01T11:55:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-10-01T11:55:00.000Z",
    metadata: { summary: null },
  };
  const [row] = buildOmnibarChatRows({
    chats: [chat],
    characterById: new Map(),
    connectionById: new Map(),
    personaById: new Map(),
    chatModeLabels: { conversation: "Conversation", roleplay: "Roleplay", game: "Game" },
    t,
    now,
  });
  const updatedFact = row?.preview().facts.find((fact) => fact.label === "Last updated");
  assert.equal(updatedFact?.value, "5m ago", "relative time, not an absolute date");
  // Slice 22 fix: the relative time also shows on the collapsed Recent row,
  // not only in the expanded preview's "Last updated" fact.
  assert.equal(row?.preview().metadataLine, "5m ago", "relative time also shows on the collapsed row's second line");
}

{
  // K3: on the chat surface, rows reach the existing Summary, Active lorebook
  // entries, Peek prompt, Search this chat and Regenerate UI. Continue already
  // reaches the chat through the idle "/continue" slash row, so it gets no new
  // row here.
  const t = ((key: string, fallback: string) => fallback) as never;
  const roleplayChat: Chat = {
    id: "chat-1",
    name: "A story so far",
    mode: "roleplay",
    characterIds: [],
    groupId: null,
    personaId: null,
    personaCharacterId: null,
    promptPresetId: null,
    connectionId: null,
    connectedChatId: null,
    folderId: null,
    sortOrder: 0,
    lastMessageAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    metadata: { summary: null },
  };
  const conversationChat: Chat = { ...roleplayChat, mode: "conversation" };
  const toolBaseInput = {
    activeChatId: "chat-1",
    activeEditorField: null,
    agents: undefined,
    allLocalResults: [],
    characterNameById: new Map<string, string>(),
    connectionById: new Map(),
    lastAppError: null,
    lorebooks: undefined,
    mariEnabled: false,
    omnibarSuggestionsEnabled: false,
    openAgentId: null,
    openCharacterId: null,
    openConnectionId: null,
    openLorebookId: null,
    openPersonaId: null,
    openPresetId: null,
    personaById: new Map(),
    personas: undefined,
    presets: undefined,
    t,
  };
  const toolIds = (rows: OmnibarResult[]) => rows.filter((row) => row.id.startsWith("chat-tool:")).map((row) => row.id);

  const roleplayOnChatSurface = buildOmnibarContextResults({
    ...toolBaseInput,
    activeChat: roleplayChat,
    surface: "chat",
  });
  assert.deepEqual(
    toolIds(roleplayOnChatSurface),
    [
      "chat-tool:search:chat-1",
      "chat-tool:lorebook:chat-1",
      "chat-tool:summary:chat-1",
      "chat-tool:advanced-parameters:chat-1",
      "chat-tool:memory-recall:chat-1",
      "chat-tool:regenerate:chat-1",
    ],
    "roleplay on the chat surface gets all six tool rows, Summary and the two settings rows included",
  );
  const summaryRow = roleplayOnChatSurface.find((row) => row.id === "chat-tool:summary:chat-1");
  assert.deepEqual(summaryRow?.action, { kind: "open-chat-tool", chatId: "chat-1", tool: "summary" });

  const conversationOnChatSurface = buildOmnibarContextResults({
    ...toolBaseInput,
    activeChat: conversationChat,
    surface: "chat",
  });
  assert.deepEqual(
    toolIds(conversationOnChatSurface),
    [
      "chat-tool:search:chat-1",
      "chat-tool:lorebook:chat-1",
      "chat-tool:advanced-parameters:chat-1",
      "chat-tool:memory-recall:chat-1",
      "chat-tool:regenerate:chat-1",
    ],
    "conversation mode has no Summary feature, so no Summary row",
  );

  // Slice 22 fix: game mode has its own turn-retry reset (GameSurface's
  // handleRetryTurn) and no listener for CHAT_SEARCH_OPEN_REQUEST_EVENT, so
  // the plain regenerate/search rows must not be offered there.
  const gameChat: Chat = { ...roleplayChat, mode: "game" };
  const gameOnChatSurface = buildOmnibarContextResults({
    ...toolBaseInput,
    activeChat: gameChat,
    surface: "chat",
  });
  assert.deepEqual(
    toolIds(gameOnChatSurface),
    ["chat-tool:lorebook:chat-1"],
    "game mode gets only the lorebook tool row, not search or regenerate",
  );

  // R2 (slice 61): a reply finding puts "Fix: Check the last reply" first in the chat's rows; a
  // setup-only finding (a large card) does not, and game mode has no quiet line to open.
  const cutOff = {
    code: "cut_off" as const,
    text: "",
    values: {},
    link: { kind: "chat-settings" as const, section: "advanced-parameters" as const },
  };
  const largeCard = { ...cutOff, code: "card_large" as const };
  const withCheckup = buildOmnibarContextResults({
    ...toolBaseInput,
    activeChat: roleplayChat,
    surface: "chat",
    lastReplyFindings: [cutOff, largeCard],
  });
  assert.equal(withCheckup[0]?.id, "chat-tool:reply-checkup:chat-1", "the reply checkup row leads the chat rows");
  assert.deepEqual(withCheckup[0]?.action, { kind: "open-chat-tool", chatId: "chat-1", tool: "reply-checkup" });
  assert.equal(withCheckup[0]?.description, "Cut off", "only reply findings are named on the row");
  for (const [chat, findings, why] of [
    [roleplayChat, [largeCard], "a large card alone is a setup fact, not a reply fix"],
    [gameChat, [cutOff], "game mode has no quiet line to open"],
  ] as const) {
    const rows = buildOmnibarContextResults({
      ...toolBaseInput,
      activeChat: chat,
      surface: "chat",
      lastReplyFindings: findings,
    });
    assert.ok(!rows.some((row) => row.id.startsWith("chat-tool:reply-checkup:")), why);
  }

  const roleplayOffChatSurface = buildOmnibarContextResults({
    ...toolBaseInput,
    activeChat: roleplayChat,
    surface: "home",
  });
  assert.deepEqual(toolIds(roleplayOffChatSurface), [], "tool rows only show on the chat surface");
}

{
  // Q2: the omnibar's settings view is the home of every search and Professor Mari setting. Jumps
  // to its section or its controls route there; every control it lists has an anchor in the view.
  const omnibarControls = SETTINGS_SEARCHABLE_CONTROLS.filter(
    (control) => control.sectionId === OMNIBAR_SETTINGS_SECTION_ID,
  );
  assert.ok(SETTINGS_SECTIONS.some((section) => section.id === OMNIBAR_SETTINGS_SECTION_ID));
  for (const id of [
    "mini-mari",
    "professor-mari-suggestions",
    "mari-permissions-mode",
    "mari-send-on-enter",
    "quick-answers",
    "quick-answer-model",
    "quick-answer-delay",
    "mari-appearance-pack",
  ]) {
    assert.ok(
      omnibarControls.some((control) => control.id === id),
      `${id} lives in the omnibar settings section`,
    );
    assert.equal(isOmnibarSettingsTarget({ controlId: id }), true, `${id} opens the omnibar settings`);
  }
  assert.equal(isOmnibarSettingsTarget({ sectionId: OMNIBAR_SETTINGS_SECTION_ID }), true);
  assert.equal(isOmnibarSettingsTarget({ controlId: "send-on-enter" }), false, "chat Send on Enter stays in Settings");
  assert.equal(isOmnibarSettingsTarget({ sectionId: "application" }), false);
  assert.equal(isOmnibarSettingsTarget({}), false);
  const view = readFileSync(
    new URL("../../packages/client/src/components/layout/omnibar/OmnibarSettingsMenu.tsx", import.meta.url),
    "utf8",
  );
  for (const control of omnibarControls) {
    assert.ok(view.includes(`"${control.id}"`), `omnibar settings view has an anchor for ${control.id}`);
  }
}

{
  // K5: every `OMNIBAR_SETTINGS_TOGGLE_BINDINGS` id must name a real `Toggle`
  // control in the registry — a stale or mistyped id would silently never
  // render (buildOmnibarControlResults only attaches a control when
  // `getOmnibarSettingsDestinations` produces a matching controlId) rather
  // than fail loudly, so this checks the binding map against the registry
  // directly.
  const toggleControlIds = new Set(
    SETTINGS_SEARCHABLE_CONTROLS.filter((control) => control.kind === "Toggle").map((control) => control.id),
  );
  for (const id of Object.keys(OMNIBAR_SETTINGS_TOGGLE_BINDINGS)) {
    assert.ok(toggleControlIds.has(id), `bound settings toggle id "${id}" is not a Toggle control in the registry`);
  }

  // A bound id's settings-control row gets a toggle control, wired to the
  // value the caller passed in (a reactive store read happens outside this
  // pure builder); an unbound id keeps navigating instead.
  const t = ((key: string, fallback: string) => fallback) as never;
  const boundId = "achievements";
  assert.ok(
    OMNIBAR_SETTINGS_TOGGLE_BINDINGS[boundId],
    "achievements should stay bound for this assertion to mean anything",
  );
  const settingsToggleValues: Record<string, boolean> = {};
  for (const id of Object.keys(OMNIBAR_SETTINGS_TOGGLE_BINDINGS)) settingsToggleValues[id] = id === boundId;
  const controlResults = buildOmnibarControlResults({
    localize: (text) => text,
    musicPlayerEnabled: false,
    notificationSoundsOnlyWhenUnfocused: false,
    reduceAmbientEffects: false,
    settingsToggleValues,
    setters: {
      setTheme: () => {},
      setUserStatusManual: () => {},
      setReduceAmbientEffects: () => {},
      setMusicPlayerEnabled: () => {},
      setSpeechToTextEnabled: () => {},
      setNotificationSoundsOnlyWhenUnfocused: () => {},
      setShowTimestamps: () => {},
      setShowModelName: () => {},
      setShowTokenUsage: () => {},
    },
    showModelName: false,
    showTimestamps: false,
    showTokenUsage: false,
    speechToTextEnabled: false,
    t,
    theme: "dark",
    userStatus: "active",
  });
  const boundRow = controlResults.find((row) => row.id === "settings-control:achievements");
  assert.ok(boundRow, "achievements settings-control row should exist");
  assert.equal(boundRow?.control?.type, "toggle", "a bound registry id gets a toggle control, not navigation only");
  assert.equal(boundRow?.control?.value, true, "the toggle reflects the value the caller passed in");
  let flippedTo: boolean | undefined;
  const originalSet = OMNIBAR_SETTINGS_TOGGLE_BINDINGS[boundId].set;
  OMNIBAR_SETTINGS_TOGGLE_BINDINGS[boundId].set = (value: boolean) => {
    flippedTo = value;
  };
  try {
    boundRow?.control?.onChange(false);
    assert.equal(flippedTo, false, "picking the row calls the binding's set, not a different setter");
  } finally {
    OMNIBAR_SETTINGS_TOGGLE_BINDINGS[boundId].set = originalSet;
  }

  const sectionRow = controlResults.find((row) => row.id === "settings-section-detail:application");
  assert.equal(sectionRow?.control, undefined, "a row with no bound controlId still just navigates");

  // Slice 22 fix: these ids delete, spend money, or change security, so K5's
  // exclusion rule means they must never be in the binding map — they should
  // keep navigating to Settings instead of flipping in place.
  const deniedIds = [
    "confirm-before-delete",
    "debug-mode",
    "include-private-notes-in-exports",
    "include-reasoning-in-exports",
    "image-prompt-review",
  ];
  for (const id of deniedIds) {
    assert.ok(!(id in OMNIBAR_SETTINGS_TOGGLE_BINDINGS), `"${id}" must not be bound (risky per K5)`);
  }

  // F6: "Ask Professor Mari from Search" and "Context suggestions" must show up as exactly one row (the
  // registry row, flipped in place), not also as the old hand-built duplicate.
  assert.ok("ask-mari" in OMNIBAR_SETTINGS_TOGGLE_BINDINGS, "ask-mari should be bound so its row flips in place");
  assert.ok(
    "omnibar-suggestions" in OMNIBAR_SETTINGS_TOGGLE_BINDINGS,
    "omnibar-suggestions should be bound so its row flips in place",
  );
  assert.ok(
    !controlResults.some((row) => row.id === "control:commandCenterMariEnabled"),
    "the hand-built Ask Mari row must be gone now that the registry row is bound",
  );
  assert.ok(
    !controlResults.some((row) => row.id === "control:omnibarSuggestionsEnabled"),
    "the hand-built Context suggestions row must be gone now that the registry row is bound",
  );
}

// L1: `agent.runs` must be classified read-only so it never arms the mutation gate.
{
  assert.ok(appDataActionLooksReadOnly("agent.runs"), "agent.runs should be read-only");
  assert.ok(!appDataActionLooksReadOnly("agent.create"), "agent.create must stay a write action");
  assert.ok(!appDataActionLooksReadOnly("agent.update"), "agent.update must stay a write action");
}

// R3: `chat.diagnose` must be classified read-only so it never arms the mutation gate.
{
  assert.ok(appDataActionLooksReadOnly("chat.diagnose"), "chat.diagnose should be read-only");
}

// L4: `lorebook.testScan` must be classified read-only, and `buildProfessorMariCommandCenterContext`
// must resolve a lorebook-entry row's id to the lorebookId (not the lorebookId:entryId pair glued
// together) - the existing lorebook-attachment UI resolves `resource.id` as a lorebookId and shows
// "no longer available" otherwise. The entry's own name still travels as `resource.label`.
{
  assert.ok(appDataActionLooksReadOnly("lorebook.testScan"), "lorebook.testScan should be read-only");
  assert.ok(!appDataActionLooksReadOnly("lorebook.updateEntry"), "lorebook.updateEntry must stay a write action");

  const entryContext = buildProfessorMariCommandCenterContext("why didn't Harbor fire", {
    id: "lorebook-entry:book-1:entry-7",
    title: "Harbor",
    category: "lorebook",
  });
  assert.deepEqual(
    entryContext.resource,
    { kind: "lorebook", id: "book-1", label: "Harbor" },
    "a lorebook-entry row's resource id is the lorebookId, not the lorebookId:entryId pair",
  );
}

// L1: the merged agent list surfaces a type from the installed registry that has no
// agent_configs row (never configured) and keeps a custom agent that has no registry entry.
{
  const registryOnlyManifest: BuiltInAgentManifest = {
    id: "registry-only-agent",
    name: "Registry Only Agent",
    description: "Ships with a package, never configured by the user.",
    phase: "post_processing",
    enabledByDefault: true,
    category: "misc",
    packageId: "example-package",
    defaultPromptTemplate: "Do the thing.",
    defaultSettings: { exampleKey: "exampleValue" },
  };
  const registryOnlyRow = summarizeMergedAgentRow(registryOnlyManifest, undefined);
  assert.equal(registryOnlyRow.type, "registry-only-agent", "a registry-only type keeps its id");
  assert.equal(registryOnlyRow.custom, false, "a registry entry is never reported as custom");
  assert.equal(registryOnlyRow.enabled, true, "an unconfigured registry agent falls back to enabledByDefault");
  assert.deepEqual(
    registryOnlyRow.settingKeys,
    ["exampleKey"],
    "setting keys come from the manifest default, names only",
  );
  assert.ok(!("settings" in registryOnlyRow), "setting values are never exposed, only key names");
  assert.equal(registryOnlyRow.id, null, "an unconfigured registry agent has no config id to update with");

  const customConfigRow = {
    id: "cfg-1",
    type: "my-custom-agent",
    name: "My Custom Agent",
    description: "Reviews scenes for tone drift.",
    phase: "parallel",
    enabled: "true",
    promptTemplate: "Custom prompt.",
    settings: JSON.stringify({ secretApiKey: "shh" }),
  };
  const customRow = summarizeMergedAgentRow(undefined, customConfigRow);
  assert.equal(customRow.custom, true, "a type absent from the registry is a custom agent");
  assert.equal(customRow.packageId, null, "a custom agent has no package");
  assert.deepEqual(
    customRow.settingKeys,
    ["secretApiKey"],
    "setting keys, not values, are reported for a custom agent",
  );
  // #L7 review: agent.update requires an id - a merged row with no id breaks the list-then-edit
  // flow (L3) because there is nothing to call agent.update with.
  assert.equal(customRow.id, "cfg-1", "a configured agent's config id must survive into the merged row");
  assert.equal(
    customRow.description,
    "Reviews scenes for tone drift.",
    "the config row's description must survive too",
  );

  const overriddenRow = summarizeMergedAgentRow(registryOnlyManifest, {
    ...customConfigRow,
    type: "registry-only-agent",
    promptTemplate: "A different prompt than the package default.",
  });
  assert.equal(
    overriddenRow.promptOverridden,
    true,
    "a prompt that differs from the package default is flagged overridden",
  );
  const unmodifiedRow = summarizeMergedAgentRow(registryOnlyManifest, {
    ...customConfigRow,
    type: "registry-only-agent",
    promptTemplate: "Do the thing.",
  });
  assert.equal(unmodifiedRow.promptOverridden, false, "a prompt matching the package default is not overridden");
}

// L3: the agent editor is Mari context. The "Editing" row leads the Improve row, so an unpinned
// handoff carries the agent with the field; a custom agent (opened by config id) and a built-in
// (opened by type) both get the row.
{
  const t = ((key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values?.[name] ?? ""))) as never;
  const agents = [
    { id: "cfg-1", type: "my-custom-agent", name: "Scene Critic" },
    { id: "cfg-2", type: "illustrator", name: "Illustrator" },
  ] as never;
  const input = {
    activeChat: null,
    activeChatId: null,
    activeEditorField: { label: "Prompt Template" },
    agents,
    allLocalResults: [],
    characterNameById: new Map<string, string>(),
    connectionById: new Map(),
    lastAppError: null,
    lorebooks: undefined,
    mariEnabled: true,
    omnibarSuggestionsEnabled: true,
    openAgentId: "cfg-1",
    openCharacterId: null,
    openConnectionId: null,
    openLorebookId: null,
    openPersonaId: null,
    openPresetId: null,
    personaById: new Map(),
    personas: undefined,
    presets: undefined,
    surface: "editor" as const,
    t,
  };
  const customRows = buildOmnibarContextResults(input);
  assert.deepEqual(
    customRows.map((row) => row.id),
    ["agent:cfg-1", "suggestion:edit-focused-field"],
    "the open custom agent leads, then the focused-field row",
  );
  assert.equal(customRows[0]?.title, "Editing Scene Critic");
  assert.equal(customRows[1]?.title, "Improve Prompt Template with Prof. Mari");
  const builtInRows = buildOmnibarContextResults({ ...input, openAgentId: "illustrator" });
  assert.equal(builtInRows[0]?.id, "agent:illustrator", "a built-in opened by type gets its Editing row");

  // An agent edit reads as tracked prose; its nested settings JSON stays behind Raw.
  const agentFields = computeFieldChanges({
    table: "agent_configs",
    id: "cfg-1",
    action: "update",
    before: {
      promptTemplate: "Critique",
      settings: { activationQuestion: "Did the scene change?", promptTemplates: [{ id: "a", prompt: "x" }] },
    },
    after: {
      promptTemplate: "Praise",
      settings: { activationQuestion: "{{char}} left?", promptTemplates: [{ id: "a", prompt: "y" }] },
    },
  });
  assert.deepEqual(
    agentFields.map((field) => field.label),
    ["Prompt Template", "Activation Question"],
    "promptTemplate and a plain setting show; the JSON setting does not",
  );
  assert.equal(fieldChangeStyle(agentFields[0]!), "text", "a one-word prompt is prose, not an enum chip");

  // L6: a reply fix names its chat and shows only the content as a change.
  const replyChange = {
    table: "messages",
    id: "msg-1",
    action: "update" as const,
    before: { chatId: "chat-1", chatName: "Harbor Night", content: "The door creaked open and she sa" },
    after: { chatId: "chat-1", chatName: "Harbor Night", content: "The door creaked open and she said nothing." },
  };
  assert.deepEqual(replyFixChat(replyChange), { id: "chat-1", name: "Harbor Night" });
  assert.equal(replyFixChat({ ...replyChange, table: "agent_configs" }), null, "only a messages change is a reply fix");
  assert.deepEqual(
    computeFieldChanges(replyChange).map((field) => [field.path, fieldChangeStyle(field)]),
    [["content", "text"]],
    "the chat label never reads as a changed field",
  );
}

// L5: `chat.updateMessage` must classify as a write (never read-only), and a raw `mari db` write
// to `messages`/`message_swipes` must be refused with a pointer to it. The full apply/Keep/Restore
// swipe flow (addSwipe reuse, forced review in Accept-edits/Bypass, chat-storage restore) is
// integration-level and lives in scripts/regressions/mari/chat-update-message.regression.ts, which
// needs a real file-backed DB that this pure-logic file never sets up.
{
  assert.ok(!appDataActionLooksReadOnly("chat.updateMessage"), "chat.updateMessage must stay a write action");
  assert.throws(
    () => guardRawMessageTableWrite("messages"),
    /chat\.updateMessage/,
    "a raw write to messages must be refused and point at chat.updateMessage",
  );
  assert.throws(
    () => guardRawMessageTableWrite("message_swipes"),
    /chat\.updateMessage/,
    "a raw write to message_swipes must be refused and point at chat.updateMessage",
  );
  assert.doesNotThrow(
    () => guardRawMessageTableWrite("characters"),
    "the guard must not block writes to unrelated tables",
  );
  // `transform all` runs over every table except the refused message tables, instead of always throwing.
  const allTables = resolveTransformTables("all");
  assert.ok(
    allTables.includes("characters") && !allTables.includes("messages") && !allTables.includes("message_swipes"),
  );
  assert.throws(() => resolveTransformTables("messages"), /chat\.updateMessage/);
}

// L8 (slice 28b): the omnibar and Mari sit above every app overlay through ONE layer,
// `--mari-layer-omnibar`. No other numeric z-index in the client may reach it, except a few
// deliberate, known exceptions above it: user extension windows/menus (they sit near 2^31 and
// above the sonner toaster too, so outranking them would need the toaster moved as well) and the
// touch folder-drag ghost. Sonner's toaster (999999999) stays above
// the layer so Undo toasts remain visible over the omnibar.
{
  const clientSource = (relativePath: string) =>
    readFileSync(new URL(`../../packages/client/src/${relativePath}`, import.meta.url), "utf8");
  // Slice 82: Mari's rules (the layer token and the sprite ghost) moved from globals.css to mari.css.
  const layer = Number(/--mari-layer-omnibar:\s*(\d+);/u.exec(clientSource("styles/mari.css"))?.[1]);
  assert.ok(layer > 10_050, "the omnibar layer must clear the highest app overlay (the chat help overlay)");
  assert.ok(layer < 999_999_999, "the sonner toaster (999999999) must stay above the omnibar layer");
  const aboveLayerAllowed = new Set([
    "components/layout/PersonalExtensionContributionsMenu.tsx",
    "components/layout/PersonalExtensionInjector.tsx",
    "hooks/use-touch-folder-drag.ts",
  ]);
  // Slice 82: the end-of-run sprite puff (.mari-sprite-ghost, the one exempt CSS value) had no user
  // left and was deleted, so any z-index at or above the layer in a stylesheet now fails this check.
  const files = readdirSync(new URL("../../packages/client/src/", import.meta.url), {
    recursive: true,
    encoding: "utf8",
  }).filter((file) => /\.(tsx?|css)$/u.test(file));
  const offenders = files.flatMap((file) => {
    const normalizedFile = file.replaceAll("\\", "/");
    if (aboveLayerAllowed.has(normalizedFile)) return [];
    const source = clientSource(file);
    return [...source.matchAll(/z-\[(\d+)\]|zIndex:\s*"?(\d+)|z-index:\s*(\d+)|Z_INDEX\s*=\s*"?(\d+)/gu)]
      .map((match) => Number(match[1] ?? match[2] ?? match[3] ?? match[4]))
      .filter((value) => value >= layer)
      .map((value) => `${file}: ${value}`);
  });
  assert.deepEqual(offenders, [], "a numeric z-index at or above the omnibar layer would cover the omnibar");

  // Slice 15's "no pull under a modal" guard was dropped on purpose (L8): the pull and ⌘K now open
  // ON TOP of a dialog. The guard must not come back.
  const pullSource = clientSource("hooks/use-pull-to-open-omnibar.ts");
  const pullGuard = pullSource.slice(pullSource.indexOf("function pullBlocked"), pullSource.indexOf("const clamp ="));
  assert.ok(pullGuard.includes("ui.omnibarOpen"), "the pull guard should still be found by this check");
  assert.doesNotMatch(pullGuard, /isModalOverlayOpen|ui\.modal/u, "the pull must open over a dialog, not stand down");
  const hostSource = clientSource("components/layout/GlobalOmnibarHost.tsx");
  const shortcutBranch = hostSource.slice(
    hostSource.indexOf("if (isOmnibarShortcut(event))"),
    hostSource.indexOf("isShortcutsHelpKey(event) &&"),
  );
  assert.doesNotMatch(shortcutBranch, /isModalOverlayOpen|ui\.modal\b/u, "⌘K must open over a dialog");

  // R22: over the game setup wizard the handoff comes from the game-setup door with the step as a label.
  const wizardContext = buildProfessorMariCommandCenterContext("how do I pick a model here", null, [], undefined, {
    field: "Connection",
    source: "game-setup",
  });
  assert.equal(wizardContext.source, "game-setup");
  assert.equal(wizardContext.field, "Connection");
  assert.equal(wizardContext.fieldId, undefined, "the wizard step travels as a label, never an id");
  assert.equal(wizardContext.resource, undefined);
}

// M4 (slice 31): the question goes to the top once on send, growth follows only while the reader is
// at the bottom, completion never moves the scroll position on its own, and a reader who scrolls away
// from the bottom stops following.
{
  assert.equal(
    transcriptScrollAction({ event: "send", nearBottom: true, following: true }).scrollTo,
    "top",
    "sending a message must place the question at the top",
  );
  assert.equal(
    transcriptScrollAction({ event: "send", nearBottom: true, following: true }).following,
    false,
    "following must start false after a send - it only turns on once the reader reaches the bottom",
  );
  assert.equal(
    transcriptScrollAction({ event: "grow", nearBottom: true, following: true }).scrollTo,
    "bottom",
    "growth while following must keep pinning to the newest output",
  );
  assert.equal(
    transcriptScrollAction({ event: "grow", nearBottom: false, following: false }).scrollTo,
    null,
    "growth while not following must never scroll - that is the jump back to the question",
  );
  assert.equal(
    transcriptScrollAction({ event: "grow", nearBottom: false, following: true }).scrollTo,
    null,
    "growth must trust the live DOM, not a stale following flag - a reader who just scrolled away must not get pulled back",
  );
  assert.equal(
    transcriptScrollAction({ event: "complete", nearBottom: true, following: true }).scrollTo,
    null,
    "a completed run must never scroll on its own, whatever the reader's position",
  );
  assert.equal(
    transcriptScrollAction({ event: "complete", nearBottom: false, following: false }).scrollTo,
    null,
    "a completed run must never scroll a reader who had scrolled away either",
  );
  assert.equal(
    transcriptScrollAction({ event: "user-scroll", nearBottom: false, following: true }).following,
    false,
    "scrolling away from the bottom must stop following",
  );
  assert.equal(
    transcriptScrollAction({ event: "user-scroll", nearBottom: true, following: false }).following,
    true,
    "scrolling back to the bottom must resume following",
  );
}

{
  // M5b (slice 37): a next-step card's fact line and its at-once action, from the model's suggestion JSON.
  const [summary, open, generic, bogus] = sanitizeMariSuggestionChips([
    { label: "Summarize the chat", prompt: "Summarize it.", detail: "  38 messages since\nyour last summary " },
    {
      label: "Open Zylo",
      prompt: "Open Zylo.",
      fact: "Greeting is 14 words now",
      action: { kind: "resource", resource: "character", id: "char-zylo" },
    },
    { label: "Tighten its prompt", prompt: "Tighten it." },
    { label: "Run it", prompt: "Run it.", action: { kind: "resource", resource: "chat", id: "x" } },
  ]);
  assert.equal(summary.detail, "38 messages since your last summary", "a valid fact line is kept on one line");
  assert.equal(summary.action, undefined, "a card without an action asks Mari");
  assert.equal(open.detail, "Greeting is 14 words now", "the fact alias is accepted");
  assert.deepEqual(open.action, { kind: "resource", resource: "character", id: "char-zylo" });
  assert.equal(generic.detail, undefined, "a suggestion without a fact keeps no detail, not an empty line");
  assert.equal(
    bogus.action,
    undefined,
    "an action the client cannot run is dropped; the card falls back to its prompt",
  );
  const [long] = sanitizeMariSuggestionChips([{ label: "Check entries", prompt: "Check.", detail: "x".repeat(200) }]);
  assert.equal(long.detail?.length, 80, "an overlong fact is bounded to one short line");
  assert.ok(long.detail?.endsWith("…"), "a cut fact shows it was cut");
  const [blank] = sanitizeMariSuggestionChips([
    { label: "Peek prompt", prompt: "Peek.", detail: "   ", action: { kind: "peek-prompt", chatId: "" } },
  ]);
  assert.equal(blank.detail, undefined, "a blank fact is dropped");
  assert.equal(blank.action, undefined, "an action without its id is dropped");
  const [peek, start, panel] = sanitizeMariSuggestionChips([
    { label: "Peek prompt", prompt: "Peek.", action: { kind: "peek-prompt", chatId: "chat-1" } },
    { label: "Start a chat", prompt: "Start.", action: { kind: "start-chat", characterId: "char-1" } },
    { label: "Pick a connection", prompt: "Pick.", action: { kind: "panel", panel: "connections" } },
  ]);
  assert.deepEqual(peek.action, { kind: "peek-prompt", chatId: "chat-1" });
  assert.deepEqual(start.action, { kind: "start-chat", characterId: "char-1" });
  assert.deepEqual(panel.action, { kind: "panel", panel: "connections" });
}

{
  // M10: the server always stores a string trace output on disk, but a stored
  // record with any other `output` must not pass the type guard - a downstream
  // `string.indexOf` call on it would crash the omnibar instead of just
  // dropping the malformed item.
  const toolBase = { id: "tool-1", name: "character.get", status: "done" } as const;
  for (const output of [{ foo: "bar" }, 42]) {
    assert.equal(
      isWorkspaceTraceItem({ type: "tool", tool: { ...toolBase, output } }),
      false,
      `a non-string output (${typeof output}) is rejected`,
    );
  }
  assert.equal(
    isWorkspaceTraceItem({ type: "tool", tool: { ...toolBase, output: null } }),
    true,
    "a null output is accepted",
  );
  assert.equal(
    isWorkspaceTraceItem({ type: "tool", tool: { ...toolBase, output: undefined } }),
    true,
    "a missing output is accepted",
  );
  assert.equal(
    isWorkspaceTraceItem({ type: "tool", tool: { ...toolBase, output: "stdout:\n{}" } }),
    true,
    "a string output is accepted",
  );
}

// M9: Mari's arrival, per surface, built from names/counts/times only. No model call is made to build it,
// and it can never carry message text: the data types have no content, and a smuggled one is not read.
{
  const t: MariArrivalData["t"] = (_key, fallback, options) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options?.[name] ?? ""));
  const now = Date.parse("2026-10-02T12:00:00Z");
  const SECRET = "SECRET-MESSAGE-TEXT";
  const chatContext = createOmnibarContext({
    surface: "chat",
    activeChat: { id: "chat-1", mode: "roleplay", resultIds: [] },
  });
  const chatData = (overrides: Partial<NonNullable<MariArrivalData["chat"]>> = {}): MariArrivalData => ({
    t,
    now,
    chat: {
      name: "Neon Harbor",
      mode: "roleplay",
      characters: [{ id: "c1", name: "Zylo" }],
      lorebooks: [{ id: "lb1", name: "Harbor lore" }],
      messageCount: 214,
      // A message object as the cache holds it, content and all: the builder must ignore the content.
      lastReply: { createdAt: "2026-10-02T11:57:00Z", finishReason: "length", content: SECRET } as never,
      messagesSinceSummary: 38,
      activeEntries: 3,
      ...overrides,
    },
  });
  const chat = buildMariArrival(chatContext, chatData())!;
  assert.equal(chat.line, "You're in Neon Harbor with Zylo.");
  assert.equal(chat.strong, "Neon Harbor");
  assert.deepEqual(
    chat.cards.map((card) => card.id),
    ["arrival:fix-reply", "arrival:why-entry", "arrival:summarize", "arrival:peek-prompt"],
    "chat: fix (cut off), why an entry, summarize since, peek",
  );
  assert.deepEqual(chat.cards.at(-1)?.action, { kind: "peek-prompt", chatId: "chat-1" }, "peek acts at once");
  // Q5: its fact line says what it shows, not "Opens now" again (the row's › says that).
  assert.equal(chat.cards.at(-1)?.detail, "What Zylo gets next turn");
  assert.ok(
    chat.cards.slice(0, 3).every((card) => !card.action),
    "the others ask Mari",
  );
  assert.ok(
    chat.meta.some((fact) => fact.includes("214")),
    "message count in the meta line",
  );
  assert.deepEqual(
    chat.refs.map((ref) => `${ref.kind}:${ref.id}`),
    ["character:c1", "lorebook:lb1"],
  );
  assert.ok(!JSON.stringify(chat).includes(SECRET), "the arrival reads no message text");
  assert.doesNotMatch(
    readFileSync(new URL("../../packages/client/src/lib/mari-arrival.ts", import.meta.url), "utf8"),
    /\.content\b|\bcontent\s*[:?]/u,
    "the arrival builder never touches a message's content",
  );
  const clean = buildMariArrival(
    chatContext,
    chatData({ lastReply: { createdAt: "2026-10-02T11:57:00Z", finishReason: "stop" }, lorebooks: [] }),
  )!;
  assert.ok(
    !clean.cards.some((card) => card.id === "arrival:fix-reply"),
    "no fix card for a reply that ended normally",
  );
  assert.ok(
    !clean.cards.some((card) => card.id === "arrival:why-entry"),
    "no lorebook card without an active lorebook",
  );
  const failed = buildMariArrival(chatContext, { ...chatData({ lastReply: null }), replyFailed: true })!;
  assert.equal(failed.cards[0]?.id, "arrival:fix-reply", "a failed generation leads with the fix");
  assert.equal(
    isMariReplyFailure({ action: "Generate reply", chatId: "chat-2" }, "chat-1"),
    false,
    "a reply failure in a different chat does not offer Fix the last reply here",
  );
  assert.equal(
    isMariReplyFailure({ action: "Generate reply", chatId: "chat-1" }, "chat-1"),
    true,
    "a reply failure in this chat does offer Fix the last reply",
  );
  const foreignChatFailed = buildMariArrival(chatContext, {
    ...chatData({ lastReply: null }),
    replyFailed: isMariReplyFailure({ action: "Generate reply", chatId: "chat-2" }, "chat-1"),
  })!;
  assert.ok(
    !foreignChatFailed.cards.some((card) => card.id === "arrival:fix-reply"),
    "a foreign chat's reply failure never surfaces as this arrival's fix card",
  );
  const empty = buildMariArrival(chatContext, chatData({ messageCount: 0, lastReply: null, lorebooks: [] }))!;
  assert.ok(empty.cards.length >= 2 && empty.cards.length <= 4, "an empty chat still gets 2-4 cards");

  // N6/A5 (R22): the arrival may say a reply failed, but the error text reaches Mari only through
  // a deliberate Fix pick (an explicit `fix` flag at the GlobalOmnibar `buildAskContext` call site)
  // — never merely because the fallback focus happens to land on the same id as the Fix row. A
  // built-in agent's editor row and Fix row share an id ("agent:<type>"), so the old implicit
  // "focus id equals Fix row id" signal dropped the agent resource from every non-Fix arrival too
  // (A5); the fallback must keep the row as the resource while still not attaching the error.
  const liveError = {
    message: "SECRET-ERROR 401 invalid key",
    retry: { kind: "open-connection" as const, id: "conn-1" },
  };
  const fixRowId = mariFixRowId(liveError);
  assert.equal(fixRowId, "connection:conn-1");
  assert.equal(mariFixRowId({ retry: { kind: "open-agent", id: "illustrator" } }), "agent:illustrator");
  assert.equal(mariFixRowId(null), null);
  const arrivalRows = [
    { id: "connection:conn-1", title: "Fix: Generate reply failed", category: "connection" as const },
    { id: "chat:chat-1", title: "Neon Harbor", category: "chat" as const },
  ];
  const askPayload = (message: string, focus: (typeof arrivalRows)[number] | null, fix: boolean) =>
    buildProfessorMariCommandCenterContext(message, focus, [], focus?.id, {
      activeChat: { id: "chat-1", label: "Neon Harbor", mode: "roleplay" },
      error: fix ? { message: liveError.message } : undefined,
      source: fix ? "chat-error" : undefined,
    });
  const arrivalFocus = mariFallbackFocus(arrivalRows, "chat:chat-1");
  assert.equal(
    arrivalFocus?.id,
    "connection:conn-1",
    "an arrival fallback keeps the Fix row's resource even though picking it was never deliberate",
  );
  assert.equal(
    mariFallbackFocus(arrivalRows)?.id,
    "connection:conn-1",
    "nor does any other unpicked door (Ask Mari row, aside) drop the resource",
  );
  assert.equal(mariFallbackFocus(arrivalRows.slice(1))?.id, "chat:chat-1", "without a Fix row the first row stays");
  // Slice 66: a chat tool row is an action, not a subject - the fallback skips it.
  const checkupRow = {
    id: "chat-tool:reply-checkup:chat-1",
    title: "Fix: Check the last reply",
    category: "chat" as const,
  };
  assert.equal(
    mariFallbackFocus([checkupRow, ...arrivalRows.slice(1)], "chat:chat-1"),
    null,
    "an arrival over a cut-off reply hands Mari the chat only",
  );
  assert.equal(
    mariFallbackFocus([checkupRow, ...arrivalRows.slice(1)])?.id,
    "chat:chat-1",
    "a typed ask falls back to the chat, not the checkup action",
  );
  const typedAfterArrival = askPayload("how do I add a lorebook?", arrivalFocus, false);
  assert.ok(
    !JSON.stringify(typedAfterArrival).includes("SECRET-ERROR"),
    "an unrelated typed question carries no error text even though it keeps the Fix row as its resource",
  );
  assert.equal(typedAfterArrival.source, "command-center");
  assert.equal(typedAfterArrival.resource?.id, "conn-1", "the resource still reaches Mari");
  const pickedFix = askPayload("", arrivalRows[0]!, true);
  assert.equal(pickedFix.source, "chat-error", "a deliberate Fix pick opens through the chat-error door");
  assert.equal(pickedFix.error?.message, liveError.message, "and only then carries the error text");

  // A5: the exact built-in-agent scenario — the editor row and the Fix row share one id.
  const agentArrivalRows = [{ id: "agent:illustrator", title: "Illustrator", category: "agent" as const }];
  const agentFallbackFocus = mariFallbackFocus(agentArrivalRows);
  assert.equal(agentFallbackFocus?.id, "agent:illustrator", "the agent resource survives a shared-id fallback");
  const agentArrivalPayload = buildProfessorMariCommandCenterContext(
    "What do its settings do?",
    agentFallbackFocus,
    [],
    agentFallbackFocus?.id,
  );
  assert.equal(agentArrivalPayload.resource?.kind, "agent", "resource is the agent");
  assert.equal(agentArrivalPayload.error, undefined, "no error field");
  assert.notEqual(agentArrivalPayload.source, "chat-error", "source is not chat-error without a deliberate fix pick");
  assert.equal(
    failed.cards.find((card) => card.id === "arrival:fix-reply")?.fix,
    true,
    "the failed reply's Fix card is the deliberate pick",
  );
  assert.equal(
    chat.cards.find((card) => card.id === "arrival:fix-reply")?.fix,
    undefined,
    "a cut-off reply has no error to carry",
  );
  assert.ok(failed.cards.filter((card) => card.fix).length === 1, "no other arrival card carries the error");
  assert.ok(
    !JSON.stringify(failed).includes("SECRET-ERROR"),
    "the arrival itself holds names only, never the error text",
  );

  // N4: a Mari card sends at once; Shift (desktop) or a long press (touch) drafts it; an action card acts.
  const sparkCard = failed.cards.find((card) => !card.action)!;
  const actionCard = failed.cards.find((card) => card.action)!;
  assert.equal(mariCardIntent(sparkCard), "send", "a Mari card sends its prompt at once");
  assert.equal(mariCardIntent(sparkCard, { shiftKey: true }), "draft", "Shift-click drafts instead");
  assert.equal(mariCardIntent(sparkCard, { longPress: true }), "draft", "a long press drafts instead");
  assert.equal(mariCardIntent(actionCard), "action", "an action card still acts at once");
  assert.equal(mariCardIntent(actionCard, { shiftKey: true }), "action", "Shift never turns an action into a draft");

  // D1: an arrival door should still show the arrival (appended at the transcript's bottom) when her
  // chat already has messages, not only when it is empty — otherwise ⌘J's "ask Mari about this" on a
  // return visit shows nothing but old history.
  assert.equal(
    shouldAppendMariArrival({
      omnibarMode: true,
      messageCount: 4,
      chatId: "mari-chat-1",
      loadedMessagesChatId: "mari-chat-1",
    }),
    true,
    "a chat with history, loaded, in the omnibar: show the appended arrival",
  );
  assert.equal(
    shouldAppendMariArrival({
      omnibarMode: true,
      messageCount: 0,
      chatId: "mari-chat-1",
      loadedMessagesChatId: "mari-chat-1",
    }),
    false,
    "an empty chat keeps the existing empty-state arrival instead, not the appended one",
  );
  assert.equal(
    shouldAppendMariArrival({ omnibarMode: true, messageCount: 4, chatId: "mari-chat-1", loadedMessagesChatId: null }),
    false,
    "her history has not loaded yet: wait rather than append over a stale list",
  );
  assert.equal(
    shouldAppendMariArrival({
      omnibarMode: false,
      messageCount: 4,
      chatId: "mari-chat-1",
      loadedMessagesChatId: "mari-chat-1",
    }),
    false,
    "a normal (non-omnibar) continue-chatting surface never appends the arrival",
  );

  const agentContext = createOmnibarContext({
    surface: "editor",
    openResource: { kind: "agent", id: "illustrator", resultId: "agent:illustrator" },
  });
  const agent = buildMariArrival(agentContext, {
    t,
    now,
    agent: {
      type: "illustrator",
      name: "Illustrator",
      enabled: true,
      promptLength: 4960,
      settingsCount: 6,
      onForChat: "Neon Harbor",
      lastError: "No image connection selected",
    },
  })!;
  assert.equal(agent.line, "This is Illustrator, one of your agents.");
  assert.deepEqual(
    agent.cards.map((card) => card.id),
    ["arrival:pick-connection", "arrival:why-failed", "arrival:tighten-prompt", "arrival:agent-settings"],
  );
  assert.deepEqual(agent.cards[0]?.action, { kind: "panel", panel: "connections" }, "L2's picker fix acts at once");
  assert.equal(agent.refs[0]?.state, "failed");
  assert.ok(agent.meta.includes("On for Neon Harbor"));
  const calmAgent = buildMariArrival(agentContext, {
    t,
    now,
    agent: { type: "illustrator", name: "Illustrator", enabled: false, promptLength: 0, settingsCount: 0 },
  })!;
  assert.ok(calmAgent.cards.length >= 2, "an agent with nothing to fix still gets two cards");

  const characterContext = createOmnibarContext({
    surface: "editor",
    editorDirty: true,
    openResource: { kind: "character", id: "c1", resultId: "character:c1" },
  });
  const character = buildMariArrival(characterContext, { t, now, editor: { name: "Zylo", field: "Description" } })!;
  assert.equal(character.line, "You're editing Zylo.");
  assert.deepEqual(character.meta, ["Description open", "Unsaved changes"]);
  assert.deepEqual(
    character.cards.map((card) => card.id),
    ["arrival:improve-field", "arrival:consistency"],
  );
  const lorebook = buildMariArrival(
    createOmnibarContext({
      surface: "editor",
      openResource: { kind: "lorebook", id: "lb1", resultId: "lorebook:lb1" },
    }),
    { t, now, editor: { name: "Harbor lore" } },
  )!;
  assert.ok(
    lorebook.cards.some((card) => card.id === "arrival:never-fired"),
    "lorebooks: entries that never fire",
  );

  const settingsContext = createOmnibarContext({
    surface: "settings",
    settingsTarget: { tab: "general", resultId: "settings" },
  });
  const settings = buildMariArrival(settingsContext, {
    t,
    now,
    settings: { section: "General" },
    undoLabel: "Reduce motion: Enabled",
  })!;
  assert.equal(settings.line, "You're in Settings · General.");
  assert.deepEqual(
    settings.cards.map((card) => card.action?.kind ?? "mari"),
    ["mari", "find-setting", "undo-setting"],
    "explain (Mari), find (search), undo (K5)",
  );
  const noUndo = buildMariArrival(settingsContext, { t, now, settings: { section: "General" } })!;
  assert.ok(!noUndo.cards.some((card) => card.action?.kind === "undo-setting"), "no Undo without a flip to undo");

  const game = buildMariArrival(createOmnibarContext({ surface: "home" }), { t, now, gameSetupStep: "World" })!;
  assert.deepEqual(game.meta, ["World"], "game setup: the wizard step as a label only");
  assert.equal(buildMariArrival(createOmnibarContext({ surface: "home" }), { t, now }), null, "Home keeps the welcome");
}

// M17: the pull circle morphs into the present Mari's sprite box.
{
  const from = { x: 200, y: 120, r: 30 };
  const to = { left: 40, top: 500, width: 48, height: 72 };
  const start = pullMorphFrame(from, to, 0);
  // At 0 the box's top square (her head) is exactly the circle.
  assert.equal(start.scale * to.width, 2 * from.r, "the head square is the circle's diameter");
  assert.equal(start.x + (start.scale * to.width) / 2, from.x, "centred on the circle (x)");
  assert.equal(start.y + (start.scale * to.width) / 2, from.y, "centred on the circle (y)");
  assert.equal(start.clip, "inset(0px 0px 24px 0px round 24px)", "clipped to a circle around the head");
  assert.equal(start.portrait, 1);
  assert.equal(start.sprite, 0);
  const end = pullMorphFrame(from, to, 1);
  assert.deepEqual([end.x, end.y, end.scale], [40, 500, 1], "lands on the sprite's exact box");
  assert.equal(end.clip, "inset(0px 0px 0px 0px round 0px)", "the sprite's own box shape");
  assert.equal(end.portrait, 0);
  assert.equal(end.sprite, 1);
  const overshoot = pullMorphFrame(from, to, 1.08);
  assert.equal(overshoot.clip, "inset(0px 0px 0px 0px round 0px)", "a spring overshoot never inverts the clip");
  assert.ok(overshoot.sprite === 1 && overshoot.portrait === 0);
  const mid = pullMorphFrame(from, to, 0.5);
  assert.ok(
    Math.min(start.scale, 1) < mid.scale && mid.scale < Math.max(start.scale, 1),
    "the size animates between the two",
  );
}

// 45b: Mari looks down at the screen's middle while pulled; a new gaze holds 150 ms, so jitter cannot flicker it.
{
  assert.deepEqual(
    [...PULL_GAZE_FRAMES],
    ["neutral", "down", "down-left", "down-right", "peering", "delighted"],
    "the sheet's frame order",
  );
  assert.equal(pullGazeFrame(195, 390), "down", "at the middle she looks straight down");
  assert.equal(pullGazeFrame(255, 390), "down", "within the middle third, still straight down");
  assert.equal(pullGazeFrame(300, 390), "down-left", "pulled from the right, she looks back left at the screen");
  assert.equal(pullGazeFrame(390, 390), "down-left");
  assert.equal(pullGazeFrame(60, 390), "down-right", "pulled from the left, she looks right");
  assert.equal(pullGazeFrame(0, 390), "down-right");
  assert.equal(pullGazeFrame(1000, 1440), "down-left", "the buckets scale with the screen");
  assert.equal(pullGazeFrame(720, 1440), "down");
  let gaze = holdPullGaze(null, "down", 1000);
  assert.deepEqual(gaze, { frame: "down", since: 1000 }, "the first frame shows at once");
  gaze = holdPullGaze(gaze, "down-left", 1000 + PULL_GAZE_HOLD_MS - 1);
  assert.equal(gaze.frame, "down", "a change inside the hold waits");
  gaze = holdPullGaze(gaze, "down-left", 1000 + PULL_GAZE_HOLD_MS);
  assert.deepEqual(gaze, { frame: "down-left", since: 1000 + PULL_GAZE_HOLD_MS }, "after the hold it changes");
  const held = holdPullGaze(gaze, "down-left", 5000);
  assert.equal(held, gaze, "the same frame keeps its start time");
  // A finger jittering across a bucket edge every 16 ms changes the frame at most once per hold.
  let shown: ReturnType<typeof holdPullGaze> | null = null;
  let changes = 0;
  for (let time = 0; time < 1500; time += 16) {
    const next = holdPullGaze(shown, pullGazeFrame(time % 32 ? 259 : 262, 390), time);
    if (shown && next.frame !== shown.frame) changes += 1;
    shown = next;
  }
  assert.ok(changes <= 1500 / PULL_GAZE_HOLD_MS, `jitter changed the gaze ${changes} times`);
}

// 45b: the armed pull's label names what she will look at, from the same arrival as the Mari pane:
// a name or a fixed phrase, never content (R22).
{
  const t: MariArrivalData["t"] = (_key, fallback, options) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options?.[name] ?? ""));
  const now = Date.parse("2026-10-04T12:00:00Z");
  const SECRET = "SECRET-MESSAGE-TEXT";
  const chatContext = createOmnibarContext({ surface: "chat", activeChat: { id: "chat-1", resultIds: [] } });
  const chat = (extra: Partial<MariArrivalData> = {}, lastReply: unknown = null): MariArrivalData => ({
    t,
    now,
    chat: {
      name: "Neon Harbor",
      characters: [{ id: "c1", name: "Zylo" }],
      lorebooks: [],
      lastReply: lastReply as never,
    },
    ...extra,
  });
  const about = (context: typeof chatContext, data: MariArrivalData) =>
    mariPullAbout(context, buildMariArrival(context, data), t);
  assert.equal(about(chatContext, chat()), "Zylo's chat", "a chat: whose chat it is");
  assert.equal(about(chatContext, chat({ replyFailed: true })), "fix that reply", "a failed reply: fix it");
  assert.equal(
    about(chatContext, chat({}, { createdAt: "2026-10-04T11:59:00Z", finishReason: "length", content: SECRET })),
    "fix that reply",
    "a cut-off reply: fix it",
  );
  assert.equal(
    about(chatContext, { t, now, chat: { name: "Neon Harbor", characters: [], lorebooks: [] } }),
    "Neon Harbor",
    "a chat without a known character: its name",
  );
  const agentContext = createOmnibarContext({
    surface: "editor",
    openResource: { kind: "agent", id: "illustrator", resultId: "agent:illustrator" },
  });
  const agent = { type: "illustrator", name: "Illustrator", enabled: true, promptLength: 0, settingsCount: 0 };
  assert.equal(about(agentContext, { t, now, agent }), "Illustrator settings", "an agent: its settings");
  assert.equal(
    about(agentContext, { t, now, agent: { ...agent, lastError: `${SECRET}: no connection` } }),
    "fix that run",
    "a failed agent run: fix it, and never the error text",
  );
  const characterContext = createOmnibarContext({
    surface: "editor",
    openResource: { kind: "character", id: "c1", resultId: "character:c1" },
  });
  assert.equal(about(characterContext, { t, now, editor: { name: "Zylo", field: "Description" } }), "Zylo");
  assert.equal(about(createOmnibarContext({ surface: "home" }), { t, now }), null, "Home: nothing to comment on");
  assert.equal(about(characterContext, { t, now }), null, "an editor whose name is not cached: the plain label");
  for (const label of [
    about(chatContext, chat({}, { createdAt: "2026-10-04T11:59:00Z", content: SECRET })),
    about(agentContext, { t, now, agent: { ...agent, lastError: SECRET } }),
  ]) {
    assert.ok(label && !label.includes(SECRET), "the label never carries message or error text");
  }
  // The pull and the omnibar detect the screen with one function.
  const ids = {
    characterDetailId: null,
    personaDetailId: null,
    lorebookDetailId: null,
    presetDetailId: null,
    connectionDetailId: null,
    agentDetailId: null,
    settingsPanelVisible: false,
    gameAssetsBrowserOpen: false,
    botBrowserOpen: false,
    characterLibraryOpen: false,
    agentCatalogOpen: false,
    activeChatId: null,
  };
  assert.deepEqual(resolveOmnibarScreen(ids), { surface: "home", openResource: undefined });
  assert.equal(resolveOmnibarScreen({ ...ids, activeChatId: "chat-1" }).surface, "chat");
  assert.deepEqual(resolveOmnibarScreen({ ...ids, activeChatId: "chat-1", agentDetailId: "illustrator" }), {
    surface: "editor",
    openResource: { kind: "agent", id: "illustrator", resultId: "agent:illustrator" },
  });
}

// O2: local frecency ranking (slice 48) — recency decay, the entry cap, and
// the hard guarantee that the boost can never outrank an exact name match or
// touch Mari's row.
{
  const now = Date.parse("2026-10-04T12:00:00Z");
  const DAY_MS = 24 * 60 * 60 * 1000;
  const entry = (resultId: string, surface: OmnibarFrecencyEntry["surface"], ageMs: number): OmnibarFrecencyEntry => ({
    resultId,
    surface,
    timestamp: now - ageMs,
  });

  // Recency decay: a week-old single use scores about half of a fresh one
  // (the half-life), and a month-old use is nearly worthless.
  const fresh = frecencyScore([entry("chat:1", "chat", 0)], "chat:1", "chat", now);
  const oneWeekOld = frecencyScore([entry("chat:1", "chat", 7 * DAY_MS)], "chat:1", "chat", now);
  const oneMonthOld = frecencyScore([entry("chat:1", "chat", 30 * DAY_MS)], "chat:1", "chat", now);
  assert.ok(Math.abs(oneWeekOld - fresh / 2) < 0.01, `a week-old use should score ~half of fresh, got ${oneWeekOld}`);
  assert.ok(oneMonthOld < fresh * 0.1, `a month-old use should have decayed to almost nothing, got ${oneMonthOld}`);
  assert.ok(fresh > oneWeekOld && oneWeekOld > oneMonthOld, "score must strictly decrease with age");

  // Frequency and recency both matter: three recent uses outscore one, and a
  // different surface or a different result never contributes.
  const threeRecent = frecencyScore(
    [entry("chat:1", "chat", 0), entry("chat:1", "chat", DAY_MS), entry("chat:1", "chat", 2 * DAY_MS)],
    "chat:1",
    "chat",
    now,
  );
  assert.ok(threeRecent > fresh, "repeated recent use should score higher than a single use");
  assert.equal(
    frecencyScore([entry("chat:1", "editor", 0)], "chat:1", "chat", now),
    0,
    "a different surface must not contribute",
  );
  assert.equal(
    frecencyScore([entry("chat:2", "chat", 0)], "chat:1", "chat", now),
    0,
    "a different result must not contribute",
  );

  // The 300-entry cap evicts the oldest first, keeping the newest MAX intact.
  const overflow: OmnibarFrecencyEntry[] = [];
  for (let i = 0; i < 310; i++) overflow.push(entry(`chat:${i}`, "chat", (310 - i) * 60_000));
  const capped = normalizeOmnibarFrecencyEntries(overflow);
  assert.equal(capped.length, 300, "the entry list must be capped at 300");
  assert.ok(!capped.some((e) => e.resultId === "chat:0"), "the oldest entry must be evicted first");
  assert.ok(
    capped.some((e) => e.resultId === "chat:309"),
    "the newest entries must survive the cap",
  );

  // The boost is capped well under the lowest exact-name-match score tier
  // (scoreText in omnibar-search.ts starts exact matches at 300+), so it can
  // only break a tie or lift a weak fuzzy hit — never outrank a real match.
  const manyRecentUses = Array.from({ length: 20 }, (_, i) => entry("weak-match", "chat", i * 60_000));
  const maxBoost = frecencyBoost(manyRecentUses, "weak-match", "chat", now);
  assert.equal(maxBoost, FRECENCY_BOOST_CAP, "repeated recent use should saturate at the boost cap");
  const EXACT_MATCH_SCORE = 300 + "vesper".length;
  const WEAK_MATCH_SCORE = 110;
  assert.ok(
    WEAK_MATCH_SCORE + maxBoost < EXACT_MATCH_SCORE,
    "even the maximum frecency boost must never lift a weak match above an exact match",
  );

  // Mari's row is a fixed rule, not a ranking outcome: never scored, never
  // boosted, never surfaced as a top-frecent id, even if it somehow appears
  // in the stored entries (e.g. data written by an older build).
  assert.ok(FRECENCY_EXCLUDED_RESULT_IDS.has("ask-professor-mari"));
  const withMariEntries = [...manyRecentUses, entry("ask-professor-mari", "chat", 0)];
  assert.equal(frecencyScore(withMariEntries, "ask-professor-mari", "chat", now), 0);
  assert.equal(frecencyBoost(withMariEntries, "ask-professor-mari", "chat", now), 0);
  assert.ok(!topFrecentResultIds(withMariEntries, "chat", now).includes("ask-professor-mari"));
  assert.ok(
    normalizeOmnibarFrecencyEntries(withMariEntries).every((e) => e.resultId !== "ask-professor-mari"),
    "an excluded id must not survive normalization even if present in raw storage",
  );

  // The empty-state deck: most frecent first, scoped to the right surface.
  const topIds = topFrecentResultIds(
    [
      ...Array.from({ length: 3 }, (_, i) => entry("character:juniper", "chat", i * DAY_MS)),
      entry("chat:9", "chat", 0),
    ],
    "chat",
    now,
    5,
  );
  assert.deepEqual(topIds, ["character:juniper", "chat:9"], "most frecent id leads, scoped to the surface");
}

// O3: setting and command synonyms (slice 49) — a `keywords` array on
// settings-registry controls and on command definitions lets a search by a
// different word than the label still find the row, scored below a real
// label/alias match (`KEYWORD_MATCH_SCORE` in omnibar-search.ts).
{
  const settingsControls: OmnibarResult[] = getOmnibarSettingsDestinations()
    .filter((destination) => destination.controlId)
    .map((destination) => ({
      id: destination.id,
      title: destination.title,
      category: "settings" as const,
      score: 165,
      aliases: destination.aliases,
      keywords: destination.keywords,
    }));
  const search = (query: string) =>
    filterOmnibarFuzzyFallback(
      searchOmnibar(query, {
        commands: systemCommands,
        chats: [],
        resources: [],
        connections: [],
        controls: settingsControls,
      }),
    );

  const phrasePairs: readonly [string, string][] = [
    ["bigger text", "settings-control:chat-font-size"],
    ["zoom", "settings-control:display-size"],
    ["night", "settings-control:theme-mode"],
    ["typing effect", "settings-control:enable-streaming"],
    ["typewriter speed", "settings-control:streaming-speed"],
    ["load history", "settings-control:messages-per-page"],
    ["voice typing", "settings-control:speech-to-text"],
    ["are you sure", "settings-control:confirm-before-delete"],
    ["toast position", "settings-control:notification-position"],
    ["rainbow mode", "settings-control:rgb-mode"],
    ["skin", "settings-control:visual-theme"],
    ["message layout", "settings-control:conversation-layout"],
    ["disk cleanup", "settings-control:avatar-storage-optimization"],
    ["chain of thought", "settings-control:show-roleplay-thinking-in-messages"],
    ["reboot server", "settings-control:restart-server"],
    ["beta channel", "settings-control:release-channel"],
    ["make a character", "create-character"],
    ["migrate from st", "import-sillytavern"],
    ["browse agents", "agent-library"],
    ["save backup", "backups"],
  ];
  assert.equal(phrasePairs.length, 20, "the plan requires 20 phrase -> result pairs");
  for (const [phrase, expectedId] of phrasePairs) {
    const top = search(phrase).find((result) => result.id !== "ask-professor-mari");
    assert.equal(top?.id, expectedId, `"${phrase}" should surface ${expectedId} first, got ${top?.id}`);
  }

  // F6 (O5): there is no context-SIZE control in the registry, so "context
  // length"/"context size" must not resolve to "Show token usage on messages"
  // (a toggle, flipped silently on Enter) nor "context"/"history length" to
  // "Messages per page" (which only pages the transcript).
  for (const phrase of ["context length", "context size"]) {
    const top = search(phrase).find((result) => result.id !== "ask-professor-mari");
    assert.notEqual(
      top?.id,
      "settings-control:show-token-usage",
      `"${phrase}" must not surface the token-usage toggle`,
    );
  }
  {
    const top = search("history length").find((result) => result.id !== "ask-professor-mari");
    assert.notEqual(
      top?.id,
      "settings-control:messages-per-page",
      `"history length" must not surface Messages per page as the top hit`,
    );
  }

  // A keyword match must never outrank a label match for the same query: a
  // setting whose real label ("Dark") collides with another setting's
  // keyword list (theme-mode's "dark" keyword) must still win.
  const collisionControls: OmnibarResult[] = [
    {
      id: "settings-control:theme-mode",
      title: "Color Scheme",
      category: "settings",
      score: 165,
      aliases: [],
      keywords: ["dark", "night", "light", "day"],
    },
    { id: "settings-control:dark", title: "Dark", category: "settings", score: 165, aliases: [] },
  ];
  const [labelMatch, keywordMatch] = searchOmnibar("dark", {
    commands: [],
    chats: [],
    resources: [],
    connections: [],
    controls: collisionControls,
  });
  assert.equal(labelMatch?.id, "settings-control:dark", "an exact label match outranks a keyword match");
  assert.equal(keywordMatch?.id, "settings-control:theme-mode");
  assert.ok(
    (labelMatch?.score ?? 0) > (keywordMatch?.score ?? 0),
    "the label match's score must exceed the keyword match's score",
  );
}

// O4 item 1: a lorebook row's plain-name Enter/tap must attach it to the open
// chat when it is not already active there, and must never be the thing that
// flips the global Enabled switch — that used to silently disable the
// lorebook app-wide with no visible Undo. `attachLorebookIfNotActive` in
// GlobalOmnibar.tsx decides this with `resolveChatResourceDropAction`, so
// pinning that decision here is what actually proves the fix, since the rest
// of the dispatch lives in a component.
{
  const chatBase = {
    id: "chat-1",
    characterIds: [] as string[],
    mode: "roleplay" as const,
    personaId: null,
    promptPresetId: null,
    connectionId: null,
  };
  const notAttached = resolveChatResourceDropAction(
    { version: 1, kind: "lorebook", ids: ["lorebook-a"], label: "Monastery codex" },
    { ...chatBase, metadata: { activeLorebookIds: [] } },
  );
  assert.equal(notAttached?.type, "add-lorebooks", "a lorebook not yet active on the chat resolves to an attach");

  const alreadyAttached = resolveChatResourceDropAction(
    { version: 1, kind: "lorebook", ids: ["lorebook-a"], label: "Monastery codex" },
    { ...chatBase, metadata: { activeLorebookIds: ["lorebook-a"] } },
  );
  assert.equal(
    alreadyAttached?.type,
    "blocked",
    "a lorebook already active on the chat must never resolve to another attach (that gap used to fall through to the global toggle)",
  );
  assert.equal((alreadyAttached as { reason?: string })?.reason, "already-active");
}

// O4 item 7: character and agent rows open on the first tap on a touch
// pointer, the same as chat and message rows already do (F4, slice 41) —
// extending `resultOpensDirectlyOnTap` instead of leaving the two-tap
// expand-then-open behaviour that cost a step in tasks 10 and 15.
{
  assert.equal(
    resultOpensDirectlyOnTap({
      target: { kind: "resource", resource: "character", id: "eliza" },
      category: "character",
    }),
    true,
    "a character row opens directly on tap",
  );
  assert.equal(
    resultOpensDirectlyOnTap({
      target: { kind: "resource", resource: "agent", id: "scene-critic" },
      category: "agent",
    }),
    true,
    "an agent row opens directly on tap",
  );
  assert.equal(
    resultOpensDirectlyOnTap({
      target: { kind: "resource", resource: "lorebook", id: "monastery" },
      category: "lorebook",
    }),
    false,
    "a lorebook row still expands first — it was not part of this fix",
  );
  assert.equal(
    resultOpensDirectlyOnTap({ target: { kind: "chat", chatId: "chat-1" }, category: "chat" }),
    true,
    "chat rows keep opening directly on tap (F4)",
  );
}

// O4 task 9: a natural-language question searches docs on its real content
// words, not the literal phrase, so a fresh install with no model still gets
// a deterministic docs answer instead of nothing.
{
  assert.equal(
    extractDocsSearchQuery("how do lorebooks work?"),
    "lorebooks work",
    "question words and punctuation strip out, leaving the content words",
  );
  assert.equal(
    extractDocsSearchQuery("openrouter"),
    "openrouter",
    "a query with no stopwords passes through unchanged",
  );
  assert.equal(
    extractDocsSearchQuery("how do"),
    "how do",
    "stripping everything falls back to the original query instead of searching on nothing",
  );
}

// P2/P3 (slice 83): the top-bar line and pill are server-backed. Done and Failed stay until the run is seen.
{
  const run = (outcome: "running" | "finished" | "failed", id = "run-1") => ({
    id,
    chatId: "thread-1",
    startedAt: 1_000,
    finishedAt: outcome === "running" ? null : 2_000,
    outcome,
  });
  const idle: MariRunState = {
    working: false,
    pendingApprovals: 0,
    latestRun: null,
    seenRunId: undefined,
    clientRunFailed: false,
  };
  assert.equal(resolveMariEdgeGlow(idle), null, "no run: nothing shows");
  assert.equal(
    resolveMariEdgeGlow({ ...idle, latestRun: run("finished"), seenRunId: undefined }),
    null,
    "while the seen marker loads, a result does not flash as new",
  );
  assert.equal(
    resolveMariEdgeGlow({ ...idle, latestRun: run("finished"), seenRunId: null }),
    "finished",
    "a finished run nobody has seen is Done",
  );
  assert.equal(
    resolveMariEdgeGlow({ ...idle, latestRun: run("finished"), seenRunId: "run-1" }),
    null,
    "once the run is seen, Done is gone (it does not come back on reload)",
  );
  assert.equal(
    resolveMariEdgeGlow({ ...idle, latestRun: run("failed"), seenRunId: "run-0" }),
    "error",
    "an unseen failed run is Failed",
  );
  assert.equal(
    resolveMariEdgeGlow({ ...idle, latestRun: run("failed"), seenRunId: "run-1" }),
    null,
    "a seen failed run clears",
  );
  assert.equal(
    resolveMariEdgeGlow({ ...idle, working: true, latestRun: run("running"), seenRunId: "run-0" }),
    "working",
    "a run in progress is Working",
  );
  assert.equal(
    resolveMariEdgeGlow({ ...idle, working: true, latestRun: run("failed"), seenRunId: null }),
    "error",
    "Failed beats Working",
  );
  assert.equal(
    resolveMariEdgeGlow({ ...idle, working: true, pendingApprovals: 1, latestRun: run("failed"), seenRunId: null }),
    "approval",
    "Needs you beats everything",
  );
  // A change held in Manual mode is no server review, but her window says "Needs you · 1 choice waiting".
  const held = { ...run("finished"), heldChange: true };
  assert.equal(
    resolveMariEdgeGlow({ ...idle, latestRun: held, seenRunId: "run-1" }),
    "approval",
    "a held change is Needs you, and seeing the run does not clear it",
  );
  assert.equal(
    resolveMariEdgeGlow({ ...idle, working: true, latestRun: run("running", "run-2"), seenRunId: "run-1" }),
    "working",
    "the answer starts a new run, so Needs you goes",
  );
  const workspaceAgentSource = readFileSync(
    new URL("../../packages/server/src/services/professor-mari/workspace-agent.service.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    workspaceAgentSource,
    /outcome: runError \? "failed" : "finished",[^}]*runEndedWithDeferral && !runError \? \{ heldChange: true \}/u,
    "the server marks the run that ended with a held change",
  );
  assert.match(
    workspaceAgentSource,
    /clearHistory === true && this\.latestRun\?\.heldChange\)\s+this\.latestRun = \{ \.\.\.this\.latestRun, heldChange: false \}/u,
    "a new thread leaves the held change behind, so the pill stops asking for it",
  );
  assert.equal(
    resolveMariEdgeGlow({ ...idle, latestRun: run("finished"), seenRunId: "run-0", clientRunFailed: true }),
    "error",
    "a failure before the server saw the run stays Failed until a retry or Dismiss",
  );
}
{
  // R14 (item 7): the run's clock is anchored on the send, never on a later step.
  const steps = [{ startedAt: 4_000, updatedAt: 6_000 }];
  assert.equal(resolveRunAnchorMs(1_000, steps), 1_000, "the send anchors the run, not the first step");
  assert.equal(resolveRunAnchorMs(1_000, []), 1_000, "before any step the send still anchors it");
  assert.equal(resolveRunAnchorMs(null, steps), 4_000, "without a send time the earliest step anchors it");
  assert.equal(
    resolveRunSeconds(steps, { startMs: 1_000, endMs: 9_000 }),
    8,
    "Worked for counts from the send to the reply, the same anchor as the live timer",
  );
  const presentation = {
    hasRecovery: true,
    hasWorkspaceError: false,
    pendingReviewCount: 0,
    working: false,
    hasDraft: false,
    attachmentCount: 0,
    hasActionResult: false,
    messageCount: 1,
  };
  assert.equal(resolveProfessorMariPresentationState(presentation), "broken");
  assert.equal(
    resolveProfessorMariPresentationState({ ...presentation, hasWorkspaceError: true, working: true }),
    "working",
    "R14: a stale error never reads as broken while she works",
  );
}

{
  // Slice 67: an optional Keep/Undo on an already-applied change reads "Ready to help", not "Needs your answer".
  assert.equal(countBlockingReviews([{ kind: "applied_review" }, { kind: "applied_review" }]), 0);
  assert.equal(
    countBlockingReviews([{ kind: "applied_review" }, { kind: "approval" }, { kind: "sensitive_file" }, {}]),
    3,
  );
  const mariSource = readFileSync(
    new URL("../../packages/client/src/components/chat/HomeProfessorMariChat.tsx", import.meta.url),
    "utf8",
  );
  assert.match(mariSource, /pendingReviewCount: countBlockingReviews\(visiblePendingChangeReviews\)/u);
  // UX-03: a run that ends while her window is open reloads the thread (an answer saved after a reload shows
  // without a reopen), and an arrival door waits for the run instead of landing under the live thread.
  assert.match(
    mariSource,
    /if \(!ended \|\| !chatId\) return;\s*void loadMessages\(chatId,/u,
    "UX-03: the thread reloads when a run ends",
  );
  assert.match(
    mariSource,
    /if \(!appendedArrivalReady \|\| !arrival \|\| workspaceTimelineActive\) return;/u,
    "UX-03: an arrival waits for the run to end",
  );
  // Slice 71: the header counts the "Needs you" cards (waiting reviews, a turn's deletes as one, a held change).
  // Slice 82: the header's Mari parts live in their own component.
  const headerChromeSource = readFileSync(
    new URL("../../packages/client/src/components/chat/mari/MariOmnibarHeaderChrome.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    headerChromeSource,
    /const needsYouCount =[\s\S]*?isMariReviewWaiting\(approval\)[\s\S]*?\(heldChangeCard \? 1 : 0\);/u,
    "the omnibar header asks for an answer only for a real approval or a held change",
  );
  // UX-04: the top-bar pill, the Now row, the empty state and the open-with-review flags count only waiting reviews.
  // An applied change (Keep/Undo) is not a question, so it never raises "Needs you".
  const appliedOnly = {
    active: false,
    pendingApprovals: [
      { id: "a1", kind: "applied_review", affectedRows: 1, diffPreview: [{ table: "characters", action: "update" }] },
    ],
  } as never;
  assert.equal(
    buildOmnibarContinueResult({
      mariEnabled: true,
      t: ((_key: string, fallback: string) => fallback) as never,
      workspaceStatus: appliedOnly,
    }),
    null,
    "UX-04: an applied change adds no Now row",
  );
  for (const file of [
    "packages/client/src/hooks/use-mari-presence.ts",
    "packages/client/src/components/layout/omnibar/use-omnibar-empty-state.ts",
    "packages/client/src/components/layout/GlobalOmnibar.tsx",
    "packages/client/src/lib/omnibar-results.ts",
  ]) {
    assert.match(
      readFileSync(new URL(`../../${file}`, import.meta.url), "utf8"),
      /countBlockingReviews\(/u,
      `UX-04: ${file} counts only the reviews that wait on the user`,
    );
  }
}

{
  // Slice 67: output that grows past the fold while the reader is not following shows the jump arrow.
  let grow = () => {};
  const realResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      grow = callback;
    }
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  const scroller = { clientHeight: 500, scrollHeight: 769, scrollTop: 1 } as unknown as HTMLElement;
  const reports: boolean[] = [];
  let following = false;
  const stop = followTranscriptGrowth(
    scroller,
    {} as HTMLElement,
    () => following,
    (below) => reports.push(below),
  );
  grow();
  following = true;
  (scroller as { scrollTop: number }).scrollTop = 230;
  grow();
  stop();
  globalThis.ResizeObserver = realResizeObserver;
  assert.deepEqual(
    reports,
    [true, false],
    "the arrow shows for unfollowed output below the fold, never while following",
  );
  assert.equal(scroller.scrollTop, 769, "following still pins to the bottom");
}

{
  // Slice 67b: two rounds' words with no step between start a new paragraph, live and in the saved trace.
  const trace: Parameters<typeof emitRoundText>[0] = [];
  const live: string[] = [];
  const onEvent = (event: { data: string }) => live.push(event.data);
  emitRoundText(trace, "I'll check your Dice chat.", onEvent);
  trace.push({ type: "tool", tool: { id: "t1", name: "app_data", status: "done" } } as (typeof trace)[number]);
  emitRoundText(trace, "Checked.", onEvent);
  emitRoundText(trace, "It wasn't cut off.", onEvent);
  assert.equal(live.join(""), "I'll check your Dice chat.Checked.\n\nIt wasn't cut off.");
  assert.deepEqual(
    trace.filter((item) => item.type === "text").map((item) => (item as { content: string }).content),
    ["I'll check your Dice chat.", "Checked.", "It wasn't cut off."],
    "slice 70: each round is its own text item in the saved trace",
  );
}

console.info("Command Center regression checks passed.");

// Slice 78: the empty omnibar - one Now row, Try rows until each kind is used, Continue.
{
  const row = (id: string, extra: Partial<OmnibarResult> = {}) =>
    ({ id, title: id, category: "chat", score: 0, ...extra }) as OmnibarResult;
  const mari = row("ask-professor-mari", { category: "professor", group: "continue" });
  const fix = row("connection:k1");
  const check = row("chat-tool:reply-checkup:c1");
  const setup = row("now:setup-connection");
  const base = {
    mariRow: mari,
    pendingApprovals: 0,
    mariActive: false,
    mariFinished: false,
    fixRow: fix,
    checkupRow: check,
    setupRow: setup,
  };
  const pick = (input: Partial<typeof base>) => pickOmnibarNowResult({ ...base, ...input });
  assert.deepEqual(
    [
      pick({ pendingApprovals: 2 }),
      pick({}),
      pick({ fixRow: null }),
      pick({ fixRow: null, checkupRow: null, mariActive: true }),
    ].map((result) => [result?.id, result?.now]),
    [
      ["ask-professor-mari", "review"],
      ["connection:k1", "fix"],
      ["chat-tool:reply-checkup:c1", "check"],
      ["ask-professor-mari", "working"],
    ],
    "Now priority: Mari's review, a failure, a cut-off reply, Mari working",
  );
  assert.equal(pick({ fixRow: null, checkupRow: null, mariFinished: true })?.now, "finished");
  assert.equal(pick({ fixRow: null, checkupRow: null })?.now, "setup", "no model is the last resort");
  assert.equal(pick({ fixRow: null, checkupRow: null, setupRow: null }), null, "nothing up, no Now row");
  assert.equal(pick({ mariRow: null, pendingApprovals: 3 })?.now, "fix", "approvals without her row fall through");
  assert.equal(mari.now, undefined, "picking never mutates the source row");

  // Try rows: fixed order, a used kind never returns, a hard stop after 15 opens, none when switched off.
  const fresh = readOmnibarTryState(null);
  const on = { enabled: true, mariEnabled: true };
  assert.deepEqual(visibleOmnibarTryKinds(fresh, on), ["search", "command", "mari"]);
  assert.deepEqual(visibleOmnibarTryKinds({ used: { search: 1 }, opens: 0 }, on), ["command", "mari"]);
  assert.deepEqual(visibleOmnibarTryKinds({ used: {}, opens: 0 }, { ...on, mariEnabled: false }), [
    "search",
    "command",
  ]);
  assert.deepEqual(visibleOmnibarTryKinds({ used: {}, opens: OMNIBAR_TRY_MAX_OPENS - 1 }, on).length, 3);
  assert.deepEqual(visibleOmnibarTryKinds({ used: {}, opens: OMNIBAR_TRY_MAX_OPENS }, on), [], "stop rule");
  assert.deepEqual(visibleOmnibarTryKinds(fresh, { ...on, enabled: false }), [], "suggestions off");
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
  };
  markOmnibarTryUsed("mari", 100, storage);
  markOmnibarTryUsed("mari", 200, storage);
  countOmnibarTryOpen(storage);
  countOmnibarTryOpen(storage);
  assert.deepEqual(
    readOmnibarTryState(storage),
    { used: { mari: 100 }, opens: 2 },
    "first use is kept; opens count up",
  );
  memory.set("marinara:omnibar:try:v1", "{not json");
  assert.deepEqual(readOmnibarTryState(storage), { used: {}, opens: 0 }, "corrupt storage reads as new");
  const t = ((_key: string, fallback: string, options?: Record<string, unknown>) =>
    fallback.replace("{{example}}", String(options?.example ?? ""))) as never;
  const tryRows = buildOmnibarTryResults(["command", "mari"], { search: "s", command: "light mode", mari: "Why?" }, t);
  assert.deepEqual(
    tryRows.map((result) => [result.id, result.group, result.action, result.description]),
    [
      ["try:command", "try", { kind: "refine-query", query: "light mode" }, "Try “light mode”"],
      ["try:mari", "try", { kind: "refine-query", query: "Why?" }, "Try “Why?”"],
    ],
    "an example only fills the field",
  );

  // Which kind a typed pick teaches.
  assert.equal(isOmnibarCommandPick({ action: { kind: "goto-message", chatId: "c", messageNumber: 1 } }), false);
  assert.equal(isOmnibarCommandPick({}), false, "opening a record is a search");
  assert.equal(isOmnibarCommandPick({ action: { kind: "slash", command: "goto" } }), true);
  assert.equal(isOmnibarCommandPick({ chooseValue: () => {} }), true);

  // Continue's "edited last": changed after creation, newest wins.
  assert.equal(
    lastEditedRecordId([
      ["character", [{ id: "imported", createdAt: "2026-10-08T10:00:00Z", updatedAt: "2026-10-08T10:00:00Z" }]],
      [
        "lorebook",
        [
          { id: "old", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z" },
          { id: "new", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z" },
        ],
      ],
    ]),
    "lorebook:new",
  );
  assert.equal(lastEditedRecordId([["preset", [{ id: "default", createdAt: "x", updatedAt: "y" }]]]), null);

  // The empty list skips rows that repeat the chat's own buttons, but never a Fix row.
  const hidden = [
    row("chat:c1", { idleHidden: true }),
    row("connection:k1", { idleHidden: true }),
    row("chat-tool:search:c1"),
  ];
  assert.deepEqual(
    idleOmnibarContextResults(hidden, null, "connection:k1").map((result) => result.id),
    ["connection:k1", "chat-tool:search:c1"],
  );
  assert.deepEqual(
    buildOmnibarSlashResults({
      activeChatId: "c1",
      deferredQuery: "",
      slashAvailability: {} as never,
      surface: "chat",
    }),
    [],
    "no slash rows before a /",
  );
}

// Slice 79: every row from the builders carries a visual. A row about a record shows that record's
// picture (its own, or the referenced record's for a derived row); anything else its type icon.
// Titles are highlighted from the search's own queries, also on rows the search never built.
{
  const t = ((_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/{{(\w+)}}/g, (_m, name: string) => String(values?.[name] ?? ""))) as never;
  const avatar = (src: string) => ({ src, alt: "", kind: "avatar" as const });
  const records: OmnibarResult[] = [
    {
      id: "character:eliza",
      title: "Eliza Thornwood",
      category: "character",
      score: 1,
      icon: "character",
      preview: () => ({ kind: "character", media: avatar("/a/eliza.png") }),
    },
    {
      id: "character:kai",
      title: "Kai",
      category: "character",
      score: 1,
      icon: "character",
      preview: () => ({ kind: "character" }),
    },
    {
      id: "persona:elowen",
      title: "Elowen",
      category: "persona",
      score: 1,
      icon: "persona",
      preview: () => ({ kind: "persona", media: avatar("/a/elowen.png"), accent: "#e879f9" }),
    },
    {
      id: "lorebook:grove",
      title: "Elder Grove Codex",
      category: "lorebook",
      score: 1,
      icon: "lorebook",
      preview: () => ({ kind: "lorebook", media: { src: "/l/grove.png", alt: "", kind: "artwork" } }),
    },
    {
      id: "connection:or",
      title: "OpenRouter",
      category: "connection",
      score: 1,
      icon: "connection",
      preview: () => ({ kind: "connection", media: { src: "/c/or.png", alt: "", kind: "artwork" } }),
    },
    {
      id: "chat:tavern",
      title: "Tavern Night",
      category: "chat",
      score: 1,
      icon: "chats",
      preview: () => ({
        kind: "chat",
        media: avatar("/a/eliza.png"),
        participants: [{ src: "/a/eliza.png" }, { src: "/a/elias.png" }],
        participantCount: 4,
      }),
    },
  ];
  const context = {
    recordById: new Map(records.map((record) => [record.id, record] as const)),
    chatModeById: new Map([["chat:tavern", "roleplay"]]),
    mariPortrait: "/sprites/mari/idle.webp",
  };
  const visualOf = (row: OmnibarResult, query = "") =>
    resolveOmnibarRowVisual(row, { ...context, matchQueries: query ? [query] : undefined });
  const activeChat = { id: "tavern", name: "Tavern Night" } as never;
  const rows: OmnibarResult[] = [
    ...records,
    ...buildOmnibarAddSuggestions({
      activeChat,
      attachedResultIds: new Set(),
      deferredQuery: "add el",
      omnibarSuggestionsEnabled: true,
      searchResults: records.filter((record) => record.category !== "chat"),
      t,
    }),
    ...buildOmnibarRemovalSuggestions({
      activeChat,
      attachedResultIds: new Set(["character:eliza", "persona:elowen"]),
      contextResults: records,
      deferredQuery: "remove",
      omnibarSuggestionsEnabled: true,
      t,
    }),
    ...buildOmnibarIntentShortcuts({
      query: "chat with eli",
      characters: [{ id: "eliza", name: "Eliza Thornwood" }],
      t,
    }),
    ...buildOmnibarIntentShortcuts({ query: "new character Bob", characters: [], t }),
    ...buildOmnibarGlobalMessageResults({
      activeChatId: null,
      chats: [{ chatId: "tavern", chatName: "Tavern Night", chatMode: "roleplay", matches: 1, cast: [] } as never],
      hits: [
        {
          chatId: "tavern",
          chatName: "Tavern Night",
          messageNumber: 2,
          snippet: "The elderberry crates came.",
        } as never,
      ],
      messageSearchQuery: "elderberry",
      t,
    }),
    ...buildOmnibarLorebookEntryResults({
      entries: [
        { id: "gate", lorebookId: "grove", name: "The Elder Gate", keys: ["gate"], content: "An old gate." } as never,
      ],
      lorebookNameById: new Map([["grove", "Elder Grove Codex"]]),
      query: "elder",
      t,
    }),
    ...buildOmnibarMariChatResults({ deferredQuery: "plan", mariChats: [{ id: "m1", name: "Plan the heist" }], t }),
    buildOmnibarContinueResult({ mariEnabled: true, t, workspaceStatus: { active: true, pendingApprovals: [] } })!,
    ...buildOmnibarSlashResults({
      activeChatId: "tavern",
      deferredQuery: "/",
      slashAvailability: {} as never,
      surface: "chat",
    }),
    ...buildOmnibarTryResults(["search", "command"], { search: "s", command: "light mode", mari: "Why?" }, t),
    { id: "docs:faq.md", title: "Importing from SillyTavern", category: "docs", score: 1, icon: "documentation" },
  ];
  assert.ok(rows.length >= 20, "the fixture covers the row builders");
  for (const row of rows) {
    const visual = visualOf(row);
    assert.ok(visual.icon, `${row.id} has a type icon`);
    const record = context.recordById.get(omnibarRecordRowId(row) ?? "")?.preview?.();
    if (record?.media || record?.participants?.length) {
      assert.ok(visual.src || visual.faces?.length, `${row.id} shows its record's picture`);
    }
  }
  const find = (prefix: string) => rows.find((row) => row.id.startsWith(prefix))!;
  assert.equal(visualOf(find("action:add-to-chat:character:eliza")).src, "/a/eliza.png", "add row: the portrait");
  assert.equal(visualOf(find("action:add-to-chat:persona:elowen")).accent, "#e879f9", "add row: the persona colour");
  assert.equal(visualOf(find("action:add-to-chat:lorebook:grove")).kind, "artwork", "add row: the lorebook image");
  assert.equal(visualOf(find("action:detach-from-chat:persona:elowen")).src, "/a/elowen.png", "remove row: the avatar");
  assert.equal(visualOf(find("shortcut:start-chat:eliza")).src, "/a/eliza.png", "start-chat row: the portrait");
  assert.equal(visualOf(find("shortcut:start-chat:eliza")).type, "chat", "start-chat row: badged as a chat");
  const message = visualOf(find("message:tavern:"));
  assert.equal(message.faces?.length, 2, "message row: the chat's faces");
  assert.equal(message.type, "message", "message row: badged as a message");
  assert.equal(visualOf(find("lorebook-entry:")).src, "/l/grove.png", "entry row: its lorebook's image");
  assert.equal(visualOf(find("mari-chat:")).src, "/sprites/mari/idle.webp", "Mari's conversation: her face");
  assert.equal(visualOf(find("ask-professor-mari")).src, "/sprites/mari/idle.webp", "Mari's row: her face");
  assert.equal(visualOf(find("character:kai")).src, undefined, "no picture: the type icon only");
  assert.equal(visualOf(find("slash:")).src, undefined, "a command shows its icon");
  // The Fix row keeps its own text preview but still shows the connection's picture.
  const fix = {
    ...records.find((record) => record.id === "connection:or")!,
    preview: () => ({ kind: "docs" as const }),
  };
  assert.equal(visualOf(fix).src, "/c/or.png", "Fix row: the connection's image");
  // Highlights: rows the search never built are matched too; a quoted query and an existing range are kept as is.
  assert.deepEqual(visualOf(find("docs:faq.md"), "import").titleMatch, [0, 6], "docs rows are highlighted");
  assert.deepEqual(visualOf(find("action:add-to-chat:character:eliza"), "eliza").titleMatch, [4, 9]);
  assert.equal(visualOf({ ...find("ask-professor-mari"), title: "Ask Prof. Mari: “eliza”" }, "eliza").titleMatch, null);
  assert.equal(visualOf(find("shortcut:create-character"), "bob").titleMatch, null, "a quoted name is not bolded");
  assert.equal(visualOf({ ...records[0]!, titleMatch: null }, "eliza").titleMatch, null, "the search's null stays");
}

// Slice 79b: the "Add [Eliza] to [Tavern Night]" line shows only when a verb sentence resolved to one record.
{
  const t = ((_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/{{(\w+)}}/g, (_m, name: string) => String(values?.[name] ?? ""))) as never;
  const chats = [
    { id: "tavern", name: "Tavern Night" },
    { id: "herb", name: "Herb garden" },
    { id: "herb2", name: "Herb garden" },
  ];
  const chatNameById = new Map(chats.map((chat) => [chat.id, chat.name] as const));
  const people: OmnibarResult[] = [
    { id: "character:eliza", title: "Eliza Thornwood", category: "character", score: 1 },
    { id: "character:elias", title: "Elias Vane", category: "character", score: 1 },
  ];
  const open = { id: "tavern", name: "Tavern Night" } as never;
  const add = (query: string, activeChat: never | null, searchResults: OmnibarResult[]) =>
    resolveOmnibarUnderstoodLine(
      buildOmnibarAddSuggestions({
        activeChat,
        attachedResultIds: new Set(),
        chats,
        deferredQuery: query,
        omnibarSuggestionsEnabled: true,
        searchResults,
        t,
      }),
      activeChat,
      chatNameById,
    );
  assert.deepEqual(add("add eliza to tavern night", null, [people[0]!]), {
    kind: "add",
    recordRowId: "character:eliza",
    name: "Eliza Thornwood",
    chatRowId: "chat:tavern",
    chatName: "Tavern Night",
  });
  assert.equal(add("add eliza", open, [people[0]!])?.chatName, "Tavern Night", "no chat named: the open chat");
  assert.equal(add("add eli", open, people), null, "two people match: the rows choose, no line");
  assert.equal(add("add", open, people), null, "a bare verb: no line");
  assert.equal(add("add eliza to herb garden", null, [people[0]!]), null, "two chats tie: no line");
  assert.equal(add("add eliza", null, [people[0]!]), null, "no chat at all: no line");
  const removal = (query: string) =>
    resolveOmnibarUnderstoodLine(
      buildOmnibarRemovalSuggestions({
        activeChat: open,
        attachedResultIds: new Set(people.map((person) => person.id)),
        contextResults: people,
        deferredQuery: query,
        omnibarSuggestionsEnabled: true,
        t,
      }),
      open,
      chatNameById,
    );
  assert.equal(removal("remove elias")?.kind, "remove");
  assert.equal(removal("remove elias")?.chatName, "Tavern Night");
  assert.equal(removal("remove"), null, "a bare remove lists everything: no line");
  const start = (query: string) =>
    resolveOmnibarUnderstoodLine(
      buildOmnibarIntentShortcuts({
        query,
        characters: people.map((person) => ({ id: person.id.slice(10), name: person.title })),
        t,
      }),
      null,
      chatNameById,
    );
  assert.equal(start("chat with eliza")?.recordRowId, "character:eliza");
  assert.equal(start("chat with eli"), null, "two characters: no line");
  assert.equal(start("new character Bob"), null, "a create row is not a resolved record");
  assert.equal(resolveOmnibarUnderstoodLine([], open, chatNameById), null, "a plain search: no line");
}

{
  // Slice 83: a lorebook row never carries a global enable/disable toggle or status chip.
  // The global flag lives in the Lorebooks panel only.
  const t = ((key: string, fallback: string) => fallback) as never;
  const lorebook = {
    id: "lb-global",
    name: "Lore",
    description: "",
    enabled: true,
    characterIds: [],
    personaIds: [],
    tags: [],
    category: "world",
    entries: [],
  } as never;
  const [row] = buildOmnibarLorebookRows({
    lorebooks: [lorebook],
    characterNameById: new Map(),
    personaById: new Map(),
    categoryLabels: {} as never,
    t,
  });
  assert.equal(row?.control, undefined, "a lorebook row exposes no global toggle");
  assert.equal(row?.preview().status, undefined, "a lorebook row shows no Enabled/Disabled chip");
}
