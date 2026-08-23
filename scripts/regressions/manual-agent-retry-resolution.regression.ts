import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getDefaultAgentPrompt, replaceBuiltInAgentDefinitions } from "../../packages/shared/dist/index.js";
import type { AgentContext, AgentResult } from "../../packages/shared/src/types/agent.js";
import type { BuiltInAgentManifest } from "../../packages/shared/src/features/agents/agent-manifest.types.js";
import type { ResolvedAgent } from "../../packages/server/src/services/agents/agent-pipeline.js";
import { normalizeAgentContextSize } from "../../packages/server/src/services/agents/agent-executor.js";
import {
  getAgentFallbackPrompt,
  resolveEffectiveAgentSettings,
} from "../../packages/server/src/services/generation/agent-resolution.js";
import { resolveAgentGenerationTools } from "../../packages/server/src/services/generation/tool-resolution-runtime.js";
import type { SpotifyRuntimeAgent } from "../../packages/server/src/services/generation/spotify-agent-runtime.js";
import {
  resolveLorebookKeeperRetryAnchor,
  resolveRetryAgentContextPolicy,
  resolveRetryAgentPhaseToolInputs,
  validateSpotifyRetryPlayback,
} from "../../packages/server/src/routes/generate/retry-agents-route.js";

assert.deepEqual(
  [
    { id: "older-message", activeSwipeIndex: 1 },
    { id: "newer-message", activeSwipeIndex: 3 },
    { id: "null-message", activeSwipeIndex: null },
    { id: "default-message" },
  ].map(resolveLorebookKeeperRetryAnchor),
  [
    { messageId: "older-message", swipeIndex: 1 },
    { messageId: "newer-message", swipeIndex: 3 },
    { messageId: "null-message", swipeIndex: 0 },
    { messageId: "default-message", swipeIndex: 0 },
  ],
  "Lorebook Keeper backfill results preserve each target message and swipe anchor",
);

const manifests = [
  {
    id: "parity-agent",
    name: "Parity Agent",
    description: "Regression fixture",
    phase: "post_processing",
    enabledByDefault: true,
    category: "utility",
    defaultTools: ["roll_dice", "search_lorebook"],
    defaultSettings: { maxTokens: 777, contextSize: 11, evolvedSetting: "current-default" },
    promptTemplates: [
      { id: "current", name: "Current", promptTemplate: "Current prompt" },
      { id: "new-option", name: "New option", promptTemplate: "New prompt" },
    ],
    defaultPromptTemplate: "Current prompt",
  },
  {
    id: "expression",
    name: "Expression",
    description: "Retirement fixture",
    phase: "post_processing",
    enabledByDefault: false,
    category: "tracker",
    defaultTools: ["set_expression"],
    defaultPromptTemplate: "Expression prompt",
  },
  {
    id: "spotify",
    name: "Music DJ",
    description: "Spotify fixture",
    phase: "post_processing",
    enabledByDefault: false,
    category: "utility",
    defaultTools: ["spotify_get_current_playback", "spotify_get_playlist_tracks", "spotify_search", "spotify_play"],
    defaultPromptTemplate: "Music prompt",
  },
] satisfies BuiltInAgentManifest[];
replaceBuiltInAgentDefinitions(manifests);

