// A real HTTP disconnect in the middle of a streamed generation (a mobile app backgrounded and its socket dropped).
// Normal, guided and impersonate generations all keep running and save their reply. An explicit Stop through
// POST /generate/abort still cancels an impersonate run.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, request as httpRequest, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-impersonate-disconnect-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.PROVIDER_LOCAL_URLS_ENABLED = "true";
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../../packages/server/src/services/storage/prompts.storage.js");
const { characterDataSchema } = await import("../../../packages/shared/dist/index.js");

// The provider streams one chunk, then holds the response open until the test releases it.
let held = Promise.withResolvers<ServerResponse>();
const provider = createServer(async (request, response) => {
  for await (const _ of request);
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.write(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "Half " }, finish_reason: null }] })}\n\n`,
  );
  held.resolve(response);
});
const finish = (response: ServerResponse) => {
  response.write(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "a reply." }, finish_reason: null }] })}\n\n`,
  );
  response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`);
  response.end("data: [DONE]\n\n");
};

const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
const streamClosed = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
app.addHook("preHandler", (request, reply, done) => {
  if (request.url === "/api/generate/" || request.url === "/api/generate") {
    const chatId = (request.body as { chatId: string }).chatId;
    reply.raw.once("close", () => streamClosed.get(chatId)?.resolve());
  }
  done();
});
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });

async function waitUntil(check: () => Promise<boolean>, description: string) {
  const deadline = Date.now() + 10_000;
  while (!(await check())) {
    assert.ok(Date.now() < deadline, description);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const results: Record<string, { survived: boolean; saved: string }> = {};
let stopped: { saved: string } | null = null;
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Disconnect fixture",
    provider: "openrouter",
    baseUrl: `http://127.0.0.1:${address.port}/openrouter.ai/api/v1`,
    model: "meta-llama/llama-3.3-70b-instruct",
    apiKey: "fixture",
    maxContext: 32768,
    maxTokensOverride: 512,
  });
  assert(connection);
  const alice = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Alice" }));
  assert(alice);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "Disconnect fixture",
    parameters: { maxTokens: 512, maxContext: 32768 },
    wrapFormat: "xml",
  });
  assert(preset);
  await presets.createSection({ presetId: preset.id, identifier: "rules", name: "Rules", content: "Rules." });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  await app.listen({ host: "127.0.0.1", port: 0 });
  const appAddress = app.server.address();
  assert(appAddress && typeof appAddress === "object");
  const appUrl = `http://127.0.0.1:${appAddress.port}`;

  const cases = {
    normal: {},
    guided: { generationGuide: "Alice opens the door.", generationGuideSource: "guide" },
    impersonate: { impersonate: true, userMessage: "wave at Alice" },
    "impersonate-stop": { impersonate: true, userMessage: "wave at Alice" },
  } as const;

  for (const [label, extra] of Object.entries(cases)) {
    const stop = label === "impersonate-stop";
    const chat = await chats.create({
      name: label,
      mode: "roleplay",
      characterIds: [alice.id],
      connectionId: connection.id,
      promptPresetId: preset.id,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false });
    await chats.createMessage({ chatId: chat.id, role: "user", content: "I knock." });
    await chats.createMessage({ chatId: chat.id, role: "assistant", characterId: alice.id, content: "Who is it?" });
    const before = (await chats.listMessages(chat.id)).length;

    held = Promise.withResolvers<ServerResponse>();
    streamClosed.set(chat.id, Promise.withResolvers<void>());
    const body = JSON.stringify({ chatId: chat.id, streaming: true, ...extra });
    const sse = Promise.withResolvers<import("node:http").IncomingMessage>();
    const client = httpRequest(
      `${appUrl}/api/generate/`,
      { method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } },
      (response) => {
        response.on("data", () => {});
        response.on("error", () => {});
        sse.resolve(response);
      },
    );
    client.on("error", (error) => sse.reject(error));
    client.end(body);

    const providerResponse = await Promise.race([
      held.promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label}: provider never called`)), 10_000).unref(),
      ),
    ]);
    const stream = await sse.promise;
    const active = async () =>
      (await app.inject({ method: "GET", url: `/api/generate/status/${chat.id}` })).json().active === true;
    assert.equal(await active(), true, `${label}: run is active before the disconnect`);

    let survived = false;
    if (stop) {
      // The user presses Stop: the client posts /abort.
      const aborted = await app.inject({ method: "POST", url: "/api/generate/abort", payload: { chatId: chat.id } });
      assert.equal(aborted.json().aborted, true, `${label}: /abort found the run`);
      stream.destroy();
    } else {
      // The phone goes to the background: the socket drops. No /abort is sent.
      stream.destroy();
      await streamClosed.get(chat.id)!.promise;
      await new Promise((resolve) => setTimeout(resolve, 100));
      survived = await active();
    }

    if (!providerResponse.writableEnded && !providerResponse.destroyed) finish(providerResponse);
    await waitUntil(async () => !(await active()), `${label}: run did not settle`);
    const after = await chats.listMessages(chat.id);
    const added = after.slice(before);
    const saved = added.length ? added.map((m) => `${m.role}: ${JSON.stringify(m.content)}`).join("; ") : "nothing";
    if (stop) stopped = { saved };
    else results[label] = { survived, saved };
  }
} finally {
  provider.closeAllConnections();
  app.server.closeAllConnections();
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

for (const [label, r] of Object.entries(results))
  console.info(`${label.padEnd(12)} still running after disconnect: ${r.survived}  saved: ${r.saved}`);
for (const [label, r] of Object.entries(results)) {
  assert.equal(r.survived, true, `${label}: a passive disconnect must not stop the generation`);
  assert.notEqual(r.saved, "nothing", `${label}: the reply must be saved after a passive disconnect`);
}
assert.match(results.impersonate!.saved, /^user: "Half a reply\."$/u, "the impersonated turn is saved as a user row");
assert(stopped, "the Stop case ran");
console.info(`impersonate-stop saved: ${stopped.saved}`);
assert.doesNotMatch(stopped.saved, /a reply\./u, "an explicit Stop cancels the impersonate run");
console.info("Generations survive a passive disconnect; Stop still cancels.");
