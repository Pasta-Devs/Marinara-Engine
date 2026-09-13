import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const dir = mkdtempSync(join(tmpdir(), "marinara-game-sequential-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { registerSequentialGameTasks, retainSequentialGameTask } =
  await import("../../packages/server/src/services/game/sequential-tasks.js");
const { sidecarRoutes } = await import("../../packages/server/src/routes/sidecar.routes.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
const { createAgentConfigSchema, replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
const delay = () => new Promise<void>((done) => setTimeout(done, 30));
let active = 0;
let peak = 0;
let mediaDone = true;
let releaseMedia = () => {};
await app.register(
  async (scope) => {
    registerSequentialGameTasks(scope, ["/narrate", "/media"]);
    scope.post("/narrate", async () => {
      active++;
      peak = Math.max(peak, active);
      assert.ok(mediaDone, "Narration must wait for background media to finish");
      await delay();
      active--;
      return { ok: true };
    });
    scope.post("/media", async (request) => {
      mediaDone = false;
      retainSequentialGameTask(
        request,
        new Promise<void>((done) => {
          releaseMedia = () => {
            mediaDone = true;
            done();
          };
        }),
      );
      return { queued: true };
    });
    scope.post("/cancel", async () => ({ available: true }));
  },
  { prefix: "/api/game" },
);
await app.register(sidecarRoutes, { prefix: "/api/sidecar" });
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  const chat = await chats.create({ name: "Sequential Game", mode: "game", characterIds: [] });
  assert.ok(chat);
  const post = (path: string) => app.inject({ method: "POST", url: `/api/game/${path}`, payload: { chatId: chat.id } });
  for (const sequential of [false, true]) {
    await chats.patchMetadata(chat.id, () => ({ gameSequentialAgents: sequential }));
    peak = 0;
    const results = await Promise.all([post("narrate"), post("narrate"), post("narrate")]);
    assert.ok(results.every((result) => result.statusCode === 200));
    assert.equal(peak, sequential ? 1 : 3, "Only opted-in Game chats serialize concurrent requests");
  }
  const queued = await post("media");
  assert.equal(queued.json().queued, true, "Initial storyboard reply must not wait for rendering");
  let narrated = false;
  let sidecarFinished = false;
  const sidecar = app
    .inject({
      method: "POST",
      url: "/api/sidecar/analyze-scene",
      payload: {
        chatId: chat.id,
        narration: "A quiet courtyard.",
        context: {
          currentState: "exploration",
          availableBackgrounds: [],
          availableSfx: [],
          activeWidgets: [],
          trackedNpcs: [],
          characterNames: [],
          currentBackground: null,
          currentMusic: null,
          currentWeather: null,
          currentTimeOfDay: null,
        },
      },
    })
    .then((response) => {
      sidecarFinished = true;
      assert.equal(
        response.statusCode,
        503,
        "actual sidecar handler checks availability only after its turn in the queue",
      );
    });
  const narration = post("narrate").then(() => {
    narrated = true;
  });
  await delay();
  assert.equal(narrated, false);
  assert.equal(sidecarFinished, false, "Sidecar Scene Analysis waits for the same chat's background media");
  assert.equal((await post("cancel")).json().available, true, "Cancellation must bypass the model queue");
  releaseMedia();
  await narration;
  await sidecar;
  assert.equal(narrated, true);

  // Exercise the actual pre-generation branches and explicit retry route with
  // local custom agent configs; no package install or model server is needed.
  replaceBuiltInAgentDefinitions([]);
  const connections = createConnectionsStorage(db);
  const agents = createAgentsStorage(db);
  const lorebooks = createLorebooksStorage(db);
  const lorebook = await lorebooks.create({ name: "Sequence lore", description: "Fixture" });
  await lorebooks.createEntry({
    lorebookId: lorebook.id,
    name: "Gate",
    content: "The gate is locked.",
    keys: ["gate"],
  });
  const types = ["sequence-pre", "knowledge-retrieval", "knowledge-router"];
  for (const type of types) {
    const connection = await connections.create({
      name: type,
      provider: "openai",
      model: type,
      apiKey: "synthetic",
      maxContext: 32768,
    });
    await agents.create(
      createAgentConfigSchema.parse({
        type,
        name: type,
        phase: "pre_generation",
        connectionId: connection.id,
        promptTemplate: `Fixture ${type}; return JSON with an injection string.`,
        settings: { resultType: "context_injection", sourceLorebookIds: [lorebook.id] },
      }),
    );
  }
  const narratorConnection = await connections.create({
    name: "Narrator",
    provider: "openai",
    model: "narrator",
    apiKey: "synthetic",
    maxContext: 32768,
  });
  const originalComplete = OpenAIProvider.prototype.chatComplete;
  const originalChat = OpenAIProvider.prototype.chat;
  let models: string[] = [];
  OpenAIProvider.prototype.chatComplete = async (_messages, options) => {
    if (options.model === "narrator") {
      assert.equal(active, 0, "narration waits for pre-generation work");
      return { content: "The gate remains locked.", toolCalls: [], finishReason: "stop" };
    }
    models.push(options.model!);
    active++;
    peak = Math.max(peak, active);
    try {
      await delay();
      return {
        content: options.model === "knowledge-router" ? '{"entryIds":[]}' : '{"injection":"Keep the gate in mind."}',
        toolCalls: [],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        finishReason: "stop",
      };
    } finally {
      active--;
    }
  };
  OpenAIProvider.prototype.chat = async function* () {
    assert.equal(active, 0, "narration waits for pre-generation work");
    yield "The gate remains locked.";
    return { promptTokens: 1, completionTokens: 1, totalTokens: 2, finishReason: "stop" };
  };
  try {
    const generatedChat = await chats.create({
      name: "Actual sequential agents",
      mode: "game",
      characterIds: [],
      connectionId: narratorConnection.id,
    });
    assert(generatedChat);
    await chats.createMessage({ chatId: generatedChat.id, role: "user", content: "Inspect the gate." });
    for (const sequential of [false, true]) {
      await chats.patchMetadata(generatedChat.id, {
        enableAgents: true,
        activeAgentIds: types,
        gameSequentialAgents: sequential,
        enableTools: false,
      });
      models = [];
      peak = 0;
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: generatedChat.id },
      });
      assert.ok(!response.body.includes('"type":"error"'), response.body);
      assert.deepEqual(
        [...new Set(models)].sort(),
        [...types].sort(),
        "all three real pre-generation branches execute",
      );
      assert.ok(
        sequential ? peak === 1 : peak > 1,
        "knowledge retrieval/router honor the same sequence as ordinary pre-generation agents",
      );
      models = [];
      peak = 0;
      const retry = await app.inject({
        method: "POST",
        url: "/api/generate/retry-agents",
        payload: { chatId: generatedChat.id, agentTypes: types },
      });
      assert.ok(!retry.body.includes('"type":"error"'), retry.body);
      assert.deepEqual([...new Set(models)].sort(), [...types].sort());
      assert.ok(
        sequential ? peak === 1 : peak > 1,
        "explicit Game agent retries honor the selected concurrency policy",
      );
    }
  } finally {
    OpenAIProvider.prototype.chatComplete = originalComplete;
    OpenAIProvider.prototype.chat = originalChat;
  }
  console.log("Game opt-in queue, concurrent default, background handoff and cancellation bypass passed.");
} finally {
  releaseMedia();
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
