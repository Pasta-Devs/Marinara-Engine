/**
 * Smart response order answered by the Decision model.
 *
 * The rules are pinned directly, then four real generate runs prove the wiring: the
 * Decision model's verdicts choose the speaker without a chat-model selector call, the
 * last speaker yields to someone else with a reason, a failing Decision model falls
 * back to the chat-model selector, and with the switch off nothing asks it at all.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-smart-group-decision-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { chooseSmartResponders, smartOrderQuestions, smartOrderState } =
  await import("../../packages/server/src/services/generation/smart-group-decision.js");

// ── the rules ──────────────────────────────────────────────────────────────────

const ids = ["a", "b", "c"];
const answers = (entries: Record<string, number>) => new Map(Object.entries(entries));
const choose = (
  entries: Record<string, number>,
  mode: "conversation" | "roleplay",
  lastSpeakerId: string | null = null,
  threshold = 0.5,
) => chooseSmartResponders({ answers: answers(entries), candidateIds: ids, lastSpeakerId, threshold, mode });

assert.deepEqual(choose({ a: 0.2, b: 0.9, c: 0.6 }, "roleplay"), ["b"], "roleplay takes the single most likely");
assert.deepEqual(
  choose({ a: 0.2, b: 0.9, c: 0.6 }, "conversation"),
  ["b", "c"],
  "conversation takes everyone with a reason, most likely first",
);
assert.deepEqual(choose({ a: 0.2, b: 0.9, c: 0.6 }, "roleplay", "b"), ["c"], "the last speaker yields");
assert.deepEqual(
  choose({ a: 0.2, b: 0.9, c: 0.1 }, "roleplay", "b"),
  ["b"],
  "but speaks again when nobody else has a reason",
);
assert.deepEqual(
  choose({ a: 0.3, b: 0.4, c: 0.1 }, "roleplay", "b"),
  ["a"],
  "nobody over the threshold: the most likely who did not just speak",
);
assert.deepEqual(choose({ a: 0.7, b: 0.7, c: 0.7 }, "roleplay"), ["a"], "a tie keeps roster order");
assert.deepEqual(choose({ a: 0.12, b: 0.08 }, "roleplay", null, 0.1), ["a"], "the threshold is the model's own");
assert.equal(choose({}, "roleplay"), null, "no answers is no choice, so the chat model decides");

const roster = [
  { id: "a", name: "Aya", status: "online", talkativeness: 70, about: "x".repeat(2000) },
  { id: "b", name: "Bram" },
];
const questions = smartOrderQuestions(roster);
assert.deepEqual(
  questions.map((question) => question.id),
  ["a", "b"],
);
assert.match(questions[0]!.instructions, /^Aya has a natural, immediate reason to respond/u);
const transcript = Array.from({ length: 12 }, (_, index) => ({
  role: index % 2 ? "assistant" : "user",
  name: index % 2 ? "Aya" : "Player",
  content: `line ${index} ${"word ".repeat(40)}`,
}));
const state = smartOrderState(transcript, roster, 600) as {
  recent_messages: Array<{ content: string }>;
  candidates: Array<{ name: string; about?: string }>;
};
assert.equal(state.candidates.length, 2, "every candidate is in the state");
assert.equal(state.candidates[0]!.about!.length, 300, "a long card is shortened");
assert.ok(state.recent_messages.length <= 5, "the transcript is the selector's five turns at most");
assert.match(state.recent_messages.at(-1)!.content, /^line 11/u, "the newest turn is kept");

// ── the real route ─────────────────────────────────────────────────────────────

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { characterDataSchema, DECISION_SMART_ORDER_SETTINGS_KEY } = await import("../../packages/shared/dist/index.js");

let probabilities: Record<string, number> = {};
let decisionFails = false;
let selectorAnswer: string[] = [];
const decisionCalls: Array<{ questions: string[] }> = [];
const selectorCalls: string[] = [];
const replies: string[] = [];

const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  if (request.url?.endsWith("/systemone")) {
    decisionCalls.push({ questions: Object.keys(body.questions ?? {}) });
    if (decisionFails) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "fixture decision failure" }));
      return;
    }
    const out: Record<string, { type: "noul"; noul: number }> = {};
    for (const id of Object.keys(body.questions ?? {})) out[id] = { type: "noul", noul: probabilities[id] ?? 0 };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ answers: out }));
    return;
  }
  const prompt = JSON.stringify(body.messages ?? []);
  if (prompt.includes("hidden response orchestrator")) {
    selectorCalls.push(prompt);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        choices: [
          { index: 0, message: { role: "assistant", content: JSON.stringify(selectorAnswer) }, finish_reason: "stop" },
        ],
      }),
    );
    return;
  }
  const speaker = /Respond as ([A-Za-z]+)/u.exec(prompt)?.[1] ?? "unknown";
  replies.push(speaker);
  const content = `${speaker} answers.`;
  if (!body.stream) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
    return;
  }
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n` +
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});

const db = await getDB();
const chats = createChatsStorage(db);
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
  const decision = await connections.create({
    name: "Decision fixture",
    provider: "decision",
    decisionSource: "custom",
    baseUrl,
    model: "jev-latest",
    maxStateTokens: 3500,
    defaultForAgents: true,
  });
  assert(decision);
  assert.equal((await connections.getDefaultForDecision())?.id, decision.id);

  const characters = createCharactersStorage(db);
  const cast = await Promise.all(
    ["Aya", "Bram", "Cole"].map((name) => characters.create(characterDataSchema.parse({ name }))),
  );
  assert(cast.every(Boolean));
  const [aya, bram, cole] = cast as Array<{ id: string }>;

  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Smart fixture", parameters: { maxTokens: 256, maxContext: 8192 } });
  assert(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "rules",
    name: "Rules",
    content: "Respond as {{char}}.",
  });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });

  const chat = await chats.create({
    name: "Smart order proof",
    mode: "roleplay",
    characterIds: [aya!.id, bram!.id, cole!.id],
    connectionId: chatConnection.id,
    promptPresetId: preset.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableMemoryRecall: false,
    groupChatMode: "individual",
    groupResponseOrder: "smart",
  });

  const settings = createAppSettingsStorage(db);
  const turn = async (text: string) => {
    replies.length = 0;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, userMessage: text },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    return [...replies];
  };

  // 1. The Decision model picks, and no chat-model selector call is made.
  await settings.set(DECISION_SMART_ORDER_SETTINGS_KEY, "true");
  probabilities = { [aya!.id]: 0.2, [bram!.id]: 0.9, [cole!.id]: 0.6 };
  assert.deepEqual(await turn("Bram, what do you think?"), ["Bram"], "the most likely candidate speaks");
  assert.equal(decisionCalls.length, 1, "one batched decision request for the whole roster");
  assert.deepEqual(decisionCalls[0]!.questions.sort(), [aya!.id, bram!.id, cole!.id].sort());
  assert.equal(selectorCalls.length, 0, "the chat-model selector is not called");

  // 2. The last speaker yields to someone else with a reason.
  probabilities = { [aya!.id]: 0.1, [bram!.id]: 0.95, [cole!.id]: 0.7 };
  assert.deepEqual(await turn("And then?"), ["Cole"], "Bram just spoke, so Cole answers");
  assert.equal(selectorCalls.length, 0);

  // 3. A failing Decision model falls back to the chat-model selector, not to a guess.
  decisionFails = true;
  selectorAnswer = [aya!.id];
  assert.deepEqual(await turn("Anyone?"), ["Aya"], "the chat-model selector chose");
  assert.equal(selectorCalls.length, 1, "exactly one selector call after the failed decision");
  decisionFails = false;

  // 4. With the switch off, the Decision model is not asked at all.
  await settings.remove(DECISION_SMART_ORDER_SETTINGS_KEY);
  const before = decisionCalls.length;
  selectorAnswer = [cole!.id];
  assert.deepEqual(await turn("Still here?"), ["Cole"]);
  assert.equal(decisionCalls.length, before, "no decision request with the switch off");
  assert.equal(selectorCalls.length, 2);

  console.log("smart-group-decision regression passed");
} finally {
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
