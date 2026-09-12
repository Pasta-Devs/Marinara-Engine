import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-advanced-generation-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { promptsRoutes } = await import("../../packages/server/src/routes/prompts.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { characterDataSchema, DEFAULT_ADVANCED_MEMORY_SETTINGS } = await import("../../packages/shared/dist/index.js");
const prompts: string[] = [];
let modelCalls = 0;
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (req.url?.endsWith("/embeddings")) {
    const texts = Array.isArray(body.input) ? body.input : [body.input];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ data: texts.map((_: unknown, index: number) => ({ index, embedding: [0.1, 0.2, 0.3] })) }),
    );
    return;
  }
  modelCalls++;
  const prompt = JSON.stringify(body.messages);
  const classification = prompt.includes("Identify scene transitions");
  const summary = prompt.includes("Summarize only the supplied eligible source material");
  const content = classification
    ? '{"starts":[]}'
    : summary
      ? '{"summary":"SUMMARY_FIXTURE: An old promise remains unresolved."}'
      : "The character answers.";
  if (!classification && !summary) prompts.push(prompt);
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
  }
});
const db = await getDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
const app = Fastify();
app.decorate("db", db);
let forwardedPreview: { ip: string; cookie?: string; forwarded?: string | string[] } | undefined;
app.addHook("onRequest", async (request, reply) => {
  if (request.url !== "/api/generate/dryRun") return;
  if (request.headers["x-preview-probe"] === "true") {
    forwardedPreview = {
      ip: request.ip,
      cookie: request.headers.cookie,
      forwarded: request.headers["x-forwarded-for"],
    };
  }
  if (request.headers["x-preview-error"] === "true")
    return reply.status(502).type("text/html").send("<p>Gateway unavailable</p>");
});
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(promptsRoutes, { prefix: "/api/prompts" });
let chatId: string | undefined;
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Memory fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 8192,
    maxTokensOverride: 512,
    embeddingModel: "fixture-embedding",
  });
  const characters = createCharactersStorage(db);
  const first = await characters.create(characterDataSchema.parse({ name: "Dottore" }));
  const second = await characters.create(characterDataSchema.parse({ name: "Visitor" }));
  assert.ok(first && second);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "Advanced fixture",
    parameters: { maxTokens: 512, maxContext: 8192 },
    wrapFormat: "xml",
  });
  assert.ok(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "rules",
    name: "Rules",
    content: "MANDATORY_FIXTURE: stay in character as {{char}}.",
  });
  await presets.createSection({
    presetId: preset.id,
    identifier: "summary",
    name: "Earlier continuity",
    isMarker: true,
    markerConfig: { type: "chat_summary" },
  });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const chat = await chats.create({
    name: "Advanced proof",
    mode: "roleplay",
    characterIds: [first.id, second.id],
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert.ok(chat);
  chatId = chat.id;
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableMemoryRecall: true,
    groupChatMode: "individual",
    groupResponseOrder: "manual",
    contextMessageLimit: 1,
    summary: "FUTURE_LEGACY_SECRET",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 8192,
      summaryBudgetTokens: 512,
      knowledgeStarts: { [first.id]: null, [second.id]: null },
      knowledgeConfirmed: true,
    },
  });
  const hidden = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: first.id,
    content: "PRIVATE_SCENE_SECRET",
    extra: { hiddenFromAICharacterIds: [second.id] },
  });
  assert.ok(hidden);
  for (let index = 0; index < 10; index++)
    await chats.createMessage({
      chatId: chat.id,
      role: index % 2 ? "assistant" : "user",
      characterId: index % 2 ? first.id : null,
      content: `HISTORY_${index}: ${"A long ongoing scene. ".repeat(200)}`,
    });
  const generate = async (regenerateMessageId?: string) => {
    const result = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: {
        chatId: chat.id,
        forCharacterId: second.id,
        regenerateMessageId,
      },
    });
    assert.equal(result.statusCode, 200, result.body);
    assert.ok(!result.body.includes('"type":"error"'), result.body);
    return result;
  };
  const generated = await generate();
  assert.ok(generated.body.includes('"type":"advanced_memory_receipt"'));
  const sent = prompts.at(-1)!;
  assert.ok(sent.includes("MANDATORY_FIXTURE"));
  assert.ok(sent.includes("SUMMARY_FIXTURE"), "oversized ongoing scene must receive its temporary summary");
  assert.ok(sent.includes("HISTORY_9"), `recent actual history stays in context: ${sent.slice(-1800)}`);
  assert.ok(!sent.includes("PRIVATE_SCENE_SECRET"), "a different character's hidden scene cannot leak");
  assert.ok(!sent.includes("FUTURE_LEGACY_SECRET"), "legacy unscoped summary cannot bypass managed placement");
  assert.ok(!sent.includes("__MARINARA_ADVANCED_MEMORY_"));
  const target = (await chats.listMessages(chat.id)).at(-1)!;
  assert.ok(JSON.parse(target.extra as string).advancedMemoryReceipt);
  await memory.initialize(chat.id, { blocking: false });
  const beforePreview = modelCalls;
  const preview = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    payload: { chatId: chat.id, forCharacterId: second.id, returnPrompt: true },
  });
  assert.equal(preview.statusCode, 200, preview.body);
  assert.equal(modelCalls, beforePreview, "opening preview cannot classify or summarize");
  assert.ok(!preview.body.includes("PRIVATE_SCENE_SECRET"));

  const cachedPeek = await app.inject({
    method: "POST",
    url: `/api/chats/${chat.id}/peek-prompt`,
    payload: { messageId: target.id },
  });
  assert.equal(cachedPeek.statusCode, 200, cachedPeek.body);
  assert.equal(cachedPeek.json().source, "cached");
  assert.ok(!cachedPeek.body.includes("PRIVATE_SCENE_SECRET"));
  const previewChat = await chats.create({
    name: "Read-only preview",
    mode: "roleplay",
    characterIds: [second.id, first.id],
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert.ok(previewChat);
  await chats.patchMetadata(previewChat.id, {
    groupChatMode: "individual",
    groupResponseOrder: "manual",
    enableAgents: false,
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 8192,
      knowledgeStarts: { [first.id]: null, [second.id]: null },
    },
  });
  await chats.createMessage({
    chatId: previewChat.id,
    role: "assistant",
    characterId: first.id,
    content: "PREVIEW_PRIVATE_SECRET",
    extra: { hiddenFromAICharacterIds: [second.id] },
  });
  await chats.createMessage({ chatId: previewChat.id, role: "user", content: "PREVIEW_VISIBLE_INPUT" });
  await chats.createMessage({
    chatId: previewChat.id,
    role: "assistant",
    characterId: second.id,
    content: "A visible answer.",
    extra: {
      cachedPrompt: [{ role: "system", content: "STALE_CACHED_SECRET" }],
      advancedMemoryReceipt: JSON.parse(target.extra as string).advancedMemoryReceipt,
    },
  });
  const livePeek = await app.inject({
    method: "POST",
    url: `/api/chats/${previewChat.id}/peek-prompt`,
    payload: {},
    remoteAddress: "100.80.1.2",
    headers: { "x-preview-probe": "true", "x-forwarded-for": "100.80.1.2", cookie: "fixture-session=retained" },
  });
  assert.equal(livePeek.statusCode, 200, livePeek.body);
  assert.equal(livePeek.json().source, "assembled", "a stale cached receipt must not bypass read-only preparation");
  assert.ok(livePeek.body.includes("PREVIEW_VISIBLE_INPUT"));
  assert.ok(!livePeek.body.includes("PREVIEW_PRIVATE_SECRET"));
  assert.ok(!livePeek.body.includes("STALE_CACHED_SECRET"));
  assert.deepEqual(
    forwardedPreview,
    { ip: "127.0.0.1", cookie: "fixture-session=retained", forwarded: undefined },
    "an authorized preview preserves session headers without pretending to recreate a remote Tailscale socket",
  );
  const previewError = await app.inject({
    method: "POST",
    url: `/api/chats/${previewChat.id}/peek-prompt`,
    payload: {},
    headers: { "x-preview-error": "true" },
  });
  assert.equal(previewError.statusCode, 502);
  assert.equal(typeof previewError.json().error, "string", "non-JSON internal failures remain a readable API error");
  const presetPreview = await app.inject({
    method: "POST",
    url: `/api/prompts/${preset.id}/preview`,
    payload: { chatId: previewChat.id },
  });
  assert.equal(presetPreview.statusCode, 200, presetPreview.body);
  assert.ok(presetPreview.body.includes("PREVIEW_VISIBLE_INPUT"));
  assert.ok(!presetPreview.body.includes("PREVIEW_PRIVATE_SECRET"));
  assert.equal(modelCalls, beforePreview, "all preview entry points must remain read-only without model calls");

  const impersonation = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: previewChat.id, impersonate: true },
  });
  assert.equal(impersonation.statusCode, 200, impersonation.body);
  assert.ok(!impersonation.body.includes('"type":"error"'), impersonation.body);
  assert.ok(impersonation.body.includes('"type":"advanced_memory_receipt"'));
  assert.ok(!prompts.at(-1)!.includes("PREVIEW_PRIVATE_SECRET"), "owner impersonation still honors explicit hiding");
  await memory.initialize(previewChat.id);
  const impersonationCalls = modelCalls;
  const impersonationPreview = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    payload: { chatId: previewChat.id, impersonate: true, returnPrompt: true },
  });
  assert.equal(impersonationPreview.statusCode, 200, impersonationPreview.body);
  assert.ok(!impersonationPreview.body.includes("PREVIEW_PRIVATE_SECRET"));
  assert.equal(modelCalls, impersonationCalls);

  // An unconfirmed character must stop the pipeline before any helper/agent receives history.
  await memory.updateSettings(previewChat.id, { knowledgeStarts: { [first.id]: null } });
  const unconfirmedCalls = modelCalls;
  const unconfirmed = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: previewChat.id, forCharacterId: second.id },
  });
  assert.ok(unconfirmed.body.includes('"type":"error"'), unconfirmed.body);
  assert.ok(unconfirmed.body.includes('"status":"needs_confirmation"'), unconfirmed.body);
  assert.ok(unconfirmed.body.includes('"blocking":true'), unconfirmed.body);
  assert.equal(modelCalls, unconfirmedCalls, "missing knowledge cannot be sent to a model before confirmation");

  await chats.createMessage({
    chatId: chat.id,
    role: "user",
    content: "FUTURE_RESET_SECRET",
    extra: { isConversationStart: true },
  });
  await generate(target.id);
  assert.ok(
    !prompts.at(-1)!.includes("FUTURE_RESET_SECRET"),
    "historical regeneration uses the prefix before later manual starts",
  );
  assert.ok(prompts.at(-1)!.includes("HISTORY_9"));
} finally {
  if (chatId) {
    await chats.patchMetadata(chatId, { advancedMemory: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: false } });
    await memory.initialize(chatId).catch(() => undefined);
  }
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
process.stdout.write("Advanced memory actual generation, preview and historical regeneration passed.\n");
