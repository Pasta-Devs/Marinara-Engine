// Real HTTP disconnects must not cancel a reviewed Illustrator image, but the
// existing Stop/Stop Agents endpoint must still cancel it before persistence.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, request as httpRequest, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-illustrator-disconnect-data-"));
process.env.DATA_DIR = fixtureDir;
process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.LOG_LEVEL = "silent";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGalleryStorage } = await import("../../packages/server/src/services/storage/gallery.storage.js");
const { replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");
replaceBuiltInAgentDefinitions([
  {
    id: "illustrator",
    name: "Illustrator",
    description: "Isolated disconnect fixture",
    phase: "post_processing",
    enabledByDefault: true,
    category: "utility",
    defaultTools: [],
    defaultSettings: { runInterval: 5 },
    defaultPromptTemplate: "Fixture",
  },
  {
    id: "echo-chamber",
    name: "Echo Chamber",
    description: "Unrelated retry cancellation control",
    phase: "post_processing",
    enabledByDefault: true,
    category: "utility",
    defaultTools: [],
    defaultSettings: {},
    defaultPromptTemplate: "Fixture",
  },
]);

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
let imageStarted = Promise.withResolvers<ServerResponse>();
const providerRequests: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  providerRequests.push(request.url ?? "");
  if (!request.url?.endsWith("/images/generations") && !request.url?.endsWith("/chat/completions")) {
    response.writeHead(500).end("Unexpected provider call: fixture must not call an LLM");
    return;
  }
  const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
  if (request.url.endsWith("/images/generations")) assert.equal(body.prompt, "A small synthetic laboratory");
  imageStarted.resolve(response);
});

const db = await getDB();
const chats = createChatsStorage(db);
const connections = createConnectionsStorage(db);
const agents = createAgentsStorage(db);
const gallery = createGalleryStorage(db);
const app = Fastify();
const streamClosed = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
app.addHook("preHandler", (request, reply, done) => {
  if (request.url === "/api/generate/retry-agents") {
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

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const providerAddress = provider.address();
  assert.ok(providerAddress && typeof providerAddress === "object");
  const providerUrl = `http://127.0.0.1:${providerAddress.port}/v1`;
  const textConnection = await connections.create({
    name: "Unused mock text provider",
    provider: "custom",
    baseUrl: providerUrl,
    model: "fixture",
    apiKey: "fixture",
  });
  const imageConnection = await connections.create({
    name: "Held mock image provider",
    provider: "image_generation",
    baseUrl: providerUrl,
    model: "dall-e-3",
    imageService: "openai",
    imageGenerationSource: "openai",
    apiKey: "fixture",
  });
  await agents.create({
    type: "illustrator",
    name: "Illustrator",
    phase: "post_processing",
    connectionId: textConnection.id,
    settings: { imageConnectionId: imageConnection.id, enabledTools: [] },
  });
  await agents.create({
    type: "echo-chamber",
    name: "Echo Chamber",
    phase: "post_processing",
    connectionId: textConnection.id,
    settings: { enabledTools: [] },
  });
  await app.listen({ host: "127.0.0.1", port: 0 });
  const appAddress = app.server.address();
  assert.ok(appAddress && typeof appAddress === "object");
  const appUrl = `http://127.0.0.1:${appAddress.port}`;

  for (const stop of [null, "agents", "generation", "other-agent-disconnect"] as const) {
    const otherAgent = stop === "other-agent-disconnect";
    const chat = await chats.create({
      name: `Illustrator disconnect ${stop ?? "passive"}`,
      mode: "roleplay",
      characterIds: [],
      connectionId: textConnection.id,
      promptPresetId: null,
    });
    assert.ok(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: true,
      activeAgentIds: [otherAgent ? "echo-chamber" : "illustrator"],
      illustratorUseAvatarReferences: false,
      illustratorIncludeCharacterAppearance: false,
    });
    const message = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Saved reply." });
    assert.ok(message);
    imageStarted = Promise.withResolvers<ServerResponse>();
    streamClosed.set(chat.id, Promise.withResolvers<void>());
    const body = JSON.stringify({
      chatId: chat.id,
      agentTypes: [otherAgent ? "echo-chamber" : "illustrator"],
      ...(!otherAgent && {
        illustratorRetryTargets: ["illustration"],
        illustratorPromptReviewOverride: {
          prompt: "A small synthetic laboratory",
          resultData: { shouldGenerate: true, prompt: "A small synthetic laboratory" },
        },
      }),
    });
    let sseOutput = "";
    const sseResponse = Promise.withResolvers<import("node:http").IncomingMessage>();
    const clientRequest = httpRequest(
      `${appUrl}/api/generate/retry-agents`,
      { method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } },
      (response) => {
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          sseOutput += chunk;
        });
        response.on("error", () => {});
        sseResponse.resolve(response);
      },
    );
    clientRequest.on("error", (error) => sseResponse.reject(error));
    clientRequest.end(body);
    const imageResponse = await Promise.race([
      imageStarted.promise,
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`Image request did not start: ${sseOutput}`)), 10_000);
        timer.unref();
      }),
    ]);
    const stream = await sseResponse.promise;
    const active = async () =>
      (await app.inject({ method: "GET", url: `/api/generate/status/${chat.id}` })).json().active === true;
    assert.equal(await active(), true);
    if (stop && !otherAgent) {
      const aborted = await app.inject({
        method: "POST",
        url: "/api/generate/abort",
        payload: { chatId: chat.id, ...(stop === "agents" ? { agentsOnly: true } : {}) },
      });
      assert.equal(aborted.json().aborted, true, aborted.body);
    }
    stream.destroy();
    // Wait for the actual peer close before resolving the provider. This is not
    // an injected AbortError or a synthetic event dispatched into the handler.
    await streamClosed.get(chat.id)!.promise;
    if (!stop) assert.equal(await active(), true, "Passive disconnect must retain the image run");
    if (otherAgent) await waitUntil(async () => !(await active()), "Other agent retries must cancel on disconnect");
    imageResponse.setHeader("content-type", "application/json");
    imageResponse.end(JSON.stringify({ data: [{ b64_json: png }] }));
    await waitUntil(async () => !(await active()), "Image run did not settle");
    const savedImages = await gallery.listByChatId(chat.id);
    assert.equal(savedImages.length, stop ? 0 : 1, `Image persistence after ${stop ?? "passive disconnect"}`);
    const expectedAttachments = stop ? 0 : 1;
    const savedMessage = await chats.getMessage(message.id);
    const savedSwipes = await chats.getSwipes(message.id);
    assert.equal((JSON.parse(savedMessage!.extra).attachments ?? []).length, expectedAttachments);
    assert.equal((JSON.parse(savedSwipes[0]!.extra).attachments ?? []).length, expectedAttachments);
    if (!stop)
      assert.deepEqual(readFileSync(join(fixtureDir, "gallery", savedImages[0]!.filePath)), Buffer.from(png, "base64"));
  }
  assert.equal(providerRequests.filter((url) => url.endsWith("/images/generations")).length, 3);
  assert.equal(providerRequests.filter((url) => url.endsWith("/chat/completions")).length, 1);
  console.info("Illustrator HTTP disconnect and explicit Stop regressions passed.");
} finally {
  // Release outstanding provider sockets first so a failed assertion cannot
  // leave a preserved retry hanging while Fastify drains active requests.
  provider.closeAllConnections();
  app.server.closeAllConnections();
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB();
  rmSync(fixtureDir, { recursive: true, force: true });
}
