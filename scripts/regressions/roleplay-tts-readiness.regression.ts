import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GenerationRunner } from "../../packages/server/src/routes/generate.routes.js";

// #8026: speech may prepare its own speaker/emotion analysis as soon as the main reply is durable.
// Unrelated agent activation, parallel work and post-processing must not hold its ready event.
const directory = mkdtempSync(join(tmpdir(), "marinara-tts-readiness-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createGenerationEventSink } = await import("../../packages/server/src/routes/generate/sse.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}
const bounded = async (promise: Promise<unknown>) => {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(new Error("Fixture did not reach its provider gate")), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(deadline);
  }
};
type Gate = ReturnType<typeof deferred> & { entered: ReturnType<typeof deferred> };
const gate = (): Gate => ({ ...deferred(), entered: deferred() });
let held: { kind: "decision" | "post" | "rewrite" | "main"; gate: Gate } | undefined;
let failing: "post" | "rewrite" | "main" | undefined;
let simulateBackpressure = false;
const originalText = 'Dottore turns toward Mari. "The experiment is ready."';
const rewrittenText = 'Dottore smiles at Mari. "Our experiment is ready."';
const mainPrompts: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  const prompt = JSON.stringify(body.messages ?? []);
  const kind = request.url?.endsWith("/systemone")
    ? "decision"
    : prompt.includes("TTS_REWRITE_FIXTURE")
      ? "rewrite"
      : prompt.includes("TTS_POST_FIXTURE")
        ? "post"
        : "main";
  if (kind === "main") mainPrompts.push(prompt);
  if (held?.kind === kind) {
    held.gate.entered.resolve();
    await held.gate.promise;
  }
  if (failing === kind) {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "Fixture provider failure" } }));
    return;
  }
  if (kind === "decision") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        answers: Object.fromEntries(Object.keys(body.questions).map((id) => [id, { type: "noul", noul: 1 }])),
      }),
    );
    return;
  }
  const content =
    kind === "rewrite"
      ? JSON.stringify({ editNeeded: true, editedText: rewrittenText, changes: [{ description: "Polished." }] })
      : kind === "post"
        ? "A note for later."
        : originalText;
  response.writeHead(200, { "content-type": body.stream ? "text/event-stream" : "application/json" });
  response.end(
    body.stream
      ? `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n` +
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`
      : JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
  );
});
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
const activeGenerations = new Map<string, { abortController: AbortController }>();
app.decorate("activeGenerations", activeGenerations);
let runner!: GenerationRunner;
await app.register(generateRoutes, { prefix: "/api/generate", onRunnerReady: (ready) => (runner = ready) });
await app.ready();
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connections = createConnectionsStorage(db);
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const connection = await connections.create({
    name: "Speech timing fixture",
    provider: "custom",
    baseUrl,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 8192,
    maxTokensOverride: 512,
  });
  assert(connection);
  await connections.create({
    name: "Activation fixture",
    provider: "decision",
    decisionSource: "custom",
    baseUrl,
    model: "jev-latest",
    maxStateTokens: 3500,
    defaultForAgents: true,
  });
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Dottore" }));
  assert(character);
  const agents = createAgentsStorage(db);
  const post = await agents.create({
    type: "custom-tts-post",
    name: "Post-processing fixture",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "TTS_POST_FIXTURE Note what happened.",
    settings: { resultType: "context_injection", activationQuestion: "Did the reply happen?" },
  });
  const rewrite = await agents.create({
    type: "custom-tts-rewrite",
    name: "Rewrite fixture",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "TTS_REWRITE_FIXTURE Polish the response.",
    settings: { resultType: "text_rewrite", capabilities: { edit_messages: true } },
  });
  const parallel = await agents.create({
    type: "custom-tts-parallel",
    name: "Parallel fixture",
    phase: "parallel",
    connectionId: connection.id,
    promptTemplate: "TTS_POST_FIXTURE Note what happened.",
    settings: { resultType: "context_injection" },
  });
  assert(post && rewrite && parallel);
  const run = async (
    types: string[],
    check: (context: {
      chatId: string;
      events: Array<Record<string, unknown>>;
      done: Promise<unknown>;
      speechReady: Promise<void>;
    }) => Promise<void>,
    options: { promptPresetId?: string; macroVariables?: Record<string, string> } = {},
  ) => {
    const chat = await chats.create({
      name: "Speech timing",
      mode: "roleplay",
      characterIds: [character.id],
      connectionId: connection.id,
      promptPresetId: options.promptPresetId,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: true,
      activeAgentIds: types,
      enableMemoryRecall: false,
      ...(options.macroVariables ? { macroVariables: options.macroVariables } : {}),
    });
    const events: Array<Record<string, unknown>> = [];
    const speechReady = deferred();
    const sink = createGenerationEventSink({
      onEvent: (event) => {
        events.push(event);
        if (event.type === "assistant_message_ready") speechReady.resolve();
      },
      onFinish: () => {},
    });
    const emit = sink.emit;
    sink.emit = (event) => {
      const sent = emit(event);
      return simulateBackpressure && event.type === "assistant_message_ready" ? false : sent;
    };
    const done = runner({ chatId: chat.id, userMessage: "Please continue.", streaming: true }, sink);
    try {
      await check({ chatId: chat.id, events, done, speechReady: speechReady.promise });
    } finally {
      held?.gate.resolve();
      await done;
      held = undefined;
      failing = undefined;
      simulateBackpressure = false;
    }
    return events;
  };
  const ready = (events: Array<Record<string, unknown>>) =>
    events.filter((event) => event.type === "assistant_message_ready");

  // A deferred activation request is a real model call before any non-rewriting post agent starts.
  held = { kind: "decision", gate: gate() };
  let events = await run([post.type], async ({ chatId, events }) => {
    await bounded(held!.gate.entered.promise);
    assert.equal(ready(events).length, 1, "speech must start before unrelated agent activation finishes");
    assert.equal(activeGenerations.has(chatId), false, "the unlocked composer must match server readiness");
  });
  assert.equal(ready(events).length, 1, "finishing the remaining agents must not replay speech");

  // Releasing the composer also lets the next turn read this turn's {{setvar}}/counter effects.
  const prompts = createPromptsStorage(db);
  const preset = await prompts.create({ name: "Readiness variables", parameters: { maxTokens: 512 } });
  assert(preset);
  await prompts.createSection({
    presetId: preset.id,
    identifier: "readiness-variables",
    name: "Readiness variables",
    content: "READINESS_BEFORE={{getvar::tts_turns}}; {{incvar::tts_turns}}",
  });
  held = { kind: "decision", gate: gate() };
  let variableChatId = "";
  await run(
    [post.type],
    async ({ chatId, events }) => {
      variableChatId = chatId;
      await bounded(held!.gate.entered.promise);
      assert.equal(ready(events).length, 1);
      const metadata = JSON.parse((await chats.getById(chatId))!.metadata);
      assert.equal(metadata.macroVariables.tts_turns, "1", "ready speech must not expose uncommitted prompt variables");
      const blockedActivation = held!;
      held = undefined; // Only the first turn's activation is held; the next turn may finish normally.
      try {
        await runner(
          { chatId, userMessage: "Continue again.", streaming: true },
          createGenerationEventSink({ onEvent: () => {}, onFinish: () => {} }),
        );
        assert.ok(mainPrompts.at(-1)!.includes("READINESS_BEFORE=1"), "the next prompt sees committed variables");
      } finally {
        blockedActivation.gate.resolve();
      }
    },
    { promptPresetId: preset.id, macroVariables: { tts_turns: "0" } },
  );
  assert.equal(
    JSON.parse((await chats.getById(variableChatId))!.metadata).macroVariables.tts_turns,
    "2",
    "the first turn's later idempotent persistence must preserve the completed second turn",
  );

  simulateBackpressure = true;
  events = await run([], async ({ done }) => {
    await done;
  });
  assert.equal(ready(events).length, 1, "a queued socket event must not be sent again as though it failed");

  held = { kind: "post", gate: gate() };
  events = await run([post.type], async ({ events }) => {
    await bounded(held!.gate.entered.promise);
    assert.equal(ready(events).length, 1, "non-rewriting work cannot delay speech");
  });
  assert.equal(ready(events).length, 1);

  held = { kind: "post", gate: gate() };
  events = await run([parallel.type], async ({ events, speechReady }) => {
    await bounded(held!.gate.entered.promise);
    await bounded(speechReady);
    assert.equal(ready(events).length, 1, "parallel work must not hold the finalized main reply");
    assert.equal(
      events.some((event) => event.type === "done"),
      false,
      "speech starts while parallel work remains",
    );
  });
  assert.equal(ready(events).length, 1);

  held = { kind: "decision", gate: gate() };
  events = await run([post.type, rewrite.type], async ({ events }) => {
    await bounded(held!.gate.entered.promise);
    assert.equal(ready(events).length, 0, "enabled rewriting agents must still hold speech during activation");
  });
  assert.equal(ready(events).length, 1);
  assert.equal((ready(events)[0]!.data as { content: string }).content, rewrittenText);

  held = { kind: "rewrite", gate: gate() };
  events = await run([post.type, rewrite.type], async ({ chatId, events }) => {
    await bounded(held!.gate.entered.promise);
    assert.equal(ready(events).length, 0, "speech must wait for the rewriting agent");
    assert.equal(activeGenerations.has(chatId), true, "a rewrite still owns the main generation slot");
  });
  assert.equal(ready(events).length, 1);
  assert.equal((ready(events)[0]!.data as { content: string }).content, rewrittenText, "speak the persisted rewrite");

  held = { kind: "rewrite", gate: gate() };
  events = await run([rewrite.type], async ({ chatId, events }) => {
    await bounded(held!.gate.entered.promise);
    assert.equal(ready(events).length, 0);
    activeGenerations.get(chatId)!.abortController.abort();
  });
  assert.equal(ready(events).length, 0, "an aborted pending rewrite must not release speech");

  failing = "rewrite";
  events = await run([rewrite.type], async ({ done }) => {
    await done;
  });
  assert.equal(ready(events).length, 1, "a failed rewrite releases the original reply once");
  assert.equal((ready(events)[0]!.data as { content: string }).content, originalText);

  failing = "post";
  events = await run([post.type], async ({ done }) => {
    await done;
  });
  assert.equal(ready(events).length, 1, "a later agent failure must not replay or suppress finalized speech");

  failing = "main";
  events = await run([], async ({ done }) => {
    await done;
  });
  assert.equal(ready(events).length, 0, "a failed main response must not become speech");

  held = { kind: "main", gate: gate() };
  events = await run([], async ({ chatId, events }) => {
    await bounded(held!.gate.entered.promise);
    assert.equal(ready(events).length, 0);
    activeGenerations.get(chatId)!.abortController.abort();
  });
  assert.equal(ready(events).length, 0, "aborting before the reply is saved must not release speech");
  console.info("Roleplay TTS readiness regression passed.");
} finally {
  held?.gate.resolve();
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
