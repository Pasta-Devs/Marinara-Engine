import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

// #7177: Game Master calls (new-game setup and the other Game routes) wait as long as the Text
// generation timeout says, not a fixed 5 minutes, and a reasoning model's thinking counts as
// progress. The setting's floor is 10 s, so 10 s and 20 s stand in for any value up to an hour.
// Ending a session and writing its ending again are checked through the real routes, on a fresh
// database in a temporary folder.
process.env.CHAT_GENERATION_TIMEOUT_MS = "10000";
const dataDir = mkdtempSync(join(tmpdir(), "marinara-game-generation-timeout-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { runGameChatComplete, gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { createLLMProvider } = await import("../../packages/server/src/services/llm/provider-registry.js");
const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");

const QUIET_MS = 12_000; // past a 10 s setting, within a 20 s one
const chunk = (delta: Record<string, string>, finish: string | null = null) =>
  `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;

// Streams `beat` every second, then the reply. Fixed routes and delays only.
function streamReply(response: ServerResponse, beat: string) {
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.flushHeaders();
  const beats = setInterval(() => response.write(beat), 1_000);
  const reply = setTimeout(() => {
    clearInterval(beats);
    response.end(chunk({ content: "done" }, "stop") + "data: [DONE]\n\n");
  }, QUIET_MS);
  response.on("close", () => {
    clearInterval(beats);
    clearTimeout(reply);
  });
}

let conclusionRequests = 0;
const server = createServer((request, response) => {
  request.resume();
  switch (request.url) {
    // No output for 12 s. SSE comments keep the socket busy, so only the Game wait can end it.
    case "/stalled/chat/completions":
      return streamReply(response, ": keep-alive\n\n");
    // The same silence for the session-ending routes, counted so the test knows both have started.
    case "/conclusion/chat/completions":
      conclusionRequests++;
      return streamReply(response, ": keep-alive\n\n");
    // A reasoning model (llama.cpp reasoning_content) thinking for 12 s before its first token.
    case "/thinking/chat/completions":
      return streamReply(response, chunk({ reasoning_content: "thinking " }));
    default:
      response.writeHead(404).end();
  }
});
await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const { port } = server.address() as AddressInfo;

// By default like Game setup with streaming on: content tokens arrive through onToken. `totalCapMs` is
// like the image-prompt calls: no onToken and a fixed cap, on a provider that streams anyway.
const generate = (route: string, totalCapMs?: number) => {
  const provider = createLLMProvider("custom", `http://127.0.0.1:${port}/${route}`, "", null, null, null, false, true);
  const started = Date.now();
  return runGameChatComplete(
    provider,
    [{ role: "user", content: "Set up the game." }],
    { model: "qwen-reasoner", stream: true, ...(totalCapMs ? {} : { onToken: () => undefined }) },
    "Game setup",
    totalCapMs,
  ).then(
    (result) => ({ content: result.content, error: null, seconds: (Date.now() - started) / 1000 }),
    (error: Error) => ({ content: null, error, seconds: (Date.now() - started) / 1000 }),
  );
};

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Silent Game Master",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${port}/conclusion`,
    model: "slow-gm",
    apiKey: "",
  });
  assert(connection);
  const chats = createChatsStorage(db);
  const gameChat = (name: string) =>
    chats.create({ name, mode: "game", characterIds: [], connectionId: connection.id });
  const playing = await gameChat("Session 1");
  const ended = await gameChat("Session 1, ended");
  assert(playing && ended);
  await chats.patchMetadata(ended.id, { gamePreviousSessionSummaries: [{ summary: "The gate was opened." }] });
  const post = (route: string, payload: Record<string, unknown>) => {
    const started = Date.now();
    return app
      .inject({
        method: "POST",
        url: `/api/game/session/${route}`,
        payload: { connectionId: connection.id, ...payload },
      })
      .then((response) => ({ response, seconds: (Date.now() - started) / 1000 }));
  };

  // Each call reads the setting when it starts, so these run side by side.
  const stalledAtTen = generate("stalled");
  const thinkingAtTen = generate("thinking");
  const concluding = post("conclude", { chatId: playing.id });
  const reconcluding = post("regenerate-conclusion", { chatId: ended.id, sessionNumber: 1 });
  // The routes read the setting after loading the chat, so wait until both have called the model.
  for (let attempt = 0; conclusionRequests < 2; attempt++) {
    if (attempt === 250) assert.fail("the session-ending routes never called the model");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  process.env.CHAT_GENERATION_TIMEOUT_MS = "20000";
  const stalledAtTwenty = generate("stalled");
  const thinkingUnderTotalCap = generate("thinking", 10_000);
  const [shorter, thinking, longer, capped] = await Promise.all([
    stalledAtTen,
    thinkingAtTen,
    stalledAtTwenty,
    thinkingUnderTotalCap,
  ]);

  assert.equal(shorter.error?.name, "GameGenerationTimeoutError", "a 10 s setting ends a 12 s silence");
  assert.match(shorter.error.message, /^Game setup timed out after 10 seconds$/);
  assert.ok(shorter.seconds < QUIET_MS / 1000, `it ends at the setting, not later (${shorter.seconds}s)`);

  assert.equal(longer.error, null, "a 20 s setting waits through the same 12 s silence");
  assert.equal(longer.content, "done");

  assert.equal(thinking.error, null, "12 s of thinking under a 10 s setting is progress, not silence");
  assert.equal(thinking.content, "done");

  assert.equal(capped.error?.name, "GameGenerationTimeoutError", "thinking does not stretch a fixed total cap");
  assert.ok(capped.seconds < QUIET_MS / 1000, `the total cap ends it on time (${capped.seconds}s)`);

  for (const [label, { response, seconds }] of [
    ["Game session conclusion", await concluding],
    ["Game session conclusion regeneration", await reconcluding],
  ] as const) {
    assert.equal(response.json().message, `${label} timed out after 10 seconds`, response.body);
    assert.ok(seconds < QUIET_MS / 1000, `${label} ends at the setting, not later (${seconds}s)`);
  }
  console.log("Game generations follow the Text generation timeout, and thinking counts as progress.");
} finally {
  await app.close();
  await closeDB();
  server.closeAllConnections();
  await new Promise<void>((done) => server.close(() => done()));
  rmSync(dataDir, { recursive: true, force: true });
}
