import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-memory-history-start-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const requests: Array<{ kind: string; text: string }> = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("Content-Type", "application/json");
  if (request.url?.endsWith("/embeddings")) {
    const texts = Array.isArray(body.input) ? body.input : [body.input];
    response.end(JSON.stringify({ data: texts.map((_: unknown, index: number) => ({ index, embedding: [1, 0] })) }));
    return;
  }
  const text = body.messages.map((message: { content: string }) => message.content).join("\n");
  const classification = text.startsWith("Identify scene transitions");
  requests.push({ kind: classification ? "classify" : "summary", text });
  const content = classification
    ? JSON.stringify({
        starts: JSON.parse(body.messages[1].content)
          .filter((message: { content: string }) => message.content.startsWith("SCENE_CHANGE"))
          .map((message: { messageId: string }) => ({ messageId: message.messageId })),
      })
    : JSON.stringify({ summary: "HISTORICAL_RECAP: The brass compass journey was recorded." });
  response.end(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }));
});

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { advancedMemoryRoutes } = await import("../../packages/server/src/routes/advanced-memory.routes.js");
const { prepareAdvancedMemoryContext } =
  await import("../../packages/server/src/services/generation/advanced-memory-context.js");
const { createAdvancedMemoryPlacement } =
  await import("../../packages/server/src/services/prompt/advanced-memory-prompt.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
const app = Fastify();
app.decorate("db", db);
await app.register(advancedMemoryRoutes, { prefix: "/api/chats" });
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "History fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxContext: 8192,
    maxTokensOverride: 1024,
    embeddingModel: "fixture-embedding",
  });
  const chat = await chats.create({
    name: "1000 messages with a late context start",
    mode: "roleplay",
    characterIds: ["traveler", "visitor", "narrator"],
    connectionId: connection.id,
  });
  assert(chat);
  await chats.createMessagesBatch(
    chat.id,
    Array.from({ length: 1000 }, (_, index) => ({
      role: "user" as const,
      content: `${[250, 500, 750, 950].includes(index) ? "SCENE_CHANGE " : ""}EVENT_${index}: The brass compass journey continued.${index === 600 || index >= 996 ? " Sundial." : ""}${index === 720 ? "\nDate: PARTIAL_SCENE_LATER_DATE" : ""}`,
      extra:
        index === 960
          ? { isConversationStart: true }
          : index === 25
            ? { hiddenFromAI: true }
            : index === 50
              ? { hiddenFromAICharacterIds: ["traveler"] }
              : index === 750
                ? { conversationStartForCharacterIds: ["visitor"] }
                : undefined,
    })),
  );
  const source = await chats.listMessages(chat.id);
  await chats.patchMetadata(chat.id, { groupChatMode: "individual" });
  const { settings } = await memory.updateSettings(chat.id, {
    enabled: true,
    maxContextTokens: 8192,
    summaryBudgetTokens: 512,
    retrieveMinMessages: 0,
    retrieveMaxMessages: 0,
    narratorCharacterId: "narrator",
    knowledgeStarts: { traveler: null, visitor: source[500]!.id },
  });
  // Exercise the same reset and prepare endpoints as Chat Settings, with the marker retained.
  const reset = await app.inject({ method: "DELETE", url: `/api/chats/${chat.id}/advanced-memory` });
  assert.equal(reset.statusCode, 200, reset.body);
  const start = await app.inject({
    method: "POST",
    url: `/api/chats/${chat.id}/advanced-memory/initialize`,
    payload: {},
  });
  assert.equal(start.statusCode, 202, start.body);
  await memory.initialize(chat.id); // Join the background operation started by the route.
  const status = await memory.status(chat.id);
  assert.equal(status.job.status, "ready");
  assert.equal(status.job.total, 1000);
  const scenes = status.records.filter((record) => record.kind === "scene" && record.content);
  const sharedScenes = scenes.filter((record) => !record.audienceCharacterIds.length);
  assert.deepEqual(
    sharedScenes.map((record) => [record.startIndex, record.endIndex]),
    [
      [1, 250],
      [251, 500],
      [501, 750],
      [751, 950],
    ],
    "all closed scenes before the context marker must be summarized",
  );
  const excerpts = status.records.filter((record) => record.kind === "excerpt" && !record.audienceCharacterIds.length);
  const archivedIds = new Set(excerpts.flatMap((record) => record.messageIds));
  assert(
    source.every((message, index) => index === 25 || archivedIds.has(message.id)),
    "the archive covers all eligible history, including the open scene",
  );
  assert(
    !status.records.some((record) => record.content && record.messageIds.includes(source[25]!.id)),
    "globally hidden text stays out of memory",
  );
  assert(
    !scenes.some(
      (record) => record.audienceCharacterIds.includes("traveler") && record.messageIds.includes(source[50]!.id),
    ),
    "character-hidden text stays out of their summaries",
  );
  assert(
    !scenes.some(
      (record) =>
        record.audienceCharacterIds.includes("visitor") &&
        record.messageIds.some((id) => source.slice(0, 750).some((message) => message.id === id)),
    ),
    "a character-specific manual start remains authoritative even with an earlier confirmed knowledge range",
  );
  assert(
    !scenes.some((record) => record.audienceCharacterIds.includes("narrator")),
    "the narrator still shares the archive",
  );
  assert(
    requests.filter((request) => request.kind === "classify").length > 1,
    "history spans several helper context windows",
  );
  assert(
    requests.some((request) => request.kind === "summary" && request.text.includes("EVENT_0:")),
    "oldest source text reaches the summary model",
  );

  const prepared = await prepareAdvancedMemoryContext({
    service: memory,
    chatId: chat.id,
    settings,
    sourceMessages: source,
    messages: [
      { role: "system", content: "SYSTEM_RULES", contextKind: "prompt" },
      ...source.slice(960).map((message) => ({ ...message, role: "user" as const, contextKind: "history" as const })),
    ],
    placements: ["chat_summary", "current_scene_summary", "recalled_scenes", "recalled_messages"].map((kind) =>
      createAdvancedMemoryPlacement(kind as Parameters<typeof createAdvancedMemoryPlacement>[0], "xml"),
    ),
    audienceCharacterIds: ["traveler"],
    maxContext: 8192,
    maxTokens: 1024,
    toProviderMessages: (messages) => messages,
  });
  assert(
    prepared.providerMessages.some(
      (message) => message.role === "system" && message.content.includes("HISTORICAL_RECAP"),
    ),
    "past scenes enter the system prompt without authored memory markers",
  );
  assert.deepEqual(
    prepared.providerMessages.filter((message) => message.role === "user").map((message) => message.content),
    source.slice(960).map((message) => message.content),
    "old raw turns do not return to live history",
  );
  assert(prepared.providerMessages.some((message) => message.content.includes("EVENT_999:")));
  assert.equal(
    prepared.receipt.boundaryMessageId,
    source[959]!.id,
    "the live context cutoff remains at the shared start",
  );
  assert(prepared.receipt.recalledSceneIds.length, "scenes before the marker remain eligible for recall");
  assert.deepEqual(
    (await memory.status(chat.id)).job.contextStarts,
    [{ messageId: source[960]!.id, audienceCharacterIds: ["traveler"] }],
    "the visible marker follows the first live message",
  );
  await memory.validatePrepared(chat.id, source, prepared.receipt);
  const settledRequests = requests.length;
  await memory.initialize(chat.id);
  assert.equal(requests.length, settledRequests, "a completed archive reuses summaries instead of regenerating");
  await memory.updateSettings(chat.id, { retrieveMinMessages: 3, retrieveMaxMessages: 10 });
  const recalled = await memory.prepare({
    chatId: chat.id,
    messages: source,
    audienceCharacterIds: ["traveler"],
    budgetTokens: 6000,
    readOnly: true,
  });
  assert(recalled.receipt.recalledMessageIds.length, "old excerpts remain available with verbatim recall enabled");
  assert(!recalled.receipt.recalledMessageIds.includes(source[25]!.id));
  assert(!recalled.receipt.recalledMessageIds.includes(source[50]!.id));
  const compressed = await memory.prepare({
    chatId: chat.id,
    messages: source,
    audienceCharacterIds: ["traveler"],
    budgetTokens: 900,
  });
  assert(source.findIndex((message) => message.id === compressed.messageIds[0]) > 960);
  const visibleStarts = (await memory.status(chat.id)).job.contextStarts;
  assert.deepEqual(
    visibleStarts,
    [{ messageId: compressed.messageIds[0], audienceCharacterIds: ["traveler"] }],
    "the marker moves after compressing an ongoing scene, not just at closed-scene boundaries",
  );
  await memory.prepare({
    chatId: chat.id,
    messages: source.slice(0, 100),
    audienceCharacterIds: ["traveler"],
    budgetTokens: 6000,
  });
  assert.deepEqual(
    (await memory.status(chat.id)).job.contextStarts,
    visibleStarts,
    "historical regeneration cannot move the current cutoff backwards",
  );
  assert.deepEqual(
    await chats.listMessages(chat.id),
    source,
    "preparation leaves the original transcript and start marker intact",
  );
  await chats.updateMessageExtra(source[960]!.id, { isConversationStart: false });
  const withoutStart = await memory.prepare({
    chatId: chat.id,
    messages: await chats.listMessages(chat.id),
    audienceCharacterIds: ["traveler"],
    budgetTokens: 100_000,
  });
  assert.equal(withoutStart.messageIds[0], source[0]!.id, "removing a manual cutoff restores eligible live history");
  assert.equal(withoutStart.receipt.boundaryMessageId, null);
  assert.equal(withoutStart.chatSummary, null, "fully live history needs no continuity summary");
  assert.equal(withoutStart.recalledScenes, null, "fully live scenes are not recalled again");
  assert.equal(withoutStart.recalledMessages, null, "fully live messages are not recalled again");
  assert.deepEqual((await memory.status(chat.id)).job.contextStarts, [], "the obsolete automatic marker is removed");
  await chats.updateMessageExtra(source[700]!.id, { isConversationStart: true });
  await memory.initialize(chat.id);
  await memory.updateSettings(chat.id, { retrieveMinMessages: 0, retrieveMaxMessages: 0 });
  const scenesBeforeSelection = (await memory.status(chat.id)).records.filter(
    (record) => record.kind === "scene" && record.content,
  );
  await chats.patchMetadata(chat.id, {
    summaryEntries: (
      [
        ["ARCHIVED_CORRECTION", 601, 610],
        ["OVERLAPPING_CORRECTION", 696, 705],
        ["LIVE_CORRECTION", 901, 910],
      ] as const
    ).map(([content, start, end]) => ({
      id: content,
      kind: "rolling",
      origin: "manual",
      content,
      enabled: true,
      title: content,
      sourceMode: "range",
      rangeStartIndex: start,
      rangeEndIndex: end,
      tokenEstimate: 6,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  });
  const beforeMovedStart = requests.length;
  const movedStart = await memory.prepare({
    chatId: chat.id,
    messages: await chats.listMessages(chat.id),
    audienceCharacterIds: ["traveler"],
    budgetTokens: 100_000,
  });
  assert.equal(movedStart.messageIds[0], source[700]!.id, "moving a manual start does not retain its later cutoff");
  const liveIds = new Set(movedStart.messageIds);
  assert(movedStart.recalledScenes, "complete earlier scenes remain available for recall");
  assert(
    scenesBeforeSelection
      .filter((record) => movedStart.receipt.recalledSceneIds.includes(record.sceneId))
      .every((record) => record.messageIds.every((id) => !liveIds.has(id))),
    "a scene crossing the live cutoff must not be recalled in full",
  );
  assert.match(movedStart.chatSummary ?? "", /ARCHIVED_CORRECTION/, "archived manual corrections remain available");
  assert.match(
    movedStart.chatSummary ?? "",
    /OVERLAPPING_CORRECTION/,
    "enabled constants survive overlapping live ranges",
  );
  assert.match(movedStart.chatSummary ?? "", /LIVE_CORRECTION/, "enabled constants remain even for fully live ranges");
  assert.equal(requests.length, beforeMovedStart, "reading ranged constants makes no helper call");
  const afterMovedStart = requests.length;
  const movedPreview = await memory.prepare({
    chatId: chat.id,
    messages: await chats.listMessages(chat.id),
    audienceCharacterIds: ["traveler"],
    budgetTokens: 100_000,
    readOnly: true,
  });
  assert.equal(movedPreview.chatSummary, movedStart.chatSummary, "the corrected continuity can be reused");
  assert.deepEqual(movedPreview.receipt.recalledSceneIds, movedStart.receipt.recalledSceneIds);
  assert.equal(requests.length, afterMovedStart, "preview does not regenerate saved summaries");
  await memory.updateSettings(chat.id, { retrieveMinMessages: 3, retrieveMaxMessages: 10 });
  const movedExcerpts = await memory.prepare({
    chatId: chat.id,
    messages: await chats.listMessages(chat.id),
    audienceCharacterIds: ["traveler"],
    budgetTokens: 100_000,
    readOnly: true,
  });
  assert(movedExcerpts.receipt.recalledMessageIds.length);
  assert(
    !movedExcerpts.receipt.recalledMessageIds.includes(source[600]!.id),
    "a split scene is left to continuity rather than recalling a recap that overlaps live context",
  );
  assert.doesNotMatch(
    movedExcerpts.recalledScenes ?? "",
    /PARTIAL_SCENE_LATER_DATE/,
    "an archived excerpt cannot inherit a timeframe from live scene messages",
  );
  assert(
    movedExcerpts.receipt.recalledMessageIds.every((id) => !liveIds.has(id)),
    "recalled excerpts never repeat live messages, including chunks crossing the cutoff",
  );
  assert.deepEqual(
    (await memory.status(chat.id)).records.filter((record) => record.kind === "scene" && record.content),
    scenesBeforeSelection,
    "prompt selection preserves completed scene recaps",
  );
  await chats.updateMessageExtra(source[700]!.id, { isConversationStart: false });
  const allLiveWithCorrections = await memory.prepare({
    chatId: chat.id,
    messages: await chats.listMessages(chat.id),
    audienceCharacterIds: ["traveler"],
    budgetTokens: 100_000,
  });
  assert.equal(
    allLiveWithCorrections.chatSummary,
    movedStart.chatSummary,
    "removing a live cutoff does not disable constant summaries",
  );
  await memory.reset(chat.id);
  assert.equal((await memory.status(chat.id)).job.contextStarts, undefined, "reset clears automatic markers");
  process.stdout.write(
    "Advanced Memory full-history archive, context cutoff and visibility regression passed (1000 messages).\n",
  );
} finally {
  await app.close();
  await db._fileStore.close();
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  rmSync(directory, { recursive: true, force: true });
}
