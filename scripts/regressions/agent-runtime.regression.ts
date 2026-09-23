import assert from "node:assert/strict";
import {
  executeAgent,
  executeAgentBatch,
  resolveAgentResultType,
} from "../../packages/server/src/services/agents/agent-executor.js";
import { createAgentPipeline, type ResolvedAgent } from "../../packages/server/src/services/agents/agent-pipeline.js";
import {
  resolveAgentPipelineAgents,
  resolveAgentsDefaultConnectionId,
} from "../../packages/server/src/services/generation/agent-resolution.js";
import {
  applySpotifyAgentPlaybackFallbacks,
  type SpotifyRuntimeAgent,
} from "../../packages/server/src/services/generation/spotify-agent-runtime.js";
import { buildLlamaArgs } from "../../packages/server/src/services/sidecar/sidecar-launch-plan.js";
import {
  BaseLLMProvider,
  type ChatCompletionResult,
  type ChatMessage,
  type ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";
import { agentResultTypeSchema } from "../../packages/shared/src/schemas/agent.schema.js";
import { resolveTrackerRowsUpdate } from "../../packages/shared/src/utils/tracker-updates.js";
import {
  buildLockedInventoryTrackerPatch,
  buildLockedPlayerStatsArrayPatch,
  resolveTrackerGroupUpdate,
} from "../../packages/server/src/routes/generate/generate-route-utils.js";
import {
  applyTrackerFieldLocksToGameStatePatch,
  characterTrackerLockKey,
  customTrackerLockKey,
} from "../../packages/shared/src/utils/tracker-field-locks.js";
import {
  AGENT_RESULT_TYPE_VALUES,
  getAgentContextSources,
  type AgentContext,
  type AgentResult,
} from "../../packages/shared/src/types/agent.js";

const namedRows = [
  { name: "Health", value: 0 },
  { name: "Mood", value: "" },
];
const malformedRows = [{}, null, [], { name: "  " }, { name: 42 }, "bad row"];
const currentCharacters = [
  { characterId: "a", name: "Alice", mood: "calm" },
  { characterId: "b", name: "Bob", mood: "annoyed" },
  { characterId: "c", name: "Carol", mood: "sleepy" },
];
const characterLocks = {
  presentCharacters: currentCharacters,
  fieldLocks: { [characterTrackerLockKey(currentCharacters[1] as any, 1, "mood")]: true },
} as any;
const nextCharacters = resolveTrackerGroupUpdate(
  [{ characterId: "a", name: "Alice", mood: "excited" }, {}, { name: "NewGuy", mood: "scared" }],
  currentCharacters,
  characterLocks,
  "presentCharacters",
);
assert.deepEqual(
  applyTrackerFieldLocksToGameStatePatch({ presentCharacters: nextCharacters }, characterLocks).presentCharacters,
  [{ characterId: "a", name: "Alice", mood: "excited" }, currentCharacters[1], { name: "NewGuy", mood: "scared" }],
  "A blank placeholder cannot shift a locked character onto a new character",
);
assert.deepEqual(
  resolveTrackerRowsUpdate([{ characterId: "npc-1", mood: "wary" }], [], "characterId"),
  [{ characterId: "npc-1", mood: "wary" }],
  "ID-only character rows keep their legacy array behavior",
);
for (const values of [
  [...namedRows, ...malformedRows],
  resolveTrackerRowsUpdate({ updates: malformedRows }, [...namedRows, ...malformedRows])!,
]) {
  assert.deepEqual(
    buildLockedPlayerStatsArrayPatch({ field: "customTrackerFields", values, snapshot: null, lockState: null }).values,
    namedRows,
  );
}
const currentFields = [
  { name: "First", value: 1 },
  { name: "Locked", value: 2 },
  { name: "Last", value: 3 },
];
const customLocks = {
  playerStats: { customTrackerFields: currentFields },
  fieldLocks: { [customTrackerLockKey(currentFields[1]!, "value", 1)]: true },
} as any;
assert.deepEqual(
  buildLockedPlayerStatsArrayPatch({
    field: "customTrackerFields",
    values: [{ name: "First", value: 4 }, null, { name: "New field", value: 5 }],
    snapshot: { playerStats: JSON.stringify(customLocks.playerStats) },
    lockState: customLocks,
  }).values,
  [{ name: "First", value: 4 }, currentFields[1], { name: "New field", value: 5 }],
  "Custom rows are cleaned only after positional locks have been applied",
);
assert.deepEqual(
  resolveTrackerRowsUpdate(
    { updates: [{ characterId: "alice", mood: "happy" }] },
    [{ characterId: "alice", name: "Alice" }],
    "characterId",
  ),
  [{ characterId: "alice", name: "Alice", mood: "happy" }],
  "ID-only character updates keep the existing name",
);
class RecordingProvider extends BaseLLMProvider {
  calls = 0;
  options: ChatOptions[] = [];
  messages: ChatMessage[][] = [];

  constructor(private readonly content = JSON.stringify({ text: "ok" })) {
    super("http://localhost", "");
  }

  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<string, void, unknown> {
    return;
  }

  override async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    this.calls += 1;
    this.messages.push(messages);
    this.options.push(options);
    return {
      content: this.content,
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 12, totalTokens: 112 },
    };
  }
}

