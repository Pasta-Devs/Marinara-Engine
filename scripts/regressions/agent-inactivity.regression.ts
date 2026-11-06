import assert from "node:assert/strict";
import type { AgentTaskProgress } from "@marinara-engine/shared";
import { completeAgentCall } from "../../packages/server/src/services/agents/agent-progress.js";
import {
  markLlmRequestActivity,
  type BaseLLMProvider,
  type ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";
import {
  __setSdkForTesting,
  ClaudeSubscriptionProvider,
} from "../../packages/server/src/services/llm/providers/claude-subscription.provider.js";

const originalTimeout = process.env.AGENT_CALL_TIMEOUT_MS;
process.env.AGENT_CALL_TIMEOUT_MS = "10000";
const tracker = { id: "tracker", type: "world-state", name: "Tracker", phase: "post_processing" };
const answer = { content: "final answer", toolCalls: [], finishReason: "stop" as const };
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
let clock = 0;
const timers = new Set<{ at: number; callback: () => void; refresh(): unknown; unref(): unknown }>();
// Node's mock.timers does not reschedule Timeout.refresh(); model that native behavior explicitly.
globalThis.setTimeout = ((callback: () => void, ms: number) => {
  const timer = {
    at: clock + ms,
    callback,
    refresh() {
      this.at = clock + ms;
      timers.add(this);
      return this;
    },
    unref() {
      return this;
    },
  };
  timers.add(timer);
  return timer;
}) as unknown as typeof setTimeout;
globalThis.clearTimeout = ((timer: Parameters<typeof timers.delete>[0]) =>
  timers.delete(timer)) as unknown as typeof clearTimeout;
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const advance = async (ms: number) => {
  const end = clock + ms;
  for (;;) {
    const next = [...timers].filter((timer) => timer.at <= end).sort((a, b) => a.at - b.at)[0];
    if (!next) break;
    clock = next.at;
    timers.delete(next);
    next.callback();
  }
  clock = end;
  await flush();
};
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

try {
  // No visible chunks are required to keep an active request alive beyond its idle budget.
  for (const progress of [false, true]) {
    const events: AgentTaskProgress[] = [];
    let requestSignal: AbortSignal | undefined;
    const provider = {
      chatComplete: async (_messages: unknown, options: ChatOptions) => {
        assert.equal(options.stream, true);
        assert.equal(options.onToken, undefined, "quiet transport must not install a visibility callback");
        assert.equal(options.onThinking, undefined);
        requestSignal = options.signal;
        for (let i = 0; i < 3; i++) {
          await delay(9000);
          markLlmRequestActivity();
        }
        return answer;
      },
    } as unknown as BaseLLMProvider;
    const pending = completeAgentCall(
      progress ? { agentProgress: (event) => events.push(event) } : {},
      [tracker],
      provider,
      [],
      {
        model: "fixture",
        stream: false,
        onToken: () => assert.fail("quiet UI received text"),
        onThinking: () => assert.fail("quiet UI received thinking"),
      },
    );
    await flush();
    for (let i = 0; i < 3; i++) await advance(9000);
    assert.deepEqual(
      await pending,
      answer,
      "real activity keeps a 27-second request alive with a 10-second idle budget",
    );
    if (progress) {
      assert.equal(events.at(-1)!.receivedChunks, 0, "quiet transport does not fabricate UI progress");
      assert.equal(events.at(-1)!.stage, "received");
    }
    await advance(10000);
    assert.equal(requestSignal!.aborted, false, "a completed call removes its inactivity timer");
  }

  // Each tool/retry call starts afresh; a prior successful call cannot spend the next budget.
  for (let round = 0; round < 3; round++) {
    const pending = completeAgentCall(
      {},
      [tracker],
      {
        chatComplete: async () => {
          await delay(9000);
          return answer;
        },
      } as unknown as BaseLLMProvider,
      [],
      { model: "fixture", stream: false },
    );
    await flush();
    await advance(9000);
    assert.deepEqual(await pending, answer);
  }

  const events: AgentTaskProgress[] = [];
  const silent = { chatComplete: async () => new Promise(() => {}) } as unknown as BaseLLMProvider;
  const stalled = completeAgentCall({ agentProgress: (event) => events.push(event) }, [tracker], silent, [], {
    model: "fixture",
  });
  const stalledCheck = assert.rejects(stalled, { name: "TimeoutError" });
  await flush();
  await advance(10000);
  await stalledCheck;
  assert.equal(events.at(-1)!.stage, "stopped", "idle cancellation stops the progress timer");

  for (const cancelContext of [false, true]) {
    const contextController = new AbortController();
    const optionsController = new AbortController();
    const cancelled = completeAgentCall({ signal: contextController.signal }, [tracker], silent, [], {
      model: "fixture",
      signal: optionsController.signal,
    });
    const checked = assert.rejects(cancelled, /user stopped/);
    await flush();
    (cancelContext ? contextController : optionsController).abort(new Error("user stopped"));
    await checked;
  }

  // Illustrator's existing image-generation allowance is an idle minimum, including batches.
  for (const configured of [10000, 2000000]) {
    process.env.AGENT_CALL_TIMEOUT_MS = String(configured);
    let signal: AbortSignal | undefined;
    const illustration = completeAgentCall(
      {},
      [tracker, { ...tracker, id: "image", type: "illustrator" }],
      {
        chatComplete: async (_messages: unknown, options: ChatOptions) => {
          signal = options.signal;
          return new Promise(() => {});
        },
      } as unknown as BaseLLMProvider,
      [],
      { model: "fixture" },
    );
    const checked = assert.rejects(illustration, { name: "TimeoutError" });
    await flush();
    await advance(Math.max(30 * 60000, configured) - 1);
    assert.equal(signal!.aborted, false);
    await advance(1);
    await checked;
  }
  process.env.AGENT_CALL_TIMEOUT_MS = "10000";

  // SDK system events (without text/thinking callbacks) are actual subprocess activity too.
  let sdkStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    sdkStarted = resolve;
  });
  __setSdkForTesting({
    query: (() =>
      (async function* () {
        sdkStarted();
        for (let i = 0; i < 3; i++) {
          await delay(9000);
          yield { type: "stream_event", event: { type: "ping" } };
        }
        yield { type: "result", subtype: "success", result: "SDK final", usage: {} };
      })()) as never,
  });
  const sdk = completeAgentCall(
    {},
    [tracker],
    new ClaudeSubscriptionProvider("", ""),
    [{ role: "user", content: "Fixture" }],
    {
      model: "claude-opus-5",
      stream: false,
    },
  );
  await started;
  await flush();
  for (let i = 0; i < 3; i++) await advance(9000);
  assert.equal((await sdk).content, "SDK final", "non-text SDK events extend the agent inactivity budget");

  console.info(
    "Agent inactivity: quiet streaming, fresh call budgets, stalls, cancellation, Illustrator and SDK events passed.",
  );
} finally {
  __setSdkForTesting(null);
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  if (originalTimeout === undefined) delete process.env.AGENT_CALL_TIMEOUT_MS;
  else process.env.AGENT_CALL_TIMEOUT_MS = originalTimeout;
}
