/**
 * Your own local servers (Ollama, LM Studio, KoboldCpp...) get the built-in model's turn order.
 *
 * - An address on this computer or the home network counts as local; a cloud one never does.
 * - When an account's slots are full, waiting requests go before-reply agents, then the reply,
 *   then agents beside or after it, then everything else.
 * - With two or more slots, trackers and background work leave one free for the reply.
 */
import assert from "node:assert/strict";

const { isLocalServerAddress } = await import("../../../packages/shared/src/utils/local-server-address.js");
const { acquireAccountSlot, setAccountParallelLimit, resetAccountBudgetsForTests, inspectAccountTurnsForTests } =
  await import("../../../packages/server/src/services/llm/account-budget.js");
const { setConnectionBudgetScope } =
  await import("../../../packages/server/src/services/llm/connection-rate-limit-registry.js");
const { runWithLocalModelPriority } =
  await import("../../../packages/server/src/services/sidecar/local-model-priority.js");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── which addresses are local ───────────────────────────────────────────────
for (const local of [
  "http://localhost:11434",
  "http://127.0.0.1:1234/v1",
  "127.0.0.1:5001",
  "http://192.168.1.20:11434",
  "http://10.0.0.5:8080/v1",
  "http://172.20.0.3:8000",
  "http://[::1]:11434",
  "http://gpu-box.local:11434",
  "http://host.docker.internal:11434",
  "http://100.101.102.103:11434",
]) {
  assert.equal(isLocalServerAddress(local), true, `${local} is local`);
}
for (const remote of [
  "",
  null,
  "https://api.openai.com/v1",
  "https://openrouter.ai/api/v1",
  "http://172.32.0.1:8000",
  "http://8.8.8.8",
  "not a url ::",
]) {
  assert.equal(isLocalServerAddress(remote), false, `${remote} is not local`);
}

// ── turn order on one slot ──────────────────────────────────────────────────
async function take(connection: string, level?: "prepare" | "reply" | "turn" | "background") {
  const release = acquireAccountSlot(connection, undefined, level);
  return typeof release === "function" ? release : await release;
}

{
  resetAccountBudgetsForTests();
  setAccountParallelLimit("ollama", 1);
  setConnectionBudgetScope("row-a", "ollama");
  setConnectionBudgetScope("row-b", "ollama");

  const releaseFirst = await take("row-a", "background");
  const order: string[] = [];
  const queued = (["turn", "background", "reply", "prepare"] as const).map((level, index) =>
    take(index % 2 ? "row-a" : "row-b", level).then((release) => {
      order.push(level);
      release();
    }),
  );
  await sleep(5);
  assert.deepEqual(order, [], "nothing overtakes the request already on the only slot");
  assert.equal(inspectAccountTurnsForTests("ollama")?.waiting.reply, 1);
  releaseFirst();
  await Promise.all(queued);
  assert.deepEqual(order, ["prepare", "reply", "turn", "background"], "both models of the account share one order");
}

{
  // The level comes from the generation when the request does not name one.
  resetAccountBudgetsForTests();
  setAccountParallelLimit("lmstudio", 1);
  setConnectionBudgetScope("row-c", "lmstudio");
  const hold = await take("row-c", "reply");
  const order: string[] = [];
  const background = take("row-c").then((release) => {
    order.push("background");
    release();
  });
  await sleep(1);
  const prepare = runWithLocalModelPriority("prepare", () =>
    take("row-c").then((release) => {
      order.push("prepare");
      release();
    }),
  );
  await sleep(1);
  hold();
  await Promise.all([background, prepare]);
  assert.deepEqual(order, ["prepare", "background"]);
}

// ── two slots keep one for the reply ───────────────────────────────────────
{
  resetAccountBudgetsForTests();
  setAccountParallelLimit("kobold", 2);
  setConnectionBudgetScope("row-d", "kobold");
  const tracker = await take("row-d", "turn");
  let secondTracker = false;
  const second = take("row-d", "turn").then((release) => {
    secondTracker = true;
    release();
  });
  await sleep(5);
  assert.equal(secondTracker, false, "a second tracker waits instead of taking the last slot");
  const reply = acquireAccountSlot("row-d", undefined, "reply");
  assert.equal(typeof reply, "function", "the reply starts at once beside the tracker");
  (reply as () => void)();
  tracker();
  await second;
  assert.equal(secondTracker, true);
}

// ── cancelled while waiting ─────────────────────────────────────────────────
{
  resetAccountBudgetsForTests();
  setAccountParallelLimit("vllm", 1);
  setConnectionBudgetScope("row-e", "vllm");
  const hold = await take("row-e", "reply");
  const abort = new AbortController();
  const waiting = acquireAccountSlot("row-e", abort.signal, "background");
  assert.ok(waiting instanceof Promise);
  abort.abort(new Error("stopped"));
  await assert.rejects(waiting as Promise<unknown>, /stopped/u);
  assert.equal(inspectAccountTurnsForTests("vllm")?.waiting.background, 0, "a cancelled request leaves the queue");
  hold();
  assert.equal(inspectAccountTurnsForTests("vllm")?.running.reply, 0);
}

// ── no cap, no queue ────────────────────────────────────────────────────────
{
  resetAccountBudgetsForTests();
  setConnectionBudgetScope("row-f", null);
  const release = acquireAccountSlot("row-f", undefined, "background");
  assert.equal(typeof release, "function", "an unlimited cloud account never waits");
}

console.log("local server turns: ok");
