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
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { chats: chatsTable } = await import("../../packages/server/src/db/schema/index.js");
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
await app.register(chatsRoutes, { prefix: "/api/chats" });
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
    maxContext: 16_384,
    maxTokensOverride: 1024,
    embeddingModel: "fixture-embedding",
  });
  const cycleChat = await chats.create({
    name: "Context resets then grows",
    mode: "roleplay",
    characterIds: ["first", "second"],
    connectionId: connection.id,
  });
  assert(cycleChat);
  await chats.patchMetadata(cycleChat.id, { groupChatMode: "individual" });
  await chats.createMessagesBatch(
    cycleChat.id,
    Array.from({ length: 30 }, (_, index) => ({
      role: "user" as const,
      content: `${index === 10 || index === 20 ? "SCENE_CHANGE " : ""}The brass compass journey continues. `.repeat(12),
    })),
  );
  await memory.updateSettings(cycleChat.id, {
    enabled: true,
    maxContextTokens: 16_384,
    summaryBudgetTokens: 512,
    retrieveMaxScenes: 0,
    knowledgeStarts: { first: null, second: null },
  });
  await memory.initialize(cycleChat.id);
  const cycleSource = await chats.listMessages(cycleChat.id);
  const allLive = await memory.prepare({
    chatId: cycleChat.id,
    messages: cycleSource,
    audienceCharacterIds: ["first"],
    budgetTokens: 100_000,
    readOnly: true,
  });
  const cycleBudget = Math.floor(allLive.receipt.estimatedTokensAfter * 0.8);
  const resetWindow = await memory.prepare({
    chatId: cycleChat.id,
    messages: cycleSource,
    audienceCharacterIds: ["first"],
    budgetTokens: cycleBudget,
  });
  assert.deepEqual(
    resetWindow.messageIds,
    cycleSource.slice(20).map((message) => message.id),
    "crossing the cap resets to the latest scene even when dropping only the oldest scene would fit",
  );
  assert(resetWindow.receipt.estimatedTokensAfter < cycleBudget * 0.6, "the reset leaves substantial room for growth");
  assert.deepEqual((await memory.status(cycleChat.id)).job.contextStarts?.[0]?.audienceCharacterIds, []);
  const moreRoom = await memory.prepare({
    chatId: cycleChat.id,
    messages: cycleSource,
    audienceCharacterIds: ["second"],
    budgetTokens: 100_000,
  });
  assert.deepEqual(
    moreRoom.messageIds,
    resetWindow.messageIds,
    "the shared cutoff also applies to another character, even with more room",
  );
  await chats.createMessagesBatch(cycleChat.id, [
    { role: "user", content: "SCENE_CHANGE The brass compass reaches the next village." },
  ]);
  const nextSceneCheck = await memory.getSceneCheck(cycleChat.id, { force: true });
  assert(nextSceneCheck);
  await memory.commitSceneCheck(cycleChat.id, nextSceneCheck, { ends: [{ messageNumber: 30 }] });
  let growingSource = await chats.listMessages(cycleChat.id);
  const growing = await memory.prepare({
    chatId: cycleChat.id,
    messages: growingSource,
    audienceCharacterIds: ["first"],
    budgetTokens: cycleBudget,
  });
  assert.deepEqual(
    growing.messageIds,
    growingSource.slice(20).map((message) => message.id),
    "a new scene alone does not move the cutoff while the window fits",
  );
  await chats.createMessagesBatch(
    cycleChat.id,
    Array.from({ length: 16 }, () => ({
      role: "user" as const,
      content: "The brass compass journey continues. ".repeat(12),
    })),
  );
  growingSource = await chats.listMessages(cycleChat.id);
  const nextReset = await memory.prepare({
    chatId: cycleChat.id,
    messages: growingSource,
    audienceCharacterIds: ["first"],
    budgetTokens: cycleBudget,
  });
  assert.deepEqual(
    nextReset.messageIds,
    growingSource.slice(30).map((message) => message.id),
    "growth to the cap triggers the next reset to the latest scene",
  );
  const historicalWindow = await memory.prepare({
    chatId: cycleChat.id,
    messages: growingSource.slice(0, 29),
    audienceCharacterIds: ["first"],
    budgetTokens: 100_000,
    readOnly: true,
  });
  assert.equal(
    historicalWindow.messageIds[0],
    growingSource[0]!.id,
    "a later automatic reset does not change historical prompt preparation",
  );

  const personalStart = await app.inject({
    method: "PATCH",
    url: `/api/chats/${cycleChat.id}/messages/${growingSource[40]!.id}/extra`,
    payload: { conversationStartForCharacterIds: ["second"] },
  });
  assert.equal(personalStart.statusCode, 200, personalStart.body);
  const cutoffId = growingSource[30]!.id;
  await chats.addSwipe(cutoffId, growingSource[30]!.content);
  await chats.addSwipe(cutoffId, growingSource[30]!.content);
  const beforeFailedFlag = {
    message: await chats.getMessage(cutoffId),
    swipes: await chats.getSwipes(cutoffId),
    chat: await chats.getById(cycleChat.id),
  };
  const missingSwipe = await app.inject({
    method: "PATCH",
    url: `/api/chats/${cycleChat.id}/messages/${cutoffId}/extra?swipeIndex=999`,
    payload: { isConversationStart: false },
  });
  assert.equal(missingSwipe.statusCode, 404);
  const update = db.update.bind(db);
  db.update = ((table: Parameters<typeof db.update>[0]) => {
    if (table === chatsTable) throw new Error("Forced cutoff metadata write failure");
    return update(table);
  }) as typeof db.update;
  try {
    const failedFlag = await app.inject({
      method: "PATCH",
      url: `/api/chats/${cycleChat.id}/messages/${cutoffId}/extra`,
      payload: { isConversationStart: false, conversationStartForCharacterIds: [] },
    });
    assert.equal(failedFlag.statusCode, 500);
  } finally {
    db.update = update;
  }
  assert.deepEqual(
    {
      message: await chats.getMessage(cutoffId),
      swipes: await chats.getSwipes(cutoffId),
      chat: await chats.getById(cycleChat.id),
    },
    beforeFailedFlag,
    "a failed cutoff save must leave the message, swipes and metadata unchanged",
  );
  const cleared = await app.inject({
    method: "PATCH",
    url: `/api/chats/${cycleChat.id}/messages/${growingSource[30]!.id}/extra`,
    payload: { isConversationStart: false, conversationStartForCharacterIds: [] },
  });
  assert.equal(cleared.statusCode, 200, cleared.body);
  assert.deepEqual((await memory.status(cycleChat.id)).job.contextStarts, []);
  assert((await chats.getSwipes(cutoffId)).every((swipe) => JSON.parse(swipe.extra).isConversationStart === false));
  const restoredSource = await chats.listMessages(cycleChat.id);
  for (const characterId of ["first", "second"]) {
    const restored = await memory.prepare({
      chatId: cycleChat.id,
      messages: restoredSource,
      audienceCharacterIds: [characterId],
      budgetTokens: 100_000,
    });
    assert.equal(
      restored.messageIds[0],
      growingSource[characterId === "second" ? 40 : 0]!.id,
      "unchecking All restores the shared window without removing personal flags",
    );
  }
  await chats.patchMetadata(cycleChat.id, (metadata) => ({
    advancedMemoryState: {
      ...(metadata.advancedMemoryState as Record<string, unknown>),
      contextStarts: [{ messageId: growingSource.at(-1)!.id, audienceCharacterIds: ["first"] }],
    },
  }));
  const legacyWindow = await memory.prepare({
    chatId: cycleChat.id,
    messages: restoredSource,
    audienceCharacterIds: ["first"],
    budgetTokens: 100_000,
  });
  assert.equal(legacyWindow.messageIds[0], growingSource[0]!.id, "legacy per-character automatic cutoffs are ignored");

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
    maxContextTokens: 16_384,
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
        record.messageIds.some((id) => source.slice(0, 500).some((message) => message.id === id)),
    ),
    "the confirmed knowledge start bounds the archive",
  );
  assert(
    scenes.some(
      (record) => record.audienceCharacterIds.includes("visitor") && record.messageIds.includes(source[600]!.id),
    ),
    "a later personal live-context flag must not erase earlier confirmed memories",
  );
  const visitor = await memory.prepare({
    chatId: chat.id,
    messages: source,
    audienceCharacterIds: ["visitor"],
    budgetTokens: 8192,
    readOnly: true,
  });
  assert.deepEqual(
    visitor.messageIds,
    source.slice(960).map((message) => message.id),
    "live context still honors the latest applicable start flag",
  );
  assert(
    visitor.recalledScenes?.includes("HISTORICAL_RECAP"),
    "earlier eligible scenes remain recallable across POV cutoffs",
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
    maxContext: 16_384,
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
    undefined,
    "a manual cutoff does not create a parallel automatic flag",
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
    undefined,
    "temporary open-scene trimming cannot move a persistent New Start to the latest message",
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
  assert.equal((await memory.status(chat.id)).job.contextStarts, undefined);
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
  assert.doesNotMatch(
    movedStart.chatSummary ?? "",
    /OVERLAPPING_CORRECTION/,
    "a constant crossing the live cutoff is omitted until its entire range is archived",
  );
  assert.doesNotMatch(movedStart.chatSummary ?? "", /LIVE_CORRECTION/, "fully live ranges need no constant summary");
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
    null,
    "removing the cutoff omits constants whose messages are live again",
  );
  assert(
    JSON.parse((await chats.getById(chat.id))!.metadata).summaryEntries.every(
      (entry: { enabled: boolean }) => entry.enabled,
    ),
    "prompt omission does not disable the saved summaries",
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
