import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-capability-decisions-"));
process.env.DATA_DIR = dataDir;

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createCapabilityDecisionHost } =
  await import("../../packages/server/src/services/capability-packages/capability-decision.service.js");

try {
  const db = await getDB();
  const asked: Array<{ state: unknown; questions: unknown }> = [];
  const backend = {
    model: "fixture",
    maxStateTokens: 4096,
    calibration: { defaultThreshold: 0.4, questionShape: "text" as const },
    deferPreGeneration: false,
    ask: async () => null,
    askMixed: async (state: unknown, questions: unknown) => {
      asked.push({ state, questions });
      return { answers: new Map([["rain", 0.9]]), choices: new Map([["mood", "calm"]]) };
    },
  };
  const host = createCapabilityDecisionHost(db, async () => backend);
  const result = await host.evaluate({
    messages: [{ role: "user", content: "It is pouring outside." }],
    questions: [
      { id: "rain", question: "It is raining." },
      { id: "mood", question: "The mood is", options: ["calm", " tense "] },
    ],
  });
  assert.deepEqual(result, { model: "fixture", answers: { rain: 0.9 }, choices: { mood: "calm" }, threshold: 0.4 });
  assert.deepEqual(asked[0]!.state, { recent_messages: [{ role: "user", content: "It is pouring outside." }] });
  assert.deepEqual(asked[0]!.questions, [
    { id: "rain", instructions: "It is raining." },
    { id: "mood", instructions: "The mood is", options: ["calm", "tense"] },
  ]);

  // No Decision model configured reads as null, never an error.
  assert.equal(
    await createCapabilityDecisionHost(db, async () => null).evaluate({
      messages: [],
      questions: [{ id: "a", question: "Yes?" }],
    }),
    null,
  );

  // A backend that answered nothing (unreachable, timed out) reads as null too.
  const silent = { ...backend, askMixed: async () => ({ answers: new Map(), choices: new Map(), error: "timeout" }) };
  assert.equal(
    await createCapabilityDecisionHost(db, async () => silent).evaluate({
      messages: [],
      questions: [{ id: "a", question: "Yes?" }],
    }),
    null,
  );

  // Trust boundary: bad requests are refused before any model is asked.
  const calls = asked.length;
  const bad = [
    { messages: [], questions: [] },
    {
      messages: [],
      questions: [
        { id: "a", question: "x" },
        { id: "a", question: "y" },
      ],
    },
    { messages: [], questions: [{ id: "a\u00000", question: "x" }] },
    { messages: [], questions: [{ id: "a", question: "x".repeat(501) }] },
    { messages: [], questions: [{ id: "a", question: "x", options: ["only"] }] },
    { messages: [{ role: "user", content: 1 }], questions: [{ id: "a", question: "x" }] },
    { messages: [{ role: "user", name: "n".repeat(101), content: "" }], questions: [{ id: "a", question: "x" }] },
    { messages: [{ role: "tool", content: "" }], questions: [{ id: "a", question: "x" }] },
    { messages: [], questions: Array.from({ length: 33 }, (_, i) => ({ id: `q${i}`, question: "x" })) },
  ];
  for (const request of bad) await assert.rejects(host.evaluate(request as never), TypeError);
  assert.equal(asked.length, calls);
  console.log("capability decisions regression passed");
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
