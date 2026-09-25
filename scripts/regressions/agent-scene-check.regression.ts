import assert from "node:assert/strict";
import type { AgentCallDebugEvent, AgentContext, AgentTaskProgress } from "../../packages/shared/src/types/agent.js";
import { completeAgentCall } from "../../packages/server/src/services/agents/agent-progress.js";
import { executeAgent, executeAgentBatch } from "../../packages/server/src/services/agents/agent-executor.js";
import {
  BaseLLMProvider,
  type ChatCompletionResult,
  type ChatMessage,
  type ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";

const tracker = {
  id: "tracker-id",
  type: "world-state",
  name: "World tracker",
  phase: "post_processing",
  promptTemplate: "Return the world state as JSON.",
  connectionId: null,
  settings: { maxTokens: 1024, contextSize: 5 },
  isCustomAgent: false,
};
const sourcePrompt = 'Check only this scene window: [{"messageNumber":5,"content":"The next morning, they leave."}]';
const sceneResult = { ends: [{ messageNumber: 5 }] };
const baseMessages: ChatMessage[] = [{ role: "user", content: "Track the current scene." }];
const context = (): AgentContext => ({
  chatId: "scene-check-fixture",
  chatMode: "roleplay",
  recentMessages: [],
  characters: [],
  persona: null,
  memory: {},
  writableLorebookIds: null,
  chatSummary: null,
  streaming: true,
  sceneCheck: { trackerAgentIds: [tracker.id], prompt: sourcePrompt, claimed: false },
});

class RecordingProvider extends BaseLLMProvider {
  calls: Array<{ messages: ChatMessage[]; options: ChatOptions }> = [];
  beforeComplete?: () => void | Promise<void>;

  constructor(
    readonly response: Record<string, unknown> | string,
    readonly finishReason = "stop",
    maxContext: number | null = 16384,
    maxTokensOverride?: number,
  ) {
    super("http://localhost", "", maxContext ?? undefined, null, maxTokensOverride);
  }

  async *chat(): AsyncGenerator<string, void, unknown> {}

  override async chatComplete(messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    this.calls.push({ messages, options });
    const content = typeof this.response === "string" ? this.response : JSON.stringify(this.response);
    if (options.stream !== false) {
      options.onThinking?.("reasoning activity");
      await options.onToken?.(content.slice(0, 15));
      await options.onToken?.(content.slice(15));
    }
    await this.beforeComplete?.();
    return {
      content,
      toolCalls: [],
      finishReason: this.finishReason,
      usage: { promptTokens: 100, completionTokens: 30, totalTokens: 130 },
    };
  }
}

const streaming = context();
const progress: AgentTaskProgress[] = [];
const debug: AgentCallDebugEvent[] = [];
streaming.agentProgress = (event) => progress.push(event);
streaming.agentDebug = (event) => debug.push(event);
const streamedProvider = new RecordingProvider({ location: "Road", __scene_check: sceneResult });
const callerChunks: string[] = [];
let thinking = "";
streamedProvider.beforeComplete = () => {
  assert.equal(callerChunks.length, 0, "raw reserved fields must not reach the tracker parser while streaming");
  assert.ok(
    progress.some((event) => event.stage === "streaming"),
    "live progress must continue before completion",
  );
};
const streamed = await completeAgentCall(streaming, [tracker], streamedProvider, baseMessages, {
  model: "fixture",
  maxTokens: 1024,
  stream: true,
  onToken: (chunk) => void callerChunks.push(chunk),
  onThinking: (chunk) => void (thinking += chunk),
});
assert.equal(streamedProvider.calls.length, 1, "scene detection must reuse the existing request");
assert.equal(streamedProvider.calls[0]!.options.stream, true);
assert.equal(streamedProvider.calls[0]!.options.debugMode, true);
assert.equal(baseMessages.length, 1, "the caller's prompt remains reusable");
assert.ok(streamedProvider.calls[0]!.messages.at(-1)!.content.includes(sourcePrompt));
assert.deepEqual(
  debug.at(-1)!.messages,
  streamedProvider.calls[0]!.messages.map(({ role, content }) => ({ role, content })),
);
assert.deepEqual(streaming.sceneCheck!.result, sceneResult);
assert.deepEqual(JSON.parse(streamed.content!), { location: "Road" });
assert.deepEqual(callerChunks, [streamed.content]);
assert.equal(thinking, "reasoning activity");
assert.equal(progress.at(-1)!.receivedChunks, 3, "progress counts raw text and reasoning chunks");
assert.equal(progress.at(-1)!.completionTokens, 30);
assert.ok(!JSON.stringify(progress).includes("__scene_check"), "normal progress remains content-free");

const nonStreaming = context();
const quietProvider = new RecordingProvider({ location: "Road", __scene_check: { ends: [] } });
const quiet = await completeAgentCall(nonStreaming, [tracker], quietProvider, baseMessages, {
  model: "fixture",
  stream: false,
});
assert.deepEqual(nonStreaming.sceneCheck!.result, { ends: [] }, "no-boundary is a completed check without progress UI");
assert.deepEqual(JSON.parse(quiet.content!), { location: "Road" });
assert.equal(quietProvider.calls[0]!.options.onToken, undefined);

for (const limits of [
  { connection: 4096, request: 16384 },
  { connection: 16384, request: 4096 },
  { connection: null, request: undefined },
]) {
  const pending = context();
  pending.sceneCheck!.prompt = `${sourcePrompt}\n${"long scene text ".repeat(1000)}`;
  const originalSceneCheck = { ...pending.sceneCheck };
  const provider = new RecordingProvider({ location: "Road" }, "stop", limits.connection);
  const chunks: string[] = [];
  provider.beforeComplete = () => assert.equal(chunks.length, 2, "skipped checks keep ordinary live streaming");
  const options: ChatOptions = {
    model: "fixture",
    maxContext: limits.request,
    maxTokens: 1024,
    stream: true,
    onToken: (chunk) => void chunks.push(chunk),
  };
  const result = await completeAgentCall(pending, [tracker], provider, baseMessages, options);
  assert.equal(provider.calls.length, 1, "an oversized window must not add a fallback call");
  assert.equal(provider.calls[0]!.messages, baseMessages, "the existing tracker prompt must remain untouched");
  assert.equal(provider.calls[0]!.options, options, "skipped checks must preserve the original request options");
  assert.deepEqual(pending.sceneCheck, originalSceneCheck, "skipped checks must neither claim nor advance the scene");
  assert.deepEqual(JSON.parse(result.content!), { location: "Road" });

  const largerProvider = new RecordingProvider({ location: "Road", __scene_check: sceneResult });
  await completeAgentCall(pending, [tracker], largerProvider, baseMessages, { model: "fixture", maxTokens: 1024 });
  assert.equal(largerProvider.calls.length, 1);
  assert.equal(pending.sceneCheck!.claimed, true, "a later scheduled tracker with room may still claim the check");
  assert.deepEqual(pending.sceneCheck!.result, sceneResult);
}

for (const outputCap of [undefined, 1024]) {
  const reserved = context();
  const provider = new RecordingProvider({ location: "Road", __scene_check: sceneResult }, "stop", 8192, outputCap);
  await completeAgentCall(reserved, [tracker], provider, baseMessages, { model: "fixture", maxTokens: 8000 });
  assert.equal(
    reserved.sceneCheck!.claimed,
    outputCap !== undefined,
    "budgeting must retain the effective reply reserve",
  );
  assert.equal(provider.calls.length, 1);
  assert.equal(provider.calls[0]!.messages.length, outputCap === undefined ? 1 : 2);
}

const shared = context();
const parallelProvider = new RecordingProvider({ location: "Road", __scene_check: sceneResult });
await Promise.all([
  completeAgentCall(shared, [tracker], parallelProvider, baseMessages, { model: "fixture", stream: true }),
  completeAgentCall({ ...shared }, [tracker], parallelProvider, baseMessages, { model: "fixture", stream: true }),
]);
assert.equal(parallelProvider.calls.length, 2, "only the already scheduled tracker calls run");
assert.equal(
  parallelProvider.calls.filter((call) => call.messages.length === 2).length,
  1,
  "concurrent lanes claim once",
);

for (const gate of ["other-agent", "pre-generation", "tools", "cancelled"] as const) {
  const excluded = context();
  const provider = new RecordingProvider({ location: "Road" });
  const config =
    gate === "other-agent"
      ? { ...tracker, id: "other" }
      : gate === "pre-generation"
        ? { ...tracker, phase: "pre_generation" }
        : tracker;
  await completeAgentCall(excluded, [config], provider, baseMessages, {
    model: "fixture",
    stream: false,
    ...(gate === "tools"
      ? { tools: [{ type: "function", function: { name: "lookup", parameters: {}, description: "Lookup" } }] }
      : {}),
    ...(gate === "cancelled" ? { signal: AbortSignal.abort() } : {}),
  });
  assert.equal(excluded.sceneCheck!.claimed, false, `${gate} must not consume a tracker scene check`);
  assert.equal(provider.calls[0]!.messages, baseMessages);
}

for (const finishReason of ["abort", "error", "length", "content_filter"]) {
  const incomplete = context();
  const provider = new RecordingProvider({ location: "Road", __scene_check: sceneResult }, finishReason);
  const result = await completeAgentCall(incomplete, [tracker], provider, baseMessages, {
    model: "fixture",
    stream: true,
  });
  assert.equal(incomplete.sceneCheck!.result, undefined, `${finishReason} must not create scene boundaries`);
  assert.deepEqual(JSON.parse(result.content!), { location: "Road" }, "reserved fields never become tracker data");
  assert.equal(provider.calls.length, 1, "an incomplete scene check must not introduce a retry");
}
for (const payload of [
  null,
  { ends: "m5" },
  { ends: [5] },
  { ends: [{ messageNumber: 0 }] },
  { ends: [{ messageNumber: "5" }] },
  { ends: [{ messageNumber: 1.5 }] },
]) {
  const invalid = context();
  const provider = new RecordingProvider({ location: "Road", __scene_check: payload });
  const result = await completeAgentCall(invalid, [tracker], provider, baseMessages, {
    model: "fixture",
    stream: false,
  });
  assert.equal(invalid.sceneCheck!.result, undefined);
  assert.deepEqual(JSON.parse(result.content!), { location: "Road" }, "invalid scene data does not break the tracker");
}
const missing = context();
const unchanged = '{ "location": "Road" }';
const missingResult = await completeAgentCall(
  missing,
  [tracker],
  {
    maxContextValue: 16384,
    chatComplete: async () => ({ content: unchanged, toolCalls: [], finishReason: "stop" }),
  } as unknown as BaseLLMProvider,
  baseMessages,
  { model: "fixture", stream: false },
);
assert.equal(
  missingResult.content,
  unchanged,
  "missing reserved data preserves the original tracker response verbatim",
);
assert.equal(missing.sceneCheck!.result, undefined);

const aborted = context();
const controller = new AbortController();
const lateProvider = new RecordingProvider({ location: "Road", __scene_check: sceneResult });
lateProvider.beforeComplete = () => controller.abort();
await completeAgentCall(aborted, [tracker], lateProvider, baseMessages, {
  model: "fixture",
  signal: controller.signal,
});
assert.equal(aborted.sceneCheck!.result, undefined, "a late successful provider response cannot beat cancellation");

const wrappedPayload = JSON.stringify({ location: "Road", __scene_check: sceneResult });
for (const wrapped of [
  `<think>draft: \`\`\`json\n{"__scene_check":{"ends":[{"messageNumber":999}]}}\n\`\`\`</think>\n${wrappedPayload}`,
  `\`\`\`json\n${wrappedPayload}\n\`\`\``,
  `Here is the tracker:\n${wrappedPayload}`,
  wrappedPayload.replaceAll('"', '<|"|>'),
]) {
  const wrappedContext = context();
  const provider = new RecordingProvider(wrapped);
  const result = await executeAgent(tracker, wrappedContext, provider, "fixture");
  assert.equal(result.success, true, "existing thinking/fence/Gemma-compatible responses stay usable");
  assert.deepEqual(result.data, { location: "Road" }, "reserved data must be stripped before tracker parsing");
  assert.deepEqual(wrappedContext.sceneCheck!.result, sceneResult, "thinking drafts cannot supply scene decisions");
  assert.equal(provider.calls.length, 1, "response normalization must not add repair calls");
}

// Exercise the real singleton and batch parsers: they prefer streamed callbacks over result.content.
for (const stream of [true, false]) {
  const singleContext = { ...context(), streaming: stream };
  const provider = new RecordingProvider({ location: "Road", __scene_check: sceneResult });
  const result = await executeAgent(tracker, singleContext, provider, "fixture");
  assert.equal(result.success, true);
  assert.equal((result.data as Record<string, unknown>).location, "Road");
  assert.ok(!JSON.stringify(result.data).includes("__scene_check"));
  assert.deepEqual(singleContext.sceneCheck!.result, sceneResult);
  assert.equal(provider.calls.length, 1);

  const batchContext = { ...context(), streaming: stream };
  const personaTracker = { ...tracker, id: "persona-id", type: "persona-stats", name: "Persona tracker" };
  const batchProvider = new RecordingProvider({
    "world-state": { location: "Road" },
    "persona-stats": { hp: 10 },
    __scene_check: sceneResult,
  });
  const results = await executeAgentBatch([tracker, personaTracker], batchContext, batchProvider, "fixture");
  assert.equal(results.length, 2);
  assert.ok(results.every((result) => result.success));
  assert.ok(!JSON.stringify(results).includes("__scene_check"));
  assert.deepEqual(batchContext.sceneCheck!.result, sceneResult);
  assert.equal(batchProvider.calls.length, 1, "the scene field must not cause batch fallback calls");
}

const beholderContext = context();
const beholder = {
  ...tracker,
  type: "beholder",
  promptTemplate: ["worn", "wounds", "holding", "species", "flags"]
    .map((lane) => `[${lane}]\nExtract ${lane}.`)
    .join("\n"),
};
const beholderProvider = new RecordingProvider({ changed: false, __scene_check: sceneResult });
const beholderResult = await executeAgent(beholder, beholderContext, beholderProvider, "fixture");
assert.equal(beholderResult.success, true);
assert.equal(beholderProvider.calls.length, 5, "Beholder keeps its existing five lanes without extra scene requests");
assert.equal(beholderProvider.calls.filter((call) => call.messages.at(-1)!.content.includes(sourcePrompt)).length, 1);
assert.deepEqual(beholderContext.sceneCheck!.result, sceneResult);
assert.ok(!JSON.stringify(beholderResult).includes("__scene_check"));

console.info(
  "Tracker scene checks reuse one request, preserve live progress and tracker parsers, and reject incomplete output.",
);
