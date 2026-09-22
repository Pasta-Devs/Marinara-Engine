/**
 * The local-model decision backend, driven from recorded llama-server responses.
 *
 * Every case here is a shape a real chat model produced or could produce for a
 * one-token yes/no request: a clean answer, a reasoning marker, unrelated prose, and a
 * runtime that returns no log-probabilities at all. The point is that only the first
 * one becomes a probability and the rest leave the agent running.
 *
 * The footprint half covers each verdict row from recorded `nvidia-smi` output, so it
 * passes on a machine with no GPU.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  normalizeDecisionThinking,
  SIDECAR_FOOTPRINT_HEADROOM_BYTES,
  type GpuDevice,
} from "../../packages/shared/src/index.js";
import {
  isDirectAnswer,
  normalizeAnswerToken,
  readLogprobAnswer,
  readWordAnswer,
} from "../../packages/server/src/services/decision/logprob-answer.js";
import {
  assessSidecarLoad,
  compareDriverVersions,
  estimateSlotBytes,
  parseNvidiaSmi,
  parseNvidiaSmiApps,
  resolveSharedDevice,
} from "../../packages/server/src/services/sidecar/sidecar-footprint.js";
import {
  askSidecarNoulQuestions,
  probeDecisionSlot,
} from "../../packages/server/src/services/decision/sidecar-decision.backend.js";
import {
  clearDecisionThinkingCache,
  getAnswerStyle,
} from "../../packages/server/src/services/decision/decision-thinking-cache.js";
import { isDecisionSlotImplemented } from "../../packages/server/src/services/decision/decision-slots.js";
import { decisionConnectionUnavailable } from "../../packages/server/src/routes/decision.routes.js";

// ── reading an answer out of log-probabilities ────────────────────────────────

const logprob = (probability: number) => Math.log(probability);

assert.equal(normalizeAnswerToken(" Yes"), "yes");
assert.equal(normalizeAnswerToken("No."), "no");
assert.equal(normalizeAnswerToken("**yes**"), "yes");
// Exactness after trimming: a word that merely starts with "no" is not an answer.
assert.equal(normalizeAnswerToken(" nothing"), "nothing");

// A clean yes, spread across capitalisation variants the way a tokenizer returns it.
const clean = readLogprobAnswer([
  { token: "yes", logprob: logprob(0.43) },
  { token: "Yes", logprob: logprob(0.29) },
  { token: "No", logprob: logprob(0.24) },
  { token: "no", logprob: logprob(0.04) },
]);
assert.equal(isDirectAnswer(clean), true);
assert.ok(Math.abs(clean.probability! - 0.72) < 0.01, `expected ~0.72, got ${clean.probability}`);

const cleanNo = readLogprobAnswer([
  { token: "no", logprob: logprob(0.999) },
  { token: "yes", logprob: logprob(0.001) },
]);
assert.equal(isDirectAnswer(cleanNo), true);
assert.ok(cleanNo.probability! < 0.01);

// A reasoning marker in the first position is not an answer, even though a "no"
// appears further down the candidate list carrying a little mass.
const reasoning = readLogprobAnswer([
  { token: "<think>", logprob: logprob(0.9) },
  { token: "no", logprob: logprob(0.05) },
]);
assert.equal(isDirectAnswer(reasoning), false);

// Unrelated prose: the yes/no share of the listed mass is below the floor.
const prose = readLogprobAnswer([
  { token: "The", logprob: logprob(0.7) },
  { token: "Based", logprob: logprob(0.2) },
  { token: "yes", logprob: logprob(0.1) },
]);
assert.equal(prose.probability, 1, "only a yes appeared, so the ratio is 1");
assert.equal(isDirectAnswer(prose), false, "but it carries too little of the listed mass to count");

// Missing log-probabilities entirely.
assert.equal(isDirectAnswer(readLogprobAnswer(undefined)), false);
assert.equal(isDirectAnswer(readLogprobAnswer([])), false);
// Malformed entries are dropped rather than parsed into a probability.
assert.equal(isDirectAnswer(readLogprobAnswer([{ token: "yes", logprob: Number.NaN }])), false);

// The word fallback is 1 or 0, read from the end so a reasoning preamble cannot win.
assert.equal(readWordAnswer("Let me think. The scene did not move, so no"), 0);
assert.equal(readWordAnswer("<think>hmm</think> yes"), 1);
assert.equal(readWordAnswer("I am not sure"), null);

// A Thinking mode is read back from a JSON config file, so an older install has no
// value and a hand-edited one may have any string. Neither may reach the backend as a
// mode nobody chose.
assert.equal(normalizeDecisionThinking(undefined), "auto");
assert.equal(normalizeDecisionThinking("maybe"), "auto");
assert.equal(normalizeDecisionThinking("allowed"), "allowed");
assert.equal(normalizeDecisionThinking("off"), "off");

// ── the backend against a recorded llama-server ───────────────────────────────

type Recorded = { status: number; body: unknown };

/** A stand-in llama-server that replays one recorded response per question. */
async function withRecordedSlot(
  responses: Map<string, Recorded>,
  run: (slot: { baseUrl: string; requests: Array<Record<string, unknown>> }) => Promise<void>,
) {
  const requests: Array<Record<string, unknown>> = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const body = JSON.parse(raw) as Record<string, unknown>;
      requests.push(body);
      const question = String((body.messages as Array<{ content: string }>)[1]!.content);
      const key = [...responses.keys()].find((candidate) => question.includes(candidate)) ?? "";
      const recorded = responses.get(key) ?? { status: 500, body: { error: "unrecorded" } };
      res.writeHead(recorded.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(recorded.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  try {
    await run({ baseUrl: `http://127.0.0.1:${port}`, requests });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const oneToken = (candidates: Array<[string, number]>, content = candidates[0]![0]) => ({
  status: 200,
  body: {
    choices: [
      {
        message: { content },
        logprobs: {
          content: [
            {
              token: candidates[0]![0],
              logprob: logprob(candidates[0]![1]),
              top_logprobs: candidates.map(([token, probability]) => ({ token, logprob: logprob(probability) })),
            },
          ],
        },
      },
    ],
  },
});

const baseSlot = { slot: "primary" as const, model: "local-sidecar", label: "Test model", thinking: "auto" as const };

clearDecisionThinkingCache();
await withRecordedSlot(
  new Map<string, Recorded>([
    [
      "moved",
      oneToken([
        ["yes", 0.8],
        ["no", 0.2],
      ]),
    ],
    [
      "stayed",
      oneToken([
        ["no", 0.95],
        ["yes", 0.05],
      ]),
    ],
    // A model that opens a reasoning block instead of answering.
    [
      "thinks",
      oneToken(
        [
          ["<think>", 0.97],
          ["no", 0.03],
        ],
        "<think>",
      ),
    ],
    ["broken", { status: 500, body: { error: "boom" } }],
  ]),
  async ({ baseUrl, requests }) => {
    const slot = { ...baseSlot, baseUrl, modelIdentity: "primary:test:1" };
    const answers = await askSidecarNoulQuestions({
      slot,
      state: { recent_messages: [{ role: "user", content: "hi" }] },
      questions: [
        { id: "a", instructions: "The scene moved." },
        { id: "b", instructions: "The scene stayed." },
        { id: "c", instructions: "The model thinks." },
        { id: "d", instructions: "The server is broken." },
      ],
    });
    assert.ok(Math.abs(answers.get("a")! - 0.8) < 0.01);
    assert.ok(Math.abs(answers.get("b")! - 0.05) < 0.01);
    // Neither the reasoning model nor the broken server produces an answer, so both
    // agents run: a gate failure must never silently stop an agent.
    assert.equal(answers.has("c"), false);
    assert.equal(answers.has("d"), false);

    // Every request must carry the two fields openai.provider.ts would otherwise drop,
    // and must not constrain the output with a grammar or schema.
    for (const body of requests) {
      assert.equal(body.logprobs, true);
      assert.equal(body.top_logprobs, 10);
      assert.equal(body.max_tokens, 1);
      assert.equal(body.temperature, 0);
      assert.equal(body.reasoning_format, "none");
      assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
      assert.equal("response_format" in body, false);
      // The shared state is the prefix, so llama-server's prompt cache is reused
      // across the questions of one group.
      const user = String((body.messages as Array<{ content: string }>)[1]!.content);
      assert.ok(user.startsWith("Conversation:"));
      assert.ok(user.lastIndexOf("Question:") > user.indexOf("Conversation:"));
    }
  },
);

// Auto switches a model over only after it has failed twice, and records that on the
// model rather than on the slot, so the user's own Thinking setting is never rewritten.
clearDecisionThinkingCache();
await withRecordedSlot(
  new Map<string, Recorded>([
    [
      "thinks",
      oneToken(
        [
          ["<think>", 0.99],
          ["no", 0.01],
        ],
        "<think>",
      ),
    ],
  ]),
  async ({ baseUrl }) => {
    const slot = { ...baseSlot, baseUrl, modelIdentity: "primary:reasoner:1" };
    const question = [{ id: "a", instructions: "The model thinks." }];
    await askSidecarNoulQuestions({ slot, state: {}, questions: question });
    assert.equal(getAnswerStyle("primary:reasoner:1"), "unknown", "one failure is not yet a verdict");
    await askSidecarNoulQuestions({ slot, state: {}, questions: question });
    assert.equal(getAnswerStyle("primary:reasoner:1"), "thinks");
    // A different model starts clean, because the cache key carries the loaded model.
    assert.equal(getAnswerStyle("primary:other:1"), "unknown");
  },
);

// A runtime that returns no log-probabilities still answers, but as a 1 or a 0, and
// the entry is reported as uncalibrated so the threshold slider means nothing.
clearDecisionThinkingCache();
await withRecordedSlot(
  new Map<string, Recorded>([["plain", { status: 200, body: { choices: [{ message: { content: "yes" } }] } }]]),
  async ({ baseUrl }) => {
    const slot = { ...baseSlot, baseUrl, modelIdentity: "primary:nologprobs:1" };
    const answers = await askSidecarNoulQuestions({
      slot,
      state: {},
      questions: [{ id: "a", instructions: "The plain server answered." }],
    });
    assert.equal(answers.get("a"), 1);
  },
);

// The Test probe reports both of the things only a local slot can be unsure about.
clearDecisionThinkingCache();
await withRecordedSlot(
  new Map<string, Recorded>([
    [
      "door",
      oneToken([
        ["yes", 0.9],
        ["no", 0.1],
      ]),
    ],
  ]),
  async ({ baseUrl }) => {
    const probe = await probeDecisionSlot({ ...baseSlot, baseUrl, modelIdentity: "primary:probe:1" });
    assert.equal(probe.answersDirectly, true);
    assert.equal(probe.logprobs, true);
    assert.ok(Math.abs(probe.probability! - 0.9) < 0.01);
  },
);

// ── footprint, preflight and diagnostics ──────────────────────────────────────

const RECORDED_SMI =
  "0, GPU-b1e6a2e9, NVIDIA GeForce RTX 5090 Laptop GPU, 24463, 182, 615.71.09\n" +
  "1, GPU-aaaa1111, NVIDIA GeForce RTX 3060, 12288, 900, 580.95.05\n";
const devices = parseNvidiaSmi(RECORDED_SMI);
assert.equal(devices.length, 2);
assert.equal(devices[0]!.name, "NVIDIA GeForce RTX 5090 Laptop GPU");
assert.equal(devices[0]!.totalBytes, 24463 * 1024 * 1024);
assert.equal(devices[0]!.driverVersion, "615.71.09");
// Junk, short rows and a zero-memory row are dropped rather than becoming a GPU with
// no memory, which would read as "won't fit" for everything.
assert.deepEqual(parseNvidiaSmi("not, a, row\n\n0, u, n, 0, 0, 1.0\n"), []);

assert.ok(compareDriverVersions("580.95.05", "581.0") < 0);
assert.ok(compareDriverVersions("615.71.09", "580.95") > 0);
assert.equal(compareDriverVersions("580.95", "580.95.0"), 0);
// An unparseable driver string is not a reason to block an install.
assert.equal(compareDriverVersions("unknown", "580.95"), 0);

assert.equal(estimateSlotBytes({ fileBytes: null, contextSize: 8192 }), null);
const eightK = estimateSlotBytes({ fileBytes: 8_000_000_000, contextSize: 8192 })!;
// The KV allowance is measured, not nominal: 64.7 KiB per token, from the same GGUF
// loaded at 4,096 and at 32,768 tokens on one card. A token figure small enough to
// disappear into rounding would be arithmetic theatre.
assert.ok(eightK - 8_000_000_000 > 500_000_000, `expected a real KV allowance, got ${eightK - 8_000_000_000}`);
assert.ok(eightK - 8_000_000_000 < 600_000_000);
// A running slot is measured, and the measurement replaces the estimate in both
// directions: llama.cpp allocates the whole KV cache at load, so the reading is
// complete, and a file size is not a device footprint for every architecture.
assert.equal(
  estimateSlotBytes({ fileBytes: 1_000_000_000, contextSize: 0, measuredBytes: 9_000_000_000 }),
  9_000_000_000,
);
assert.equal(
  estimateSlotBytes({ fileBytes: 8_192_953_472, contextSize: 8192, measuredBytes: 5_472_000_000 }),
  5_472_000_000,
  "a Gemma 4 E4B really measures 5.2 GB on the card from an 8.2 GB file",
);
// Per-process readings, the thing that makes a running slot measurable at all.
const apps = parseNvidiaSmiApps("15647, 14\n717315, 7030\n");
assert.equal(apps.get(717315), 7030 * 1024 * 1024);
assert.equal(parseNvidiaSmiApps("bad row\n999, 0\n").size, 0, "a zero-byte row is not a measurement");

const slot = (over: Partial<Parameters<typeof assessSidecarLoad>[0]["slots"][number]>) => ({
  slot: "main" as const,
  configured: true,
  running: false,
  model: "m",
  fileBytes: null,
  contextSize: null,
  backend: null,
  estimatedBytes: 0,
  measured: false,
  onCpu: false,
  ...over,
});
const card = (totalBytes: number): GpuDevice => ({
  index: 0,
  uuid: "u",
  name: "NVIDIA",
  totalBytes,
  usedBytes: 0,
  driverVersion: "615.71.09",
});

const GB = 1_000_000_000;
// Every verdict row.
assert.equal(
  assessSidecarLoad({ slots: [], device: card(24 * GB), unsupportedReason: "requires_linux" }).verdict,
  "unsupported",
);
assert.equal(
  assessSidecarLoad({
    slots: [],
    device: card(24 * GB),
    freeDiskBytes: 1 * GB,
    requiredDiskBytes: 12 * GB,
  }).verdict,
  "not_enough_disk",
);
assert.equal(
  assessSidecarLoad({
    slots: [slot({ slot: "decision", estimatedBytes: 30 * GB })],
    device: card(24 * GB),
    candidate: "decision",
  }).verdict,
  "wont_fit",
  "the candidate alone exceeds the card, which stopping something else cannot fix",
);
const beside = assessSidecarLoad({
  slots: [slot({ estimatedBytes: 12 * GB }), slot({ slot: "decision", estimatedBytes: 19 * GB })],
  device: card(24 * GB),
  candidate: "decision",
});
assert.equal(beside.verdict, "wont_fit_beside_sidecar");
assert.equal(beside.blockingSlot, "main", "the warning names the sidecar model in the way");
assert.equal(
  assessSidecarLoad({
    slots: [slot({ estimatedBytes: 23 * GB })],
    device: card(24 * GB),
  }).verdict,
  "tight",
);
assert.equal(
  assessSidecarLoad({
    slots: [slot({ estimatedBytes: 10 * GB })],
    device: card(24 * GB),
  }).verdict,
  "recommended",
);
// The threshold between tight and recommended is the documented headroom.
assert.equal(
  assessSidecarLoad({
    slots: [slot({ estimatedBytes: 24 * GB - SIDECAR_FOOTPRINT_HEADROOM_BYTES })],
    device: card(24 * GB),
  }).verdict,
  "recommended",
);

// Memory another application already holds counts against the card. Without this a
// model that cannot possibly load reads as "recommended".
const busyCard = { ...card(24 * GB), usedBytes: 20 * GB };
assert.equal(assessSidecarLoad({ slots: [slot({ estimatedBytes: 6 * GB })], device: busyCard }).verdict, "wont_fit");
// A running slot of ours is already inside the card's `used` figure, so it is counted
// once rather than twice: 8 GB used, all of it ours, leaves the full remainder free.
const oursRunning = assessSidecarLoad({
  slots: [slot({ estimatedBytes: 8 * GB, running: true })],
  device: { ...card(24 * GB), usedBytes: 8 * GB },
});
assert.equal(oursRunning.totalBytes, 8 * GB, "our own running slot must not be double counted");
assert.equal(oursRunning.verdict, "recommended");
// Anything on the card beyond our running slots is somebody else's and does count.
const mixed = assessSidecarLoad({
  slots: [slot({ estimatedBytes: 8 * GB, running: true })],
  device: { ...card(24 * GB), usedBytes: 11 * GB },
});
assert.equal(mixed.totalBytes, 11 * GB, "3 GB held by another application is added to our 8 GB");

// A CPU-bound slot is weighed against system memory, so it never counts against the card.
assert.equal(
  assessSidecarLoad({
    slots: [slot({ estimatedBytes: 40 * GB, onCpu: true })],
    device: card(24 * GB),
  }).totalBytes,
  0,
);
// With no device, nothing is asserted about fit.
assert.equal(assessSidecarLoad({ slots: [slot({ estimatedBytes: 99 * GB })], device: null }).verdict, "recommended");

// A slot this build cannot run must not be selectable or writable through the API,
// or a setting for it lands on the primary slot's config instead.
assert.equal(isDecisionSlotImplemented("primary"), true);
assert.equal(isDecisionSlotImplemented("utility"), true);
assert.equal(isDecisionSlotImplemented("decision_sidecar"), false);

// The dropdown greys a connection out and the select route refuses it using the same
// rule, so a stale client cannot store a decision model that cannot sign a request.
const plain = { id: "a" };
const quarantined = { id: "b", profileImportReviewRequired: "true" };
const borrowsPlain = { id: "c", credentialsFromConnectionId: "a" };
const borrowsQuarantined = { id: "d", credentialsFromConnectionId: "b" };
const borrowsMissing = { id: "e", credentialsFromConnectionId: "zzz" };
const all = [plain, quarantined, borrowsPlain, borrowsQuarantined, borrowsMissing];
assert.equal(decisionConnectionUnavailable(plain, all), null);
assert.equal(decisionConnectionUnavailable(borrowsPlain, all), null);
assert.equal(decisionConnectionUnavailable(quarantined, all), "needs_relinking");
assert.equal(
  decisionConnectionUnavailable(borrowsQuarantined, all),
  "needs_relinking",
  "a quarantined lender lends nothing",
);
assert.equal(decisionConnectionUnavailable(borrowsMissing, all), "needs_relinking", "a deleted lender needs relinking");

// Vulkan and CUDA index the same cards differently, so devices are matched by name and
// a machine with one NVIDIA GPU shares it.
assert.equal(resolveSharedDevice(devices, null), null, "two cards and no name: claim nothing");
assert.equal(resolveSharedDevice([devices[0]!], null), devices[0]);
assert.equal(resolveSharedDevice(devices, "RTX 3060"), devices[1]);

console.log("decision-local-models regression passed");