class ConcurrencyRecordingProvider extends RecordingProvider {
  activeCalls = 0;
  maxActiveCalls = 0;

  override async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    this.activeCalls += 1;
    this.maxActiveCalls = Math.max(this.maxActiveCalls, this.activeCalls);
    try {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return await super.chatComplete(messages, options);
    } finally {
      this.activeCalls -= 1;
    }
  }
}

const makeAgent = (type: string, resultType = "context_injection"): ResolvedAgent => ({
  id: type,
  type,
  name: type,
  phase: "post_processing",
  promptTemplate: `${type} prompt`,
  connectionId: "connection-1",
  settings: { resultType, contextSize: 4, maxTokens: 512 },
  isCustomAgent: false,
  provider: new RecordingProvider(),
  model: "agent-model",
});

const context: AgentContext = {
  chatId: "agent-runtime-regression",
  chatMode: "roleplay",
  recentMessages: [],
  characters: [],
  persona: null,
  memory: {},
  writableLorebookIds: null,
  chatSummary: null,
  streaming: false,
};

// This test oracle intentionally duplicates the public compatibility contract so
// coordinated production changes cannot make a breaking vocabulary edit invisible.
const EXPECTED_AGENT_RESULT_TYPE_VALUES = [
  "game_state_update",
  "text_rewrite",
  "sprite_change",
  "echo_message",
  "quest_update",
  "image_prompt",
  "context_injection",
  "continuity_check",
  "director_event",
  "lorebook_update",
  "character_card_update",
  "character_card_create",
  "background_change",
  "character_tracker_update",
  "persona_stats_update",
  "custom_tracker_update",
  "inventory_tracker_update",
  "spotify_control",
  "youtube_control",
  "local_music_control",
  "haptic_command",
  "cyoa_choices",
  "secret_plot",
  "game_master_narration",
  "party_action",
  "game_map_update",
  "game_state_transition",
  "prompt_patch",
  "character_activity_update",
  "frontend_theme_update",
  "about_me_update",
  "memory_nag",
] as const;

assert.deepEqual(
  AGENT_RESULT_TYPE_VALUES,
  EXPECTED_AGENT_RESULT_TYPE_VALUES,
  "agent result vocabulary must retain its exact public values and order",
);
assert.deepEqual(
  agentResultTypeSchema.options,
  EXPECTED_AGENT_RESULT_TYPE_VALUES,
  "agent result schema must retain the public vocabulary order",
);
assert.equal(
  agentResultTypeSchema.safeParse("unrecognized_result_type").success,
  false,
  "agent result schema must reject unknown values",
);
for (const resultType of AGENT_RESULT_TYPE_VALUES) {
  assert.equal(agentResultTypeSchema.safeParse(resultType).success, true, `${resultType} must be schema-accepted`);
  assert.equal(
    resolveAgentResultType({ type: "custom-agent", settings: { resultType } }),
    resultType,
    `${resultType} must be runtime-admitted`,
  );
}
assert.equal(
  resolveAgentResultType({ type: "world-state", settings: { resultType: "unrecognized_result_type" } }),
  "game_state_update",
  "an unknown configured result type should retain its built-in mapping fallback",
);
assert.equal(
  resolveAgentResultType({ type: "custom-agent", settings: { resultType: "unrecognized_result_type" } }),
  "context_injection",
  "an unknown configured result type should fall back to context injection when unmapped",
);

const defaultTemperatureProvider = new RecordingProvider();
await executeAgent(makeAgent("temperature-default"), context, defaultTemperatureProvider, "agent-model");
assert.equal(defaultTemperatureProvider.options[0]?.temperature, 0.7, "unset agent temperature should default to 0.7");

