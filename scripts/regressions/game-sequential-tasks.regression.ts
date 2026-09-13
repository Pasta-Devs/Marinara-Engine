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
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
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
await app.register(gameRoutes, { prefix: "/api/game" });
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

    // Exercise model-producing Game routes, including work that outlives the
    // initial conclusion response and recaps scoped through session selection.
    let releaseKeeper = () => {};
    let keeperStarted = () => {};
    let mapCalls = 0;
    let recapCalls = 0;
    OpenAIProvider.prototype.chatComplete = async (messages) => {
      const text = messages.map((message) => message.content).join("\n");
      active++;
      peak = Math.max(peak, active);
      try {
        let content = '{"summary":"The gate was opened."}';
        if (text.includes("You are Marinara's Game Lorebook Keeper.")) {
          await new Promise<void>((done) => {
            releaseKeeper = done;
            keeperStarted();
          });
          content = '{"entries":[]}';
        } else if (text.includes("Generate the map.")) {
          mapCalls++;
          await delay();
          content = JSON.stringify({
            type: "node",
            name: "Courtyard",
            description: "Quiet",
            nodes: [],
            edges: [],
            partyPosition: "gate",
          });
        } else if (text.includes("Generate the session recap.")) {
          recapCalls++;
          await delay();
          content = "The gate stands open as the next session begins.";
        }
        return { content, toolCalls: [], finishReason: "stop" };
      } finally {
        active--;
      }
    };
    const gamePost = (path: string, payload: Record<string, unknown>) =>
      app.inject({ method: "POST", url: `/api/game/${path}`, payload });
    const mapPayload = { chatId: generatedChat.id, locationType: "courtyard" };
    try {
      for (const sequential of [false, true]) {
        await chats.patchMetadata(generatedChat.id, { gameSequentialAgents: sequential });
        peak = 0;
        const responses = await Promise.all([
          gamePost("narrate", { chatId: generatedChat.id }),
          gamePost("map/generate", mapPayload),
        ]);
        assert.ok(
          responses.every((response) => response.statusCode === 200),
          responses.map((response) => response.body).join("\n"),
        );
        assert.equal(peak, sequential ? 1 : 2, "actual map generation shares the opted-in chat queue");
      }

      for (const endpoint of ["session/conclude", "session/conclude/apply-json"]) {
        const concluding = await chats.create({
          name: endpoint,
          mode: "game",
          characterIds: [],
          connectionId: narratorConnection.id,
        });
        assert(concluding);
        await chats.patchMetadata(concluding.id, {
          gameSequentialAgents: true,
          gameLorebookKeeperEnabled: true,
          gameSessionStatus: "active",
        });
        const started = new Promise<void>((done) => {
          keeperStarted = done;
        });
        const response = await gamePost(endpoint, {
          chatId: concluding.id,
          streaming: false,
          rawJson: '{"summary":"The gate was opened."}',
        });
        assert.equal(response.statusCode, 200, response.body);
        await started;
        const beforeMaps = mapCalls;
        const mapRequest = gamePost("map/generate", { chatId: concluding.id, locationType: "courtyard" }).then(
          (result) => result,
        );
        await delay();
        assert.equal(mapCalls, beforeMaps, `${endpoint} retains the background Keeper after its HTTP reply`);
        releaseKeeper();
        const result = await mapRequest;
        assert.equal(result.statusCode, 200, result.body);
        assert.equal(
          JSON.parse((await chats.getById(concluding.id))!.metadata).gameLorebookKeeperLastRun.status,
          "success",
        );
      }

      for (const explicitSource of [false, true]) {
        const gameId = `sequence-session-${explicitSource}`;
        const canonical = await chats.create({
          name: "Canonical — Session 1",
          mode: "game",
          characterIds: [],
          groupId: gameId,
          connectionId: narratorConnection.id,
        });
        const branch = await chats.create({
          name: "Branch — Session 1",
          mode: "game",
          characterIds: [],
          groupId: gameId,
          connectionId: narratorConnection.id,
        });
        assert(canonical && branch);
        const selected = explicitSource ? branch : canonical;
        for (const session of [canonical, branch]) {
          await chats.patchMetadata(session.id, {
            gameSequentialAgents: session.id === selected.id,
            gameSessionNumber: 1,
            gameSessionStatus: "concluded",
            gamePreviousSessionSummaries: [{ summary: "The gate was opened." }],
            ...(session.id === branch.id ? { branchName: "Alternative gate" } : {}),
          });
        }
        const background = await gamePost("media", { chatId: selected.id });
        assert.equal(background.statusCode, 200);
        const beforeRecaps = recapCalls;
        const nextSession = gamePost("session/start", {
          gameId,
          ...(explicitSource ? { sourceChatId: selected.id } : {}),
        }).then((result) => result);
        await delay();
        assert.equal(recapCalls, beforeRecaps, "recap waits for the selected/source session's background task");
        releaseMedia();
        const response = await nextSession;
        assert.equal(response.statusCode, 200, response.body);
        const { sessionChat, sessionNumber } = response.json();
        assert.equal(sessionNumber, 2);
        assert.equal(recapCalls, beforeRecaps + 1);
        assert.equal(
          JSON.parse(sessionChat.metadata).gameSequentialAgents,
          true,
          "the new session retains the selected session's opt-in",
        );
        assert.equal(sessionChat.name.startsWith(explicitSource ? "Branch" : "Canonical"), true);
      }

      const gameId = "sequence-session-owner-change";
      const previous = await chats.create({
        name: "Owner — Session 1",
        mode: "game",
        characterIds: [],
        groupId: gameId,
        connectionId: narratorConnection.id,
      });
      assert(previous);
      const concluded = {
        gameSequentialAgents: true,
        gameSessionStatus: "concluded",
        gamePreviousSessionSummaries: [{ summary: "The gate was opened." }],
      };
      await chats.patchMetadata(previous.id, { ...concluded, gameSessionNumber: 1 });
      await gamePost("media", { chatId: previous.id });
      const releasePrevious = releaseMedia;
      const beforeRecaps = recapCalls;
      const waitingStart = gamePost("session/start", { gameId }).then((result) => result);
      await delay();
      const current = await chats.create({
        name: "Owner — Session 2",
        mode: "game",
        characterIds: [],
        groupId: gameId,
        connectionId: narratorConnection.id,
      });
      assert(current);
      await chats.patchMetadata(current.id, {
        ...concluded,
        gameSessionNumber: 2,
        gamePreviousSessionSummaries: [
          ...concluded.gamePreviousSessionSummaries,
          { summary: "The courtyard was explored." },
        ],
      });
      await gamePost("media", { chatId: current.id });
      try {
        releasePrevious();
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          const previousMap = await Promise.race([
            gamePost("map/generate", { chatId: previous.id, locationType: "courtyard" }),
            new Promise<never>((_, reject) => {
              timeout = setTimeout(
                () => reject(new Error("The previous owner's queue must be released before requeueing")),
                1000,
              );
            }),
          ]);
          assert.equal(previousMap.statusCode, 200, previousMap.body);
        } finally {
          clearTimeout(timeout);
        }
        assert.equal(
          recapCalls,
          beforeRecaps,
          "changed session ownership requeues the recap behind the current owner's media",
        );
        releaseMedia();
        const started = await waitingStart;
        assert.equal(started.statusCode, 200, started.body);
        assert.equal(started.json().sessionNumber, 3);
        assert.equal(recapCalls, beforeRecaps + 1);
      } finally {
        releasePrevious();
        releaseMedia();
      }
    } finally {
      releaseKeeper();
      releaseMedia();
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
