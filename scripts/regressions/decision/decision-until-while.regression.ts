/**
 * `until:"..."` and `while:"..."` on decision statements (#6922): after a yes the block
 * stays on without its statement being asked, and the condition is asked each turn in
 * its place. Until turns it off on a yes, while on a no; with sticky, `:and` stops at
 * whichever ends first and `:or` at whichever ends last. Cooldown follows as usual.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DecisionLifetime } from "../../../packages/server/src/services/decision/decision-timers.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-decision-until-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { collectDecisionQuestions, resolveMacros, characterDataSchema } =
  await import("../../../packages/shared/dist/index.js");
const { planPromptDecisions, answerPromptDecisions, PromptDecisionTurnCache } =
  await import("../../../packages/server/src/services/decision/prompt-decisions.js");
const { readDecisionTimers, decisionTurnFor, heldDecision } =
  await import("../../../packages/server/src/services/decision/decision-timers.js");

// ── parsing ───────────────────────────────────────────────────────────────────

const parse = (condition: string) => collectDecisionQuestions(`{{#if ${condition}}}x{{/if}}`)[0];
assert.deepEqual(parse('decision:"A fight starts" until:"The fight ends" sticky:2'), {
  kind: "noul",
  question: "A fight starts",
  options: [],
  sticky: 2,
  lasts: { statement: "The fight ends", kind: "until", mode: "and" },
});
assert.deepEqual(parse(`decision:"A" while:'Ada hides'`).lasts, { statement: "Ada hides", kind: "while", mode: "or" });
assert.equal(parse('decision:"A" until:"B":extend sticky:5').lasts.mode, "or", "extend is or");
assert.equal(parse('decision:"A" while:"B":restrict').lasts.mode, "and", "restrict is and");
assert.equal(parse('decision:"A" until:"B":OR').lasts.mode, "or", "modes ignore case");
const both = parse('decision:"A" until:"B" while:"C" cooldown:1');
assert.equal(both.question, "A", "both clauses come out of the statement");
assert.deepEqual(both.lasts, { statement: "B", kind: "until", mode: "and" }, "only the first counts");
assert.equal(both.cooldown, 1);
assert.equal(parse('decision:"A" until:""').lasts, undefined, "an empty condition is ignored");
const anyOrder = parse('decision:"A" sticky:3 until:"B ends":or cooldown:1');
assert.deepEqual(
  [anyOrder.question, anyOrder.sticky, anyOrder.cooldown, anyOrder.lasts],
  ["A", 3, 1, { statement: "B ends", kind: "until", mode: "or" }],
  "modifiers can come in any order",
);

// ── turns ─────────────────────────────────────────────────────────────────────

const ctx = { user: "Ada", char: "Mira", characters: ["Mira"], variables: {} } as never;

/** Each turn says which statements are true; returns what was asked and whether the block is on. */
async function play(modifiers: string, turns: Array<Record<string, boolean>>) {
  const template = `{{#if decision:"Start" ${modifiers}}}ON{{/if}}`;
  const timers = readDecisionTimers(undefined);
  const cache = new PromptDecisionTurnCache();
  const seen: string[] = [];
  for (const [index, truth] of turns.entries()) {
    const turn = decisionTurnFor(timers, `message-${index}`);
    const plan = planPromptDecisions([{ texts: [template], ctx }], 32, {
      held: (kind: "noul" | "choice", key: string, modifiers?: { every?: number; lasts?: DecisionLifetime }) =>
        heldDecision(timers, turn, kind, key, modifiers?.every, modifiers?.lasts),
    });
    const asked: string[] = [];
    const backend = {
      maxStateTokens: 1000,
      calibration: { defaultThreshold: 0.5 },
      deferPreGeneration: false,
      askMixed: async (_state: unknown, questions: Array<{ id: string; instructions: string }>) => {
        asked.push(...questions.map((question) => question.instructions));
        const answered = questions.filter((question) => question.instructions in truth);
        return {
          answers: new Map(answered.map((question) => [question.id, truth[question.instructions] ? 0.9 : 0.1])),
          choices: new Map(),
        };
      },
    } as never;
    const decisions = await answerPromptDecisions({
      plan,
      backend,
      messages: [],
      cacheKey: `turn-${index}`,
      cache,
      timers: { state: timers, turn },
    });
    seen.push(`${asked.join("+") || "-"}:${resolveMacros(template, { ...(ctx as object), decisions } as never)}`);
  }
  return seen;
}