const configuredTemperatureProvider = new RecordingProvider();
await executeAgent(
  {
    ...makeAgent("temperature-configured"),
    temperature: 0.5,
    enabledParameters: { temperature: true },
  },
  context,
  configuredTemperatureProvider,
  "agent-model",
);
assert.equal(configuredTemperatureProvider.options[0]?.temperature, 0.5);
assert.equal(configuredTemperatureProvider.options[0]?.enabledParameters?.temperature, true);

const disabledTemperatureProvider = new RecordingProvider();
await executeAgent(
  {
    ...makeAgent("temperature-disabled"),
    temperature: 0.5,
    enabledParameters: { temperature: false },
  },
  context,
  disabledTemperatureProvider,
  "agent-model",
);
assert.equal(disabledTemperatureProvider.options[0]?.temperature, undefined);

const repairedJsonProvider = new RecordingProvider("```json\n{weather: 'rain', nested: {value: 1}");
const repairedJsonResult = await executeAgent(
  makeAgent("world-state", "game_state_update"),
  context,
  repairedJsonProvider,
  "agent-model",
);
assert.equal(repairedJsonResult.success, true, "structured agents should recover repairable JSON without a retry");
assert.equal(repairedJsonProvider.calls, 1, "repairable JSON should not spend another model call");
assert.deepEqual(repairedJsonResult.data, { weather: "rain", nested: { value: 1 } });

// Inventory replacement is destructive: incomplete JSON and malformed rows
// must fail before the same patch helper used by generation/retry can save them.
const inventoryAgent = makeAgent("inventory-tracker", "inventory_tracker_update");
const savedInventory = {
  inventoryTrackerCurrencies: [{ name: "Gold", qty: 8 }],
  inventoryTrackerEquipped: [{ name: "Sword" }],
  inventoryTrackerInventory: [{ name: "Rope" }, { name: "Potion", qty: 3 }],
};
for (const output of [
  '{"currencies": [], "equipped": [], "inventory": [',
  '{"inventory": [{"name":"Rope"}',
  '{"inventory": [null]}',
  '{"inventory": [{"name":"Rope"}, {"qty":3}]}',
  '{"inventory": {"updates":[{"name":""}], "removed":["Potion"]}}',
  '{"inventory": {"updates":[], "removed":[42]}}',
  '{"inventory": null}',
]) {
  const provider = new RecordingProvider(output);
  const result = await executeAgent(inventoryAgent, context, provider, "agent-model");
  assert.equal(result.success, false, `unsafe inventory output must fail: ${output}`);
  assert.equal(provider.calls, 2, "unsafe output keeps the existing single retry");
  const next = result.success
    ? buildLockedInventoryTrackerPatch({
        data: result.data as Record<string, unknown>,
        snapshot: { playerStats: savedInventory },
        lockState: null,
      }).playerStats
    : savedInventory;
  assert.deepEqual(next, savedInventory, "a failed result must not remove any saved group or row");
}
for (const output of [
  {},
  { inventory: [] },
  { inventory: [{ name: "Rope", qty: 2 }] },
  { inventory: { updates: [{ name: "Potion", qty: 2 }], removed: ["Rope"] } },
]) {
  const result = await executeAgent(
    inventoryAgent,
    context,
    new RecordingProvider(`\`\`\`json\n${JSON.stringify(output)}\n\`\`\``),
    "agent-model",
  );
  assert.equal(result.success, true, "complete legacy/incremental output and no-op objects remain supported");
  assert.deepEqual(result.data, output);
}
const brokenInventoryBatch = await executeAgentBatch(
  [inventoryAgent, makeAgent("world-state", "game_state_update")],
  context,
  new RecordingProvider('{"world-state":{"weather":"rain"},"inventory-tracker":{"inventory":['),
  "agent-model",
);
assert.equal(
  brokenInventoryBatch.find((result) => result.agentType === "inventory-tracker")?.success,
  false,
  "batch JSON repair must not hide an incomplete inventory array from validation",
);

