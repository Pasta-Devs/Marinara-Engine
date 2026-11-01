import assert from "node:assert/strict";
import { BaseLLMProvider, type ChatCompletionResult } from "../../packages/server/src/services/llm/base-provider.js";
import { withRateLimitAwareProvider } from "../../packages/server/src/services/llm/rate-limit-aware-provider.js";
import { withConnectionFallbackProvider } from "../../packages/server/src/services/llm/connection-fallback-provider.js";
import {
  resetConnectionRateLimitsForTests,
  setAccountRateLimit,
  setConnectionBudgetScope,
  setConnectionRateLimit,
} from "../../packages/server/src/services/llm/connection-rate-limit-registry.js";
import {
  acquireAccountSlot,
  resetAccountBudgetsForTests,
  setAccountParallelLimit,
} from "../../packages/server/src/services/llm/account-budget.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const result: ChatCompletionResult = {
  content: "done",
  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  finishReason: "stop",
};

/** Records start times and peak concurrency; `gate` (when set) holds the first call open. */
class Fake extends BaseLLMProvider {
  starts: number[] = [];
  running = 0;
  peak = 0;
  gate: Promise<void> | null = null;
  constructor() {
    super("", "", 1000, null, null);
  }
  async chatComplete(): Promise<ChatCompletionResult> {
    this.starts.push(Date.now());
    this.running += 1;
    this.peak = Math.max(this.peak, this.running);
    if (this.starts.length === 1 && this.gate) await this.gate;
    else await sleep(20);
    this.running -= 1;
    return result;
  }
}
function reset() {
  resetConnectionRateLimitsForTests();
  resetAccountBudgetsForTests();
}
const call = (p: BaseLLMProvider, id: string, signal?: AbortSignal) =>
  withRateLimitAwareProvider(p, id).chatComplete([], { model: "m", signal });

// Each case uses its own account id: pacing cursors are module state that reset() does not clear.
// 1. Shared parallel cap holds across 3 rows; queued starts are still paced by row RPM.
reset();
{
  const fake = new Fake();
  let open!: () => void;
  fake.gate = new Promise<void>((r) => (open = r));
  const ids = ["r1", "r2", "r3"];
  for (const id of ids) {
    setConnectionBudgetScope(id, "acct1");
    setConnectionRateLimit(id, 600);
  }
  setAccountParallelLimit("acct1", 1);
  setAccountRateLimit("acct1", 600); // rows are paced individually; the account paces them together
  const all = ids.map((id) => call(fake, id));
  await sleep(250);
  assert.equal(fake.starts.length, 1, "cap 1 across three rows lets one request start");
  open();
  await Promise.all(all);
  assert.equal(fake.peak, 1, "shared cap never exceeded");
  assert(fake.starts[2]! - fake.starts[1]! >= 90, `queued starts burst: ${fake.starts.join(",")}`);
}

// 2. Abort frees the slot.
reset();
{
  const fake = new Fake();
  setConnectionBudgetScope("a1", "acct2");
  setConnectionBudgetScope("a2", "acct2");
  setAccountParallelLimit("acct2", 1);
  const hold = await acquireAccountSlot("a1");
  const controller = new AbortController();
  const aborted = call(fake, "a2", controller.signal);
  controller.abort();
  await assert.rejects(aborted);
  hold();
  const again = await acquireAccountSlot("a2");
  again();
  assert.equal(fake.starts.length, 0, "aborted request never started");
}

// 3. Row RPM still applies when the account has a different (looser) cap.
reset();
{
  const fake = new Fake();
  setConnectionBudgetScope("b1", "acct3");
  setConnectionRateLimit("b1", 600); // 100 ms interval
  setAccountRateLimit("acct3", 6000); // 10 ms interval
  await Promise.all([call(fake, "b1"), call(fake, "b1")]);
  assert(fake.starts[1]! - fake.starts[0]! >= 90, "row RPM paces despite a looser account cap");
}

// 3b. The account RPM applies across rows that have no row limit.
reset();
{
  const fake = new Fake();
  setConnectionBudgetScope("c1", "acct4");
  setConnectionBudgetScope("c2", "acct4");
  setAccountRateLimit("acct4", 600);
  await Promise.all([call(fake, "c1"), call(fake, "c2")]);
  assert(fake.starts[1]! - fake.starts[0]! >= 90, "account RPM paces across rows");
}

// 4. Null caps add no wait and no extra tick.
reset();
{
  const fake = new Fake();
  setConnectionBudgetScope("d1", "acct5");
  setConnectionBudgetScope("d2", "acct5");
  const all = [call(fake, "d1"), call(fake, "d2")];
  assert.equal(fake.starts.length, 2, "uncapped attempts start synchronously");
  await Promise.all(all);
  assert.equal(fake.peak, 2, "no shared cap, both run in parallel");
}

// 5. A pre-wrapped primary (a package's llm.createProvider + llm.withFallback) takes one slot, not two.
reset();
{
  const fake = new Fake();
  setConnectionBudgetScope("e1", "acct6");
  setAccountParallelLimit("acct6", 1);
  const wrapped = withConnectionFallbackProvider({
    primary: withRateLimitAwareProvider(fake, "e1"),
    primaryConnectionId: "e1",
    fallbackConnection: null,
    category: "main",
  });
  const done = await Promise.race([wrapped.chatComplete([], { model: "m" }), sleep(1000).then(() => null)]);
  assert.equal(done?.content, "done", "cap 1 with a pre-wrapped primary must not deadlock");
}

console.info("account-budget regression passed");
