import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getTypewriterRevealCharsPerSecond,
  isGenerationSendBlocked,
  isGenerationStartBlocked,
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
import { api, StreamResumeDisconnectError } from "../../packages/client/src/lib/api-client.js";
import { executeAgentBatch } from "../../packages/server/src/services/agents/agent-executor.js";
import { resolveAgentPipelineAgents } from "../../packages/server/src/services/generation/agent-resolution.js";
import {
  BaseLLMProvider,
  type ChatCompletionResult,
  type ChatMessage,
  type ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";
import type { AgentCallDebugEvent, AgentContext } from "../../packages/shared/src/types/agent.js";
import { CSRF_HEADER, CSRF_HEADER_VALUE } from "../../packages/shared/src/constants/security.js";

const retryAgentRouteSource = readFileSync(
  new URL("../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
  "utf8",
);
const generateRouteSource = readFileSync(
  new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url),
  "utf8",
);
const chatInputSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ChatInput.tsx", import.meta.url),
  "utf8",
);
const conversationInputSource = readFileSync(
  new URL("../../packages/client/src/components/chat/ConversationInput.tsx", import.meta.url),
  "utf8",
);
const useGenerateSource = readFileSync(
  new URL("../../packages/client/src/hooks/use-generate.ts", import.meta.url),
  "utf8",
);
const useChatsSource = readFileSync(
  new URL("../../packages/client/src/hooks/use-chats.ts", import.meta.url),
  "utf8",
);
const gameInputSource = readFileSync(
  new URL("../../packages/client/src/components/game/GameInput.tsx", import.meta.url),
  "utf8",
);
const chatStoreSource = readFileSync(
  new URL("../../packages/client/src/stores/chat.store.ts", import.meta.url),
  "utf8",
);
const summaryPopoverSource = readFileSync(
  new URL("../../packages/client/src/components/chat/SummaryPopover.tsx", import.meta.url),
  "utf8",
);
assert.match(
  summaryPopoverSource,
  /const \[draft, setDraft\] = useState\(\(\) => \(\{ \.\.\.entry \}\)\);/u,
  "summary typing should update editor-local state instead of rerendering the entire popover",
);
assert.doesNotMatch(
  summaryPopoverSource,
  /onDraftChange=\{setDraftEntry\}/u,
  "summary keystrokes must not update popover-level draft state",
);
assert.match(
  chatStoreSource,
  /api\.post\("\/generate\/abort", \{ chatId \}\)/u,
  "explicit stop requests must use the authenticated API client so CSRF protection cannot discard them",
);
assert.doesNotMatch(
  chatStoreSource,
  /fetch\("\/api\/generate\/abort"/u,
  "generation abort must not bypass shared CSRF and admin-auth headers",
);
const originalFetch = globalThis.fetch;
let capturedAbortRequest: { input: string | URL | Request; init?: RequestInit } | null = null;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  capturedAbortRequest = { input, init };
  return new Response(JSON.stringify({ aborted: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}) as typeof fetch;
try {
  await api.post("/generate/abort", { chatId: "roleplay-stop-regression" });
} finally {
  globalThis.fetch = originalFetch;
}
assert.ok(capturedAbortRequest, "the shared API client should send an abort request");
assert.equal(String(capturedAbortRequest.input), "/api/generate/abort");
assert.equal(new Headers(capturedAbortRequest.init?.headers).get(CSRF_HEADER), CSRF_HEADER_VALUE);

class VisibilityDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";

  setVisibility(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

function sseFrame(type: string, data: unknown) {
  return new TextEncoder().encode(`data: ${JSON.stringify({ type, data })}\n\n`);
}

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const visibilityDocument = new VisibilityDocument();
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: visibilityDocument,
});

let healthyStreamController: ReadableStreamDefaultController<Uint8Array> | null = null;
globalThis.fetch = (async () =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        healthyStreamController = controller;
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  )) as typeof fetch;
try {
  const events = api.streamEvents("/generate", {}, undefined, {
    disconnectOnResume: true,
    resumeDisconnectGraceMs: 50,
  });
  const firstEvent = events.next();
  healthyStreamController!.enqueue(sseFrame("token", "First"));
  assert.deepEqual(await firstEvent, { done: false, value: { type: "token", data: "First" } });

  const resumedEvent = events.next();
  visibilityDocument.setVisibility("hidden");
  visibilityDocument.setVisibility("visible");
  await new Promise((resolve) => setTimeout(resolve, 10));
  healthyStreamController!.enqueue(sseFrame("token", " second"));
  assert.deepEqual(
    await resumedEvent,
    { done: false, value: { type: "token", data: " second" } },
    "a healthy stream must survive tab resume instead of being replaced by the persisted full reply",
  );
  healthyStreamController!.close();
  assert.equal((await events.next()).done, true);

  let stalledStreamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  globalThis.fetch = (async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          stalledStreamController = controller;
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      },
    )) as typeof fetch;
  const stalledEvents = api.streamEvents("/generate", {}, undefined, {
    disconnectOnResume: true,
    resumeDisconnectGraceMs: 5,
  });
  const initialStalledEvent = stalledEvents.next();
  stalledStreamController!.enqueue(sseFrame("token", "Before hiding"));
  assert.deepEqual(await initialStalledEvent, {
    done: false,
    value: { type: "token", data: "Before hiding" },
  });
  const stalledRead = stalledEvents.next();
  visibilityDocument.setVisibility("hidden");
  visibilityDocument.setVisibility("visible");
  await assert.rejects(stalledRead, StreamResumeDisconnectError);
} finally {
  globalThis.fetch = originalFetch;
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
}
assert.match(
  generateRouteSource,
  /type: "illustration_queued"/u,
  "automatic Illustrator runs should announce their background-only tail before generation completes",
);
assert.match(
  retryAgentRouteSource,
  /type: "illustration_queued"/u,
  "an Illustrator-only retry should expose the same background handoff",
);
const chatTextareaSource = chatInputSource.match(/<textarea[\s\S]*?\/>/u)?.[0] ?? "";
const chatHandleInputSource =
  chatInputSource.match(
    /const handleInput = \(event\?: FormEvent<HTMLTextAreaElement>\) => \{[\s\S]*?\n  \};\n\n  \/\/ Dismiss feedback/u,
  )?.[0] ?? "";
