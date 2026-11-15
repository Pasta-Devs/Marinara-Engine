/**
 * Decision time limits are per statement, never per group.
 *
 * A turn can ask thirty statements at once. Held to the limit of one, the group timed
 * out and every statement read as no; queued behind the others on a local model's
 * server, the later statements spent their limit waiting. Each case below uses a stand-in
 * server that behaves like the real one and fails the way the old code did.
 */
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "marinara-decision-limits-"));
process.env.DATA_DIR = root;

const { DECISION_TIMEOUT_MS, findDecisionModel } = await import("../../../packages/shared/src/index.js");
const { whenDecisionServerFree } = await import("../../../packages/server/src/services/decision/decision-server-queue.js");
const { answersAskedFor, perStatementLimitMs, resolveDecisionBackend } =
  await import("../../../packages/server/src/services/decision/decision-default.js");
const { askSidecarNoulQuestions } =
  await import("../../../packages/server/src/services/decision/sidecar-decision.backend.js");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A server that works on one request at a time and queues the rest, like llama-server with one slot. */
async function withOneAtATimeServer(
  answerMs: number,
  respond: (body: Record<string, unknown>) => unknown,
  run: (baseUrl: string, stats: { peak: number }) => Promise<void>,
) {
  let chain: Promise<void> = Promise.resolve();
  let inFlight = 0;
  const stats = { peak: 0 };
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      inFlight += 1;
      stats.peak = Math.max(stats.peak, inFlight);
      chain = chain.then(async () => {
        await sleep(answerMs);
        inFlight -= 1;
        if (res.destroyed) return;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(respond(JSON.parse(raw) as Record<string, unknown>)));
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as { port: number }).port}`, stats);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

try {
  // ── the limit is built per answer ─────────────────────────────────────────────

  assert.equal(answersAskedFor([{ id: "a", instructions: "x" }]), 1);
  assert.equal(
    answersAskedFor([
      { id: "a", instructions: "x" },
      { id: "b", instructions: "y", options: ["one", "two", "three"] },
    ]),
    5,
    "a Choice asks one answer per option plus 'none of these'",
  );
  assert.equal(perStatementLimitMs(1, 4000, 350), 4000);
  assert.equal(perStatementLimitMs(32, 4000, 350), 4000 + 31 * 350);
  // A model with no measured cost per answer gets the full limit for each: a pasted
  // sidecar model used to get a flat 4 s for thirty statements.
  assert.equal(perStatementLimitMs(10, 4000, 4000), 40_000);
  // No ceiling for the group. The old 20 s cap cut off large Choice-heavy turns.
  assert.ok(perStatementLimitMs(80, 4000, findDecisionModel("open-jev-2b")!.perQuestionMs!) > 20_000);

  // The sidecar path builds its limit that way, queues on the model's server, and has
  // no group cap left in it.
  {
    const source = readFileSync(
      new URL("../../../packages/server/src/services/decision/decision-default.ts", import.meta.url),
      "utf8",
    );
    const sidecar = source.slice(
      source.indexOf('resolved.protocol === "system_one"'),
      source.indexOf("return chatBackend("),
    );
    assert.ok(sidecar.length > 0, "the System One sidecar branch must still exist");
    assert.match(sidecar, /whenDecisionServerFree\(resolved\.baseUrl, resolved\.serverSlots, signal/u);
    assert.match(sidecar, /resolved\.perQuestionMs \?\? DECISION_TIMEOUT_MS\.sidecar/u);
    assert.doesNotMatch(source, /Math\.min\(\s*DECISION_TIMEOUT_MS\.thinking/u, "no ceiling on a group's limit");
  }

  // ── the queue: a statement's clock starts when the server can take it ─────────

  {
    let running = 0;
    let peak = 0;
    const order: number[] = [];
    const releases: Array<() => void> = [];
    const task = (id: number) =>
      whenDecisionServerFree("test:two-slots", 2, undefined, async () => {
        running += 1;
        peak = Math.max(peak, running);
        order.push(id);
        await new Promise<void>((resolve) => releases.push(resolve));
        running -= 1;
        return id;
      });
    const all = Promise.all([1, 2, 3, 4, 5].map(task));
    await sleep(10);
    assert.deepEqual(order, [1, 2], "only as many as the server has slots start");
    releases.shift()!();
    await sleep(10);
    // A newcomer arriving right after a slot frees must not jump the queue.
    const late = task(6);
    await sleep(10);
    assert.deepEqual(order, [1, 2, 3], "the freed slot goes to the longest waiter, not to a newcomer");
    while (releases.length) {
      releases.shift()!();
      await sleep(10);
    }
    assert.deepEqual(await all, [1, 2, 3, 4, 5]);
    assert.equal(await late, 6);
    assert.equal(peak, 2, "never more than the server's slots at once");
  }
  {
    // A request cancelled while it waits leaves the queue at once and takes no slot.
    let release!: () => void;
    const holder = whenDecisionServerFree("test:cancel", 1, undefined, () => new Promise<void>((r) => (release = r)));
    const controller = new AbortController();
    let ranCancelled = false;
    const cancelled = whenDecisionServerFree("test:cancel", 1, controller.signal, async () => {
      ranCancelled = true;
    });
    let ranNext = false;
    const next = whenDecisionServerFree("test:cancel", 1, undefined, async () => {
      ranNext = true;
    });
    controller.abort();
    await cancelled;
    assert.equal(ranCancelled, true, "the cancelled caller's run still reports its own cancellation");
    assert.equal(ranNext, false, "and does not free the slot for the next caller early");
    release();
    await holder;
    await next;
    assert.equal(ranNext, true);
  }
  {
    // A missing slot count must not stall every decision.
    const value = await Promise.race([
      whenDecisionServerFree("test:nan", Number.NaN, undefined, async () => "ran"),
      sleep(500).then(() => "stalled"),
    ]);
    assert.equal(value, "ran");
  }

  // ── a local chat model with one slot answers every statement ──────────────────

  // 300 ms each on a one-slot server: 16 statements take 4.8 s in all. Sent at once
  // with their clocks running, everything past about the 13th timed out at 4 s.
  await withOneAtATimeServer(
    300,
    () => ({
      choices: [
        {
          message: { content: "yes" },
          logprobs: {
            content: [
              {
                token: "yes",
                logprob: Math.log(0.9),
                top_logprobs: [
                  { token: "yes", logprob: Math.log(0.9) },
                  { token: "no", logprob: Math.log(0.1) },
                ],
              },
            ],
          },
        },
      ],
    }),
    async (baseUrl, stats) => {
      const slot = {
        slot: "utility" as const,
        baseUrl,
        model: "utility-sidecar",
        modelIdentity: "utility:time-limits:1",
        label: "Test model",
        thinking: "off" as const,
        protocol: "chat_logprobs" as const,
        serverSlots: 1,
      };
      const questions = Array.from({ length: 16 }, (_, i) => ({ id: `q${i}`, instructions: `Statement ${i}` }));
      const answers = await askSidecarNoulQuestions({
        slot,
        state: { recent_messages: [{ role: "user", content: "hi" }] },
        questions,
      });
      assert.equal(answers.size, 16, "every statement is answered, none spends its limit waiting");
      assert.equal(stats.peak, 1, "the server is never sent more requests than it has slots");
    },
  );

  // ── a Decision connection gets its Time limit for each statement ──────────────

  // A Time limit of 0.5 s and a server that takes 1.2 s for a request of four. Held to
  // one statement's limit, the request timed out and all four read as no.
  await withOneAtATimeServer(
    1200,
    (body) => ({
      answers: Object.fromEntries(Object.keys(body.questions as object).map((id) => [id, { type: "noul", noul: 0.9 }])),
    }),
    async (baseUrl) => {
      const row = {
        id: "decision-conn",
        provider: "decision",
        baseUrl,
        model: "jev-latest",
        apiKey: "",
        decisionSource: "custom",
        decisionTimeoutMs: 500,
      };
      const backend = await resolveDecisionBackend({
        getLocalDefault: async () => null,
        getThinkingPreGeneration: async () => false,
        getDefaultConnection: async () => row,
        getConnectionWithKey: async () => row,
      });
      assert.ok(backend, "the connection resolves");
      const four = Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, instructions: `Statement ${i}` }));
      const result = await backend.askMixed!({ recent_messages: [] }, four);
      assert.equal(result.error, undefined, `four statements get four limits: ${result.error}`);
      assert.equal(result.answers.size, 4);
      // Positive control: one statement still gets exactly one limit.
      const one = await backend.askMixed!({ recent_messages: [] }, [{ id: "solo", instructions: "Statement" }]);
      assert.equal(one.error, "timeout", "a single statement slower than the limit still times out");
    },
  );
  assert.equal(DECISION_TIMEOUT_MS.sidecar, 4000, "the sidecar's first-answer limit this file assumes");
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log("decision-time-limits regression passed");