assert.deepEqual(
  await play('until:"Stop"', [{ Start: true }, { Stop: false }, { Stop: true }, { Start: false }]),
  ["Start:ON", "Stop:ON", "Stop:", "Start:"],
  "until: the condition is asked in place of the statement, and a yes turns the block off",
);
assert.deepEqual(
  await play('while:"Hidden"', [{ Start: true }, { Hidden: true }, { Hidden: false }, { Start: false }]),
  ["Start:ON", "Hidden:ON", "Hidden:", "Start:"],
  "while: a no turns the block off",
);
assert.deepEqual(
  await play('until:"Stop" sticky:2', [{ Start: true }, { Stop: false }, { Stop: false }, { Start: false }]),
  ["Start:ON", "Stop:ON", "Stop:ON", "Start:"],
  "until with sticky defaults to and: on at most for the sticky turns",
);
assert.deepEqual(
  await play('until:"Stop" sticky:2', [{ Start: true }, { Stop: true }, { Start: false }]),
  ["Start:ON", "Stop:", "Start:"],
  "and the condition can cut sticky short",
);
assert.deepEqual(
  await play('until:"Stop":or sticky:2', [{ Start: true }, {}, {}, { Stop: false }, { Stop: true }, { Start: false }]),
  ["Start:ON", "-:ON", "-:ON", "Stop:ON", "Stop:", "Start:"],
  "until:or stays on through sticky without asking, then until the condition says stop",
);
assert.deepEqual(
  await play('while:"Hidden" sticky:2', [{ Start: true }, {}, {}, { Hidden: true }, { Hidden: false }]),
  ["Start:ON", "-:ON", "-:ON", "Hidden:ON", "Hidden:"],
  "while with sticky defaults to or",
);
assert.deepEqual(
  await play('while:"Hidden":and sticky:2', [{ Start: true }, { Hidden: true }, { Hidden: false }, { Start: false }]),
  ["Start:ON", "Hidden:ON", "Hidden:", "Start:"],
  "while:and stops at the first no during sticky",
);
assert.deepEqual(
  await play('until:"Stop" cooldown:2', [{ Start: true }, { Stop: true }, {}, {}, { Start: false }]),
  ["Start:ON", "Stop:", "-:", "-:", "Start:"],
  "cooldown follows the turn the block is turned off",
);
assert.deepEqual(
  await play('until:"Stop"', [{ Start: true }, {}, { Stop: true }]),
  ["Start:ON", "Stop:ON", "Stop:"],
  "a condition with no answer leaves the block on",
);

// ── a real chat ───────────────────────────────────────────────────────────────

const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../../packages/server/src/services/storage/prompts.storage.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");

const db = await getDB();
let truth: Record<string, boolean> = {};
const asked: string[][] = [];
const prompts: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  if (request.url?.endsWith("/systemone")) {
    const questions = Object.entries(body.questions as Record<string, { instructions: string }>);
    asked.push(questions.map(([, question]) => question.instructions));
    const answers = Object.fromEntries(
      questions.map(([id, question]) => [id, { type: "noul", noul: truth[question.instructions] ? 0.9 : 0.1 }]),
    );
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ answers }));
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
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Mira" }));
  assert(character);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Until", parameters: { maxTokens: 256, maxContext: 8192 } });
  assert(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "scene",
    name: "Scene",
    content: '{{#if decision:"A fight starts" until:"The fight ends"}}COMBAT_RULES{{/if}}',
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
    name: "Until turns",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: chatConnection.id,
    promptPresetId: preset.id,
  } as never);
  assert(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false, enableMemoryRecall: false });
  const turn = async (userMessage: string, answers: Record<string, boolean>) => {
    truth = answers;
    const from = asked.length;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, userMessage },
    });
    assert.equal(response.statusCode, 200, response.body);
    return { asked: asked.slice(from).flat(), on: (prompts.at(-1) ?? "").includes("COMBAT_RULES") };
  };
  assert.deepEqual(await turn("Swords are drawn.", { "A fight starts": true }), {
    asked: ["A fight starts"],
    on: true,
  });
  assert.deepEqual(
    await turn("They trade blows.", { "The fight ends": false }),
    { asked: ["The fight ends"], on: true },
    "the next turn asks only the until statement, and the block stays on",
  );
  assert.deepEqual(await turn("The bandit flees.", { "The fight ends": true }), {
    asked: ["The fight ends"],
    on: false,
  });
  assert.deepEqual(
    await turn("Calm returns.", { "A fight starts": false }),
    { asked: ["A fight starts"], on: false },
    "once off, the statement itself is asked again",
  );
  console.log("decision-until-while regression passed");
} finally {
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