// Custom Tracker accepts the same incremental envelope at the root or under fields.
const trackerUpdates = { updates: [{ name: "Trust", value: "49/100" }], removed: ["Obsolete"] };
for (const output of [trackerUpdates, { fields: trackerUpdates }]) {
  const result = await executeAgent(
    makeAgent("custom-tracker", "custom_tracker_update"),
    context,
    new RecordingProvider(JSON.stringify({ ...output, reasoning: "A new milestone." })),
    "agent-model",
  );
  assert.equal(result.success, true);
  const data = result.data as Record<string, unknown>;
  assert.equal(data.reasoning, "A new milestone.");
  assert.deepEqual(
    resolveTrackerRowsUpdate(data.fields, [
      { name: "Trust", value: "48/100", description: "Keep this detail" },
      { name: "Energy", value: "80/100" },
      { name: "Obsolete", value: "old" },
    ]),
    [
      { name: "Trust", value: "49/100", description: "Keep this detail" },
      { name: "Energy", value: "80/100" },
    ],
    "top-level incremental output must reach the existing row merge without losing omitted values",
  );
}
for (const output of [
  { fields: [{ name: "Trust", value: "49/100" }] },
  { fields: [], ...trackerUpdates },
  { updates: "invalid" },
  {},
]) {
  const result = await executeAgent(
    makeAgent("custom-tracker", "custom_tracker_update"),
    context,
    new RecordingProvider(JSON.stringify(output)),
    "agent-model",
  );
  assert.deepEqual(result.data, output, "explicit fields and invalid/empty envelopes retain their meaning");
}

const invalidJsonProvider = new RecordingProvider("not JSON at all");
const invalidJsonResult = await executeAgent(
  makeAgent("world-state", "game_state_update"),
  context,
  invalidJsonProvider,
  "agent-model",
);
assert.equal(invalidJsonResult.success, false, "non-JSON agent output must still fail after the repair attempt");
assert.equal(invalidJsonProvider.calls, 2, "unrepairable JSON should retain the existing single retry");

const arrayJsonProvider = new RecordingProvider('[{"weather":"rain"}]');
const arrayJsonResult = await executeAgent(
  makeAgent("world-state", "game_state_update"),
  context,
  arrayJsonProvider,
  "agent-model",
);
assert.equal(arrayJsonResult.success, false, "structured agent output must be a JSON object, not an array");
assert.equal(arrayJsonProvider.calls, 2, "array-shaped JSON should retain the existing single retry");

// #5537: with reasoning_format "none" a local runtime leaves thinking inline in
// content; JSON extraction must strip the leading block instead of failing.
const inlineThinkingProvider = new RecordingProvider('<think>the user wants weather</think>\n{"weather":"rain"}');
const inlineThinkingResult = await executeAgent(
  makeAgent("world-state", "game_state_update"),
  context,
  inlineThinkingProvider,
  "agent-model",
);
assert.equal(inlineThinkingResult.success, true, "a leading thinking block must not fail JSON agents");
assert.equal(inlineThinkingProvider.calls, 1, "thinking-prefixed JSON should parse without a retry");
assert.deepEqual(inlineThinkingResult.data, { weather: "rain" });

// A fenced payload INSIDE the thinking block must not win the fence heuristic.
const fencedThinkingProvider = new RecordingProvider(
  '<think>draft: ```json\n{"weather":"draft"}\n```</think>\n{"weather":"final"}',
);
const fencedThinkingResult = await executeAgent(
  makeAgent("world-state", "game_state_update"),
  context,
  fencedThinkingProvider,
  "agent-model",
);
assert.equal(fencedThinkingResult.success, true);
assert.deepEqual(fencedThinkingResult.data, { weather: "final" }, "the payload after the thinking block must win");

// #5537: Gemma 4's <|"|> string delimiters parse in the tool-call path and must
// parse in the agent JSON path too.
const gemmaDelimiterProvider = new RecordingProvider('{<|"|>weather<|"|>: <|"|>rain<|"|>}');
const gemmaDelimiterResult = await executeAgent(
  makeAgent("world-state", "game_state_update"),
  context,
  gemmaDelimiterProvider,
  "agent-model",
);
assert.equal(gemmaDelimiterResult.success, true, "Gemma 4 string delimiters must not fail JSON agents");
assert.equal(gemmaDelimiterProvider.calls, 1);
assert.deepEqual(gemmaDelimiterResult.data, { weather: "rain" });

// #5537: JSON agents on the local sidecar are grammar-constrained via
// response_format json_object; other connections keep prompt-only behavior.
const sidecarFormatProvider = new RecordingProvider('{"weather":"rain"}');
await executeAgent(
  { ...makeAgent("world-state", "game_state_update"), connectionId: "__local_sidecar__" },
  context,
  sidecarFormatProvider,
  "local-sidecar",
);
assert.deepEqual(
  sidecarFormatProvider.options[0]?.responseFormat,
  { type: "json_object" },
  "sidecar JSON agents must request grammar-constrained output",
);

