import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AgentContext, AgentTaskProgress } from "../../packages/shared/src/types/agent.ts";
import type { BaseLLMProvider, ChatOptions } from "../../packages/server/src/services/llm/base-provider.ts";
import { completeAgentCall } from "../../packages/server/src/services/agents/agent-progress.ts";
import { useAgentStore } from "../../packages/client/src/stores/agent.store.ts";

const originalNow = Date.now;
let now = 1000;
Date.now = () => now;
const events: AgentTaskProgress[] = [];
const config = {
  id: "tracker",
  type: "world-state",
  name: "World tracker",
  phase: "post_processing",
  promptTemplate: "private prompt",
};
const context = { agentProgress: (event: AgentTaskProgress) => events.push(event) } as AgentContext;
let thinking = "";
let text = "";
const provider = {
  chatComplete: async (_messages: unknown, options: ChatOptions) => {
    now += 40;
    options.onThinking?.("private reasoning");
    for (let i = 0; i < 60; i++) {
      now += 10;
      await options.onToken?.("x");
    }
    return {
      content: "x".repeat(60),
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 120, completionTokens: 70, totalTokens: 190 },
    };
  },
} as unknown as BaseLLMProvider;

try {
  await completeAgentCall(context, [config], provider, [{ role: "user", content: "private user message" }], {
    model: "fixture",
    stream: true,
    onThinking: (chunk) => {
      thinking += chunk;
    },
    onToken: (chunk) => {
      text += chunk;
    },
  });
  assert.equal(thinking, "private reasoning");
  assert.equal(text, "x".repeat(60));
  assert.equal(events[0]!.stage, "waiting");
  assert.equal(events[1]!.ttftMs, 40, "reasoning counts as first received output without debug mode");
  assert.equal(events.at(-1)!.receivedChunks, 61);
  assert.equal(events.at(-1)!.elapsedMs, 640);
  assert.equal(events.at(-1)!.promptTokens, 120);
  assert.equal(events.at(-1)!.completionTokens, 70);
  assert.equal(events.length, 5, "first output plus throttled updates and final usage only");
  for (const event of events.slice(0, -1))
    assert.equal(event.promptTokens, undefined, "no invented streaming token counts");
  assert.ok(!JSON.stringify(events).includes("private"), "status must not leak prompts/reasoning/config secrets");
  assert.equal(context.agentDebug, undefined, "normal progress must not enable full prompt logging");

  const noUsage = {
    chatComplete: async (_messages: unknown, options: ChatOptions) => {
      assert.equal(options.stream, false);
      assert.equal(options.onToken, undefined);
      return { content: "ok", toolCalls: [], finishReason: "stop" };
    },
  } as unknown as BaseLLMProvider;
  events.length = 0;
  await completeAgentCall(context, [config, { ...config, id: "other", name: "Other tracker" }], noUsage, [], {
    model: "fixture",
    stream: false,
  });
  assert.equal(events.at(-1)!.agents.length, 2, "shared batch attribution remains explicit");
  assert.equal(events.at(-1)!.ttftMs, undefined, "no fake TTFT for non-streaming calls");
  assert.equal(events.at(-1)!.completionTokens, undefined);
  const failing = {
    chatComplete: async () => {
      throw new Error("Provider failed");
    },
  } as unknown as BaseLLMProvider;
  await assert.rejects(completeAgentCall(context, [config], failing, [], { model: "fixture", stream: true }));
  assert.equal(events.at(-1)!.stage, "error");
  await assert.rejects(
    completeAgentCall(context, [config], failing, [], { model: "fixture", stream: true, signal: AbortSignal.abort() }),
  );
  assert.equal(events.at(-1)!.stage, "stopped", "cancellation is not a provider failure");

  const store = useAgentStore.getState();
  store.reset();
  store.setProcessingRun("run-a", true, "chat-a");
  store.setProcessingRun("run-b", true, "chat-b");
  const progress = { ...events[0]!, callId: "call-a", stage: "streaming" as const, elapsedMs: 0 };
  store.updateTaskProgress("chat-a", "run-a", progress);
  store.updateTaskProgress("chat-b", "run-b", { ...progress, callId: "call-b" });
  now += 100;
  store.updateTaskProgress("chat-a", "run-a", { ...progress, elapsedMs: 100, receivedChunks: 7 });
  assert.equal(useAgentStore.getState().taskProgress.length, 2, "stream snapshots replace, not accumulate");
  store.setProcessingRun("run-a", false, "chat-a");
  const stopped = useAgentStore.getState().taskProgress.find((entry) => entry.chatId === "chat-a")!;
  assert.equal(stopped.stopped, true);
  assert.equal(useAgentStore.getState().taskProgress.find((entry) => entry.chatId === "chat-b")!.stopped, undefined);
  now += 1000;
  store.updateTaskProgress("chat-a", "run-a", { ...progress, elapsedMs: 1100, receivedChunks: 90 });
  assert.equal(
    useAgentStore.getState().taskProgress.find((entry) => entry.chatId === "chat-a"),
    stopped,
    "late buffered events cannot restart a stopped timer",
  );
  store.setProcessingRun("run-a", false, "chat-a");
  assert.equal(
    useAgentStore.getState().taskProgress.find((entry) => entry.chatId === "chat-a")!.elapsedMs,
    stopped.elapsedMs,
    "stop freezes elapsed time",
  );
  store.setProcessingRun("run-c", true, "chat-a");
  assert.deepEqual(
    useAgentStore.getState().taskProgress.map((entry) => entry.chatId),
    ["chat-b"],
    "new runs clear old metrics only for their own chat",
  );
  store.reset();

  const executor = readFileSync(
    new URL("../../packages/server/src/services/agents/agent-executor.ts", import.meta.url),
    "utf8",
  );
  assert.ok(
    !executor.includes("provider.chatComplete("),
    "single, retry, Beholder, tool and batch calls all use progress observation",
  );
  const generation = readFileSync(new URL("../../packages/client/src/hooks/use-generate.ts", import.meta.url), "utf8");
  assert.equal((generation.match(/case "agent_progress"/g) ?? []).length, 2, "main and manual retry consume progress");
  console.info("Agent progress: throttling, TTFT, usage truth, privacy, batches, stop and chat isolation passed.");
} finally {
  Date.now = originalNow;
}
