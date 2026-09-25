/**
 * Prompt conditionals that ask the Decision model (#6569).
 *
 * The engine operands and the planning service are pinned directly, then real
 * generate runs prove the wiring: the branch the model's answer selects is the one the
 * provider receives, a Choice question is sent with its options, answers are kept for
 * the turn, and with no Decision model or a failing one the `{{else}}` branch is sent.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-decision-conditionals-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = process.env.DC_LOG ?? "silent";

const {
  collectDecisionQuestions,
  containsDecisionStatements,
  resolveDeferredCharacterMacros,
  resolveMacros,
  DECISION_PROMPT_QUESTION_LIMIT_SETTINGS_KEY,
  DECISION_LOCAL_SLOT_IDS,
  characterDataSchema,
} = await import("../../packages/shared/dist/index.js");
const { DECISION_SETTINGS_KEYS } = await import("../../packages/server/src/services/decision/decision-default.js");
const {
  agentShapedDecisionContext,
  answerPromptDecisions,
  planPromptDecisions,
  PromptDecisionTurnCache,
  promptDecisionTurnCache,
  promptDecisionCacheKey,
} = await import("../../packages/server/src/services/decision/prompt-decisions.js");

// ── engine: what a condition reads ─────────────────────────────────────────────

const profiles = [{ name: "Kaelen" }, { name: "Alyssa" }];
const base = {
  user: "Mira",
  char: "Kaelen",
  characters: ["Kaelen", "Alyssa"],
  variables: {},
  characterProfiles: profiles,
};
const run = (template: string, decisions?: object) =>
  resolveMacros(template, { ...base, decisions } as never, { trimResult: false });

const yesNo = `{{#if decision:"{{user}} is lying"}}LIE{{else}}TRUST{{/if}}`;
assert.equal(run(yesNo), "TRUST", "no Decision model: the else branch");
assert.equal(run(yesNo, { answers: new Map([["Mira is lying", true]]) }), "LIE");
assert.equal(run(yesNo, { answers: new Map([["Mira is lying", false]]) }), "TRUST");
assert.equal(
  run(`{{#if decision:"a fight starts"}}FIGHT{{/if}}`, { answers: new Map() }),
  "",
  "an unanswered statement reads as no, never as its own non-empty text",
);

const mood = `{{#if decision_choice:"Kaelen's mood" == "angry"}}ANGRY{{else if decision_choice:"Kaelen's mood" == "sad"}}SAD{{else}}CALM{{/if}}`;
assert.equal(run(mood, { choices: new Map([["Kaelen's mood", "angry"]]) }), "ANGRY");
assert.equal(run(mood, { choices: new Map([["Kaelen's mood", "sad"]]) }), "SAD");
assert.equal(run(mood, { choices: new Map([["Kaelen's mood", "none of these"]]) }), "CALM");
assert.equal(run(mood), "CALM", "no answer: every option comparison is false");
const notCalm = `{{#if decision_choice:"Kaelen's mood" != "calm"}}AGITATED{{else}}STEADY{{/if}}`;
assert.equal(run(notCalm), "STEADY", "no answer: even a != comparison is false");
assert.equal(
  run(notCalm, { choices: new Map([["Kaelen's mood", "none of these"]]) }),
  "AGITATED",
  "an answer of none is still an answer",
);

assert.deepEqual(collectDecisionQuestions(`{{#if decision_choice:"weather" == "rain" || "snow"}}x{{/if}}`), [
  { kind: "choice", question: "weather", options: ["rain", "snow"] },
]);
assert.equal(
  run(`{{#if decision_choice:"weather" == "rain" || "snow"}}WET{{else}}DRY{{/if}}`, {
    choices: new Map([["weather", "snow"]]),
  }),
  "WET",
);

const group = `[\n{{char}}: {{#if decision:"{{char}} was addressed"}}respond{{else}}wait{{/if}}\n]`;
assert.equal(
  run(group, {
    answers: new Map([
      ["Alyssa was addressed", true],
      ["Kaelen was addressed", false],
    ]),
  }),
  "[\nKaelen: wait\n]\n[\nAlyssa: respond\n]",
  "a group block asks once per character",
);
const perResponder = `{{#if decision:"{{char}} is angry"}}{{char}} snaps{{else}}{{char}} is calm{{/if}}`;
const decisions = {
  answers: new Map([
    ["Kaelen is angry", true],
    ["Alyssa is angry", false],
  ]),
};
const deferred = resolveMacros(perResponder, { ...base, decisions } as never, {
  deferCharacterMacros: "all",
  trimResult: false,
});
assert.equal(resolveDeferredCharacterMacros(deferred, profiles[0]!, { ...base, decisions } as never), "Kaelen snaps");
assert.equal(resolveDeferredCharacterMacros(deferred, profiles[1]!, { ...base, decisions } as never), "Alyssa is calm");

assert.equal(containsDecisionStatements({ sections: [{ content: 'a {{#if decision:"x"}}y{{/if}}' }] }), true);
assert.equal(containsDecisionStatements({ description: "a decision: to make" }), false, "prose is not a statement");
assert.equal(containsDecisionStatements({ settings: { activationQuestion: "The scene changes." } }), true);
assert.equal(containsDecisionStatements([{ defaultSettings: { activationQuestion: "The scene changes." } }]), true);
assert.equal(containsDecisionStatements({ settings: { activationQuestion: "  " } }), false);
assert.equal(containsDecisionStatements({ settings: { activationQuestion: false } }), false);
assert.equal(
  containsDecisionStatements({ promptTemplate: '{{#if decision_choice:"Weather" == "rain"}}Wet{{/if}}' }),
  true,
);

// The Game prompt's authored sources, chosen the way generation chooses them.
const { gameGmPromptDecisionTexts } =
  await import("../../packages/server/src/services/generation/game-gm-prompt-runtime.js");
assert.deepEqual(gameGmPromptDecisionTexts({ gameSpecialInstructions: "S", customGmPrompt: "C" }, "PRESET"), [
  "PRESET",
  "S",
  "C",
]);
assert.equal(
  gameGmPromptDecisionTexts({ gameSystemPrompt: "CHAT" }, "PRESET")[0],
  "CHAT",
  "the chat's own GM prompt wins",
);

// ── planning ───────────────────────────────────────────────────────────────────

const plan = planPromptDecisions(
  [
    {
      texts: [
        `{{#if decision_choice:"mood" == "angry"}}a{{/if}}`,
        `{{#if decision_choice:"mood" == "sad"}}b{{/if}}`,
        `{{#if decision:"a fight starts"}}c{{/if}}`,
        `{{#if decision_choice:"no options"}}d{{/if}}`,
      ],
      ctx: base as never,
    },
  ],
  32,
);
assert.deepEqual(
  plan.decisions.map((d) => [d.kind, d.key, d.options]),
  [
    ["choice", "mood", ["angry", "sad"]],
    ["noul", "a fight starts", []],
  ],
  "options merge across places; a Choice with nothing to choose from is not asked",
);
const capped = planPromptDecisions(
  [
    {
      texts: [`{{#if decision:"one"}}{{/if}}{{#if decision:"two"}}{{/if}}{{#if decision:"three"}}{{/if}}`],
      ctx: base as never,
    },
  ],
  2,
);
assert.deepEqual(
  capped.decisions.map((d) => d.key),
  ["one", "two"],
);
assert.deepEqual(capped.dropped, ["three"], "past the limit, the last statements found are dropped");
const agentPlan = planPromptDecisions(
  [{ texts: [`{{#if decision:"{{char}} is here"}}{{/if}}`], ctx: agentShapedDecisionContext(base as never) }],
  32,
);
assert.ok(
  agentPlan.decisions.some((d) => d.key === "Kaelen, Alyssa is here"),
  "an agent template is planned as the agent executor resolves it",
);

// ── Choice on a local chat model: one yes/no per option ─────────────────────────

const { askChoicesAsStatements } = await import("../../packages/server/src/services/decision/decision-default.js");
const scored =
  (scores: Record<string, number>) => async (_state: unknown, qs: Array<{ id: string; instructions: string }>) =>
    new Map(qs.flatMap((q) => (q.instructions in scores ? [[q.id, scores[q.instructions]!] as const] : [])));
const mixed = await askChoicesAsStatements(
  scored({ "a fight starts": 0.8, "mood: angry": 0.3, "mood: sad": 0.9, "weather: rain": 0.2, "weather: snow": 0.1 }),
  {},
  [
    { id: "q", instructions: "a fight starts" },
    { id: "m", instructions: "mood", options: ["angry", "sad"] },
    { id: "w", instructions: "weather", options: ["rain", "snow"] },
    { id: "x", instructions: "unasked", options: ["one"] },
  ],
  0.5,
);
assert.deepEqual([...mixed.answers], [["q", 0.8]], "plain statements pass through; per-option ids do not leak");
assert.equal(mixed.choices.get("m"), "sad", "the most likely option wins");
assert.equal(mixed.choices.get("w"), "none of these", "no option clears the threshold: none of these");
assert.equal(mixed.choices.has("x"), false, "no answer for any option leaves the choice unanswered");

// ── answering: once per turn, with the model's own threshold ────────────────────

let asks = 0;
const fakeBackend = (
  threshold: number,
  reply: (ids: string[]) => { answers: Map<string, number>; choices: Map<string, string> },
) => ({
  maxStateTokens: 3500,
  calibration: { defaultThreshold: threshold, questionShape: "text" as const },
  deferPreGeneration: false,
  ask: async () => null,
  askMixed: async (_state: unknown, questions: Array<{ id: string }>) => {
    asks += 1;
    return reply(questions.map((q) => q.id));
  },
});
const messages = [{ role: "user", name: "Mira", content: "Hello" }];
const answered = await answerPromptDecisions({
  plan,
  backend: fakeBackend(0.1, () => ({ answers: new Map([["d1", 0.2]]), choices: new Map([["d0", "sad"]]) })) as never,
  messages,
  cacheKey: "chat:m1:model",
});
assert.equal(answered.answers!.get("a fight starts"), true, "0.2 clears a 0.1 threshold");
assert.equal(answered.choices!.get("mood"), "sad");
await answerPromptDecisions({
  plan,
  backend: fakeBackend(0.1, () => ({ answers: new Map(), choices: new Map() })) as never,
  messages,
  cacheKey: "chat:m1:model",
});
assert.equal(asks, 1, "the same turn is not asked twice");
const deferring = { ...fakeBackend(0.5, () => ({ answers: new Map(), choices: new Map() })), deferPreGeneration: true };
const deferredAnswers = await answerPromptDecisions({
  plan,
  backend: deferring as never,
  messages,
  cacheKey: "chat:m2:model",
});
assert.equal(asks, 1, "a reasoning model in front of the reply is not asked");
assert.equal(deferredAnswers.answers!.size, 0);
const throwing = {
  ...fakeBackend(0.5, () => {
    throw new Error("down");
  }),
};
const failed = await answerPromptDecisions({ plan, backend: throwing as never, messages, cacheKey: "chat:m3:model" });
assert.equal(failed.answers!.size, 0, "a failing backend leaves statements unanswered, not an error");
assert.ok(new PromptDecisionTurnCache(2), "the cache is constructible with a bound");

// Explicit UI debug mode must expose scores even when the normal log level hides debug.
const { logger } = await import("../../packages/server/src/lib/logger.js");
const originalWarn = logger.warn;
const debugLines: unknown[][] = [];
try {
  logger.warn = (...args: unknown[]) => {
    debugLines.push(args);
  };
  await answerPromptDecisions({
    plan: { decisions: [{ kind: "noul", key: "Debug statement", options: [] }], dropped: [] },
    backend: { ...fakeBackend(0.5, () => ({ answers: new Map([["d0", 0.42]]), choices: new Map() })), debugMode: true },
    messages,
    cacheKey: "debug-output",
    cache: new PromptDecisionTurnCache(),
  });
  const output = debugLines.flat().join(" ");
  assert.match(output, /"probability":0\.42/u);
  assert.match(output, /"threshold":0\.5/u);
  assert.match(output, /"yes":false/u);
} finally {
  logger.warn = originalWarn;
}

// ── the real route ─────────────────────────────────────────────────────────────

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { decisionRoutes } = await import("../../packages/server/src/routes/decision.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { importRoutes } = await import("../../packages/server/src/routes/import.routes.js");
const multipart = requireServer("@fastify/multipart");
const AdmZip = requireServer("adm-zip");

let noul = 0.9;
let choice = "sad";
let decisionFails = false;
const decisionBodies: Array<{
  state?: unknown;
  questions: Record<string, { type: string; instructions?: string; criteria?: Record<string, unknown> }>;
}> = [];
let replyCount = 0;
const prompts: string[] = [];

const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  if (request.url?.endsWith("/systemone")) {
    decisionBodies.push(body);
    if (decisionFails) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end("{}");
      return;
    }
    const out: Record<string, unknown> = {};
    for (const [id, question] of Object.entries(body.questions as Record<string, { type: string }>))
      out[id] = question.type === "choice" ? { type: "choice", choice } : { type: "noul", noul };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ answers: out }));
    return;
  }
  if (body.model === "local-decision-fixture" || body.model === "utility-sidecar") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: "yes" } }] }));
    return;
  }
  prompts.push(JSON.stringify(body.messages ?? []));
  const content = `Reply ${++replyCount}.`;
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
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(decisionRoutes, { prefix: "/api/decision" });
await app.register(multipart);
await app.register(importRoutes, { prefix: "/api/import" });

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

  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Kaelen" }));
  assert(character);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Decision fixture", parameters: { maxTokens: 256, maxContext: 8192 } });
  assert(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "rules",
    name: "Rules",
    content: [
      `{{#if decision:"The latest message moves the scene to a new place"}}SCENE_MOVED{{else}}SCENE_STAYED{{/if}}`,
      `{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}MOOD_ANGRY{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}MOOD_SAD{{else}}MOOD_CALM{{/if}}`,
    ].join("\n"),
  });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const chat = await chats.create({
    name: "Decision proof",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: chatConnection.id,
    promptPresetId: preset.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false, enableMemoryRecall: false });

  const generate = async (payload: Record<string, unknown>) => {
    const before = prompts.length;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, ...payload },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(prompts.length - before, 1, "one provider request per turn");
    const sent = prompts.at(-1)!;
    assert(!sent.includes("\\u001e") && !sent.includes("MARINARA_DEFERRED"), "no private token reaches the provider");
    return sent;
  };

  // 1. The model's answers pick the branches the provider receives.
  let sent = await generate({ userMessage: "Kaelen storms out into the snow." });
  assert.ok(sent.includes("SCENE_MOVED") && !sent.includes("SCENE_STAYED"));
  assert.ok(sent.includes("MOOD_SAD") && !sent.includes("MOOD_ANGRY") && !sent.includes("MOOD_CALM"));
  assert.equal(decisionBodies.length, 1, "every statement in one batched request");
  const questions = Object.values(decisionBodies[0]!.questions);
  const choiceQuestion = questions.find((q) => q.type === "choice")!;
  assert.deepEqual(
    Object.keys(choiceQuestion.criteria ?? {}).sort(),
    ["angry", "none of these", "sad"],
    "a Choice question offers its compared options plus none",
  );

  // 2. A regeneration of the same turn reuses the answers.
  const assistant = (await chats.listMessages(chat.id)).filter((m: { role: string }) => m.role === "assistant").at(-1)!;
  noul = 0.1;
  sent = await generate({ regenerateMessageId: assistant.id });
  assert.equal(decisionBodies.length, 1, "no second decision request for the same turn");
  assert.ok(sent.includes("SCENE_MOVED"), "and the same branch is sent");

  // 3. A new message is a new turn.
  choice = "none of these";
  sent = await generate({ userMessage: "He sits back down." });
  assert.equal(decisionBodies.length, 2);
  assert.ok(sent.includes("SCENE_STAYED") && sent.includes("MOOD_CALM"));

  // 4. A failing Decision model: the else branches, and the turn still completes.
  decisionFails = true;
  noul = 0.9;
  sent = await generate({ userMessage: "Anything?" });
  assert.ok(sent.includes("SCENE_STAYED") && sent.includes("MOOD_CALM"));
  decisionFails = false;

  // 5. The per-turn limit, set where the user sets it: only the first statement is asked.
  const limitUrl = "/api/decision/prompt-question-limit";
  assert.deepEqual((await app.inject({ method: "GET", url: limitUrl })).json(), {
    limit: 32,
    defaultLimit: 32,
    maxLimit: 255,
  });
  for (const limit of [0, 256, 1.5])
    assert.notEqual(
      (await app.inject({ method: "POST", url: limitUrl, payload: { limit } })).statusCode,
      200,
      `a limit of ${limit} is refused`,
    );
  assert.equal((await app.inject({ method: "POST", url: limitUrl, payload: { limit: 1 } })).statusCode, 200);
  assert.equal((await app.inject({ method: "GET", url: limitUrl })).json().limit, 1);
  sent = await generate({ userMessage: "Limit check." });
  assert.equal(Object.keys(decisionBodies.at(-1)!.questions).length, 1, "past the limit, not asked");
  assert.ok(sent.includes("SCENE_MOVED") && sent.includes("MOOD_CALM"), "and the dropped one reads as no");
  await createAppSettingsStorage(db).remove(DECISION_PROMPT_QUESTION_LIMIT_SETTINGS_KEY);

  // 6. Previews never ask. Peek Prompt before any generation and a dry run of the next
  // turn both read the cache only and say which statements have no answer yet.
  const preview = await chats.create({
    name: "Decision preview",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: chatConnection.id,
    promptPresetId: preset.id,
  });
  assert(preview);
  const beforePreview = decisionBodies.length;
  const peek = await app.inject({ method: "POST", url: `/api/chats/${preview.id}/peek-prompt`, payload: {} });
  assert.equal(peek.statusCode, 200, peek.body);
  assert.equal(peek.json().source, "live_preview");
  assert.deepEqual(peek.json().decisions, {
    unanswered: ["The latest message moves the scene to a new place", "Kaelen's mood in the latest message"],
    decisionModelSet: true,
  });
  assert.ok(JSON.stringify(peek.json().messages).includes("SCENE_STAYED"), "the preview shows the else branch");
  const dry = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    payload: { chatId: chat.id, returnPrompt: true },
  });
  assert.equal(dry.statusCode, 200, dry.body);
  assert.match(dry.body, /"unanswered":\[/u, "the dry run of the next turn reports unanswered statements");
  assert.equal(decisionBodies.length, beforePreview, "neither preview asked the Decision model");

  // #6650: inspecting inputs is passive; explicit tests ask real questions and assemble
  // with fresh answers, but preserve the live cache, messages, metadata and chat model.
  const debugPayload = { chatId: preview.id, returnPrompt: true, injectLorebook: true, wrapLastMessage: true };
  const inspect = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    payload: { ...debugPayload, decisionDebug: "inspect" },
  });
  assert.equal(inspect.statusCode, 200, inspect.body);
  const prepared = inspect.json().prompt.decisionDebug;
  assert.equal(prepared.mode, "inspect");
  assert.equal(prepared.requests.length, 1);
  assert.equal(prepared.results.length, 2);
  assert(prepared.results.every((row: any) => row.status === "ready" && row.probability === undefined));
  assert.equal(decisionBodies.length, beforePreview, "input inspection sends no request");
  const liveKey = promptDecisionCacheKey(preview.id, null, decision.id);
  const liveTurn = promptDecisionTurnCache.get(liveKey);
  const statement = "The latest message moves the scene to a new place";
  liveTurn.noul.set(statement, { p: 0.11, yes: false });
  const priorMessages = await chats.listMessages(preview.id);
  const priorChat = await chats.getById(preview.id);
  const priorReplies = prompts.length;
  const testDecisions = async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/dryRun",
      payload: { ...debugPayload, decisionDebug: "run" },
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };
  const positive = await testDecisions();
  assert.deepEqual(
    positive.prompt.decisionDebug.requests[0].body,
    prepared.requests[0].body,
    "preview uses the actual request builder",
  );
  assert.deepEqual(
    positive.prompt.decisionDebug.requests[0].body,
    decisionBodies.at(-1),
    "trace is exactly the sent request body",
  );
  const positiveRow = positive.prompt.decisionDebug.results.find((row: any) => row.statement === statement);
  assert.equal(positiveRow.probability, 0.9);
  assert.equal(positiveRow.threshold, 0.5);
  assert.equal(positiveRow.yes, true);
  assert.equal(positiveRow.status, "evaluated");
  assert.equal(positive.prompt.decisionDebug.results.find((row: any) => row.kind === "choice").probability, undefined);
  assert(JSON.stringify(positive.prompt.messages).includes("SCENE_MOVED"));
  noul = 0.2;
  const negative = await testDecisions();
  assert(JSON.stringify(negative.prompt.messages).includes("SCENE_STAYED"), "a rerun gets a fresh low score");
  assert.equal(negative.prompt.decisionDebug.results.find((row: any) => row.statement === statement).probability, 0.2);
  assert.deepEqual(liveTurn.noul.get(statement), { p: 0.11, yes: false }, "test never changes the live answer");
  assert.deepEqual(await chats.listMessages(preview.id), priorMessages);
  assert.deepEqual(await chats.getById(preview.id), priorChat, "test never saves timers or other metadata");
  assert.equal(prompts.length, priorReplies, "the chat model is never called");
  decisionFails = true;
  const errorTest = await testDecisions();
  assert(
    errorTest.prompt.decisionDebug.results.every(
      (row: any) => row.status === "unanswered" && row.probability === undefined && row.error === "http_500",
    ),
  );
  decisionFails = false;
  noul = 0.9;
  const beforeInvalid = decisionBodies.length;
  for (const bad of [
    { returnPrompt: false, decisionDebug: "run" },
    { returnPrompt: true, decisionDebug: "typo" },
    { returnPrompt: true, decisionDebug: "run", streaming: true },
  ]) {
    const rejected = await app.inject({
      method: "POST",
      url: "/api/generate/dryRun",
      payload: { chatId: preview.id, ...bad },
    });
    assert.equal(rejected.statusCode, 400);
  }
  assert.equal(decisionBodies.length, beforeInvalid);

  const diagnostic = () => ({
    mode: "run" as const,
    createdAt: "fixture",
    turnId: null,
    model: "fixture",
    results: [],
    requests: [],
  });
  const heldReport = diagnostic();
  await answerPromptDecisions({
    plan: {
      decisions: [{ kind: "noul", key: "Held statement", options: [], held: { yes: true } }],
      dropped: ["Too many statements"],
    },
    backend: null,
    messages: [],
    cacheKey: "held-test",
    cache: new PromptDecisionTurnCache(),
    inspection: heldReport,
  });
  assert.equal((heldReport.results[0] as any).status, "held");
  assert.equal((heldReport.results[0] as any).yes, true);
  assert.equal((heldReport.results[0] as any).probability, undefined, "a timer is never presented as 100% confidence");
  assert.equal((heldReport.results[1] as any).status, "dropped");

  const { askSidecarNoulQuestions } =
    await import("../../packages/server/src/services/decision/sidecar-decision.backend.js");
  const { getAnswerStyle } = await import("../../packages/server/src/services/decision/decision-thinking-cache.js");
  const localReport = diagnostic();
  const localAnswers = await askSidecarNoulQuestions({
    slot: {
      slot: "primary",
      baseUrl: baseUrl.slice(0, -3),
      model: "local-decision-fixture",
      modelIdentity: "debug-isolation-fixture",
      label: "Fixture",
      thinking: "auto",
      protocol: "chat_logprobs",
    },
    state: { recent_messages: [{ role: "user", content: "The door is open." }] },
    questions: [{ id: "door", instructions: "The door is open." }],
    inspection: localReport,
  });
  assert.equal(localAnswers.get("door"), 1);
  assert.deepEqual((localReport.requests[0] as any).results, [{ id: "door", yes: true, binary: true }]);
  assert.equal(getAnswerStyle("debug-isolation-fixture"), "unknown", "tests never teach the live Auto thinking cache");

  const previewSettings = createAppSettingsStorage(db);
  // A deliberate test can wait for reasoning even when live pre-reply decisions
  // are deferred. Inspecting stays passive and never changes that preference.
  const { utilitySidecarService } =
    await import("../../packages/server/src/services/utility-sidecar/utility-sidecar.service.js");
  const originalUtilityStatus = utilitySidecarService.getStatus;
  const originalUtilityConfig = utilitySidecarService.getConfig;
  const utilityStatus = utilitySidecarService.getStatus();
  const utilityConfig = utilitySidecarService.getConfig();
  const priorLocalDefault = await previewSettings.get(DECISION_SETTINGS_KEYS.localDefault);
  const priorThinking = await previewSettings.get(DECISION_SETTINGS_KEYS.thinkingPreGeneration);
  try {
    utilitySidecarService.getStatus = () => ({
      ...utilityStatus,
      configured: true,
      ready: true,
      activeModelId: "reasoning-fixture",
      baseUrl: baseUrl.slice(0, -3),
    });
    utilitySidecarService.getConfig = () => ({ ...utilityConfig, decisionThinking: "allowed" });
    await previewSettings.set(DECISION_SETTINGS_KEYS.localDefault, DECISION_LOCAL_SLOT_IDS.utility);
    await previewSettings.set(DECISION_SETTINGS_KEYS.thinkingPreGeneration, "false");
    const deferredPeek = await app.inject({
      method: "POST",
      url: "/api/generate/dryRun",
      payload: { ...debugPayload, decisionDebug: "inspect" },
    });
    assert.equal(deferredPeek.statusCode, 200, deferredPeek.body);
    assert(deferredPeek.json().prompt.decisionDebug.results.every((row: any) => row.status === "deferred"));
    assert.equal(
      deferredPeek.json().prompt.decisionDebug.requests.length,
      0,
      "inspection does not ask a deferred model",
    );
    const reasoningTest = await testDecisions();
    const reasoningRow = reasoningTest.prompt.decisionDebug.results.find((row: any) => row.statement === statement);
    assert.equal(reasoningRow.status, "evaluated", "explicit tests can wait for normally deferred reasoning");
    assert.equal(reasoningRow.yes, true);
    assert.equal(reasoningRow.binary, true);
    assert.equal(reasoningRow.probability, undefined);
    assert(reasoningTest.prompt.decisionDebug.requests.every((request: any) => request.body.max_tokens > 1));
    assert(JSON.stringify(reasoningTest.prompt.messages).includes("SCENE_MOVED"));
    assert.equal(await previewSettings.get(DECISION_SETTINGS_KEYS.thinkingPreGeneration), "false");
    assert.equal(
      promptDecisionTurnCache.peek(promptDecisionCacheKey(preview.id, null, DECISION_LOCAL_SLOT_IDS.utility)),
      undefined,
    );
    assert.deepEqual(await chats.listMessages(preview.id), priorMessages);
    assert.deepEqual(await chats.getById(preview.id), priorChat);
    assert.equal(prompts.length, priorReplies);
  } finally {
    utilitySidecarService.getStatus = originalUtilityStatus;
    utilitySidecarService.getConfig = originalUtilityConfig;
    if (priorLocalDefault === null) await previewSettings.remove(DECISION_SETTINGS_KEYS.localDefault);
    else await previewSettings.set(DECISION_SETTINGS_KEYS.localDefault, priorLocalDefault);
    if (priorThinking === null) await previewSettings.remove(DECISION_SETTINGS_KEYS.thinkingPreGeneration);
    else await previewSettings.set(DECISION_SETTINGS_KEYS.thinkingPreGeneration, priorThinking);
  }
  // A local model that cannot serve is no Decision model, as generation treats it.
  await previewSettings.set(DECISION_SETTINGS_KEYS.localDefault, DECISION_LOCAL_SLOT_IDS.primary);
  const peekUnusable = await app.inject({ method: "POST", url: `/api/chats/${preview.id}/peek-prompt`, payload: {} });
  assert.equal(peekUnusable.json().decisions?.decisionModelSet, false, "an unusable local model reads as none");
  await previewSettings.remove(DECISION_SETTINGS_KEYS.localDefault);

  // 7. Agent prompt templates. A pre-reply agent reads the same answers as the prompt;
  // a post-processing agent is asked with the finished reply, and asked again when a
  // regenerated swipe changes that reply.
  const agents = createAgentsStorage(db);
  for (const [type, phase, template] of [
    [
      "custom-decision-pre",
      "pre_generation",
      `{{#if decision:"{{char}} is in the scene"}}PRE_AGENT_YES{{else}}PRE_AGENT_NO{{/if}}`,
    ],
    [
      "custom-decision-post",
      "post_processing",
      `{{#if decision:"The latest reply ends the scene"}}POST_AGENT_YES{{else}}POST_AGENT_NO{{/if}}`,
    ],
    // Configured but not active in this chat: never asked.
    ["custom-decision-idle", "pre_generation", `{{#if decision:"The idle pre agent applies"}}x{{/if}}`],
    ["custom-decision-idle-post", "post_processing", `{{#if decision:"The idle post agent applies"}}x{{/if}}`],
  ] as const)
    assert(
      await agents.create({
        type,
        name: type,
        phase,
        connectionId: chatConnection.id,
        promptTemplate: template,
        settings: { resultType: "context_injection" },
      }),
    );
  const agentChat = await chats.create({
    name: "Decision agents",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: chatConnection.id,
    promptPresetId: preset.id,
  });
  assert(agentChat);
  await chats.patchMetadata(agentChat.id, {
    enableAgents: true,
    enableMemoryRecall: false,
    activeAgentIds: ["custom-decision-pre", "custom-decision-post"],
  });
  const asked = (from: number, statement: string) =>
    decisionBodies
      .slice(from)
      .filter((body) => Object.values(body.questions).some((q) => q.instructions === statement));
  const agentTurn = async (payload: Record<string, unknown>) => {
    const from = { prompts: prompts.length, decisions: decisionBodies.length };
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: agentChat.id, ...payload },
    });
    assert.equal(response.statusCode, 200, response.body);
    return from;
  };
  let from = await agentTurn({ userMessage: "Kaelen waves goodbye." });
  const agentPrompts = prompts.slice(from.prompts).join("\n");
  assert.ok(agentPrompts.includes("PRE_AGENT_YES"), "the pre-reply agent template took the yes branch");
  assert.ok(agentPrompts.includes("POST_AGENT_YES"), "the post-processing agent template took the yes branch");
  assert.equal(asked(from.decisions, "Kaelen is in the scene").length, 1);
  assert.equal(asked(from.decisions, "The idle pre agent applies").length, 0, "an agent this chat does not run");
  assert.equal(asked(from.decisions, "The idle post agent applies").length, 0, "nor one that runs after the reply");
  const post = asked(from.decisions, "The latest reply ends the scene");
  assert.equal(post.length, 1, "the post-processing statement is asked once, after the reply");
  const reply = (await chats.listMessages(agentChat.id))
    .filter((m: { role: string }) => m.role === "assistant")
    .at(-1)!;
  assert.ok(JSON.stringify(post[0]!.state).includes(reply.content as string), "and it reads the finished reply");
  from = await agentTurn({ regenerateMessageId: reply.id });
  assert.equal(
    asked(from.decisions, "Kaelen is in the scene").length,
    0,
    "the pre-reply answers are kept for the turn",
  );
  assert.equal(
    asked(from.decisions, "The latest reply ends the scene").length,
    1,
    "a regenerated swipe is a new reply, so the post-processing statement is asked again",
  );

  // Retry agents reads the answers its turn already has: the pre-generation agent the
  // pre-reply ones, the post-processing agent the ones taken with this swipe's reply.
  // The model now answers "no", so a yes in the retried prompts can only be cached.
  noul = 0.1;
  const swipe = (await chats.listMessages(agentChat.id))
    .filter((m: { role: string }) => m.role === "assistant")
    .at(-1)!;
  const beforeRetry = { prompts: prompts.length, decisions: decisionBodies.length };
  const retry = await app.inject({
    method: "POST",
    url: "/api/generate/retry-agents",
    payload: {
      chatId: agentChat.id,
      agentTypes: ["custom-decision-pre", "custom-decision-post"],
      forMessageId: swipe.id,
    },
  });
  assert.equal(retry.statusCode, 200, retry.body);
  const retriedPrompts = prompts.slice(beforeRetry.prompts).join("\n");
  assert.ok(retriedPrompts.includes("PRE_AGENT_YES"), "the retried pre-generation agent keeps its turn's answer");
  assert.ok(retriedPrompts.includes("POST_AGENT_YES"), "the retried post-processing agent keeps its reply's answer");
  assert.equal(decisionBodies.length, beforeRetry.decisions, "a retry of an answered turn asks nothing");
  noul = 0.9;

  // Conversation mode: the chat's system prompt replaces the preset sections, so its
  // statements are asked and the preset's are not.
  const convo = await chats.create({
    name: "Decision conversation",
    mode: "conversation",
    characterIds: [character.id],
    connectionId: chatConnection.id,
    promptPresetId: preset.id,
  });
  assert(convo);
  await chats.patchMetadata(convo.id, {
    enableAgents: false,
    enableMemoryRecall: false,
    customSystemPrompt: `You are {{char}}. {{#if decision:"The conversation turns to food"}}CONVO_YES{{else}}CONVO_NO{{/if}}`,
  });
  // The chat's own prompt replaces the preset's conversation prompt, so the preset's
  // statement is never asked.
  await presets.update(preset.id, {
    conversationPrompt: `{{#if decision:"The preset conversation prompt applies"}}x{{/if}}`,
  });
  const beforeConvo = { prompts: prompts.length, decisions: decisionBodies.length };
  const convoTurn = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: convo.id, userMessage: "What should we cook tonight?" },
  });
  assert.equal(convoTurn.statusCode, 200, convoTurn.body);
  assert.equal(asked(beforeConvo.decisions, "The conversation turns to food").length, 1);
  assert.equal(
    asked(beforeConvo.decisions, "The latest message moves the scene to a new place").length,
    0,
    "preset sections are not used in Conversation, so their statements are not asked",
  );
  assert.equal(asked(beforeConvo.decisions, "The preset conversation prompt applies").length, 0);
  assert.ok(prompts.slice(beforeConvo.prompts).join("\n").includes("CONVO_YES"));
  // Peek Prompt plans from the same sources: the conversation prompt, not the preset.
  const convoPreview = await chats.create({
    name: "Decision conversation preview",
    mode: "conversation",
    characterIds: [character.id],
    connectionId: chatConnection.id,
    promptPresetId: preset.id,
  });
  assert(convoPreview);
  await chats.patchMetadata(convoPreview.id, {
    customSystemPrompt: `{{#if decision:"The conversation turns to food"}}CONVO_YES{{/if}}`,
  });
  const convoPeek = await app.inject({ method: "POST", url: `/api/chats/${convoPreview.id}/peek-prompt`, payload: {} });
  assert.equal(convoPeek.statusCode, 200, convoPeek.body);
  assert.deepEqual(convoPeek.json().decisions?.unanswered, ["The conversation turns to food"]);

  // The author's note is resolved in the prompt's macro pass, so its statements are
  // asked; and editing the newest message then regenerating asks again, because the
  // turn is keyed by that message's text as well as its id.
  const noteChat = await chats.create({
    name: "Decision author's note",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: chatConnection.id,
    promptPresetId: preset.id,
  });
  assert(noteChat);
  await chats.patchMetadata(noteChat.id, {
    enableAgents: false,
    enableMemoryRecall: false,
    authorNotes: `{{#if decision:"The author's note statement applies"}}NOTE_YES{{/if}}`,
  });
  const noteTurn = async (payload: Record<string, unknown>) => {
    const from = { prompts: prompts.length, decisions: decisionBodies.length };
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: noteChat.id, ...payload },
    });
    assert.equal(response.statusCode, 200, response.body);
    return from;
  };
  let noteFrom = await noteTurn({ userMessage: "First message." });
  assert.equal(asked(noteFrom.decisions, "The author's note statement applies").length, 1);
  assert.ok(prompts.slice(noteFrom.prompts).join("\n").includes("NOTE_YES"));
  const noteMessages = await chats.listMessages(noteChat.id);
  const noteUser = noteMessages.filter((m: { role: string }) => m.role === "user").at(-1)!;
  const noteReply = noteMessages.filter((m: { role: string }) => m.role === "assistant").at(-1)!;
  noteFrom = await noteTurn({ regenerateMessageId: noteReply.id });
  assert.equal(asked(noteFrom.decisions, "The author's note statement applies").length, 0, "same text: cached");
  await chats.updateMessageContent(noteUser.id, "First message, edited.");
  noteFrom = await noteTurn({ regenerateMessageId: noteReply.id });
  assert.equal(
    asked(noteFrom.decisions, "The author's note statement applies").length,
    1,
    "an edited message is asked again",
  );

  // Text-rewrite agents run after the other agents, outside the pipeline, and read
  // the same answers taken with the finished reply.
  assert(
    await agents.create({
      type: "custom-decision-rewrite",
      name: "custom-decision-rewrite",
      phase: "post_processing",
      connectionId: chatConnection.id,
      promptTemplate: `{{#if decision:"The latest reply needs a rewrite"}}REWRITE_YES{{else}}REWRITE_NO{{/if}}`,
      settings: { resultType: "text_rewrite" },
    }),
  );
  const rewriteChat = await chats.create({
    name: "Decision rewrite",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: chatConnection.id,
    promptPresetId: preset.id,
  });
  assert(rewriteChat);
  await chats.patchMetadata(rewriteChat.id, {
    enableAgents: true,
    enableMemoryRecall: false,
    activeAgentIds: ["custom-decision-rewrite"],
  });
  const beforeRewrite = { prompts: prompts.length, decisions: decisionBodies.length };
  const rewriteTurn = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: rewriteChat.id, userMessage: "Tell me the whole story." },
  });
  assert.equal(rewriteTurn.statusCode, 200, rewriteTurn.body);
  assert.equal(asked(beforeRewrite.decisions, "The latest reply needs a rewrite").length, 1);
  assert.ok(prompts.slice(beforeRewrite.prompts).join("\n").includes("REWRITE_YES"), "the rewrite agent read yes");

  // Imports the browser cannot read (card files, .marinara archives) report their
  // decision statements from the server, so the importer can say so.
  const upload = (parts: Array<{ field: string; name: string; bytes: Buffer }>) => {
    const boundary = `decision-${Date.now().toString(36)}`;
    return {
      payload: Buffer.concat([
        ...parts.flatMap((part) => [
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${part.field}"; filename="${part.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
          ),
          part.bytes,
          Buffer.from("\r\n"),
        ]),
        Buffer.from(`--${boundary}--\r\n`),
      ]),
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    };
  };
  const card = (name: string, description: string) =>
    Buffer.from(JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", data: { name, description } }));
  const batch = await app.inject({
    method: "POST",
    url: "/api/import/st-character/batch",
    ...upload([
      { field: "files", name: "decides.json", bytes: card("Decides", `{{#if decision:"x"}}y{{/if}}`) },
      { field: "files", name: "plain.json", bytes: card("Plain", "A plain card.") },
    ]),
  });
  assert.equal(batch.statusCode, 200, batch.body);
  const byName = new Map(
    (batch.json().results as Array<{ filename: string; success: boolean; usesDecisions?: boolean }>).map((r) => [
      r.filename,
      r,
    ]),
  );
  assert.equal(byName.get("decides.json")?.success, true, batch.body);
  assert.equal(byName.get("decides.json")?.usesDecisions, true, "a card with a statement is flagged");
  assert.equal(byName.get("plain.json")?.usesDecisions, undefined, "a plain card is not");
  const zip = new AdmZip();
  zip.addFile(
    "data.json",
    Buffer.from(
      JSON.stringify({
        type: "marinara_persona",
        version: 1,
        data: { name: "Deciding persona", description: `{{#if decision_choice:"mood" == "calm"}}z{{/if}}` },
      }),
    ),
  );
  const pkg = await app.inject({
    method: "POST",
    url: "/api/import/marinara-package",
    ...upload([{ field: "file", name: "persona.marinara", bytes: zip.toBuffer() }]),
  });
  assert.equal(pkg.statusCode, 200, pkg.body);
  assert.equal(pkg.json().usesDecisions, true, "a .marinara archive with a statement is flagged");

  // 8. No Decision model: nothing is asked and the else branches are sent.
  await connections.update(decision.id, { defaultForAgents: false });
  const beforeNone = decisionBodies.length;
  sent = await generate({ userMessage: "No model now." });
  assert.equal(decisionBodies.length, beforeNone, "no decision request without a Decision model");
  assert.ok(sent.includes("SCENE_STAYED") && sent.includes("MOOD_CALM"));
  const peekNoModel = await app.inject({ method: "POST", url: `/api/chats/${preview.id}/peek-prompt`, payload: {} });
  assert.equal(peekNoModel.json().decisions.decisionModelSet, false, "Peek Prompt says no Decision model is set");

  console.log("decision-conditionals regression passed");
} finally {
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
