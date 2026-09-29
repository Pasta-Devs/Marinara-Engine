import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GenerationRunner } from "../../packages/server/src/routes/generate.routes.js";
import {
  createGenerationEventSink,
  endGenerationOutput,
  sendSseEvent,
  setGenerationOutputHeader,
  startSseReply,
} from "../../packages/server/src/routes/generate/sse.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-generation-output-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");

let modelCalls = 0;
const providerPrompts: string[] = [];
let waitForRelease: Promise<void> | undefined;
let enteredModel: (() => void) | undefined;
let releaseModel: (() => void) | undefined;
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  providerPrompts.push(Buffer.concat(chunks).toString());
  modelCalls++;
  enteredModel?.();
  await waitForRelease;
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      choices: [{ index: 0, message: { role: "assistant", content: "The room is quiet." }, finish_reason: "stop" }],
    }),
  );
});
const db = await getDB();
const app = Fastify();
app.decorate("db", db);
let runner: GenerationRunner | undefined;
await app.register(generateRoutes, {
  prefix: "/api/generate",
  onRunnerReady: (ready) => {
    runner = ready;
  },
});
app.get("/output-headers", async (_request, reply) => {
  setGenerationOutputHeader(reply, "x-before", "kept");
  startSseReply(reply);
  setGenerationOutputHeader(reply, "x-late", "ignored");
  sendSseEvent(reply, { type: "headers", before: reply.getHeader("x-before"), late: reply.getHeader("x-late") });
  endGenerationOutput(reply);
});

