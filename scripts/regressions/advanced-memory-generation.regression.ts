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
const modelCallKinds: string[] = [];
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
  modelCallKinds.push(classification ? "scene" : summary ? "summary" : "main");
  const content = classification
    ? body.messages[0].content.includes('"ends"')
      ? '{"ends":[]}'
      : '{"starts":[]}'
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
  const first = await characters.create(characterDataSchema.parse({ name: "Powers That Be" }));
  const second = await characters.create(characterDataSchema.parse({ name: "Maukie" }));
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
    summaryMaxTokens: 512,
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
    content: "Date: PRIVATE_SCENE_SECRET_DATE\nPRIVATE_SCENE_SECRET",
    extra: { hiddenFromAICharacterIds: [second.id] },
  });
  assert.ok(hidden);
  for (let index = 0; index < 10; index++)
    await chats.createMessage({
      chatId: chat.id,
      role: index % 2 ? "assistant" : "user",
      characterId: index % 2 ? first.id : null,
      content: `${index === 0 ? "Date: Spring 14\n" : ""}HISTORY_${index}: ${"A long ongoing scene. ".repeat(200)}`,
    });
  const summarySource = (await chats.listMessages(chat.id)).slice(1, 3);
  const conditionalEntries = [
    '{{#if char == "Powers That Be" || "Maukie"}}SHARED_CONSTANT_FOR_{{char}}{{/if}}\n{{#if char == "Pantalone"}}PANTALONE_ONLY_SECTION{{/if}}',
    '{{#if char == "Powers That Be"}}NARRATOR_ONLY_CONSTANT{{/if}}',
  ].map((content, index) => ({
    id: `conditional-constant-${index}`,
    content,
    enabled: true,
    origin: "manual",
    sourceMode: "range",
    rangeStartIndex: 2,
    rangeEndIndex: 3,
    messageIds: summarySource.map((message) => message.id),
  }));
  await chats.patchMetadata(chat.id, { summaryEntries: conditionalEntries });
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
  assert.ok(sent.includes("SHARED_CONSTANT_FOR_Maukie"), "conditional constants reach Maukie's actual request");
  assert.ok(!sent.includes("NARRATOR_ONLY_CONSTANT"), "narrator-only constants stay out of Maukie's request");
  assert.ok(!sent.includes("PANTALONE_ONLY_SECTION"), "another character's section stays out of Maukie's constant");
  assert.ok(sent.includes("Earlier context omitted"), "an oversized ongoing scene retains bounded source excerpts");
  assert(!modelCallKinds.includes("summary"), "main generation never invokes the summary helper");
  assert.ok(sent.includes("HISTORY_9"), `recent actual history stays in context: ${sent.slice(-1800)}`);
  assert.ok(!sent.includes("PRIVATE_SCENE_SECRET"), "a different character's hidden scene cannot leak");
  assert.ok(!sent.includes("FUTURE_LEGACY_SECRET"), "legacy unscoped summary cannot bypass managed placement");
  assert.ok(!sent.includes("__MARINARA_ADVANCED_MEMORY_"));
  const personalStart = (await chats.listMessages(chat.id)).find((message) => message.content.includes("HISTORY_4:"))!;
  await chats.updateMessageExtra(summarySource[0]!.id, { hiddenFromAI: true });
  await chats.updateMessageExtra(summarySource[1]!.id, { hiddenFromAICharacterIds: [second.id] });
  await chats.updateMessageExtra(personalStart.id, { conversationStartForCharacterIds: [second.id] });
  await generate();
  assert.ok(
    prompts.at(-1)!.includes("SHARED_CONSTANT_FOR_Maukie"),
    "enabled Chat Summaries follow their character conditions, not source-message visibility or personal cutoffs",
  );
  assert.doesNotMatch(
    prompts.at(-1)!,
    /PANTALONE_ONLY_SECTION|NARRATOR_ONLY_CONSTANT|PRIVATE_SCENE_SECRET|HISTORY_[0-3]:/u,
  );
  await chats.updateMessageExtra(summarySource[0]!.id, { hiddenFromAI: false });
  await chats.updateMessageExtra(summarySource[1]!.id, { hiddenFromAICharacterIds: [] });
  await chats.updateMessageExtra(personalStart.id, { conversationStartForCharacterIds: [] });
  const hideSummarized = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/metadata`,
    payload: { hideSummarisedMessages: true },
  });
  assert.equal(hideSummarized.statusCode, 200, hideSummarized.body);
  assert(JSON.parse((await chats.getMessage(summarySource[0]!.id))!.extra).hiddenFromAI);
  await generate();
  assert.ok(
    prompts.at(-1)!.includes("SHARED_CONSTANT_FOR_Maukie"),
    "hiding summarized source messages must retain their enabled constants",
  );
  assert.ok(!prompts.at(-1)!.includes("HISTORY_0:"), "summary-owned hiding still excludes the raw source message");
  assert.ok(!prompts.at(-1)!.includes("PRIVATE_SCENE_SECRET"), "explicit character hiding remains enforced");
  await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/metadata`,
    payload: { hideSummarisedMessages: false },
  });
  await generate();
  const target = (await chats.listMessages(chat.id)).at(-1)!;
  assert.ok(JSON.parse(target.extra as string).advancedMemoryReceipt);
  const originalMemory = JSON.parse(target.extra as string).advancedMemorySnapshot;
  assert(originalMemory.prepared.currentSceneSummary, "the original swipe retains its budget-compaction summary");
  await memory.checkScenesAfterGeneration(chat.id, { blocking: false });
  const beforeSwipe = modelCalls;
  const regenerated = await generate(target.id);
  assert.equal(modelCalls, beforeSwipe + 1, "regeneration reuses existing continuity without a helper call");
  assert.doesNotMatch(regenerated.body, /"stage":"compacting"/u);
  assert.match(regenerated.body, /reused-swipe-memory/u);
  const continued = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id, forCharacterId: second.id, continueMessageId: target.id },
  });
  assert.equal(continued.statusCode, 200, continued.body);
  assert(!continued.body.includes('"type":"error"'), continued.body);
  assert.equal(
    JSON.parse((await chats.getMessage(target.id))!.extra).advancedMemorySnapshot.prepared.receipt.sourceFingerprint,
    originalMemory.prepared.receipt.sourceFingerprint,
    "continuation must not replace the memory for regenerating the whole reply",
  );
  await memory.checkScenesAfterGeneration(chat.id, { blocking: false });
  const afterContinuation = modelCalls;
  const regeneratedAfterContinuation = await generate(target.id);
  assert.deepEqual(modelCallKinds.slice(afterContinuation), ["main"]);
  assert.doesNotMatch(regeneratedAfterContinuation.body, /"stage":"compacting"/u);
  assert.match(regeneratedAfterContinuation.body, /reused-swipe-memory/u);
  const generatedMetadata = JSON.parse((await chats.getById(chat.id))!.metadata);
  assert.equal(generatedMetadata.advancedMemoryState.contextStarts.length, 1);
  assert.deepEqual(generatedMetadata.advancedMemoryState.contextStarts[0].audienceCharacterIds, [second.id]);
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
  const savedRequest = cachedPeek.json().messages;
  await chats.updateMessageExtra(summarySource[0]!.id, {
    attachments: [{ type: "image", filename: "illustration_1.png", url: "/illustration_1.png" }],
  });
  await chats.patchMetadata(chat.id, {
    summary: "A summary edited after generation.",
    summaryEntries: conditionalEntries.map((entry) => ({ ...entry, enabled: false })),
  });
  const peekAfterUpdates = await app.inject({
    method: "POST",
    url: `/api/chats/${chat.id}/peek-prompt`,
    payload: { messageId: target.id },
  });
  assert.equal(peekAfterUpdates.statusCode, 200, peekAfterUpdates.body);
  assert.equal(peekAfterUpdates.json().exact, true);
  assert.deepEqual(
    peekAfterUpdates.json().messages,
    savedRequest,
    "late images and summary edits cannot rewrite a sent request",
  );
  const activeMessage = (await chats.getMessage(target.id))!;
  const activeExtra = JSON.parse(activeMessage.extra);
  const activeIndex = activeMessage.activeSwipeIndex;
  await chats.updateMessageExtra(target.id, { cachedPrompt: null });
  await chats.updateSwipeExtra(target.id, activeIndex, { cachedPrompt: null });
  const missingActivePrompt = await app.inject({
    method: "POST",
    url: `/api/chats/${chat.id}/peek-prompt`,
    payload: { messageId: target.id },
  });
  assert.equal(missingActivePrompt.statusCode, 404, "a missing active prompt must not borrow another swipe's request");
  await chats.updateMessageExtra(target.id, { cachedPrompt: activeExtra.cachedPrompt });
  await chats.updateSwipeExtra(target.id, activeIndex, { cachedPrompt: activeExtra.cachedPrompt });
  const otherSwipe = (await chats.getSwipes(target.id)).find((swipe) => swipe.index !== activeIndex)!;
  assert(otherSwipe, "the fixture includes multiple generated swipes");
  const otherPrompt = JSON.parse(otherSwipe.extra).cachedPrompt;
  await chats.setActiveSwipe(target.id, otherSwipe.index);
  const otherPeek = await app.inject({
    method: "POST",
    url: `/api/chats/${chat.id}/peek-prompt`,
    payload: { messageId: target.id },
  });
  assert.deepEqual(
    otherPeek.json().messages,
    otherPrompt.map(({ role, content }: { role: string; content: string }) => ({ role, content })),
  );
  await chats.setActiveSwipe(target.id, activeIndex);
  assert.equal(modelCalls, beforePreview, "historical inspection never prepares memory or calls a model");
  await chats.updateMessageExtra(summarySource[0]!.id, { attachments: [] });
  await chats.patchMetadata(chat.id, { summary: "FUTURE_LEGACY_SECRET", summaryEntries: conditionalEntries });
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

  const oversizedPreview = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    payload: {
      chatId: previewChat.id,
      returnPrompt: true,
      skipPreset: true,
      presetText: "Required fixed instruction. ".repeat(10_000),
    },
  });
  assert.equal(oversizedPreview.statusCode, 500);
  assert.match(oversizedPreview.json().error, /fixed instructions.*context cap/u);
  assert.equal(modelCalls, beforePreview, "preparation failures cannot start model calls");

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

  const beforeSharedStart = await chats.listMessages(chat.id);
  const sharedStart = beforeSharedStart.find((message) => message.content.includes("HISTORY_8:"))!;
  await chats.updateMessageExtra(sharedStart.id, { isConversationStart: true });
  await chats.patchMetadata(chat.id, {
    summaryEntries: [
      {
        id: "pre-marker-constant",
        kind: "rolling",
        origin: "manual",
        title: "Earlier history",
        content: "SUMMARY_FIXTURE: An old promise remains unresolved.",
        enabled: true,
        sourceMode: "range",
        rangeStartIndex: 2,
        rangeEndIndex: 3,
        messageIds: beforeSharedStart.slice(1, 3).map((message) => message.id),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
  await generate();
  const markedPrompt = JSON.parse(prompts.at(-1)!) as Array<{ role: string; content: string }>;
  assert(
    markedPrompt.some((message) => message.role === "system" && message.content.includes("SUMMARY_FIXTURE")),
    "actual generation keeps pre-marker memory in the system prompt",
  );
  assert(
    !markedPrompt.some((message) => message.role !== "system" && /HISTORY_[0-7]:/.test(message.content)),
    "actual generation respects the live-history start marker",
  );
  assert(!prompts.at(-1)!.includes("PRIVATE_SCENE_SECRET"));
  await memory.checkScenesAfterGeneration(chat.id, { blocking: false });
  const markedCalls = modelCalls;
  const markedPreview = await app.inject({
    method: "POST",
    url: "/api/generate/dryRun",
    payload: { chatId: chat.id, forCharacterId: second.id, returnPrompt: true },
  });
  assert.equal(markedPreview.statusCode, 200, markedPreview.body);
  assert(markedPreview.body.includes("SUMMARY_FIXTURE"));
  assert.equal(modelCalls, markedCalls, "preview reuses the pre-marker memory without provider calls");
  await chats.updateMessageExtra(sharedStart.id, { isConversationStart: false });

  await chats.createMessage({
    chatId: chat.id,
    role: "user",
    content: "FUTURE_RESET_SECRET",
    extra: { isConversationStart: true },
  });
  for (const wrapFormat of ["xml", "markdown", "none"] as const) {
    await presets.update(preset.id, { wrapFormat });
    await generate(target.id);
    assert.ok(
      !prompts.at(-1)!.includes("FUTURE_RESET_SECRET"),
      "historical regeneration uses the prefix before later manual starts",
    );
    assert.ok(prompts.at(-1)!.includes("HISTORY_9"));
    assert.ok(prompts.at(-1)!.includes("Spring 14"), `${wrapFormat} main-provider prompt retains known story time`);
    assert.ok(
      /(?:Messages #2–#|#2 User:)/u.test(prompts.at(-1)!),
      `${wrapFormat} memory has canonical source positions`,
    );
    assert.ok(
      !prompts.at(-1)!.includes("PRIVATE_SCENE_SECRET_DATE"),
      `${wrapFormat} memory cannot borrow another character's hidden date`,
    );
  }
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