const remoteFormatProvider = new RecordingProvider('{"weather":"rain"}');
await executeAgent(makeAgent("world-state", "game_state_update"), context, remoteFormatProvider, "agent-model");
assert.equal(
  remoteFormatProvider.options[0]?.responseFormat,
  undefined,
  "non-sidecar agents must not gain a response format",
);

// Text-result agents must stay unconstrained even on the sidecar.
const sidecarTextProvider = new RecordingProvider("plain prose");
await executeAgent(makeAgent("custom", "context_injection"), context, sidecarTextProvider, "local-sidecar");
assert.equal(
  sidecarTextProvider.options[0]?.responseFormat,
  undefined,
  "text agents on the sidecar must not be JSON-constrained",
);

// #5539: the sidecar can be the agents default without owning a connection
// row. The sentinel is substituted only while the sidecar is available;
// unavailable it degrades to the row default (or null) instead of feeding the
// sentinel into the default slot, which would bypass the skip guard.
assert.equal(
  resolveAgentsDefaultConnectionId({
    useLocalSidecarAsAgentsDefault: true,
    localSidecarAvailable: true,
    rowDefaultConnectionId: "row-1",
  }),
  "__local_sidecar__",
  "the sidecar agents default must win over a row default while available",
);
assert.equal(
  resolveAgentsDefaultConnectionId({
    useLocalSidecarAsAgentsDefault: true,
    localSidecarAvailable: false,
    rowDefaultConnectionId: "row-1",
  }),
  "row-1",
  "an unavailable sidecar default must degrade to the row default",
);
assert.equal(
  resolveAgentsDefaultConnectionId({
    useLocalSidecarAsAgentsDefault: false,
    localSidecarAvailable: true,
    rowDefaultConnectionId: "row-1",
  }),
  "row-1",
  "the row default must hold when the sidecar flag is off",
);
assert.equal(
  resolveAgentsDefaultConnectionId({
    useLocalSidecarAsAgentsDefault: true,
    localSidecarAvailable: false,
    rowDefaultConnectionId: null,
  }),
  null,
  "no default at all must stay null so agents inherit the chat connection",
);

const toolJsonProvider = new RecordingProvider('{"weather":"rain"}');
await executeAgent(
  {
    ...makeAgent("world-state", "game_state_update"),
    enabledParameters: { temperature: true },
  },
  context,
  toolJsonProvider,
  "agent-model",
  {
    tools: [
      {
        type: "function",
        function: { name: "lookup", description: "Look up context", parameters: { type: "object" } },
      },
    ],
    executeToolCall: async () => "unused",
  },
);
assert.equal(toolJsonProvider.options[0]?.reasoningEffort, "none", "JSON agents with tools should disable reasoning");
assert.deepEqual(
  toolJsonProvider.options[0]?.enabledParameters,
  { temperature: true, reasoningEffort: true },
  "the JSON reasoning override should preserve the connection's other parameter switches",
);

const batchReasoningProvider = new RecordingProvider(
  JSON.stringify({
    "world-state": { weather: "rain" },
    quest: { quests: [] },
  }),
);
await executeAgentBatch(
  [makeAgent("world-state", "game_state_update"), makeAgent("quest", "quest_update")],
  context,
  batchReasoningProvider,
  "agent-model",
);
assert.equal(
  batchReasoningProvider.options[0]?.reasoningEffort,
  "none",
  "batched agent requests should disable reasoning because the combined response must be JSON",
);
assert.equal(batchReasoningProvider.options[0]?.enabledParameters?.reasoningEffort, true);

const inheritedReasoningProvider = new RecordingProvider('{"weather":"rain"}');
await executeAgent(
  {
    ...makeAgent("world-state", "game_state_update"),
    enabledParameters: { reasoningEffort: false },
  },
  context,
  inheritedReasoningProvider,
  "agent-model",
);
assert.equal(
  inheritedReasoningProvider.options[0]?.reasoningEffort,
  undefined,
  "the connection send-switch should still allow the provider default",
);
assert.equal(inheritedReasoningProvider.options[0]?.enabledParameters?.reasoningEffort, false);

