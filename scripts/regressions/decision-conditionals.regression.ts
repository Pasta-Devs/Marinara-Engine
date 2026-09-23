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
  characterDataSchema,
} = await import("../../packages/shared/dist/index.js");
const { agentShapedDecisionContext, answerPromptDecisions, planPromptDecisions, PromptDecisionTurnCache } =
  await import("../../packages/server/src/services/decision/prompt-decisions.js");

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