assert.match(chatTextareaSource, /disabled=\{!activeChatId\}/u);
assert.doesNotMatch(
  chatTextareaSource,
  /disabled=\{[^}]*isInputBusy/u,
  "agent work should guard sending without disabling preparation of the next draft",
);
assert.match(
  chatHandleInputSource,
  /resizeTimerRef\.current = setTimeout\(\(\) => \{[\s\S]*?resizeChatInputTextarea\(el\);[\s\S]*?\}, 150\);/u,
  "Roleplay textarea measurement should wait for a typing pause instead of forcing layout on each keystroke",
);
assert.doesNotMatch(
  chatHandleInputSource,
  /requestAnimationFrame\(\(\) => \{[\s\S]*?resizeChatInputTextarea\(el\);/u,
  "Roleplay textarea resizing must not force a scrollHeight layout read every animation frame",
);
const conversationTextareaSource = conversationInputSource.match(/<textarea[\s\S]*?\/>/u)?.[0] ?? "";
assert.doesNotMatch(
  conversationTextareaSource,
  /disabled=/u,
  "Conversation drafts should remain editable regardless of send-blocking state",
);
const gameTextareaSource = gameInputSource.match(/<textarea[\s\S]*?\/>/u)?.[0] ?? "";
assert.match(
  gameTextareaSource,
  /disabled=\{draftDisabled\}/u,
  "Game mode should keep its draft field separate from the generation send lock",
);

assert.equal(
  isGenerationSendBlocked({ streamActive: true, agentsProcessing: true, backgroundIllustration: false }),
  true,
  "ordinary streaming and agent work should keep send actions guarded",
);
assert.equal(
  isGenerationSendBlocked({ streamActive: false, agentsProcessing: true, backgroundIllustration: false }),
  true,
  "agent-only retries should guard sending without locking the draft field",
);
assert.equal(
  isGenerationSendBlocked({ streamActive: true, agentsProcessing: true, backgroundIllustration: true }),
  false,
  "an Illustrator-only tail should permit the next message to be sent",
);
assert.equal(
  isGenerationSendBlocked({
    streamActive: true,
    agentsProcessing: true,
    backgroundIllustration: false,
    delayedResponse: true,
  }),
  false,
  "a Conversation presence delay should allow additional user messages to be posted",
);
assert.match(
  conversationInputSource,
  /const createDurableMessageWithRollback = useCallback\([\s\S]*?createMessage\.mutateAsync\(\{[\s\S]*?role: "user"/u,
  "the shared durable-message helper should persist user messages before attaching files",
);
assert.match(
  conversationInputSource,
  /if \(delayedCharacterInfo\) \{[\s\S]*?createDurableMessageWithRollback\(\{[\s\S]*?return;/u,
  "additional messages sent during a Conversation presence delay should persist without starting another generator",
);
assert.equal(
  isGenerationStartBlocked({ setupLocked: false, activeController: true, backgroundIllustration: false }),
  true,
  "ordinary same-chat generations must remain exclusive",
);
assert.equal(
  isGenerationStartBlocked({ setupLocked: false, activeController: true, backgroundIllustration: true }),
  false,
  "the next same-chat generation should be allowed while Illustrator finishes",
);
assert.match(
  retryAgentRouteSource,
  /const updateRetryTargetGameStateSnapshot = async/,
  "tracker retries should have an unanchored snapshot persistence path",
);
for (const resultType of [
  "game_state_update",
  "character_tracker_update",
  "persona_stats_update",
  "quest_update",
  "custom_tracker_update",
]) {
  assert.doesNotMatch(
    retryAgentRouteSource,
    new RegExp(`retryMessageId\\s*&&\\s*result\\.success\\s*&&\\s*result\\.type === ["']${resultType}["']`),
    `${resultType} retries must not require an assistant-message anchor`,
  );
}

assert.equal(
  trackerEditableText({ name: "HP", value: 75, max: 100, color: "#ef4444" }),
  "HP: 75/100",
  "object-shaped tracker values must become editable text instead of invalid React children",
);
assert.equal(trackerEditableText({ nested: true }), '{"nested":true}');

assert.equal(
  getTypewriterRevealCharsPerSecond({
    selectedCharsPerSecond: 90,
    pendingCharacters: 45,
    observedArrivalCharsPerSecond: null,
    streamComplete: false,
  }),
  42.75,
  "the first provider burst should be spread across roughly one second instead of draining immediately",
);
assert.equal(
  getTypewriterRevealCharsPerSecond({
    selectedCharsPerSecond: 90,
    pendingCharacters: 20,
    observedArrivalCharsPerSecond: 40,
    streamComplete: false,
  }),
  38,
  "an open stream should reveal slightly behind its observed arrival rate to absorb chunk gaps",
);
assert.equal(
  getTypewriterRevealCharsPerSecond({
    selectedCharsPerSecond: 90,
    pendingCharacters: 200,
    observedArrivalCharsPerSecond: 40,
    streamComplete: true,
  }),
  90,
  "a completed stream should drain at the user's selected speed",
);

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
const messageSavedHandlerSource =
  useGenerateSource.match(/case "message_saved": \{[\s\S]*?case "schedule_updated":/u)?.[0] ?? "";
assert.match(
  messageSavedHandlerSource,
  /if \(!keepStreamLiveThroughPostProcessing\) \{[\s\S]*?rememberContinuedMessageContent\(savedMessage\);[\s\S]*?\}[\s\S]*?upsertPersistedMessages\(qc, params\.chatId, \[savedMessage\]\);/u,
  "a saved Roleplay reply must remain cached while its live presentation is shadowing it",
);
const updateMessageHookSource =
  useChatsSource.match(/export function useUpdateMessage[\s\S]*?export function useUpdateMessageExtra/u)?.[0] ?? "";
assert.match(
  updateMessageHookSource,
  /const cancellation = qc\.cancelQueries[\s\S]*?qc\.setQueryData[\s\S]*?await cancellation/u,
  "message edits should paint optimistically before query cancellation finishes",
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