const mixedParameterBatchProvider = new RecordingProvider();
await executeAgentBatch(
  [
    {
      ...makeAgent("batch-temperature-low"),
      temperature: 0.2,
      enabledParameters: { temperature: true },
      suppressModelParameters: false,
    },
    {
      ...makeAgent("batch-temperature-high"),
      temperature: 0.8,
      enabledParameters: { temperature: true },
      suppressModelParameters: false,
    },
    {
      ...makeAgent("batch-parameters-suppressed"),
      temperature: 0.4,
      enabledParameters: { temperature: true },
      suppressModelParameters: true,
    },
  ],
  context,
  mixedParameterBatchProvider,
  "agent-model",
);
assert.equal(mixedParameterBatchProvider.calls, 3, "agents with incompatible request options must not share a batch");
assert.deepEqual(
  mixedParameterBatchProvider.options.map((options) => ({
    temperature: options.temperature,
    suppressModelParameters: options.suppressModelParameters ?? false,
  })),
  [
    { temperature: 0.2, suppressModelParameters: false },
    { temperature: 0.8, suppressModelParameters: false },
    { temperature: undefined, suppressModelParameters: true },
  ],
  "split agent requests should retain each agent's temperature and parameter policy",
);

const storedTemperatureResolution = await resolveAgentPipelineAgents({
  connections: {
    getDefaultForAgents: async () => null,
    getFallbackForAgents: async () => null,
    getWithKey: async () => ({
      id: "agent-temperature-connection",
      name: "Agent temperature connection",
      provider: "custom",
      baseUrl: "http://127.0.0.1:65535/v1",
      apiKey: "",
      model: "custom-agent-model",
      maxContext: 32_768,
      defaultParameters: JSON.stringify({
        temperature: 0.55,
        enabledParameters: { temperature: true },
      }),
      maxParallelJobs: 1,
    }),
  } as unknown as Parameters<typeof resolveAgentPipelineAgents>[0]["connections"],
  configuredAgents: [
    {
      ...makeAgent("stored-temperature"),
      connectionId: "agent-temperature-connection",
    },
  ],
  chatId: "stored-agent-temperature",
  chatEnableAgents: true,
  hasPerChatAgentList: false,
  perChatAgentSet: new Set<string>(),
  agentPromptTemplateSelections: {},
  chatProvider: new RecordingProvider(),
  chatConnectionId: "chat-connection",
  chatModel: "agent-model",
  chatCustomParameters: {},
  chatTemperature: 0.9,
  chatEnabledParameters: { temperature: true },
  chatSuppressModelParameters: false,
  chatMaxOutputTokens: null,
  chatMaxParallelJobs: 1,
  chatEnableCaching: false,
  chatAnthropicExtendedCacheTtl: false,
  chatCachingAtDepth: 5,
  resolveBaseUrl: (connection) => connection.baseUrl,
});
assert.equal(storedTemperatureResolution.resolvedAgents[0]?.temperature, 0.55);
assert.equal(storedTemperatureResolution.resolvedAgents[0]?.enabledParameters?.temperature, true);

const spotifyProvider = new RecordingProvider(JSON.stringify({ action: "none", mood: "quiet" }));
let spotifyToolExecutions = 0;
const spotifyAgent: ResolvedAgent = {
  ...makeAgent("spotify", "spotify_control"),
  provider: spotifyProvider,
  toolContext: {
    tools: [
      {
        type: "function",
        function: {
          name: "spotify_search",
          description: "Search Spotify",
          parameters: { type: "object" },
        },
      },
    ],
    executeToolCall: async () => {
      spotifyToolExecutions += 1;
      return JSON.stringify({ tracks: [] });
    },
  },
};
await createAgentPipeline([spotifyAgent], context).postGenerate("The room settles into a quieter mood.");
assert.equal(spotifyProvider.calls, 1, "Spotify Music DJ should make one planning request");
assert.equal(spotifyProvider.options[0]?.tools, undefined, "Spotify planning should not enter the LLM tool loop");
assert.equal(spotifyToolExecutions, 0, "Spotify tools should run later in the deterministic playback stage");