try {
  await app.ready();
  const headerResponse = await app.inject({ method: "GET", url: "/output-headers" });
  assert.equal(headerResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(headerResponse.payload.slice(6).trim()), { type: "headers", before: "kept" });
  let sinkHeaders: Record<string, string> = {};
  const headerSink = createGenerationEventSink({
    onEvent: () => {},
    onFinish: ({ headers }) => {
      sinkHeaders = headers;
    },
  });
  setGenerationOutputHeader(headerSink, "x-before", "kept");
  startSseReply(headerSink);
  setGenerationOutputHeader(headerSink, "x-late", "ignored");
  endGenerationOutput(headerSink);
  assert.deepEqual(sinkHeaders, { "x-before": "kept" }, "HTTP and internal adapters both ignore late headers");
  assert.ok(runner, "route registration exposes the same trusted runner");
  const run = runner;
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Generation output fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 8192,
    maxTokensOverride: 128,
  });
  const presets = createPromptsStorage(db);
  const preset = await presets.create({ name: "Output fixture", parameters: { maxTokens: 128 }, wrapFormat: "xml" });
  assert.ok(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const chats = createChatsStorage(db);
  const chat = await chats.create({
    name: "Output fixture",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert.ok(chat);
  await chats.patchMetadata(chat.id, { enableAgents: false, automaticSummaryEnabled: false });
  const http = await app.inject({
    method: "POST",
    url: "/api/generate",
    payload: { chatId: chat.id, userMessage: "Look around.", streaming: false },
  });
  assert.equal(http.statusCode, 200);
  assert.equal(http.headers["content-type"], "text/event-stream");
  assert.equal(http.headers["cache-control"], "no-store, no-cache, must-revalidate");
  const httpEvents = http.payload
    .split("\n\n")
    .filter((block) => block.startsWith("data: "))
    .map((block) => JSON.parse(block.slice(6)) as Record<string, unknown>);
  assert.ok(httpEvents.some((event) => event.type === "message_saved"));
  assert.equal(httpEvents.at(-1)?.type, "done");
  assert.ok(!httpEvents.some((event) => event.type === "error"), http.payload);

  const events: Array<Record<string, unknown>> = [];
  const order: string[] = [];
  const output = createGenerationEventSink({
    onEvent: (event) => {
      events.push(event);
      order.push(String(event.type));
    },
    onFinish: (result) => {
      assert.equal(result.statusCode, 200);
      order.push("finished");
    },
  });
  const modelEntered = new Promise<void>((resolve) => {
    enteredModel = resolve;
  });
  waitForRelease = new Promise<void>((resolve) => {
    releaseModel = resolve;
  });
  const pending = run({ chatId: chat.id, userMessage: "Listen.", streaming: false }, output);
  await modelEntered;
  const blocked = await app.inject({ method: "POST", url: "/api/generate", payload: { chatId: chat.id } });
  assert.equal(blocked.statusCode, 409, "HTTP and internal calls share one generation lock");
  let rejectedStatus = 0;
  await run(
    { chatId: chat.id },
    createGenerationEventSink({
      onEvent: () => assert.fail("a rejected generation cannot emit events"),
      onFinish: ({ statusCode }) => {
        rejectedStatus = statusCode;
      },
    }),
  );
  assert.equal(rejectedStatus, 409);
  releaseModel();
  await pending;
  assert.equal(modelCalls, 2, "rejected attempts do not call the model");
  assert.ok(events.some((event) => event.type === "message_saved"));
  assert.ok(!events.some((event) => event.type === "error"), JSON.stringify(events));
  assert.deepEqual(order.slice(-2), ["done", "finished"], "completion follows the ordered event stream");
  assert.equal(output.ended, true);
  assert.equal(sendSseEvent(output, { type: "token", data: "late" }), false);
  endGenerationOutput(output);
  assert.equal(order.filter((type) => type === "finished").length, 1, "completion is emitted only once");
  const saved = await chats.listMessages(chat.id);
  assert.deepEqual(
    saved.map((message) => message.role),
    ["user", "assistant", "user", "assistant"],
  );
  const status = await app.inject(`/api/generate/status/${chat.id}`);
  assert.equal(status.json().active, false, "the internal runner returns after releasing the generation lock");

  const authority = { roomId: "room_12345", epoch: "epoch_12345", operationId: "operation_12345" };
  const room = {
    version: 1,
    role: "host",
    roomId: authority.roomId,
    epoch: authority.epoch,
    generationOperationId: authority.operationId,
    status: "active",
    participants: [
      {
        id: "host_12345",
        displayName: "Mari",
        persona: { name: "Luna", description: "Exact <leaf> & text" },
        isHost: true,
      },
      {
        id: "guest_12345",
        displayName: "Alex",
        persona: { name: "Rowan", description: "A traveller." },
        isHost: false,
      },
    ],
  };
  await chats.patchMetadata(chat.id, { multiplayer: room });
  const bypass = await app.inject({
    method: "POST",
    url: "/api/generate",
    payload: { chatId: chat.id, roomContext: authority, streaming: false },
  });
  assert.equal(bypass.statusCode, 409, "JSON cannot supply trusted room authority");
  let roomStatus = 0;
  const roomErrors: unknown[] = [];
  const roomOutput = () =>
    createGenerationEventSink({
      onEvent: (event) => {
        if (event.type === "error") roomErrors.push(event);
      },
      onFinish: ({ statusCode }) => {
        roomStatus = statusCode;
      },
    });
  await run({ chatId: chat.id, userMessage: "Spoofed identity" }, roomOutput(), authority);
  assert.equal(roomStatus, 400, "the coordinator must save attributed participant input first");
  const guestMessage = await chats.createMessage({
    chatId: chat.id,
    role: "user",
    characterId: null,
    content: "Rowan listens.",
    extra: {
      multiplayerParticipantId: "guest_12345",
      personaSnapshot: { personaId: "guest_12345", name: "Rowan", source: "persona" },
    },
  });
  await run({ chatId: chat.id, streaming: false }, roomOutput(), authority);
  assert.equal(roomStatus, 200);
  assert.equal(modelCalls, 3);
  assert.deepEqual(roomErrors, []);
  assert.ok(providerPrompts.at(-1)?.includes("Alex controls Rowan"));
  assert.ok(providerPrompts.at(-1)?.includes("Exact <leaf> & text"));
  assert.equal(
    (await chats.getById(chat.id))?.personaId,
    null,
    "room generation never replaces the host's chosen identity",
  );
  assert.equal(JSON.parse((await chats.getMessage(guestMessage!.id))!.extra).personaSnapshot.name, "Rowan");
  await chats.patchMetadata(chat.id, { multiplayer: { ...room, status: "ended" } });
  await run({ chatId: chat.id }, roomOutput(), authority);
  assert.equal(roomStatus, 409, "a stopped hosting epoch cannot start late work");
  const ordinary = await app.inject({
    method: "POST",
    url: "/api/generate",
    payload: { chatId: chat.id, streaming: false },
  });
  assert.equal(ordinary.statusCode, 200, "ended rooms remain usable as private chats");
} finally {
  releaseModel?.();
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

process.stdout.write("Generation output regression passed.\n");
