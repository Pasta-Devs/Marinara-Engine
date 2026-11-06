// A Conversation video's first-frame selfie runs through the per-connection queue (queue: true). That wrapper must not
// reserve a media permit while generateImage waits for its shared GPU turn: with one permit and text holding the GPU,
// an unrelated backend still renders, and a cancelled selfie leaves no permit, turn or waiter behind.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-shared-gpu-queued-selfie-"));
process.env.DATA_DIR = fixtureDir;
process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_MEDIA_GENERATION_CONCURRENCY = "1";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { handleConversationSelfieCommand } =
  await import("../../packages/server/src/services/generation/conversation-selfie-command-runtime.js");
const { generateImage } = await import("../../packages/server/src/services/image/image-generation.js");
const { inspectMediaGenerationConcurrencyForTests } =
  await import("../../packages/server/src/services/image/image-generation-queue.js");
const { runSharedGpuTurn, inspectSharedGpuTurnsForTests } =
  await import("../../packages/server/src/services/generation/shared-gpu-turns.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const physicalCalls = { gpu: 0, other: 0 };
// One fake per role: the GPU host draws the selfie, "other" is an unlisted image backend, and the text model that
// writes the selfie prompt sits on its own host so the stalled text turn doesn't hold it up.
const startServer = async (name: keyof typeof physicalCalls | "text") => {
  const server = createServer(async (request, response) => {
    for await (const chunk of request) void chunk;
    response.setHeader("content-type", "application/json");
    if (request.url?.endsWith("/images/generations")) {
      if (name !== "text") physicalCalls[name] += 1;
      response.end(JSON.stringify({ data: [{ b64_json: png }] }));
      return;
    }
    response.end(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: "1girl, selfie" }, finish_reason: "stop" }],
        usage: { total_tokens: 5 },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, base: `http://127.0.0.1:${address.port}/v1` };
};
const tick = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 5));
};
const noPermitsHeld = (why: string) =>
  assert.deepEqual(
    inspectMediaGenerationConcurrencyForTests(),
    { activeGlobalPermits: 0, queuedWaiters: 0, foregroundWaiters: 0, backgroundWaiters: 0 },
    why,
  );

const gpu = await startServer("gpu");
const other = await startServer("other");
const textModel = await startServer("text");
const gpuHost = new URL(gpu.base).host;
process.env.MARINARA_SHARED_GPU_HOSTS = gpuHost;
const db = await getDB();
const keepAlive = setTimeout(() => undefined, 30_000);
try {
  const connections = createConnectionsStorage(db);
  const text = await connections.create({
    name: "Text",
    provider: "custom",
    baseUrl: textModel.base,
    model: "fixture",
    apiKey: "fixture",
  });
  const image = await connections.create({
    name: "Local image",
    provider: "image_generation",
    baseUrl: gpu.base,
    model: "local-flux",
    imageService: "openai",
    imageGenerationSource: "openai",
    apiKey: "fixture",
  });
  const chars = createCharactersStorage(db);
  const character = await chars.create(characterDataSchema.parse({ name: "Aster" }));
  assert.ok(character);
  const chats = createChatsStorage(db);
  const conversation = await chats.create({ name: "Convo", mode: "conversation", characterIds: [character.id] });
  assert.ok(conversation);
  const chatMeta = { imageGenConnectionId: image.id };
  await chats.patchMetadata(conversation.id, chatMeta);
  const errors: unknown[] = [];
  const queuedSelfie = async (signal: AbortSignal) =>
    handleConversationSelfieCommand({
      command: { type: "selfie" } as Parameters<typeof handleConversationSelfieCommand>[0]["command"],
      characterId: character.id,
      chatId: conversation.id,
      chatMeta,
      charInfo: [],
      persona: null,
      promptConnection: (await connections.getWithKey(text.id))!,
      promptConnectionId: text.id,
      serviceTier: null,
      db,
      chars,
      chats,
      connections,
      sendEvent: (payload) => {
        if (payload.type === "selfie_error") errors.push(payload.data);
      },
      // As the Conversation video first frame takes it.
      queue: true,
      signal,
    });

  // Text holds the shared GPU; the queued selfie waits for its turn without holding the only permit.
  const stalledText = Promise.withResolvers<void>();
  const textTurn = runSharedGpuTurn("text", gpu.base, () => stalledText.promise);
  await tick();
  const cancel = new AbortController();
  const selfie = queuedSelfie(cancel.signal);
  for (let i = 0; i < 100 && !inspectSharedGpuTurnsForTests()[gpuHost]?.waiting; i += 1) await tick();
  assert.equal(inspectSharedGpuTurnsForTests()[gpuHost]?.waiting, 1, "the selfie waits for the shared GPU");
  noPermitsHeld("the queued selfie holds no media permit while it waits");
  const otherDraw = await generateImage("openai", other.base, "fixture-key", "openai", {
    prompt: "a moonlit laboratory",
    model: "other-model",
    allowLocalUrls: true,
  });
  assert.equal(otherDraw.base64, png, "an unrelated backend renders while the selfie waits");
  assert.equal(physicalCalls.other, 1);

  // Cancelled while waiting: nothing is drawn and nothing is left held.
  cancel.abort();
  await selfie.catch(() => undefined);
  assert.equal(physicalCalls.gpu, 0, "nothing reached the shared GPU while text held it");
  noPermitsHeld("a cancelled selfie leaves no permit");
  assert.equal(inspectSharedGpuTurnsForTests()[gpuHost]?.waiting ?? 0, 0, "no waiter left");

  // Once text lets go, a queued selfie takes its turn, then its permit, and draws.
  stalledText.resolve();
  await textTurn;
  assert.equal(await queuedSelfie(new AbortController().signal), true);
  assert.deepEqual(errors.slice(1), [], "the second selfie draws without an error");
  assert.equal(physicalCalls.gpu, 1);
  noPermitsHeld("a finished selfie returns its permit");
  assert.deepEqual(inspectSharedGpuTurnsForTests(), {});
  console.log("shared-gpu-queued-selfie regression passed");
} finally {
  clearTimeout(keepAlive);
  for (const { server } of [gpu, other, textModel]) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await closeDB();
  rmSync(fixtureDir, { recursive: true, force: true });
}
