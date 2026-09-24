/**
 * Priority and timing on decision statements (#6599): `priority:high|low` decides which
 * statements are asked when a turn has more than its limit, and `every:N` asks a
 * statement only every N turns, reading as no in between without taking a slot.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-decision-priority-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { collectDecisionQuestions, characterDataSchema, DECISION_PROMPT_QUESTION_LIMIT_SETTINGS_KEY } =
  await import("../../packages/shared/dist/index.js");
const { planPromptDecisions } = await import("../../packages/server/src/services/decision/prompt-decisions.js");
const { readDecisionTimers, decisionTurnFor, heldDecision, recordDecisionCheck } =
  await import("../../packages/server/src/services/decision/decision-timers.js");

// ── parsing ───────────────────────────────────────────────────────────────────

const [parsed] = collectDecisionQuestions('{{#if decision:"A" priority:high every:3 sticky:2}}x{{/if}}');
assert.equal(parsed.priority, "high");
assert.equal(parsed.every, 3);
assert.equal(parsed.sticky, 2);
const [medium] = collectDecisionQuestions('{{#if decision:"A" priority:medium}}x{{/if}}');
assert.equal(medium.priority, undefined, "medium is the default, so it is not stored");
const [unknown] = collectDecisionQuestions('{{#if decision:"A" priority:urgent every:0}}x{{/if}}');
assert.equal(unknown.priority, undefined, "an unknown priority is ignored");
assert.equal(unknown.every, undefined, "every:0 is ignored");

// ── priority under the limit ──────────────────────────────────────────────────

const ctx = { user: "User", char: "Mira", characters: ["Mira"], variables: {} } as never;
const block = (statement: string, modifiers = "") =>
  `{{#if decision:"${statement}"${modifiers ? ` ${modifiers}` : ""}}}x{{/if}}`;
const texts = [block("Low", "priority:low"), block("Medium"), block("High", "priority:high")];
const plan = (limit: number, planTexts = texts) => planPromptDecisions([{ texts: planTexts, ctx }], limit);
assert.deepEqual(
  plan(1).decisions.map((decision: { key: string }) => decision.key),
  ["High"],
  "high is asked first",
);
assert.deepEqual(plan(1).dropped, ["Medium", "Low"], "and low is dropped first");
assert.deepEqual(
  plan(2).decisions.map((decision: { key: string }) => decision.key),
  ["High", "Medium"],
);
assert.deepEqual(
  plan(3).decisions.map((decision: { key: string }) => decision.key),
  ["High", "Medium", "Low"],
  "within the limit everything is asked",
);
const merged = plan(3, [
  block("Twice", "priority:low every:4"),
  block("Twice", "every:2"),
  block("Thrice", "priority:low"),
]).decisions;
assert.equal(merged[0].key, "Twice");
assert.equal(merged[0].priority, undefined, "an occurrence without priority counts as medium, the higher one");
assert.equal(merged[0].every, 2, "the smallest every anywhere");
assert.equal(merged[1].priority, "low", "low only when every occurrence says so");

// ── timing ────────────────────────────────────────────────────────────────────

{
  const timers = readDecisionTimers(undefined);
  const turn1 = decisionTurnFor(timers, "m1");
  recordDecisionCheck(timers, turn1, { kind: "noul", key: "Weather", every: 3 });
  const held: Array<boolean | undefined> = [];
  for (const id of ["m1", "m2", "m3", "m4"])
    held.push(heldDecision(timers, decisionTurnFor(timers, id), "noul", "Weather", 3)?.yes);
  assert.deepEqual(held, [undefined, false, false, undefined], "asked, no for two turns, then asked again");
  assert.deepEqual(timers.checks, {}, "a check that has come due is dropped");
  recordDecisionCheck(timers, timers.turn, { kind: "noul", key: "Every turn", every: 1 });
  assert.deepEqual(timers.checks, {}, "every:1 is every turn, so nothing is kept");
  const timedPlan = planPromptDecisions([{ texts: [block("Weather", "every:3"), block("Live")], ctx }], 1, {
    held: (_kind: string, key: string, modifiers?: { every?: number }) =>
      key === "Weather" && modifiers?.every === 3 ? { yes: false } : undefined,
  });
  assert.deepEqual(
    timedPlan.decisions.map((decision: { key: string; held?: unknown }) => [decision.key, !!decision.held]),
    [
      ["Weather", true],
      ["Live", false],
    ],
    "a statement between checks takes no slot, and the planner passes its every to the timers",
  );
}

// ── real turns ────────────────────────────────────────────────────────────────

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");

const db = await getDB();
const decisionBodies: Array<{ questions: Record<string, { instructions?: string }> }> = [];
const prompts: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  if (request.url?.endsWith("/systemone")) {
    decisionBodies.push(body);
    const out: Record<string, unknown> = {};
    for (const id of Object.keys(body.questions)) out[id] = { type: "noul", noul: 0.9 };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ answers: out }));
    return;
  }
  prompts.push(JSON.stringify(body.messages ?? []));
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "Reply." }, finish_reason: null }] })}\n\n` +
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const connections = createConnectionsStorage(db);
  const chatConnection = await connections.create({
    name: "Chat fixture",
    provider: "custom",
    baseUrl,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 8192,
    maxTokensOverride: 256,
  });
  assert(chatConnection);
  assert(
    await connections.create({
      name: "Decision fixture",
      provider: "decision",
      decisionSource: "custom",
      baseUrl,
      model: "jev-latest",
      maxStateTokens: 3500,
      defaultForAgents: true,
    }),
  );
  await createAppSettingsStorage(db).set(DECISION_PROMPT_QUESTION_LIMIT_SETTINGS_KEY, "2");
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Mira" }));
  assert(character);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Prioritized", parameters: { maxTokens: 256, maxContext: 8192 } });
  assert(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "scene",
    name: "Scene",
    content:
      '{{#if decision:"The weather changes" every:2}}WEATHER{{/if}} ' +
      '{{#if decision:"A minor detail holds" priority:low}}MINOR{{/if}} ' +
      '{{#if decision:"A fight is on" priority:high}}FIGHT{{/if}}',
  } as never);
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  } as never);
  const chats = createChatsStorage(db);
  const chat = await chats.create({
    name: "Prioritized turns",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: chatConnection.id,
    promptPresetId: preset.id,
  } as never);
  assert(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false, enableMemoryRecall: false });
  const turn = async (payload: Record<string, unknown>) => {
    const from = decisionBodies.length;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, ...payload },
    });
    assert.equal(response.statusCode, 200, response.body);
    return {
      asked: decisionBodies.slice(from).flatMap((body) => Object.values(body.questions).map((q) => q.instructions)),
      prompt: prompts.at(-1) ?? "",
    };
  };
  let result = await turn({ userMessage: "Rain begins as swords are drawn." });
  assert.deepEqual(
    result.asked,
    ["A fight is on", "The weather changes"],
    "turn 1: two slots go to the high and the medium statement; the low one is dropped",
  );
  assert.ok(result.prompt.includes("FIGHT") && result.prompt.includes("WEATHER") && !result.prompt.includes("MINOR"));
  result = await turn({ userMessage: "They fight on." });
  assert.deepEqual(
    result.asked,
    ["A fight is on", "A minor detail holds"],
    "turn 2: the weather is between checks, so it takes no slot and the low one gets it",
  );
  assert.ok(!result.prompt.includes("WEATHER"), "between checks it reads as no");
  assert.ok(result.prompt.includes("MINOR"));
  const reply = (await chats.listMessages(chat.id)).filter((m: { role: string }) => m.role === "assistant").at(-1)!;
  result = await turn({ regenerateMessageId: reply.id });
  assert.deepEqual(result.asked, [], "a regeneration is the same turn: nothing asked");
  assert.ok(!result.prompt.includes("WEATHER"));
  result = await turn({ userMessage: "The storm breaks." });
  assert.deepEqual(result.asked, ["A fight is on", "The weather changes"], "turn 3: the weather is due again");
  console.log("decision-priority-timing regression passed");
} finally {
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
