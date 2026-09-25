import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { connectionsRoutes } from "../../packages/server/src/routes/connections.routes.js";
import { translateRoutes } from "../../packages/server/src/routes/translate.routes.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";
import { createChatsStorage } from "../../packages/server/src/services/storage/chats.storage.js";

const previousDirectory = process.env.FILE_STORAGE_DIR;
let directory: string | undefined;
let db:
  | Awaited<ReturnType<typeof import("../../packages/server/src/db/file-backed-store.js").createFileNativeDB>>
  | undefined;
const app = Fastify();
const requests: Record<string, unknown>[] = [];
const longTranslation = `${"Zażółć gęślą jaźń. ".repeat(3000)}KONIEC PEŁNEGO TŁUMACZENIA`;
const provider = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "L3-8B-Stheno-v3.2" }] }));
    return;
  }
  if (request.method === "GET") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Unknown catalog endpoint" }));
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
  requests.push(body);
  response.writeHead(200, { "content-type": "application/json" });
  if (typeof body.model === "string" && body.model.startsWith("glm-5.3")) {
    // An always-reasoning model that spent its whole budget thinking (#5963).
    response.end(
      JSON.stringify({
        choices: [{ message: { content: "", reasoning_content: "…" }, finish_reason: "length" }],
        usage: { prompt_tokens: 13, completion_tokens: 1024, completion_tokens_details: { reasoning_tokens: 1023 } },
      }),
    );
    return;
  }
  response.end(
    JSON.stringify({
      choices: [
        { message: { content: body.model === "long-translation" ? longTranslation : "hello" }, finish_reason: "stop" },
      ],
    }),
  );
});
try {
  directory = mkdtempSync(join(tmpdir(), "marinara-test-parameters-"));
  process.env.FILE_STORAGE_DIR = directory;
  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  db = await createFileNativeDB();
  const storage = createConnectionsStorage(db);
  app.decorate("db", db);
  await app.register(connectionsRoutes, { prefix: "/api/connections" });
  await app.register(translateRoutes, { prefix: "/api/translate" });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  for (const [host, providerKind] of [
    ["localhost", "custom"],
    ["127.0.0.1", "custom"],
    ["localhost", "image_generation"],
    ["127.0.0.1", "image_generation"],
  ] as const) {
    const local = await storage.create({
      name: "LM Studio model discovery",
      provider: providerKind,
      baseUrl: `http://${host}:${address.port}/v1/`,
      apiKey: "",
      model: "",
      treatAsLocalEndpoint: true,
      ...(providerKind === "image_generation" ? { imageService: "openai", imageGenerationSource: "openai" } : {}),
    });
    const models = await app.inject({ method: "GET", url: `/api/connections/${local.id}/models` });
    assert.equal(models.statusCode, 200, models.body);
    assert.deepEqual(models.json().models, [{ id: "L3-8B-Stheno-v3.2", name: "L3-8B-Stheno-v3.2" }]);
  }
  const stoppedProvider = createServer();
  await new Promise<void>((resolve) => stoppedProvider.listen(0, "127.0.0.1", resolve));
  const stoppedAddress = stoppedProvider.address();
  assert.ok(stoppedAddress && typeof stoppedAddress !== "string");
  await new Promise<void>((resolve) => stoppedProvider.close(() => resolve()));
  const unreachable = await storage.create({
    name: "Stopped local provider",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${stoppedAddress.port}/v1`,
    apiKey: "",
    model: "",
  });
  const failedModels = await app.inject({ method: "GET", url: `/api/connections/${unreachable.id}/models` });
  assert.equal(failedModels.statusCode, 502);
  assert.match(failedModels.json().error, /ECONNREFUSED/);
  assert.match(failedModels.json().error, /from the Marinara server/);
  for (const defaults of [
    {},
    { temperature: 1, topP: 0.8, maxTokens: 2048, frequencyPenalty: 0.2, stopSequences: ["end"] },
    { temperature: 1, topP: 0.8, enabledParameters: { temperature: false, topP: false } },
    { maxTokens: 2048, enabledParameters: { maxTokens: false } },
  ]) {
    const created = await app.inject({
      method: "POST",
      url: "/api/connections",
      payload: {
        name: "Test parameter fixture",
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "",
        model: "fixture-model",
        defaultParameters: defaults,
      },
    });
    assert.equal(created.statusCode, 200, created.body);
    const id = created.json().id;
    await storage.updateDefaultParameters(id, defaults);
    const tested = await app.inject({ method: "POST", url: `/api/connections/${id}/test-message` });
    assert.equal(tested.json().success, true, tested.body);
    const sent = requests.at(-1)!;
    assert.equal(
      sent.temperature,
      defaults.enabledParameters?.temperature === false ? undefined : (defaults.temperature ?? 0.7),
    );
    assert.equal(sent.top_p, defaults.enabledParameters?.topP === false ? undefined : defaults.topP);
    // The provider removes explicitly disabled fields, including the route's fallback token limit.
    assert.equal(
      sent.max_tokens,
      defaults.enabledParameters?.maxTokens === false ? undefined : (defaults.maxTokens ?? 200),
    );
    assert.equal(sent.frequency_penalty, defaults.frequencyPenalty);
    if (defaults.stopSequences) assert.deepEqual(sent.stop, defaults.stopSequences);
    assert.deepEqual(sent.messages, [{ role: "user", content: "hi" }]);
  }

  // Translation uses the selected connection's budget, rather than the provider's 4096 default (#6366).
  for (const [maxTokensOverride, defaults, expected] of [
    [8192, {}, 8192],
    [4096, {}, 4096],
    [1024, {}, 1024],
    [null, {}, 4096],
    [null, { maxTokens: 8192 }, 8192],
    [8192, { maxTokens: 2048 }, 2048],
    [4096, { maxTokens: 8192 }, 4096],
    [8192, { maxTokens: 2048, enabledParameters: { maxTokens: false } }, undefined],
  ] as const) {
    const connection = await storage.create({
      name: "Translation budget fixture",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: "",
      model: "fixture-model",
      maxContext: 32768,
      maxTokensOverride,
    });
    await storage.updateDefaultParameters(connection.id, defaults);
    const translated = await app.inject({
      method: "POST",
      url: "/api/translate/",
      payload: { provider: "ai", connectionId: connection.id, text: "Cześć", targetLanguage: "English" },
    });
    assert.equal(translated.statusCode, 200, translated.body);
    assert.equal(translated.json().translatedText, "hello");
    const sent = requests.at(-1)!;
    assert.equal(sent.max_tokens, expected, `translation budget: ${JSON.stringify({ maxTokensOverride, defaults })}`);
    assert.equal(sent.temperature, 0.3, "translation keeps its dedicated sampling temperature");
  }

  // #6374: preserve the entire provider response, including text well beyond
  // 4096 tokens, through parsing, translation and the message/active-swipe store.
  const longConnection = await storage.create({
    name: "Long translation fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "",
    model: "long-translation",
    maxContext: 32768,
    maxTokensOverride: 8192,
  });
  const longResponse = await app.inject({
    method: "POST",
    url: "/api/translate/",
    payload: {
      provider: "ai",
      connectionId: longConnection.id,
      text: "Translate all of this.",
      targetLanguage: "Polish",
    },
  });
  assert.equal(longResponse.statusCode, 200, longResponse.body);
  assert.equal(longResponse.json().translatedText, longTranslation);
  assert.equal(requests.at(-1)!.max_tokens, 8192);
  const chats = createChatsStorage(db);
  const longChat = await chats.create({ name: "Long translation", mode: "roleplay", characterIds: [] });
  assert.ok(longChat);
  const longMessage = await chats.createMessage({
    chatId: longChat.id,
    role: "assistant",
    content: "Translate all of this.",
  });
  assert.ok(longMessage);
  await chats.updateMessageExtra(longMessage.id, {
    translation: longResponse.json().translatedText,
    translationSource: longMessage.content,
  });
  assert.equal(JSON.parse((await chats.getMessage(longMessage.id))!.extra).translation, longTranslation);
  assert.equal(JSON.parse((await chats.getSwipes(longMessage.id))[0]!.extra).translation, longTranslation);

  const localDefault = await storage.create({
    name: "Loaded local model",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "",
    model: "",
  });
  const localTest = await app.inject({ method: "POST", url: `/api/connections/${localDefault.id}/test-message` });
  assert.equal(localTest.json().success, true, localTest.body);
  assert.equal(requests.at(-1)!.model, "", "local auxiliary generations can use the currently loaded model");
  const cloudDefault = await storage.create({
    name: "Cloud needs a model",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "",
  });
  const beforeCloud = requests.length;
  const cloudTest = await app.inject({ method: "POST", url: `/api/connections/${cloudDefault.id}/test-message` });
  assert.equal(cloudTest.statusCode, 400, cloudTest.body);
  assert.equal(requests.length, beforeCloud, "blank cloud models must still fail before a provider request");

  // GLM 5.3 always reasons: the test gives it 1024 tokens instead of 200, and an
  // empty reply names the spent budget instead of showing a blank success (#5963).
  const glm = await app.inject({
    method: "POST",
    url: "/api/connections",
    payload: {
      name: "GLM test fixture",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: "",
      model: "glm-5.3",
      defaultParameters: {},
    },
  });
  assert.equal(glm.statusCode, 200, glm.body);
  const glmTested = await app.inject({ method: "POST", url: `/api/connections/${glm.json().id}/test-message` });
  assert.equal(glmTested.json().success, true, glmTested.body);
  assert.equal(requests.at(-1)!.max_tokens, 1024);
  assert.equal(
    glmTested.json().response,
    "The model used its whole output budget (1024 of 1024 output tokens, 1023 of them reasoning) before writing any visible text. Raise Max Tokens or lower Reasoning Effort, then try again.",
  );
} finally {
  try {
    try {
      await app.close();
    } finally {
      try {
        await new Promise<void>((resolve) => provider.close(() => resolve()));
      } finally {
        await db?._fileStore.close();
      }
    }
  } finally {
    if (previousDirectory === undefined) delete process.env.FILE_STORAGE_DIR;
    else process.env.FILE_STORAGE_DIR = previousDirectory;
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
}
console.log("Connection test-message parameter regressions passed.");
