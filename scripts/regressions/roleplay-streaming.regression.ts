import assert from "node:assert/strict";
import {
  isMessageShadowedByLiveStream,
  reconcileTypewriterReplacement,
  shouldKeepStreamLiveThroughPostProcessing,
} from "../../packages/client/src/lib/generation-stream-policy.js";
import { resolveMessageRewriteVersions } from "../../packages/client/src/lib/message-rewrite-versions.js";
import {
  findLatestTTSAutoplayMessage,
  getTTSAutoplayRevision,
  shouldAutoplayGeneratedTTS,
} from "../../packages/client/src/lib/tts-autoplay.js";
import { getAgentBatchLane, type ResolvedAgent } from "../../packages/server/src/services/agents/agent-pipeline.js";
import { mergePairedBuiltInRewriteAgents } from "../../packages/server/src/services/generation/prose-guardian-settings.js";
import { estimateAgentLoadCost } from "../../packages/shared/src/utils/agent-cost.js";
import {
  ECHO_CHAMBER_MESSAGE_INTERVAL_MAX_MS,
  ECHO_CHAMBER_MESSAGE_INTERVAL_MIN_MS,
  enqueueEchoChamberMessages,
  getEchoChamberMessageInterval,
  resolveEchoChamberPersistedBaseline,
} from "../../packages/client/src/lib/echo-chamber-queue.js";
import { useAgentStore } from "../../packages/client/src/stores/agent.store.js";
import { advanceWeatherFrameClock } from "../../packages/client/src/lib/weather-frame-clock.js";
import { trackerEditableText } from "../../packages/client/src/features/tracker-panel/lib/tracker-display.js";
import { executeAgentBatch } from "../../packages/server/src/services/agents/agent-executor.js";
import { resolveAgentPipelineAgents } from "../../packages/server/src/services/generation/agent-resolution.js";
import {
  BaseLLMProvider,
  type ChatCompletionResult,
  type ChatMessage,
  type ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";
import type { AgentCallDebugEvent, AgentContext } from "../../packages/shared/src/types/agent.js";

assert.equal(
  trackerEditableText({ name: "HP", value: 75, max: 100, color: "#ef4444" }),
  "HP: 75/100",
  "object-shaped tracker values must become editable text instead of invalid React children",
);
assert.equal(trackerEditableText({ nested: true }), '{"nested":true}');

assert.equal(
  shouldKeepStreamLiveThroughPostProcessing({
    streamingEnabled: true,
    shouldDisplayRawStream: true,
    isGameGeneration: false,
    isRegeneration: false,
    isContinuation: false,
  }),
  true,
);
assert.equal(
  shouldKeepStreamLiveThroughPostProcessing({
    streamingEnabled: true,
    shouldDisplayRawStream: true,
    isGameGeneration: false,
    isRegeneration: true,
    isContinuation: false,
  }),
  false,
);

assert.deepEqual(
  reconcileTypewriterReplacement("The response is al", "The response is already complete."),
  {
    visibleText: "The response is al",
    pendingText: "ready complete.",
  },
  "ordinary finalization should keep the unrevealed response in the typewriter queue",
);
assert.deepEqual(
  reconcileTypewriterReplacement("\nThe response is al", "The response is already complete."),
  {
    visibleText: "The response is alr",
    pendingText: "eady complete.",
  },
  "leading-whitespace cleanup must not dump the complete response when tracker work starts",
);
assert.deepEqual(
  reconcileTypewriterReplacement("Dottore: The response", "The response is already complete."),
  {
    visibleText: "The response is alrea",
    pendingText: "dy complete.",
  },
  "speaker-prefix cleanup should preserve reveal progress while adopting authoritative text",
);
assert.deepEqual(
  reconcileTypewriterReplacement("Original", "Rewritten response", true),
  {
    visibleText: "",
    pendingText: "Rewritten response",
  },
  "explicit rewrites should still retype from the beginning",
);

assert.equal(
  isMessageShadowedByLiveStream({
    hasLiveStream: true,
    regenerateMessageId: null,
    streamedMessageId: "saved-assistant",
    messageId: "saved-assistant",
  }),
  true,
  "the durable copy of an active presentation stream should not render beside it",
);
assert.equal(
  isMessageShadowedByLiveStream({
    hasLiveStream: true,
    regenerateMessageId: null,
    streamedMessageId: "current-group-reply",
    messageId: "previous-group-reply",
  }),
  false,
  "earlier group replies must remain visible while the next reply streams",
);
assert.equal(
  isMessageShadowedByLiveStream({
    hasLiveStream: true,
    regenerateMessageId: "saved-assistant",
    streamedMessageId: "saved-assistant",
    messageId: "saved-assistant",
  }),
  false,
  "regeneration owns the existing row in place and must not hide it",
);

const makeAgent = (type: string, resultType: string): ResolvedAgent =>
  ({
    id: type,
    type,
    name: type,
    phase: "post_processing",
    promptTemplate: `${type} prompt`,
    connectionId: "connection-1",
    settings: { resultType, holdForRewrite: true },
    provider: {},
    model: "agent-model",
  }) as ResolvedAgent;

const rewriteAgents = [
  makeAgent("prose-guardian", "text_rewrite"),
  makeAgent("continuity", "text_rewrite"),
  makeAgent("html", "text_rewrite"),
];
const trackerAgent = makeAgent("world-state", "game_state_update");
const merged = mergePairedBuiltInRewriteAgents([...rewriteAgents, trackerAgent]);

assert.equal(merged.length, 2, "the three built-in rewrite agents should share one editor call");
assert.match(merged[0]!.name, /prose-guardian.*continuity.*html/u);
assert.equal(getAgentBatchLane(merged[0]!), "rewrite");
assert.equal(getAgentBatchLane(trackerAgent), "standard");
assert.equal(
  estimateAgentLoadCost(
    [
      ...rewriteAgents.map((agent) => ({
        type: agent.type,
        phase: "post_processing" as const,
        connectionId: "connection-1",
        promptTemplate: agent.promptTemplate,
        resultType: "text_rewrite",
      })),
      {
        type: trackerAgent.type,
        phase: "post_processing" as const,
        connectionId: "connection-1",
        promptTemplate: trackerAgent.promptTemplate,
        resultType: "game_state_update",
      },
    ],
    null,
  ).extraCalls,
  2,
  "rewrite editors should count as one call separate from the tracker call",
);

class CountingTrackerBatchProvider extends BaseLLMProvider {
  calls = 0;

  constructor() {
    super("http://localhost", "");
  }

  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<string, void, unknown> {
    return;
  }

  override async chatComplete(_messages: ChatMessage[], _options: ChatOptions): Promise<ChatCompletionResult> {
    this.calls += 1;
    return {
      content: JSON.stringify({
        expression: { expressions: [] },
        "world-state": { date: "Unknown", time: "Night" },
        background: { chosen: null, generate: null },
      }),
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
    };
  }
}

const trackerBatchProvider = new CountingTrackerBatchProvider();
const trackerBatchDebugEvents: AgentCallDebugEvent[] = [];
const fallbackResolvedAgents = await resolveAgentPipelineAgents({
  connections: {
    getDefaultForAgents: async () => null,
    getFallbackForAgents: async () => null,
    getWithKey: async () => null,
  } as unknown as Parameters<typeof resolveAgentPipelineAgents>[0]["connections"],
  configuredAgents: [
    { ...makeAgent("expression", "sprite_change"), connectionId: null },
    { ...makeAgent("world-state", "game_state_update"), connectionId: null },
    { ...makeAgent("background", "background_change"), connectionId: null },
  ],
  chatId: "tracker-batch-regression",
  chatEnableAgents: true,
  hasPerChatAgentList: false,
  perChatAgentSet: new Set<string>(),
  agentPromptTemplateSelections: {},
  chatProvider: trackerBatchProvider,
  chatConnectionId: "chat-connection",
  chatModel: "agent-model",
  chatCustomParameters: {},
  chatMaxOutputTokens: null,
  chatMaxParallelJobs: 1,
  chatEnableCaching: false,
  chatAnthropicExtendedCacheTtl: false,
  chatCachingAtDepth: 5,
  resolveBaseUrl: () => "",
});

assert.equal(fallbackResolvedAgents.resolvedAgents.length, 3);
assert.ok(
  fallbackResolvedAgents.resolvedAgents.every(
    (agent) => agent.provider === fallbackResolvedAgents.resolvedAgents[0]!.provider,
  ),
  "ordinary generation should reuse one provider wrapper when agents share the chat fallback connection",
);

const trackerBatchResults = await executeAgentBatch(
  [
    makeAgent("expression", "sprite_change"),
    makeAgent("world-state", "game_state_update"),
    makeAgent("background", "background_change"),
  ],
  {
    chatId: "tracker-batch-regression",
    chatMode: "roleplay",
    recentMessages: [],
    mainResponse: "Night settles over the lake.",
    gameState: null,
    characters: [],
    persona: null,
    memory: {},
    activatedLorebookEntries: null,
    writableLorebookIds: null,
    chatSummary: null,
    streaming: false,
    agentDebug: (event) => trackerBatchDebugEvents.push(event),
  } satisfies AgentContext,
  trackerBatchProvider,
  "agent-model",
);

assert.equal(trackerBatchProvider.calls, 1, "compatible tracker agents should share one provider request");
assert.equal(trackerBatchResults.length, 3);
assert.ok(trackerBatchResults.every((result) => result.success));
assert.deepEqual(
  trackerBatchDebugEvents.map((event) => ({
    stage: event.stage,
    agentType: event.agentType,
    batchedAgentTypes: event.batchedAgentTypes,
  })),
  [
    {
      stage: "request",
      agentType: "__batch__",
      batchedAgentTypes: ["expression", "world-state", "background"],
    },
    {
      stage: "response",
      agentType: "__batch__",
      batchedAgentTypes: ["expression", "world-state", "background"],
    },
  ],
  "tracker batch debug output should describe the real combined request",
);

const queuedEchoBatch = enqueueEchoChamberMessages(
  {
    messages: [{ characterName: "Watcher", reaction: "The old reaction.", timestamp: 1 }],
    visibleCount: 1,
    baseline: 1,
  },
  [
    { characterName: "Watcher A", reaction: "First new reaction." },
    { characterName: "Watcher B", reaction: "Second new reaction." },
    { characterName: "Watcher C", reaction: "Third new reaction." },
  ],
  100,
);
assert.equal(queuedEchoBatch.messages.length, 4);
assert.equal(queuedEchoBatch.visibleCount, 1, "a fresh Echo result must remain behind the reveal cursor");
assert.equal(queuedEchoBatch.baseline, 1);
assert.equal(getEchoChamberMessageInterval(0), ECHO_CHAMBER_MESSAGE_INTERVAL_MIN_MS);
assert.equal(getEchoChamberMessageInterval(0.5), 20_000);
assert.ok(getEchoChamberMessageInterval(0.999999) < ECHO_CHAMBER_MESSAGE_INTERVAL_MAX_MS);
assert.equal(getEchoChamberMessageInterval(1), ECHO_CHAMBER_MESSAGE_INTERVAL_MAX_MS);

const staleEchoCursor = enqueueEchoChamberMessages(
  { messages: [], visibleCount: 99, baseline: 99 },
  [{ characterName: "Watcher", reaction: "Do not dump me." }],
  200,
);
assert.equal(staleEchoCursor.visibleCount, 0, "stale reveal counters must clamp before a new batch is queued");
assert.equal(
  resolveEchoChamberPersistedBaseline(
    [
      { characterName: "Old", reaction: "Persisted history.", timestamp: 50 },
      { characterName: "New A", reaction: "Generated during load.", timestamp: 101 },
      { characterName: "New B", reaction: "Also generated during load.", timestamp: 101 },
    ],
    100,
  ),
  1,
  "an Echo result persisted during the initial load must stay queued instead of appearing all at once",
);

useAgentStore.setState({
  echoMessages: queuedEchoBatch.messages,
  echoVisibleCount: queuedEchoBatch.visibleCount,
  echoBaseline: queuedEchoBatch.baseline,
});
useAgentStore.getState().revealNextEchoMessage();
assert.equal(useAgentStore.getState().echoVisibleCount, 2, "one Echo timer tick must reveal exactly one reaction");
useAgentStore.getState().revealNextEchoMessage();
assert.equal(useAgentStore.getState().echoVisibleCount, 3, "a second Echo timer tick must reveal only the next reaction");

let weatherAccumulator = 0;
let weatherDraws = 0;
for (let frame = 0; frame < 6; frame++) {
  const step = advanceWeatherFrameClock(weatherAccumulator, 1000 / 60);
  weatherAccumulator = step.accumulatedMs;
  if (step.shouldDraw) weatherDraws++;
}
assert.equal(weatherDraws, 3, "60 Hz foreground callbacks should produce an even 30 FPS weather cadence");

const legacyRewrite = resolveMessageRewriteVersions(
  "The polished rewritten reply.",
  { proseGuardianOriginalText: "The original reply." },
  false,
);
assert.equal(legacyRewrite.hasVersions, true, "legacy one-way restore metadata should remain recoverable");
assert.equal(legacyRewrite.alternateText, "The original reply.");

const restoredOriginal = resolveMessageRewriteVersions(
  "The original reply.",
  {
    proseGuardianOriginalText: "The original reply.",
    proseGuardianRewrittenText: "The polished rewritten reply.",
  },
  false,
);
assert.equal(restoredOriginal.hasVersions, true, "the shield should remain after showing the original");
assert.equal(restoredOriginal.showingOriginal, true);
assert.equal(restoredOriginal.alternateText, "The polished rewritten reply.");

const restoredRewrite = resolveMessageRewriteVersions(
  "The polished rewritten reply.",
  {
    proseGuardianOriginalText: "The original reply.",
    proseGuardianRewrittenText: "The polished rewritten reply.",
  },
  false,
);
assert.equal(restoredRewrite.showingOriginal, false);
assert.equal(restoredRewrite.alternateText, "The original reply.");

const previousTTSMessage = {
  id: "assistant-1",
  role: "assistant",
  content: "The previous successful reply.",
  activeSwipeIndex: 0,
};
const previousTTSRevision = getTTSAutoplayRevision(previousTTSMessage);
assert.equal(
  shouldAutoplayGeneratedTTS({
    beforeRevision: previousTTSRevision,
    message: previousTTSMessage,
    generationFailed: false,
  }),
  false,
  "ending a generation without a new assistant revision must not replay the previous audio",
);
assert.equal(
  shouldAutoplayGeneratedTTS({
    beforeRevision: previousTTSRevision,
    message: { ...previousTTSMessage, content: "A partial reply before failure." },
    generationFailed: true,
  }),
  false,
  "a failed generation must not autoplay even if partial assistant text was persisted",
);
assert.equal(
  shouldAutoplayGeneratedTTS({
    beforeRevision: previousTTSRevision,
    message: { id: "assistant-2", role: "assistant", content: "A successful new reply.", activeSwipeIndex: 0 },
    generationFailed: false,
  }),
  true,
  "a successful new assistant message should still autoplay",
);
assert.equal(
  shouldAutoplayGeneratedTTS({
    beforeRevision: previousTTSRevision,
    message: { ...previousTTSMessage, activeSwipeIndex: 1 },
    generationFailed: false,
  }),
  true,
  "a successful regenerated swipe should still autoplay even when its text happens to match",
);
assert.equal(
  findLatestTTSAutoplayMessage([
    previousTTSMessage,
    { id: "user-2", role: "user", content: "Try again.", activeSwipeIndex: 0 },
  ])?.id,
  previousTTSMessage.id,
  "the generation baseline should ignore the user's newest input",
);

process.stdout.write("Roleplay streaming regression passed.\n");