const spotifyFallbackCalls: string[] = [];
let spotifyFallbackReportsActiveUri = true;
const spotifyFallbackAgent = {
  ...makeAgent("spotify", "spotify_control"),
  __spotifyCandidateTracks: [
    { uri: "spotify:track:unavailable", name: "Unavailable", artist: "Regression Artist" },
    { uri: "spotify:track:fallback", name: "Fallback", artist: "Regression Artist" },
  ],
  toolContext: {
    tools: [],
    executeToolCall: async (call) => {
      const args = JSON.parse(call.function.arguments) as { uri?: string };
      spotifyFallbackCalls.push(args.uri ?? "");
      if (args.uri === "spotify:track:unavailable") {
        return JSON.stringify({
          error: "Spotify playback failed to start the selected track on Regression device.",
          verification: "failed",
          ...(spotifyFallbackReportsActiveUri ? { currentUri: "spotify:track:previous" } : {}),
        });
      }
      return JSON.stringify({
        applied: true,
        currentUri: "spotify:track:fallback",
        device: "Regression device",
        queued: 1,
      });
    },
  },
} as SpotifyRuntimeAgent;
const spotifyFallbackPlannerResult: AgentResult = {
  agentId: "spotify",
  agentType: "spotify",
  type: "spotify_control",
  data: {
    action: "play",
    mood: "tense",
    searchQuery: "game soundtrack",
    trackUris: [],
    trackNames: [],
  },
  tokensUsed: 12,
  durationMs: 1,
  success: true,
  error: null,
};
const [spotifyFallbackResult] = await applySpotifyAgentPlaybackFallbacks(
  [spotifyFallbackPlannerResult],
  [spotifyFallbackAgent],
  { ...context, chatMode: "game" },
);
assert.deepEqual(
  spotifyFallbackCalls,
  ["spotify:track:unavailable", "spotify:track:fallback"],
  "Music DJ should try the next deterministic candidate after Spotify accepts but cannot verify the first",
);
assert.equal(spotifyFallbackResult?.success, true);
assert.deepEqual((spotifyFallbackResult?.data as Record<string, unknown>).trackUris, ["spotify:track:fallback"]);

spotifyFallbackReportsActiveUri = false;
spotifyFallbackCalls.length = 0;
const [spotifyMissingUriResult] = await applySpotifyAgentPlaybackFallbacks(
  [spotifyFallbackPlannerResult],
  [spotifyFallbackAgent],
  { ...context, chatMode: "game" },
);
assert.deepEqual(
  spotifyFallbackCalls,
  ["spotify:track:unavailable"],
  "Music DJ must not switch candidates when Spotify verification reports no active URI",
);
assert.equal(spotifyMissingUriResult?.success, false);

const connectionLimitedProvider = new ConcurrencyRecordingProvider();
const connectionLimitedAgents: ResolvedAgent[] = [
  {
    ...makeAgent("tracker-limited"),
    provider: connectionLimitedProvider,
    maxParallelJobs: 1,
    settings: { ...makeAgent("tracker-limited").settings, includeParallelResults: false },
  },
  {
    ...makeAgent("illustrator-limited"),
    provider: connectionLimitedProvider,
    maxParallelJobs: 1,
    settings: { ...makeAgent("illustrator-limited").settings, includeParallelResults: true },
  },
];
await createAgentPipeline(connectionLimitedAgents, context).postGenerate(
  "A shared connection must serialize its jobs.",
);
assert.equal(connectionLimitedProvider.calls, 2, "separate post-processing groups should still make separate requests");
assert.equal(
  connectionLimitedProvider.maxActiveCalls,
  1,
  "Max Parallel Agent Jobs must apply across every post-processing group sharing a connection",
);

const isolatedConnectionLimitedProvider = new ConcurrencyRecordingProvider();
const isolatedConnectionLimitedAgents: ResolvedAgent[] = [
  {
    ...makeAgent("illustrator"),
    id: "illustrator-limited-a",
    provider: isolatedConnectionLimitedProvider,
    maxParallelJobs: 1,
  },
  {
    ...makeAgent("illustrator"),
    id: "illustrator-limited-b",
    provider: isolatedConnectionLimitedProvider,
    maxParallelJobs: 1,
  },
];
await createAgentPipeline(isolatedConnectionLimitedAgents, context).postGenerate(
  "Isolated jobs in one batch group must share the connection limit.",
);
assert.equal(isolatedConnectionLimitedProvider.calls, 2, "isolated agents should still make separate requests");
assert.equal(
  isolatedConnectionLimitedProvider.maxActiveCalls,
  1,
  "Max Parallel Agent Jobs must also serialize isolated configs inside one batch group",
);

