// ──────────────────────────────────────────────
// Regression: global media-generation concurrency cap (#5097)
// ──────────────────────────────────────────────
// A leaked or deadlocked permit hangs ALL generation app-wide with no error —
// the worst available failure signature — so every path that could leak or
// deadlock is pinned: task throw, abort during the permit wait, grant-then-
// abort, re-entrant acquisition under a held permit (the video-fallback /
// self-wrap shape), live limit lowering AND raising, the wait timeout, the
// 0 = unlimited opt-out, and the foreground/background split (background
// never takes the last permit; foreground waiters drain first).
import assert from "node:assert/strict";

process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "2";
process.env.MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS = "0";
const { runMediaGenerationRequest, inspectMediaGenerationConcurrencyForTests } = await import(
  "../../packages/server/src/services/image/image-generation-queue.js"
);

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const idle = () =>
  assert.deepEqual(inspectMediaGenerationConcurrencyForTests(), {
    activeGlobalPermits: 0,
    queuedWaiters: 0,
    foregroundWaiters: 0,
    backgroundWaiters: 0,
  });

async function main() {
  // ── 1) The ceiling holds for non-queued callers (previously unlimited) ──
  let running = 0;
  let peak = 0;
  const gates = [deferred(), deferred(), deferred(), deferred()];
  const tasks = gates.map((gate) =>
    runMediaGenerationRequest({
      connectionKey: "conn-a",
      queue: false,
      task: async () => {
        running += 1;
        peak = Math.max(peak, running);
        await gate.promise;
        running -= 1;
        return "done";
      },
    }),
  );
  await tick();
  assert.equal(peak, 2, "the global cap must bound non-queued concurrency");
  assert.equal(inspectMediaGenerationConcurrencyForTests().queuedWaiters, 2);
  for (const gate of gates) gate.resolve();
  assert.deepEqual(await Promise.all(tasks), ["done", "done", "done", "done"]);
  assert.equal(peak, 2, "late tasks must reuse permits, never exceed the cap");
  idle();

  // ── 2) A throwing task restores its permit ──
  await assert.rejects(
    runMediaGenerationRequest({
      connectionKey: "conn-a",
      queue: false,
      task: async () => {
        throw new Error("provider exploded");
      },
    }),
    /provider exploded/u,
  );
  idle();

  // ── 3) Re-entrant acquisition under a held permit must NOT deadlock ──
  //    (the video fallback hop and generateImage's self-wrap both re-enter;
  //    at limit=1 a second real acquire would deadlock forever)
  process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "1";
  const nested = await runMediaGenerationRequest({
    connectionKey: "outer",
    queue: false,
    task: () =>
      runMediaGenerationRequest({
        connectionKey: "inner-fallback",
        queue: false,
        task: async () => "fallback-succeeded",
      }),
  });
  assert.equal(nested, "fallback-succeeded", "a nested request under a held permit must reuse it");
  idle();

  // ── 4) Abort during the permit wait releases the waiter; grant-then-abort
  //       leaks nothing ──
  process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "1";
  const hold = deferred();
  const holder = runMediaGenerationRequest({ connectionKey: "conn-a", queue: false, task: () => hold.promise.then(() => "held") });
  await tick();
  const abortEarly = new AbortController();
  const waitingAborted = runMediaGenerationRequest({
    connectionKey: "conn-b",
    queue: false,
    signal: abortEarly.signal,
    task: async () => "never",
  });
  const abortLate = new AbortController();
  const grantedThenAborted = runMediaGenerationRequest({
    connectionKey: "conn-c",
    queue: false,
    signal: abortLate.signal,
    task: async () => "granted-then-aborted-should-not-run",
  });
  await tick();
  assert.equal(inspectMediaGenerationConcurrencyForTests().queuedWaiters, 2);
  abortEarly.abort(new Error("user cancelled"));
  await assert.rejects(waitingAborted, /user cancelled/u);
  assert.equal(inspectMediaGenerationConcurrencyForTests().queuedWaiters, 1, "aborted waiters must be removed");
  // Abort the second waiter in the same frame its grant will arrive: the
  // permit must come back regardless of which side wins.
  abortLate.abort(new Error("late cancel"));
  hold.resolve();
  await holder;
  await assert.rejects(grantedThenAborted, /late cancel/u);
  await tick();
  idle();

  // ── 5) Live limit changes: lowering converges, raising wakes parked waiters ──
  process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "2";
  const lowerGates = [deferred(), deferred(), deferred(), deferred()];
  let lowerRunning = 0;
  let postLowerPeak = 0;
  let lowered = false;
  const lowerTasks = lowerGates.map((gate) =>
    runMediaGenerationRequest({
      connectionKey: "conn-a",
      queue: false,
      task: async () => {
        lowerRunning += 1;
        if (lowered) postLowerPeak = Math.max(postLowerPeak, lowerRunning);
        await gate.promise;
        lowerRunning -= 1;
      },
    }),
  );
  await tick();
  process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "1";
  lowered = true;
  lowerGates[0]!.resolve();
  await tick();
  assert.equal(lowerRunning, 1, "a lowered limit must converge as in-flight tasks finish, not hand off at the old width");
  lowerGates[1]!.resolve();
  await tick();
  lowerGates[2]!.resolve();
  await tick();
  lowerGates[3]!.resolve();
  await Promise.all(lowerTasks);
  assert.ok(postLowerPeak <= 1, "no task may start above the lowered limit");
  idle();

  // Raise: park two waiters at limit 1, raise to 3 — the next acquire's pump
  // must wake them without waiting for a release.
  process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "1";
  const raiseHold = deferred();
  const raiseHolder = runMediaGenerationRequest({ connectionKey: "conn-a", queue: false, task: () => raiseHold.promise });
  await tick();
  const parkedGates = [deferred(), deferred()];
  let parkedStarted = 0;
  const parked = parkedGates.map((gate) =>
    runMediaGenerationRequest({
      connectionKey: "conn-b",
      queue: false,
      task: async () => {
        parkedStarted += 1;
        await gate.promise;
      },
    }),
  );
  await tick();
  assert.equal(parkedStarted, 0);
  process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "3";
  const wakeGate = deferred();
  const waker = runMediaGenerationRequest({ connectionKey: "conn-c", queue: false, task: () => wakeGate.promise });
  await tick();
  assert.equal(parkedStarted, 2, "a live raise must wake parked waiters on the next acquire");
  raiseHold.resolve();
  wakeGate.resolve();
  for (const gate of parkedGates) gate.resolve();
  await Promise.all([raiseHolder, waker, ...parked]);
  idle();

  // ── 6) Wait timeout: saturated pool rejects with the actionable error ──
  process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "1";
  process.env.MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS = "25";
  const timeoutHold = deferred();
  const timeoutHolder = runMediaGenerationRequest({ connectionKey: "conn-a", queue: false, task: () => timeoutHold.promise });
  await tick();
  const saturatedRejection = assert.rejects(
    runMediaGenerationRequest({ connectionKey: "conn-b", queue: false, task: async () => "never" }),
    /queue is saturated/u,
    "a bounded wait must fail loudly instead of parking forever",
  );
  // The wait timer is unref'd (it must never keep the SERVER alive), so the
  // bare test process needs a ref'd timer spanning the window or the loop
  // drains before the timeout can fire.
  await new Promise((resolve) => setTimeout(resolve, 60));
  await saturatedRejection;
  timeoutHold.resolve();
  await timeoutHolder;
  process.env.MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS = "0";
  idle();

  // ── 7) Foreground/background: background never takes the last permit and
  //       foreground waiters drain first ──
  process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "2";
  const bgGateA = deferred();
  let backgroundConcurrent = 0;
  let backgroundPeak = 0;
  const bgA = runMediaGenerationRequest({
    connectionKey: "bg",
    queue: false,
    priority: "background",
    task: async () => {
      backgroundConcurrent += 1;
      backgroundPeak = Math.max(backgroundPeak, backgroundConcurrent);
      await bgGateA.promise;
      backgroundConcurrent -= 1;
    },
  });
  const bgGateB = deferred();
  const bgB = runMediaGenerationRequest({
    connectionKey: "bg",
    queue: false,
    priority: "background",
    task: async () => {
      backgroundConcurrent += 1;
      backgroundPeak = Math.max(backgroundPeak, backgroundConcurrent);
      await bgGateB.promise;
      backgroundConcurrent -= 1;
    },
  });
  await tick();
  assert.equal(backgroundPeak, 1, "background work must never occupy the last permit (limit 2 → 1 background slot)");
  const fgGate = deferred();
  let foregroundRan = false;
  const fg = runMediaGenerationRequest({
    connectionKey: "fg",
    queue: false,
    task: async () => {
      foregroundRan = true;
      await fgGate.promise;
    },
  });
  await tick();
  assert.equal(foregroundRan, true, "the reserved permit must admit foreground work immediately");
  bgGateA.resolve();
  fgGate.resolve();
  await tick();
  bgGateB.resolve();
  await Promise.all([bgA, bgB, fg]);
  idle();

  // ── 8) 0 disables the cap entirely (explicit opt-out) ──
  process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "0";
  let unlimitedPeak = 0;
  let unlimitedRunning = 0;
  const unlimitedGate = deferred();
  const unlimited = Array.from({ length: 8 }, () =>
    runMediaGenerationRequest({
      connectionKey: "conn-a",
      queue: false,
      task: async () => {
        unlimitedRunning += 1;
        unlimitedPeak = Math.max(unlimitedPeak, unlimitedRunning);
        await unlimitedGate.promise;
        unlimitedRunning -= 1;
      },
    }),
  );
  await tick();
  assert.equal(unlimitedPeak, 8, "MARINARA_MEDIA_GENERATION_CONCURRENCY=0 must mean unlimited");
  unlimitedGate.resolve();
  await Promise.all(unlimited);
  idle();

  // ── 9) Queued path: FIFO per key preserved, cap spans keys, no deadlock ──
  process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "1";
  const order: string[] = [];
  const slowGate = deferred();
  const first = runMediaGenerationRequest({
    connectionKey: "key-1",
    queue: true,
    task: async () => {
      order.push("key1-first");
      await slowGate.promise;
    },
  });
  await tick();
  const second = runMediaGenerationRequest({
    connectionKey: "key-1",
    queue: true,
    task: async () => {
      order.push("key1-second");
    },
  });
  const otherKey = runMediaGenerationRequest({
    connectionKey: "key-2",
    queue: true,
    task: async () => {
      order.push("key2");
    },
  });
  await tick();
  assert.deepEqual(order, ["key1-first"], "a free connection must still wait for the global permit");
  slowGate.resolve();
  await Promise.all([first, second, otherKey]);
  assert.ok(order.indexOf("key1-first") < order.indexOf("key1-second"), "per-key FIFO order must hold");
  assert.equal(order.length, 3, "every queued task must eventually run — no deadlock between the two queues");
  idle();

  // ── 10) Pre-aborted requests reject without consuming anything ──
  const preAborted = new AbortController();
  preAborted.abort(new Error("gone"));
  await assert.rejects(
    runMediaGenerationRequest({ connectionKey: "conn-a", queue: false, signal: preAborted.signal, task: async () => "x" }),
    /gone/u,
  );
  idle();

  console.log("media-generation cap regression passed");
}

await main();