const retryRouteSource = readFileSync(
  new URL("../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
  "utf8",
);
assert.match(
  retryRouteSource,
  /`read-behind:\$\{entry\.resolved\.batchContextKey \?\? entry\.resolved\.id\}`/u,
  "custom lorebook retries targeting the same historical message remain batchable",
);
assert.match(
  retryRouteSource,
  /messageId:\s*historicalTarget\?\.messageId[\s\S]*swipeIndex:\s*historicalTarget\?\.swipeIndex/u,
  "custom lorebook retry events must identify their historical message and swipe",
);
const toolRuntimeSource = readFileSync(
  new URL("../../packages/server/src/services/generation/tool-resolution-runtime.ts", import.meta.url),
  "utf8",
);
const agentArgsStart = toolRuntimeSource.indexOf("export type ResolveAgentGenerationToolsArgs");
const agentArgsEnd = toolRuntimeSource.indexOf("export type ResolvedGenerationTools", agentArgsStart);
const agentArgsSource = toolRuntimeSource.slice(agentArgsStart, agentArgsEnd);
assert.ok(agentArgsStart >= 0 && agentArgsEnd > agentArgsStart);
assert.equal(
  /LLMToolCall|execute|toolName|spotifyExecutionAdapter/.test(agentArgsSource),
  false,
  "Agent retry options must not expose arbitrary post-allowlist tool execution authority",
);
assert.equal(toolRuntimeSource.includes("SpotifyAgentToolExecutionAdapter"), false);
assert.equal(toolRuntimeSource.includes("enabledConfigs?:"), false, "configuration identity input must be required");
assert.equal(retryRouteSource.includes("attachRetrySpotifyToolContexts"), false);
assert.equal(retryRouteSource.includes("applyDefaultBuiltInAgentTools"), false);

// The pure fixtures below cannot observe whether the Fastify route still wires these
// seams, so keep one narrow caller-contract guard without pinning call counts or order.
const retryToolWiringStart = retryRouteSource.indexOf("const phaseToolInputs = resolveRetryAgentPhaseToolInputs({");
const retryToolWiringEnd = retryRouteSource.indexOf("const retryIllustratorPromptAgent", retryToolWiringStart);
const retryToolWiringSource = retryRouteSource.slice(retryToolWiringStart, retryToolWiringEnd);
assert.ok(retryToolWiringStart >= 0 && retryToolWiringEnd > retryToolWiringStart);
assert.match(retryToolWiringSource, /selectedTargetMessage:\s*lastAssistant/);
assert.match(retryToolWiringSource, /await resolveAgentGenerationTools\(\{/);
assert.match(retryToolWiringSource, /if \(activeMusicPlayerSource === null\)/);
assert.match(retryToolWiringSource, /!spotifyToolNames\.has\(toolName\)/);
assert.match(retryToolWiringSource, /gameSpotifyMusicEnabled:\s*activeMusicPlayerSource !== null/);
assert.match(
  retryToolWiringSource,
  /emitMetadataPatch:\s*\(patch\)\s*=>\s*\{[\s\S]{0,120}assertRetrySetupActive\(\);[\s\S]{0,120}sendSseEvent\(reply,\s*\{\s*type:\s*"metadata_patch",\s*data:\s*patch\s*\}\);[\s\S]{0,40}\}/,
);
assert.match(retryToolWiringSource, /observeSpotifyPlaybackBeforePlay:\s*true/);

const makeAgent = (id: string, type: string, settings: Record<string, unknown>): ResolvedAgent =>
  ({
    id,
    type,
    name: id,
    isCustomAgent: true,
    phase: "post_processing",
    promptTemplate: "fixture",
    connectionId: null,
    settings,
    provider: {} as ResolvedAgent["provider"],
    model: "fixture",
  }) as ResolvedAgent;

const createSpotifyAgentsStore = (scopes: string[]) => {
  const spotifyAgent = {
    id: "spotify-fixture",
    type: "spotify",
    settings: {
      spotifyAccessToken: "fake-access-token",
      spotifyRefreshToken: "fake-refresh-token",
      spotifyClientId: "fake-client-id",
      spotifyExpiresAt: Date.now() + 10 * 60_000,
      spotifyScope: scopes.join(" "),
    },
  };
  return {
    getById: async (id: string) => (id === spotifyAgent.id ? spotifyAgent : null),
    getByType: async (type: string) => (type === "spotify" ? spotifyAgent : null),
    update: async () => assert.fail("fresh Spotify fixture credentials must not be refreshed"),
  };
};

const effectiveSettings = resolveEffectiveAgentSettings({
  agentType: "parity-agent",
  settings: JSON.stringify({
    maxTokens: 321,
    enabledTools: ["roll_dice", "search_lorebook"],
    promptTemplates: [{ id: "current", name: "Stored name", promptTemplate: "Stored prompt" }],
  }),
  chatMetadata: {},
});
assert.equal(effectiveSettings.maxTokens, 321, "stored overrides must win over current manifest defaults");
assert.equal(effectiveSettings.evolvedSetting, "current-default", "older rows must receive current manifest defaults");
assert.deepEqual(
  (effectiveSettings.promptTemplates as Array<{ id: string }>).map((option) => option.id),
  ["current", "new-option"],
  "current prompt-template options must merge into older stored rows",
);
assert.deepEqual(
  resolveEffectiveAgentSettings({
    agentType: "expression",
    settings: JSON.stringify({ enabledTools: ["set_expression", "search_lorebook"] }),
  }).enabledTools,
  ["search_lorebook"],
  "retired built-in tools must be removed without dropping ordinary tools",
);
assert.doesNotThrow(() =>
  resolveEffectiveAgentSettings({ agentType: "parity-agent", settings: "{ definitely malformed" }),
);
assert.deepEqual(
  resolveEffectiveAgentSettings({
    agentType: "spotify",
    settings: { musicProvider: "spotify", enabledTools: ["spotify_search"] },
    activeMusicPlayerSource: "custom",
  }).enabledTools,
  [],
  "the active non-Spotify music source must suppress Spotify tools",
);
assert.equal(
  resolveEffectiveAgentSettings({
    agentType: "prose-guardian",
    settings: {},
    chatMetadata: { proseGuardianStyleInstructions: "Prefer concise sentences." },
  }).prefer,
  "Prefer concise sentences.",
);
assert.deepEqual(
  resolveEffectiveAgentSettings({
    agentType: "knowledge-retrieval",
    settings: {},
    chatMetadata: {
      knowledgeAgentSources: {
        "knowledge-retrieval": { sourceLorebookIds: ["book-active"], sourceFileIds: ["file-historical"] },
      },
    },
  }).sourceFileIds,
  ["file-historical"],
);
assert.equal(
  resolveEffectiveAgentSettings({
    agentType: "custom-image-agent",
    settings: { imageConnectionId: "agent-default" },
    chatMetadata: {
      customAgentImageSettings: { "custom-image-agent": { imageConnectionId: "chat-override" } },
    },
  }).imageConnectionId,
  "chat-override",
);

const musicFallbackParity = [
  { agentType: "spotify", settings: {}, fallbackAgentType: "spotify" },
  { agentType: "spotify", settings: { musicProvider: "youtube" }, fallbackAgentType: "youtube" },
  { agentType: "spotify", settings: { musicPlayerSource: "custom" }, fallbackAgentType: "local-music" },
  {
    agentType: "spotify",
    settings: { musicProvider: "custom", musicPlayerSource: "youtube" },
    fallbackAgentType: "youtube",
  },
  { agentType: "parity-agent", settings: {}, fallbackAgentType: "parity-agent" },
] as const;
for (const { agentType, settings, fallbackAgentType } of musicFallbackParity) {
  assert.equal(
    getAgentFallbackPrompt(agentType, settings),
    getDefaultAgentPrompt(fallbackAgentType),
    `normal and retry fallback selection must preserve ${agentType} source precedence`,
  );
}
const resolvedMalformedBuiltIn = makeAgent(
  "resolved-malformed",
  "parity-agent",
  resolveEffectiveAgentSettings({ agentType: "parity-agent", settings: "{ malformed downstream fixture" }),
);
resolvedMalformedBuiltIn.isCustomAgent = false;
const resolvedVectorAgent = makeAgent("resolved-vector", "custom-vector", {
  customCapabilities: { access_vectors: true },
});
const resolvedCustomMusicAgent = makeAgent(
  "resolved-music",
  "spotify",
  resolveEffectiveAgentSettings({
    agentType: "spotify",
    settings: { musicProvider: "spotify" },
    activeMusicPlayerSource: "custom",
  }),
);
resolvedCustomMusicAgent.isCustomAgent = false;
const contextPolicy = resolveRetryAgentContextPolicy([
  resolvedMalformedBuiltIn,
  resolvedVectorAgent,
  resolvedCustomMusicAgent,
]);
assert.deepEqual(
  contextPolicy,
  { contextSize: 11, customAgentVectorAccessEnabled: true, musicPlayerSource: "custom" },
  "retry context composition must consume safe, manifest-merged, source-overlaid resolved settings",
);
assert.equal(
  resolveRetryAgentContextPolicy([resolvedMalformedBuiltIn]).musicPlayerSource,
  null,
  "a Music DJ omitted from the resolved array must not activate retry Music-source context",
);
assert.equal(
  resolveRetryAgentContextPolicy([]).contextSize,
  normalizeAgentContextSize(undefined),
  "an empty retry Agent set must use the canonical context-size default",
);

const historicalContext: AgentContext = {
  chatId: "retry-chat",
  chatMode: "game",
  recentMessages: [
    { id: "old-user", role: "user", content: "historical question" },
    { id: "retry-target", role: "assistant", content: "historical answer", characterId: "char-1" },
  ],
  mainResponse: "historical answer",
  gameState: { turn: 7, location: "archive" },
  characters: [
    { id: "char-2", name: "First Active Character", description: "Appears first in the active chat" },
    { id: "char-1", name: "Archivist", description: "Owns the historical retry target" },
  ],
  persona: { name: "Historian", description: "Studies timelines" },
  memory: {},
  writableLorebookIds: ["book-write"],
  chatSummary: "Prior summary",
  streaming: false,
};

const composedAgent = makeAgent("composed", "custom-composed", {
  enabledTools: [
    "roll_dice",
    "search_lorebook",
    "save_lorebook_entry",
    "read_chat_summary",
    "historical_probe",
    "invalid_probe",
    "edit_chat_message",
    "spotify_search",
  ],
  writableLorebookId: "book-write",
});
let lorebookSearchArgs: Record<string, unknown> | null = null;
let writes = 0;
const metadata = {
  enableTools: true,
  activeToolIds: ["update_about_me"],
  activeLorebookIds: ["book-active"],
  excludedLorebookIds: ["book-hidden"],
  agentWriteApprovalRequired: true,
  summary: "Prior summary",
};
const customTools = [
  {
    name: "historical_probe",
    description: "Static historical probe",
    parametersSchema: {
      type: "object",
      properties: { value: { type: "string" } },
      required: ["value"],
    },
    executionType: "static",
    webhookUrl: null,
    staticResult: "historical-ok",
    scriptBody: null,
    includeHiddenContext: true,
  },
  {
    name: "invalid_probe",
    description: "Invalid schema",
    parametersSchema: { type: "array" },
    executionType: "static",
    webhookUrl: null,
    staticResult: "must-not-run",
    scriptBody: null,
  },
  {
    name: "roll_dice",
    description: "Collision",
    parametersSchema: { type: "object" },
    executionType: "static",
    webhookUrl: null,
    staticResult: "must-not-shadow-built-in",
    scriptBody: null,
  },
];
const preGenerationHistoricalContext: AgentContext = {
  ...historicalContext,
  recentMessages: historicalContext.recentMessages.slice(0, 1),
  mainResponse: "",
  gameState: { turn: 6, location: "anteroom" },
  memory: {},
};
const selectedRetryTarget = historicalContext.recentMessages.at(-1);
const phaseToolInputs = resolveRetryAgentPhaseToolInputs({
  requestBody: { enableTools: true },
  agentContext: historicalContext,
  preGenerationAgentContext: preGenerationHistoricalContext,
  selectedTargetMessage: selectedRetryTarget,
});
assert.equal(phaseToolInputs.default.agentContext, historicalContext);
assert.equal(phaseToolInputs.preGeneration?.agentContext, preGenerationHistoricalContext);
assert.deepEqual(phaseToolInputs.preGeneration?.agentContext.recentMessages, [historicalContext.recentMessages[0]]);
assert.deepEqual(phaseToolInputs.preGeneration?.agentContext.gameState, { turn: 6, location: "anteroom" });
assert.deepEqual(phaseToolInputs.default.promptCharacterIds, ["char-1"]);
assert.deepEqual(phaseToolInputs.preGeneration?.promptCharacterIds, ["char-1"]);
assert.equal(phaseToolInputs.default.requestBody.forCharacterId, "char-1");
assert.equal(phaseToolInputs.preGeneration?.requestBody.forCharacterId, "char-1");
const fallbackPhaseToolInputs = resolveRetryAgentPhaseToolInputs({
  requestBody: { enableTools: true, forCharacterId: "invalid-request-target" },
  agentContext: historicalContext,
  preGenerationAgentContext: preGenerationHistoricalContext,
  selectedTargetMessage: { role: "assistant", characterId: "not-active" },
});
assert.deepEqual(fallbackPhaseToolInputs.default.promptCharacterIds, ["char-2", "char-1"]);
assert.deepEqual(fallbackPhaseToolInputs.preGeneration?.promptCharacterIds, ["char-2", "char-1"]);
assert.equal(fallbackPhaseToolInputs.default.requestBody.forCharacterId, undefined);
assert.equal(fallbackPhaseToolInputs.preGeneration?.requestBody.forCharacterId, undefined);

const runtime = await resolveAgentGenerationTools({
  requestBody: phaseToolInputs.default.requestBody,
  chatId: "retry-chat",
  chatMetadata: metadata,
  chats: {
    getMessage: async (id) => ({
      id,
      chatId: id === "other-chat-message" ? "another-chat" : "retry-chat",
      role: "assistant",
    }),
    updateMessageContent: async () => ({}),
    patchMetadata: async (_chatId, patcher) => ({ metadata: await patcher(metadata) }),
  },
  agentsStore: createSpotifyAgentsStore(["user-modify-playback-state"]),
  customToolsStore: { listEnabled: async () => customTools },
  lorebooksStore: {
    listActiveEntries: async (args) => {
      lorebookSearchArgs = args;
      return [{ name: "Archive", content: "Historical archive", tag: "history", keys: ["archive"] }];
    },
    getById: async () => ({ id: "book-write", name: "Writable" }),
    listEntries: async () => [],
    createEntry: async () => {
      writes += 1;
      return { id: "created" };
    },
    updateEntry: async () => {
      writes += 1;
      return { id: "updated" };
    },
  },
  resolvedAgents: [composedAgent],
  enabledConfigs: [{ id: "spotify-fixture", type: "spotify" }],
  promptCharacterIds: phaseToolInputs.default.promptCharacterIds,
  personaId: "persona-historical",
  activeLorebookIds: ["book-active"],
  excludedLorebookIds: ["book-hidden"],
  excludedSourceAgentIds: ["hidden-source"],
  gameState: historicalContext.gameState,
  gameSpotifyMusicEnabled: true,
  agentContext: historicalContext,
  emitMetadataPatch: () => {},
});

assert.equal(runtime.enableChatTools, false, "Agent-only resolution must not activate normal main-chat tools");
assert.equal(runtime.toolDefs, undefined, "retry must not receive the normal main-chat tool list");
assert.deepEqual(
  composedAgent.toolContext?.tools.map((tool) => tool.function.name),
  ["roll_dice", "search_lorebook", "save_lorebook_entry", "read_chat_summary", "spotify_search", "historical_probe"],
  "ordinary, metadata, Spotify, lorebook, and custom families must compose in one context",
);
assert.equal(
  runtime.baseToolExecutionContext.hiddenContext?.recentMessages.at(-1)?.id,
  "retry-target",
  "custom hidden context must be built from the historical retry target",
);
assert.deepEqual(runtime.baseToolExecutionContext.hiddenContext?.gameState, historicalContext.gameState);
assert.equal(
  runtime.baseToolExecutionContext.hiddenContext?.characterId,
  "char-1",
  "the historical second-character target must override the first active character",
);
assert.equal(runtime.baseToolExecutionContext.hiddenContext?.personaId, "persona-historical");
assert.equal(
  composedAgent.toolContext?.tools.some((tool) => tool.function.name === "edit_chat_message"),
  false,
  "message editing without capability must be denied",
);

const callTool = async (agent: ResolvedAgent, name: string, args: Record<string, unknown>) => {
  assert.ok(agent.toolContext, `expected ${agent.id} to have a tool context`);
  return JSON.parse(
    await agent.toolContext.executeToolCall({
      id: `call-${name}`,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    }),
  ) as Record<string, unknown>;
};

const idempotentWriter = makeAgent("idempotent-writer", "custom-idempotent-writer", {
  enabledTools: ["save_lorebook_entry"],
  writableLorebookId: "book-write",
});
let storedWriterEntry: Record<string, unknown> | null = null;
let writerCreateCount = 0;
let writerPersistenceCount = 0;
await resolveAgentGenerationTools({
  requestBody: {},
  chatId: "retry-chat",
  chatMetadata: { ...metadata, agentWriteApprovalRequired: false },
  chats: {
    getMessage: async () => null,
    updateMessageContent: async () => ({}),
    patchMetadata: async (_chatId, patcher) => ({ metadata: await patcher(metadata) }),
  },
  agentsStore: createSpotifyAgentsStore([]),
  customToolsStore: { listEnabled: async () => [] },
  lorebooksStore: {
    listActiveEntries: async () => [],
    getById: async () => ({ id: "book-write", name: "Writable" }),
    listEntries: async () => (storedWriterEntry ? [storedWriterEntry] : []),
    createEntry: async (entry) => {
      writerPersistenceCount += 1;
      writerCreateCount += 1;
      storedWriterEntry = { ...entry, id: "entry-1" };
      return storedWriterEntry;
    },
    updateEntry: async () => {
      writerPersistenceCount += 1;
      return storedWriterEntry;
    },
  },
  resolvedAgents: [idempotentWriter],
  enabledConfigs: [],
  promptCharacterIds: [],
  personaId: null,
  activeLorebookIds: [],
  excludedLorebookIds: [],
  excludedSourceAgentIds: [],
  gameState: null,
  gameSpotifyMusicEnabled: false,
  agentContext: historicalContext,
  emitMetadataPatch: () => {},
});
const createWriterEntry = { name: "Timeline", content: "Turn seven", keys: ["timeline"], mode: "create" };
assert.equal((await callTool(idempotentWriter, "save_lorebook_entry", createWriterEntry)).action, "created");
assert.equal((await callTool(idempotentWriter, "save_lorebook_entry", createWriterEntry)).action, "exists");
assert.equal(writerCreateCount, 1, "Retrying a create-mode lorebook write must not duplicate the entry");
assert.equal(writerPersistenceCount, 1, "Retrying a create-mode lorebook write must persist only once");

assert.match(
  retryRouteSource,
  /isAgentWriteApprovalEnvelope\(result\.data\)[\s\S]*onLorebookEffectStatus\?\.\(result\.agentId, "pending_approval"\)/u,
  "Approval-required lorebook backfill must remain pending without advancing its cursor",
);
assert.match(
  retryRouteSource,
  /catch \(err\) \{[\s\S]*onLorebookEffectStatus\?\.\(result\.agentId, "failed"\)[\s\S]*Failed to apply lorebook update/u,
  "Failed lorebook persistence must report failure without advancing its cursor",
);
assert.match(
  retryRouteSource,
  /customLorebookBackfillEffectStatus === "applied"[\s\S]*CUSTOM_LOREBOOK_BACKFILL_CURSOR_KEY/u,
  "Custom lorebook backfill cursor advances only after durable application",
);

const rollResult = await callTool(composedAgent, "roll_dice", { notation: "1d2" });
assert.equal(rollResult.notation, "1d2", "built-in collision handling must preserve the built-in implementation");
assert.equal(typeof rollResult.total, "number");
const searchResult = await callTool(composedAgent, "search_lorebook", { query: "archive" });
assert.equal(Array.isArray(searchResult.results), true);
assert.deepEqual(lorebookSearchArgs, {
  chatId: "retry-chat",
  characterIds: ["char-1"],
  personaId: "persona-historical",
  activeLorebookIds: ["book-active"],
  excludedLorebookIds: ["book-hidden"],
  excludedSourceAgentIds: ["hidden-source"],
});
const approval = await callTool(composedAgent, "save_lorebook_entry", {
  name: "Timeline",
  content: "The retry target belongs to turn seven.",
  keys: ["timeline"],
  mode: "create",
});
assert.equal(approval.requiresApproval, true, "lorebook writes must remain approval proposals");
assert.equal(writes, 0, "approval-required writes must not touch lorebook persistence");
const customResult = await callTool(composedAgent, "historical_probe", { value: "ok" });
assert.equal(customResult.result, "historical-ok");
const deniedResult = await callTool(composedAgent, "invalid_probe", {});
assert.match(String(deniedResult.error), /not allowed/i, "invalid custom schemas must not enter the allowlist");

const editAgent = makeAgent("editor", "custom-editor", {
  enabledTools: ["edit_chat_message"],
  customCapabilities: { edit_messages: true },
});
await resolveAgentGenerationTools({
  requestBody: {},
  chatId: "retry-chat",
  chatMetadata: metadata,
  chats: {
    getMessage: async (id) => ({ id, chatId: "another-chat", role: "assistant" }),
    updateMessageContent: async () => ({}),
    patchMetadata: async (_chatId, patcher) => ({ metadata: await patcher(metadata) }),
  },
  agentsStore: {},
  customToolsStore: { listEnabled: async () => [] },
  lorebooksStore: {
    listActiveEntries: async () => [],
    getById: async () => null,
    listEntries: async () => [],
    createEntry: async () => null,
    updateEntry: async () => null,
  },
  resolvedAgents: [editAgent],
  enabledConfigs: [],
  promptCharacterIds: ["char-1"],
  personaId: null,
  activeLorebookIds: [],
  excludedLorebookIds: [],
  excludedSourceAgentIds: [],
  gameState: null,
  gameSpotifyMusicEnabled: false,
  agentContext: historicalContext,
  emitMetadataPatch: () => {},
});
assert.match(
  String((await callTool(editAgent, "edit_chat_message", { messageId: "other-chat-message", content: "no" })).error),
  /not found in this chat/i,
  "message editing must retain same-chat ownership enforcement",
);

const unavailableSpotifyAgent = makeAgent("no-spotify", "custom-no-spotify", {
  enabledTools: ["roll_dice", "spotify_search"],
});
await resolveAgentGenerationTools({
  requestBody: {},
  chatId: "retry-chat",
  chatMetadata: metadata,
  chats: {
    getMessage: async () => null,
    updateMessageContent: async () => ({}),
    patchMetadata: async (_chatId, patcher) => ({ metadata: await patcher(metadata) }),
  },
  agentsStore: createSpotifyAgentsStore([]),
  customToolsStore: { listEnabled: async () => [] },
  lorebooksStore: {
    listActiveEntries: async () => [],
    getById: async () => null,
    listEntries: async () => [],
    createEntry: async () => null,
    updateEntry: async () => null,
  },
  resolvedAgents: [unavailableSpotifyAgent],
  enabledConfigs: [],
  promptCharacterIds: [],
  personaId: null,
  activeLorebookIds: [],
  excludedLorebookIds: [],
  excludedSourceAgentIds: [],
  gameState: null,
  gameSpotifyMusicEnabled: false,
  agentContext: historicalContext,
  emitMetadataPatch: () => {},
});
assert.deepEqual(
  unavailableSpotifyAgent.toolContext?.tools.map((tool) => tool.function.name),
  ["roll_dice"],
  "Spotify tools must be denied to ordinary agents when the required scope is unavailable",
);
assert.match(
  String((await callTool(unavailableSpotifyAgent, "spotify_search", {})).error),
  /not allowed/i,
  "per-Agent execution allowlisting must reject omitted names",
);

const youtubeMusicDjWithoutTools = makeAgent("youtube-tool-free", "spotify", {
  musicProvider: "youtube",
  enabledTools: [],
});
let youtubeToolFreeCustomToolLoads = 0;
const youtubeToolFreeRuntime = await resolveAgentGenerationTools({
  requestBody: {},
  chatId: "retry-chat",
  chatMetadata: {},
  chats: {
    getMessage: async () => null,
    updateMessageContent: async () => ({}),
    patchMetadata: async (_chatId, patcher) => ({ metadata: await patcher({}) }),
  },
  agentsStore: {},
  customToolsStore: {
    listEnabled: async () => {
      youtubeToolFreeCustomToolLoads += 1;
      return [];
    },
  },
  lorebooksStore: {
    listActiveEntries: async () => [],
    getById: async () => null,
    listEntries: async () => [],
    createEntry: async () => null,
    updateEntry: async () => null,
  },
  resolvedAgents: [youtubeMusicDjWithoutTools],
  enabledConfigs: [],
  promptCharacterIds: [],
  personaId: null,
  activeLorebookIds: [],
  excludedLorebookIds: [],
  excludedSourceAgentIds: [],
  gameState: null,
  gameSpotifyMusicEnabled: true,
  agentContext: historicalContext,
  emitMetadataPatch: () => {},
});
assert.equal(
  youtubeToolFreeCustomToolLoads,
  0,
  "a tool-free YouTube Music DJ must not load custom or built-in tool definitions",
);
assert.equal(youtubeToolFreeRuntime.toolDefs, undefined);
assert.equal(
  youtubeMusicDjWithoutTools.toolContext,
  undefined,
  "a tool-free YouTube Music DJ must not receive tool context",
);

const disabledSpotifyAgent = makeAgent("spotify-disabled", "spotify", { enabledTools: [] });
let disabledSpotifyCredentialReads = 0;
let disabledSpotifyToolLoads = 0;
await resolveAgentGenerationTools({
  requestBody: {},
  chatId: "retry-chat",
  chatMetadata: {},
  chats: {
    getMessage: async () => null,
    updateMessageContent: async () => ({}),
    patchMetadata: async (_chatId, patcher) => ({ metadata: await patcher({}) }),
  },
  agentsStore: {
    getById: async () => {
      disabledSpotifyCredentialReads += 1;
      return null;
    },
    getByType: async () => {
      disabledSpotifyCredentialReads += 1;
      return null;
    },
  },
  customToolsStore: {
    listEnabled: async () => {
      disabledSpotifyToolLoads += 1;
      return [];
    },
  },
  lorebooksStore: {
    listActiveEntries: async () => [],
    getById: async () => null,
    listEntries: async () => [],
    createEntry: async () => null,
    updateEntry: async () => null,
  },
  resolvedAgents: [disabledSpotifyAgent],
  enabledConfigs: [{ id: "spotify-disabled", type: "spotify" }],
  promptCharacterIds: [],
  personaId: null,
  activeLorebookIds: [],
  excludedLorebookIds: [],
  excludedSourceAgentIds: [],
  gameState: null,
  gameSpotifyMusicEnabled: false,
  agentContext: historicalContext,
  emitMetadataPatch: () => {},
});
assert.deepEqual(disabledSpotifyAgent.settings.enabledTools, []);
assert.equal(disabledSpotifyAgent.toolContext, undefined);
assert.equal(disabledSpotifyCredentialReads, 0, "disabled Spotify retries must not load credentials");
assert.equal(disabledSpotifyToolLoads, 0, "disabled Spotify retries must not load tool definitions");

const spotifyBoundaryAgent = makeAgent("spotify-boundary", "spotify", {}) as SpotifyRuntimeAgent;
let spotifyBoundaryCustomToolLoads = 0;
const spotifyBoundaryEvents: string[] = [];
const unexpectedSpotifyRequests: string[] = [];
const spotifyBoundaryViolations: string[] = [];
let boundaryCurrentUri = "spotify:track:old";
let boundaryRepeatState = "off";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  if (url === "https://api.spotify.com/v1/me/player" && method === "GET") {
    spotifyBoundaryEvents.push(`playback:${boundaryCurrentUri}`);
    return new Response(
      JSON.stringify({
        is_playing: true,
        repeat_state: boundaryRepeatState,
        item: { uri: boundaryCurrentUri, name: "Fixture track", artists: [{ name: "Fixture artist" }] },
        device: { id: "fixture-device", name: "Fixture device", type: "Computer" },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  if (url.startsWith("https://api.spotify.com/v1/me/player/repeat?") && method === "PUT") {
    boundaryRepeatState = new URL(url).searchParams.get("state") ?? boundaryRepeatState;
    spotifyBoundaryEvents.push(`repeat:${boundaryRepeatState}`);
    return new Response(null, { status: 204 });
  }
  if (url.startsWith("https://api.spotify.com/v1/me/player/play") && method === "PUT") {
    const body = JSON.parse(String(init?.body)) as { uris?: string[] };
    if (JSON.stringify(body.uris) !== JSON.stringify(["spotify:track:new"])) {
      spotifyBoundaryViolations.push(`unexpected play uris: ${JSON.stringify(body.uris)}`);
    }
    boundaryCurrentUri = "spotify:track:new";
    spotifyBoundaryEvents.push("play:spotify:track:new");
    return new Response(null, { status: 204 });
  }
  unexpectedSpotifyRequests.push(`${method} ${url}`);
  return new Response(null, { status: 500 });
};
try {
  await resolveAgentGenerationTools({
    requestBody: {},
    chatId: "retry-chat",
    chatMetadata: metadata,
    chats: {
      getMessage: async () => null,
      updateMessageContent: async () => ({}),
      patchMetadata: async (_chatId, patcher) => ({ metadata: await patcher(metadata) }),
    },
    agentsStore: createSpotifyAgentsStore(["user-read-playback-state", "user-modify-playback-state"]),
    customToolsStore: {
      listEnabled: async () => {
        spotifyBoundaryCustomToolLoads += 1;
        return [];
      },
    },
    lorebooksStore: {
      listActiveEntries: async () => [],
      getById: async () => null,
      listEntries: async () => [],
      createEntry: async () => null,
      updateEntry: async () => null,
    },
    resolvedAgents: [spotifyBoundaryAgent],
    enabledConfigs: [{ id: "spotify-fixture", type: "spotify" }],
    promptCharacterIds: [],
    personaId: null,
    activeLorebookIds: [],
    excludedLorebookIds: [],
    excludedSourceAgentIds: [],
    gameState: null,
    gameSpotifyMusicEnabled: true,
    agentContext: historicalContext,
    emitMetadataPatch: () => {},
    observeSpotifyPlaybackBeforePlay: true,
  });
  assert.deepEqual(
    spotifyBoundaryAgent.settings.enabledTools,
    manifests[2].defaultTools,
    "an eligible Spotify Music DJ with empty settings must receive default tools before tool loading",
  );
  assert.deepEqual(
    spotifyBoundaryAgent.toolContext?.tools.map((tool) => tool.function.name),
    manifests[2].defaultTools,
    "an eligible Spotify Music DJ with empty settings must attach its default tools",
  );
  assert.equal(spotifyBoundaryCustomToolLoads, 1, "eligible Spotify defaults must load tool definitions");
  const boundaryResult = await callTool(spotifyBoundaryAgent, "spotify_play", {
    uri: "spotify:track:new",
    reason: "Boundary regression",
  });
  assert.equal(boundaryResult.applied, true);
} finally {
  globalThis.fetch = originalFetch;
}
assert.deepEqual(unexpectedSpotifyRequests, [], "Spotify boundary requests must stay inside the expected fake API");
assert.deepEqual(
  spotifyBoundaryViolations,
  [],
  "Spotify play requests must preserve the approved single-track payload",
);
assert.deepEqual(
  spotifyBoundaryEvents,
  [
    "playback:spotify:track:old",
    "playback:spotify:track:old",
    "repeat:off",
    "play:spotify:track:new",
    "repeat:track",
    "playback:spotify:track:new",
  ],
  "retry observation must precede exactly one canonical play with repeat-track enforcement",
);
assert.equal(
  spotifyBoundaryEvents.filter((event) => event.startsWith("play:")).length,
  1,
  "the approved canonical spotify_play call must execute exactly once",
);
assert.equal(spotifyBoundaryAgent.__spotifyCurrentBeforePlayUri, "spotify:track:old");
assert.equal(spotifyBoundaryAgent.__spotifyCurrentAfterPlayUri, "spotify:track:new");
assert.equal(spotifyBoundaryAgent.__spotifyRepeatAfterPlayState, "track");

const fallbackCalls: string[] = [];
const fallbackEntry = {
  cfg: { id: "spotify", name: "Music DJ" },
  resolved: {
    ...makeAgent("spotify", "spotify", {}),
    toolContext: {
      tools: [],
      executeToolCall: async (call) => {
        fallbackCalls.push(call.function.name);
        if (call.function.name === "spotify_get_current_playback") {
          return JSON.stringify({ currentUri: "spotify:track:old" });
        }
        if (call.function.name === "spotify_get_playlist_tracks") {
          return JSON.stringify({
            tracks: [{ uri: "spotify:track:fresh", name: "Fresh Song", artists: [{ name: "Artist" }] }],
          });
        }
        return JSON.stringify({
          applied: true,
          currentUri: "spotify:track:fresh",
          repeatState: "track",
          device: "Fake device",
        });
      },
    },
  },
  agentProvider: {},
  agentModel: "fixture",
} as Parameters<typeof validateSpotifyRetryPlayback>[0];
const fallbackContext: AgentContext = {
  ...historicalContext,
  memory: {
    _spotifyDjConstraints: { manualRetry: true, forceFreshPick: true, mode: "game", sourceType: "liked" },
  },
};
const fallbackResult = await validateSpotifyRetryPlayback(
  fallbackEntry,
  {
    agentId: "spotify",
    agentType: "spotify",
    type: "spotify_control",
    success: true,
    data: { action: "none", mood: "tense" },
  } as AgentResult,
  fallbackContext,
);
assert.equal(fallbackResult.success, true);
assert.equal((fallbackResult.data as Record<string, unknown>).deterministicFallbackApplied, true);
assert.deepEqual(fallbackCalls, ["spotify_get_current_playback", "spotify_get_playlist_tracks", "spotify_play"]);

console.info("Manual Agent retry settings/tool parity regression passed.");