const parallelLlamaArgs = buildLlamaArgs({
  modelPath: "/tmp/model.gguf",
  gpuLayers: 0,
  port: 10_019,
  contextSize: 8_192,
  runtimeVariant: "cpu",
  enableNativeToolCalls: false,
  embeddingPooling: "mean",
  embeddingBatchSize: 512,
  maxParallelJobs: 4,
});
assert.deepEqual(
  parallelLlamaArgs.slice(parallelLlamaArgs.indexOf("--parallel"), parallelLlamaArgs.indexOf("--port")),
  ["--parallel", "4", "--ctx-size", "32768"],
  "local parallel slots should preserve the configured context budget per request",
);

for (const batchSize of [512, 4096, 32768]) {
  const args = buildLlamaArgs({
    modelPath: "gemma-4-E2B-it-Q8_0.gguf",
    gpuLayers: 999,
    port: 10_019,
    contextSize: 32768,
    runtimeVariant: "win-x64-hip",
    enableNativeToolCalls: true,
    embeddingPooling: "mean",
    embeddingBatchSize: batchSize,
    maxParallelJobs: 2,
  });
  const logicalBatch = Number(args[args.indexOf("--batch-size") + 1]);
  const physicalBatch = Number(args[args.indexOf("--ubatch-size") + 1]);
  assert.equal(physicalBatch, batchSize);
  assert.equal(logicalBatch, Math.max(2048, batchSize), "logical batch must not silently cap configured embeddings");
}

console.log("Agent runtime regression checks passed.");

// Built-in defaults stay intact; explicit selections also control batched prompts.
assert.equal(getAgentContextSources({ settings: {} }).characters, true);
assert.equal(getAgentContextSources({ settings: {} }).previousOutput, false);
assert.equal(getAgentContextSources({ isCustomAgent: true, settings: {} }).characters, false);
const selectedSources = { chatHistory: true, characters: false, persona: false };
assert.equal(
  getAgentContextSources({ settings: JSON.stringify({ contextSources: selectedSources }) }).characters,
  false,
);
const selectiveAgent = {
  ...makeAgent("world-state", "game_state_update"),
  settings: { ...makeAgent("world-state").settings, contextSources: selectedSources },
};
const selectiveContext: AgentContext = {
  ...context,
  characters: [{ id: "char", name: "Alice", description: "UNIQUE_CHARACTER_CONTEXT" }],
  persona: { name: "Reader", description: "UNIQUE_PERSONA_CONTEXT" },
};
const selectiveProvider = new RecordingProvider('{"weather":"rain"}');
await executeAgent(selectiveAgent, selectiveContext, selectiveProvider, "agent-model");
assert.doesNotMatch(JSON.stringify(selectiveProvider.messages), /UNIQUE_CHARACTER_CONTEXT|UNIQUE_PERSONA_CONTEXT/);
const unionProvider = new RecordingProvider('{"world-state":{"weather":"rain"},"quest":{"quests":[]}}');
await executeAgentBatch(
  [selectiveAgent, makeAgent("quest", "quest_update")],
  selectiveContext,
  unionProvider,
  "agent-model",
);
assert.equal(unionProvider.calls, 1, "agents with different context selections still share one request");
assert.match(JSON.stringify(unionProvider.messages), /UNIQUE_CHARACTER_CONTEXT/);
assert.match(JSON.stringify(unionProvider.messages), /UNIQUE_PERSONA_CONTEXT/);

let previousOutputLoads = 0;
const previousContext: AgentContext = {
  ...selectiveContext,
  loadPreviousOutput: async (agentId) => {
    assert.equal(agentId, selectiveAgent.id);
    previousOutputLoads++;
    return { "agent-context": "BUILT_IN_PRIVATE_PREVIOUS_CONTEXT" };
  },
};
const previousProvider = new RecordingProvider('{"weather":"rain"}');
await executeAgent(
  { ...selectiveAgent, settings: { ...selectiveAgent.settings, contextSources: { previousOutput: true } } },
  previousContext,
  previousProvider,
  "agent-model",
);
assert.equal(previousOutputLoads, 1);
assert.match(JSON.stringify(previousProvider.messages), /BUILT_IN_PRIVATE_PREVIOUS_CONTEXT/);
const noPreviousProvider = new RecordingProvider('{"weather":"rain"}');
await executeAgent(selectiveAgent, previousContext, noPreviousProvider, "agent-model");
assert.equal(previousOutputLoads, 1, "disabled previous output must not be loaded");
assert.doesNotMatch(JSON.stringify(noPreviousProvider.messages), /BUILT_IN_PRIVATE_PREVIOUS_CONTEXT/);
