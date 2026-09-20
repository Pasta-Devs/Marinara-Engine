import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { createRequire } from "node:module";

const directory = mkdtempSync(join(tmpdir(), "marinara-advanced-memory-core-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

const requests: Array<{ kind: string; text: string }> = [];
let beforeSummary: (() => Promise<void>) | null = null;
let sceneFinishReason = "stop";
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString()) as {
    input?: string | string[];
    messages?: Array<{ content: string }>;
  };
  response.setHeader("Content-Type", "application/json");
  if (request.url?.endsWith("/embeddings")) {
    const input = Array.isArray(body.input) ? body.input : [body.input ?? ""];
    requests.push({ kind: "embedding", text: input.join("\n") });
    response.end(
      JSON.stringify({
        data: input.map((text, index) => ({ index, embedding: [1, text.includes("compass") ? 1 : 0, 0.5] })),
      }),
    );
    return;
  }
  const messages = body.messages ?? [];
  const text = messages.map((message) => message.content).join("\n");
  const classification = messages[0]?.content.startsWith("Identify scene transitions") === true;
  requests.push({ kind: classification ? "classify" : "summary", text });
  let content: string;
  if (classification) {
    const source = JSON.parse(messages[1]!.content) as Array<{ messageId: string; content: string }>;
    content = JSON.stringify({
      starts: source
        .filter((message) => message.content.startsWith("SCENE_CHANGE"))
        .map((message) => ({ messageId: message.messageId })),
    });
  } else {
    const callback = beforeSummary;
    beforeSummary = null;
    if (callback) await callback();
    content = JSON.stringify({
      summary: text.includes("CORRECTED_SILVER")
        ? "CORRECTED_SILVER compass."
        : text.includes("CORRECTED_GOLD")
          ? "CORRECTED_GOLD compass."
          : "A previous compass promise matters.",
      title: "Journey",
    });
  }
  response.end(
    JSON.stringify({
      id: "memory-proof",
      object: "chat.completion",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: classification ? sceneFinishReason : "stop",
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 },
    }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}/v1`;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { createConnectionSchema } = await import("../../packages/shared/src/schemas/connection.schema.ts");
const { DEFAULT_ADVANCED_MEMORY_SETTINGS } = await import("../../packages/shared/src/types/advanced-memory.ts");
const db = await createFileNativeDB();
const { advancedMemoryRecords } = await import("../../packages/server/src/db/schema/advanced-memory.ts");
const fullRecordReads = new Map<string, number>();
const select = db.select.bind(db);
db.select = ((...args: unknown[]) => {
  const query = (select as (...args: unknown[]) => any)(...args);
  const from = query.from.bind(query);
  query.from = (table: unknown) => {
    const builder = from(table);
    if (table === advancedMemoryRecords) {
      const where = builder.where.bind(builder);
      builder.where = (condition: { left?: unknown; right?: unknown }) => {
        if (condition.left === advancedMemoryRecords.chatId && typeof condition.right === "string")
          fullRecordReads.set(condition.right, (fullRecordReads.get(condition.right) ?? 0) + 1);
        return where(condition);
      };
    }
    return builder;
  };
  return query;
}) as typeof db.select;
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
try {
  const connection = await createConnectionsStorage(db).create(
    createConnectionSchema.parse({
      name: "Memory proof",
      provider: "openai",
      model: "gpt-4o-mini",
      baseUrl,
      apiKey: "test-key",
      maxContext: 4096,
      defaultForAgents: true,
      embeddingBaseUrl: baseUrl,
      embeddingModel: "memory-proof",
      treatAsLocalEndpoint: true,
    }),
  );
  const chat = await chats.create({
    name: "800-message proof",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection!.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 4096,
      summaryBudgetTokens: 512,
    },
  });
  await chats.createMessagesBatch(
    chat.id,
    Array.from({ length: 800 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content: `${index === 0 ? "Date: Spring 14\n" : index === 400 ? "SCENE_CHANGE\nDate: Spring 15\n" : ""}Message ${index}: the compass promise continues along the road.`,
    })),
  );
  const source = await chats.listMessages(chat.id);
  const controller = new AbortController();
  await assert.rejects(
    memory.initialize(chat.id, {
      signal: controller.signal,
      onProgress: (event) => {
        if (event.stage === "classifying" && event.completed > 0) controller.abort(new Error("pause proof"));
      },
    }),
  );
  const classifiedBeforeResume = requests.filter((request) => request.kind === "classify").length;
  assert.equal(classifiedBeforeResume, 1);
  await memory.initialize(chat.id);
  const resumedFirst = requests.filter((request) => request.kind === "classify")[classifiedBeforeResume]!;
  assert(!resumedFirst.text.includes('"content":"Message 0:'), "resume uses the durable classification checkpoint");
  assert.equal((await memory.status(chat.id)).job.status, "ready");
  assert(
    (fullRecordReads.get(chat.id) ?? 0) <= 8,
    "initializing 800 messages reads the archive only a bounded number of times",
  );

  const settledRequests = requests.length;
  await memory.initialize(chat.id);
  assert.equal(requests.length, settledRequests, "unchanged messages reuse summaries and vectors");
  const readonly = await memory.prepare({
    chatId: chat.id,
    messages: source,
    audienceCharacterIds: [],
    budgetTokens: 50_000,
    readOnly: true,
  });
  assert.equal(requests.length, settledRequests, "preview makes no provider or embedding call");
  assert.equal(readonly.messageIds.length, 800);
  const prepared = await memory.prepare({
    chatId: chat.id,
    messages: source,
    audienceCharacterIds: [],
    budgetTokens: 1200,
  });
  assert(prepared.currentSceneSummary, "a large ongoing scene gets a temporary prefix summary");
  assert(prepared.chatSummary?.includes("source timeframe (summary corrections take precedence): Spring 14"));
  assert(prepared.currentSceneSummary.includes("story timeframe: Spring 15"));
  assert(prepared.chatSummary.includes("Messages #1–#400"), "continuity retains canonical chronology");
  assert(prepared.messageIds.includes(source.at(-1)!.id), "the latest message remains exact history");
  assert(prepared.receipt.estimatedTokensAfter <= 1200);
  await memory.validatePrepared(chat.id, source, prepared.receipt);
  assert(
    (await memory.status(chat.id)).records.some((record) => record.kind === "scene" && record.status === "open"),
    "prefix compression leaves the scene open",
  );

  assert(prepared.receipt.checkpointId);
  const originalCheckpointId = prepared.receipt.checkpointId;
  const oversizedCorrection = "CORRECTED_GOLD compass. ".repeat(500);
  await memory.updateRecord(chat.id, originalCheckpointId, { content: oversizedCorrection });
  const compactedCorrection = await memory.prepare({
    chatId: chat.id,
    messages: source,
    audienceCharacterIds: [],
    budgetTokens: 1200,
  });
  assert(
    compactedCorrection.chatSummary?.includes("CORRECTED_GOLD"),
    "oversized user correction supplies the derived summary",
  );
  assert.notEqual(compactedCorrection.receipt.checkpointId, originalCheckpointId);
  assert.equal(
    (await memory.status(chat.id)).records.find((record) => record.id === originalCheckpointId)?.content,
    oversizedCorrection.trim(),
    "the original user edit is preserved exactly",
  );
  const beforeCachedCorrection = requests.length;
  await memory.prepare({
    chatId: chat.id,
    messages: source,
    audienceCharacterIds: [],
    budgetTokens: 1200,
    readOnly: true,
  });
  assert.equal(requests.length, beforeCachedCorrection, "derived correction is reusable in read-only preparation");
  await memory.updateRecord(chat.id, originalCheckpointId, { enabled: false });
  const disabledCorrection = await memory.prepare({
    chatId: chat.id,
    messages: source,
    audienceCharacterIds: [],
    budgetTokens: 1200,
  });
  assert(
    !disabledCorrection.chatSummary?.includes("CORRECTED_GOLD"),
    "disabled correction is excluded from rebuilt required continuity",
  );
  assert.notEqual(disabledCorrection.receipt.checkpointId, originalCheckpointId);
  assert.equal(
    (await memory.status(chat.id)).records.find((record) => record.id === originalCheckpointId)?.enabled,
    false,
  );
  await memory.validatePrepared(chat.id, source, disabledCorrection.receipt);
  const temporaryOriginal = (await memory.status(chat.id)).records.find(
    (record) => record.kind === "temporary" && record.id in disabledCorrection.receipt.recordRevisions,
  );
  assert(temporaryOriginal);
  await memory.updateRecord(chat.id, temporaryOriginal.id, { content: oversizedCorrection });
  const temporaryCorrected = await memory.prepare({
    chatId: chat.id,
    messages: source,
    audienceCharacterIds: [],
    budgetTokens: 1200,
  });
  assert(
    temporaryCorrected.currentSceneSummary?.includes("CORRECTED_GOLD"),
    "oversized open-scene corrections supply a smaller derivative",
  );
  assert.equal(
    (await memory.status(chat.id)).records.find((record) => record.id === temporaryOriginal.id)?.content,
    oversizedCorrection.trim(),
  );
  await memory.updateRecord(chat.id, temporaryOriginal.id, { enabled: false });
  const temporaryDisabled = await memory.prepare({
    chatId: chat.id,
    messages: source,
    audienceCharacterIds: [],
    budgetTokens: 1200,
  });
  assert(
    !temporaryDisabled.currentSceneSummary?.includes("CORRECTED_GOLD"),
    "a disabled temporary correction is not silently injected",
  );
  assert.equal(
    (await memory.status(chat.id)).records.find((record) => record.id === temporaryOriginal.id)?.enabled,
    false,
  );
  await memory.validatePrepared(chat.id, source, temporaryDisabled.receipt);

  const historicalSource = source.slice(0, 80);
  const historicalStart = requests.length;
  const historical = await memory.prepare({
    chatId: chat.id,
    messages: historicalSource,
    audienceCharacterIds: [],
    budgetTokens: 900,
  });
  assert(
    !requests.slice(historicalStart).some((request) => request.text.includes("Message 799:")),
    "historical summaries never consume future messages",
  );
  await memory.validatePrepared(chat.id, historicalSource, historical.receipt);

  await chats.patchMetadata(chat.id, {
    macroVariables: { material: "CORRECTED_GOLD" },
    summaryEntries: [
      {
        id: "correction",
        kind: "rolling",
        origin: "manual",
        content: "{{getvar::material}} compass",
        enabled: true,
        title: "Correction",
        sourceMode: "range",
        messageIds: source.slice(0, 10).map((message) => message.id),
        rangeStartIndex: 1,
        rangeEndIndex: 10,
        tokenEstimate: 6,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
  const corrected = await memory.prepare({
    chatId: chat.id,
    messages: source,
    audienceCharacterIds: [],
    budgetTokens: 1400,
  });
  assert(
    corrected.chatSummary?.includes("CORRECTED_GOLD"),
    "user corrections contribute to the sole continuity summary",
  );
  await assert.rejects(
    memory.validatePrepared(chat.id, source, prepared.receipt),
    /summary corrections|memory changed/iu,
  );
  await chats.patchMetadata(chat.id, { macroVariables: { material: "CORRECTED_SILVER" } });
  const revisedVariable = await memory.prepare({
    chatId: chat.id,
    messages: source,
    audienceCharacterIds: [],
    budgetTokens: 1400,
  });
  assert(
    revisedVariable.chatSummary?.includes("CORRECTED_SILVER"),
    "manual summary variables resolve and invalidate cached derived text when changed",
  );
  await assert.rejects(
    memory.validatePrepared(chat.id, source, corrected.receipt),
    /summary corrections|memory changed/iu,
  );
  await chats.updateMessageContent(source[0]!.id, "Edited promise.");
  await assert.rejects(
    memory.prepare({
      chatId: chat.id,
      messages: source,
      audienceCharacterIds: [],
      budgetTokens: 50_000,
      readOnly: true,
    }),
    /history changed/iu,
  );

  const privateChat = await chats.create({
    name: "Audience proof",
    mode: "roleplay",
    characterIds: ["alice", "bob", "narrator"],
    connectionId: connection!.id,
  });
  assert(privateChat);
  await chats.createMessagesBatch(
    privateChat.id,
    Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content: `${index === 6 ? "SCENE_CHANGE " : ""}${index < 6 ? "PRIVATE_SECRET" : "Shared road"} turn ${index}`,
    })),
  );
  const privateSource = await chats.listMessages(privateChat.id);
  await chats.patchMetadata(privateChat.id, {
    groupChatMode: "individual",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 4096,
      summaryBudgetTokens: 512,
      narratorCharacterId: "narrator",
      knowledgeStarts: { alice: null, bob: privateSource[6]!.id },
      knowledgeConfirmed: true,
    },
  });
  await memory.initialize(privateChat.id);
  const bob = await memory.prepare({
    chatId: privateChat.id,
    messages: privateSource,
    audienceCharacterIds: ["bob"],
    budgetTokens: 3000,
    readOnly: true,
  });
  assert(
    bob.messageIds.every((id) => privateSource.slice(6).some((message) => message.id === id)),
    "late joiner sees only permitted source history",
  );
  const narrator = await memory.prepare({
    chatId: privateChat.id,
    messages: privateSource,
    audienceCharacterIds: ["narrator"],
    budgetTokens: 3000,
    readOnly: true,
  });
  assert(narrator.messageIds.includes(privateSource[0]!.id));
  const beforeHistoricalPolicy = privateSource.slice(0, 4);
  await chats.updateMessageExtra(privateSource[10]!.id, { conversationStartForCharacterIds: ["alice"] });
  const alicePast = await memory.prepare({
    chatId: privateChat.id,
    messages: beforeHistoricalPolicy,
    audienceCharacterIds: ["alice"],
    budgetTokens: 3000,
  });
  await memory.validatePrepared(privateChat.id, beforeHistoricalPolicy, alicePast.receipt);

  const recallChat = await chats.create({
    name: "Exact recall proof",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection!.id,
  });
  assert(recallChat);
  await chats.patchMetadata(recallChat.id, {
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 4096,
      summaryBudgetTokens: 256,
      retrieveMinMessages: 1,
      retrieveMaxMessages: 3,
    },
  });
  await chats.createMessagesBatch(
    recallChat.id,
    Array.from({ length: 60 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content:
        index === 5
          ? "Date: Spring 14\nLuna promised to return the silver compass on Sunday."
          : index === 25
            ? "The following morning, Luna corrected the promise: the silver compass returns on Tuesday, never Sunday."
            : index >= 56
              ? "What was Luna's promise about the silver compass and its later correction?"
              : `${index === 40 ? "SCENE_CHANGE " : ""}The cartographer studied ancient maps and measured every mountain ridge carefully along the long winding road.`,
    })),
  );
  const recallSource = await chats.listMessages(recallChat.id);
  const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
  const gameStates = createGameStateStorage(db);
  const { characterTrackerLockKey } = await import("../../packages/shared/src/utils/tracker-field-locks.ts");
  const hiddenNpc = {
    characterId: "",
    name: "HIDDEN_NPC_NAME",
    emoji: "",
    mood: "neutral",
    appearance: null,
    outfit: null,
    thoughts: null,
    stats: [],
    customFields: {},
  };
  const trackerBase = {
    chatId: recallChat.id,
    swipeIndex: 0,
    date: "Spring 14",
    time: "Noon",
    location: "Committed Map Room",
    weather: null,
    temperature: null,
    presentCharacters: [
      {
        characterId: "luna",
        name: "Luna",
        emoji: "",
        mood: "compass",
        appearance: null,
        outfit: null,
        thoughts: "TRACKER_SECRET_NEVER_INCLUDE",
        stats: [],
        customFields: { relationship: "compass promise" },
      },
    ],
    recentEvents: [],
    playerStats: null,
    personaStats: null,
    committed: true,
    hiddenTrackerFields: { [characterTrackerLockKey(hiddenNpc, 1, "name")]: true },
  };
  trackerBase.presentCharacters.push(hiddenNpc);
  await gameStates.create({ ...trackerBase, messageId: recallSource[5]!.id });
  await gameStates.create({
    ...trackerBase,
    messageId: recallSource[57]!.id,
    location: "UNCOMMITTED_FORBIDDEN",
    committed: false,
  });
  await gameStates.create({ ...trackerBase, messageId: recallSource[58]!.id });
  const trackerRequests = requests.length;
  await memory.initialize(recallChat.id);
  const trackedClassification = requests
    .slice(trackerRequests)
    .filter((request) => request.kind === "classify")
    .map((request) => request.text)
    .join("\n");
  assert(trackedClassification.includes("Committed Map Room"), "classifier can reuse bounded committed scene hints");
  assert(
    !trackedClassification.includes("HIDDEN_NPC_NAME"),
    "explicitly hidden NPC presence names never reach classification",
  );
  assert(
    !trackedClassification.includes("UNCOMMITTED_FORBIDDEN") &&
      !trackedClassification.includes("TRACKER_SECRET_NEVER_INCLUDE"),
    "uncommitted tracker state and private thoughts are never classification hints",
  );

  await memory.prepare({ chatId: recallChat.id, messages: recallSource, audienceCharacterIds: [], budgetTokens: 1800 });
  const beforeLexical = requests.length;
  const exactRecall = await memory.prepare({
    chatId: recallChat.id,
    messages: recallSource,
    audienceCharacterIds: [],
    budgetTokens: 1800,
    readOnly: true,
  });
  assert.equal(requests.length, beforeLexical);

  assert(exactRecall.recalledRecordIds.length > 0);
  assert(
    exactRecall.recalledRecordIds.every(
      (id) => id in exactRecall.receipt.recordRevisions && id !== exactRecall.receipt.checkpointId,
    ),
    "optional recall exposes actual persisted record IDs separately from mandatory summary revisions",
  );
  assert(
    exactRecall.recalledMessages?.includes("returns on Tuesday"),
    "lexical recall includes the later correction exactly",
  );
  assert.equal(exactRecall.receipt.recalledMessageIds.length, 3, "the scene contributes one bounded excerpt");
  assert.equal(exactRecall.recalledScenes, null, "the scene recap stays paired with its excerpt");
  assert(exactRecall.recalledMessages?.includes("story timeframe: Spring 14 → The following morning"));
  assert(exactRecall.recalledMessages.includes("story timeframe: The following morning"));
  assert(exactRecall.recalledMessages.includes("Excerpt:\nMessages #25–#27"));
  const { estimateChatSummaryTokens } = await import("../../packages/shared/src/index.ts");
  assert(
    estimateChatSummaryTokens(exactRecall.chatSummary ?? "") <= 256,
    "the entire constant summary, including timeframe labels, respects its configured maximum",
  );
  const { eq: timelineEq } = await import("../../packages/server/src/db/file-query.ts");
  await db
    .update(advancedMemoryRecords)
    .set({ timeline: null })
    .where(timelineEq(advancedMemoryRecords.chatId, recallChat.id));
  const beforeLegacyTimeline = requests.length;
  const legacyTimeline = await memory.prepare({
    chatId: recallChat.id,
    messages: recallSource,
    audienceCharacterIds: [],
    budgetTokens: 1800,
    readOnly: true,
  });
  assert(
    legacyTimeline.recalledMessages?.includes("Spring 14 → The following morning"),
    "legacy archives recover known timeframes from validated source IDs",
  );
  assert(
    (await memory.status(recallChat.id)).records.some((record) => record.timeline?.includes("Spring 14")),
    "legacy inspector timelines use the same fallback",
  );
  assert.equal(requests.length, beforeLegacyTimeline, "legacy timeline recovery makes no model or embedding calls");

  const excerptRecords = (await memory.status(recallChat.id)).records.filter((record) => record.kind === "excerpt");
  assert(excerptRecords.length > 0, "zero limits are tested with an existing excerpt archive");
  for (const record of excerptRecords) {
    assert.equal(record.startIndex, recallSource.findIndex((message) => message.id === record.messageIds[0]) + 1);
    assert.equal(record.endIndex, recallSource.findIndex((message) => message.id === record.messageIds.at(-1)) + 1);
  }
  const fullScene = (await memory.status(recallChat.id)).records.find(
    (record) => record.kind === "scene" && record.status === "closed",
  );
  assert(fullScene);
  assert.equal(fullScene.startIndex, recallSource.findIndex((message) => message.id === fullScene.startMessageId) + 1);
  assert.equal(fullScene.endIndex, recallSource.findIndex((message) => message.id === fullScene.endMessageId) + 1);
  await memory.updateSettings(recallChat.id, { retrieveMinMessages: 0, retrieveMaxMessages: 0 });
  await assert.rejects(
    memory.validatePrepared(recallChat.id, recallSource, exactRecall.receipt),
    /settings or summary corrections changed/,
    "a previously prepared prompt cannot keep cached excerpts after disabling recall",
  );
  const noExcerpts = await memory.prepare({
    chatId: recallChat.id,
    messages: recallSource,
    audienceCharacterIds: [],
    budgetTokens: 1800,
    readOnly: true,
  });
  assert.equal(noExcerpts.recalledMessages, null);
  assert.deepEqual(noExcerpts.receipt.recalledMessageIds, []);
  assert.equal(noExcerpts.chatSummary, exactRecall.chatSummary, "zero excerpt limits preserve required continuity");
  assert.equal(noExcerpts.currentSceneSummary, exactRecall.currentSceneSummary);
  assert(noExcerpts.recalledScenes, "zero excerpt limits still permit relevant scene recall");
  assert(
    excerptRecords.every(
      (record) =>
        !noExcerpts.recalledRecordIds.includes(record.id) && !(record.id in noExcerpts.receipt.recordRevisions),
    ),
    "disabled excerpt recall contributes no cached record dependencies",
  );
  const { createAdvancedMemoryPlacement, resolveAdvancedMemoryPrompt } =
    await import("../../packages/server/src/services/prompt/advanced-memory-prompt.js");
  for (const format of ["xml", "markdown", "none"] as const) {
    const placements = [
      createAdvancedMemoryPlacement("chat_summary", format),
      createAdvancedMemoryPlacement("recalled_scenes", format),
      createAdvancedMemoryPlacement("recalled_messages", format),
    ];
    const messages = [{ role: "system", content: placements.map((placement) => placement.token).join("\n") }];
    const withoutExcerpts = resolveAdvancedMemoryPrompt(messages, placements, noExcerpts)
      .map((message) => message.content)
      .join("\n");
    assert.doesNotMatch(withoutExcerpts, /Below is a small excerpt|Recalled Messages|recalled_messages/);
    assert.match(withoutExcerpts, /Below is a summary|Included below are recalled memories/);
    assert.match(
      resolveAdvancedMemoryPrompt(messages, placements, exactRecall)
        .map((message) => message.content)
        .join("\n"),
      /Excerpt:\s+Messages #/,
      "nonzero limits retain historical excerpt prompt placement",
    );
  }
  await memory.updateSettings(recallChat.id, { retrieveMinMessages: 0, retrieveMaxMessages: 3 });
  const optionalExcerpts = await memory.prepare({
    chatId: recallChat.id,
    messages: recallSource,
    audienceCharacterIds: [],
    budgetTokens: 1800,
    readOnly: true,
  });
  assert(optionalExcerpts.recalledMessages?.includes("returns on Tuesday"), "0/N can still recall relevant excerpts");
  assert(optionalExcerpts.receipt.recalledMessageIds.length > 0);
  assert.deepEqual(
    (await memory.status(recallChat.id)).records.filter((record) => record.kind === "excerpt"),
    excerptRecords,
    "changing excerpt limits does not delete or rewrite archived records",
  );
  for (const message of recallSource.slice(-4))
    await chats.updateMessageContent(message.id, "What is the temperature and pressure inside Jupiter's atmosphere?");
  const unrelatedSource = await chats.listMessages(recallChat.id);
  // Refresh only source-derived mandatory preparation before observing the pure lexical path.
  await memory.prepare({
    chatId: recallChat.id,
    messages: unrelatedSource,
    audienceCharacterIds: [],
    budgetTokens: 1800,
  });
  const beforeUnrelated = requests.length;
  const unrelated = await memory.prepare({
    chatId: recallChat.id,
    messages: unrelatedSource,
    audienceCharacterIds: [],
    budgetTokens: 1800,
    readOnly: true,
  });
  assert.equal(requests.length, beforeUnrelated);
  assert.equal(unrelated.recalledScenes, null, "common words alone do not recall unrelated scenes");
  assert.equal(unrelated.recalledMessages, null, "common words alone do not recall unrelated source messages");
  assert(unrelated.receipt.reasons.includes("no-relevant-recall"));
  await memory.updateSettings(recallChat.id, { retrieveMinMessages: 1, retrieveMaxMessages: 3 });

  const resumeChat = await chats.create({
    name: "Paid summary resume",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection!.id,
  });
  assert(resumeChat);
  await chats.patchMetadata(resumeChat.id, {
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 4096,
      summaryBudgetTokens: 512,
    },
  });
  await chats.createMessagesBatch(
    resumeChat.id,
    Array.from({ length: 500 }, (_, index) => ({
      role: "user" as const,
      content: `${index === 450 ? "SCENE_CHANGE " : ""}Paid batch message ${index}: a compass promise across the mountains.`,
    })),
  );
  const summaryController = new AbortController();
  const summaryResumeStart = requests.length;
  await assert.rejects(
    memory.initialize(resumeChat.id, {
      signal: summaryController.signal,
      onProgress: (event) => {
        if (event.stage === "summarizing" && event.completed === 1 && event.total > 1)
          summaryController.abort(new Error("pause paid summary"));
      },
    }),
  );
  const paidBatch = requests.slice(summaryResumeStart).find((request) => request.kind === "summary");
  assert(paidBatch);
  assert(
    !(await memory.status(resumeChat.id)).records.some((record) => record.kind === "scene" && record.content),
    "partial summaries remain private work",
  );
  await memory.initialize(resumeChat.id);
  assert.equal(
    requests
      .slice(summaryResumeStart)
      .filter((request) => request.kind === "summary" && request.text === paidBatch.text).length,
    1,
    "resume never repeats the completed paid summary batch",
  );

  const resumeSource = await chats.listMessages(resumeChat.id);
  const resumePrepared = await memory.prepare({
    chatId: resumeChat.id,
    messages: resumeSource,
    audienceCharacterIds: [],
    budgetTokens: 1000,
  });
  assert(resumePrepared.receipt.checkpointId && resumePrepared.currentSceneSummary);
  await memory.updateRecord(resumeChat.id, resumePrepared.receipt.checkpointId, {
    content: "IMPORTED_CONTINUITY_CORRECTION",
  });
  const memoryExport = await memory.exportMemory(resumeChat.id);
  const importChat = await chats.create({
    name: "Standalone memory identity",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection!.id,
  });
  assert(importChat);
  await chats.patchMetadata(importChat.id, {
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 4096,
      summaryBudgetTokens: 512,
    },
  });
  await chats.createMessagesBatch(
    importChat.id,
    resumeSource.map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
  );
  const importSource = await chats.listMessages(importChat.id);
  const readsBeforeImport = fullRecordReads.get(importChat.id) ?? 0;
  const importedMemory = await memory.importMemory(importChat.id, memoryExport);
  assert(importedMemory.imported > 100);
  assert(
    (fullRecordReads.get(importChat.id) ?? 0) - readsBeforeImport <= 4,
    "standalone import reuses one archive snapshot across records",
  );
  const importedContinuity = importedMemory.records.find(
    (record) => record.kind === "continuity" && record.content === "IMPORTED_CONTINUITY_CORRECTION",
  );
  assert(
    importedContinuity && importedContinuity.sceneId === `continuity-${importSource[449]!.id}`,
    "continuity import keeps its actual boundary anchor rather than the record's first source message",
  );
  assert(
    importedMemory.records.some(
      (record) => record.kind === "temporary" && record.sceneId === `temporary-${importSource[449]!.id}`,
    ),
  );
  const importedPrepared = await memory.prepare({
    chatId: importChat.id,
    messages: importSource,
    audienceCharacterIds: [],
    budgetTokens: 1000,
  });
  assert(importedPrepared.chatSummary?.endsWith("\nIMPORTED_CONTINUITY_CORRECTION"));
  assert(
    importedPrepared.chatSummary.includes(
      "source timeframe (summary corrections take precedence): unknown (use message order)",
    ),
  );
  assert.equal(
    importedPrepared.receipt.checkpointId,
    importedContinuity.id,
    "preparation reuses the imported correction without a duplicate checkpoint",
  );
  assert.equal(
    (await memory.importMemory(importChat.id, memoryExport)).imported,
    0,
    "repeat import preserves local identities and edits",
  );

  const { eq } = await import("../../packages/server/src/db/file-query.ts");
  await db.delete(advancedMemoryRecords).where(eq(advancedMemoryRecords.id, importedContinuity.id));
  const reorderedExport = {
    ...memoryExport,
    records: [...memoryExport.records].sort(
      (left, right) => Number(right.record.kind === "continuity") - Number(left.record.kind === "continuity"),
    ),
  };
  assert.equal((await memory.importMemory(importChat.id, reorderedExport)).imported, 1);
  const reorderedPrepared = await memory.prepare({
    chatId: importChat.id,
    messages: importSource,
    audienceCharacterIds: [],
    budgetTokens: 1000,
  });
  assert(
    reorderedPrepared.chatSummary?.endsWith("\nIMPORTED_CONTINUITY_CORRECTION"),
    "an imported dependent before duplicate sources resolves their final local IDs",
  );

  const dependencySource = await chats.create({
    name: "Standalone dependency source",
    mode: "roleplay",
    characterIds: ["alice"],
    connectionId: connection!.id,
  });
  assert(dependencySource);
  await chats.createMessagesBatch(
    dependencySource.id,
    Array.from({ length: 4 }, (_, index) => ({
      role: "user" as const,
      content: `${index === 3 ? "SCENE_CHANGE " : ""}Dependency source turn ${index}: the compass promise.`,
      extra: index === 3 ? { isConversationStart: true } : undefined,
    })),
  );
  const dependencyMessages = await chats.listMessages(dependencySource.id);
  const dependencySettings = {
    ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
    enabled: true,
    maxContextTokens: 4096,
    summaryBudgetTokens: 512,
    knowledgeStarts: { alice: null },
  };
  await chats.patchMetadata(dependencySource.id, {
    groupChatMode: "individual",
    advancedMemory: dependencySettings,
    summaryEntries: [
      {
        id: "required-manual-summary",
        kind: "rolling",
        origin: "manual",
        content: "CORRECTED_GOLD compass",
        enabled: true,
        title: "Required correction",
        sourceMode: "range",
        messageIds: dependencyMessages.slice(0, 2).map((message) => message.id),
        rangeStartIndex: 1,
        rangeEndIndex: 2,
        tokenEstimate: 6,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
  await memory.initialize(dependencySource.id);
  const sourceManualScene = (await memory.status(dependencySource.id)).records.find(
    (record) => record.kind === "scene" && record.content && !record.audienceCharacterIds.length,
  );
  assert(sourceManualScene);
  await memory.updateRecord(dependencySource.id, sourceManualScene.id, {
    content: "IMPORTED_DISABLED_SCENE_CORRECTION",
  });
  const dependencyPrepared = await memory.prepare({
    chatId: dependencySource.id,
    messages: dependencyMessages,
    audienceCharacterIds: [],
    audienceMode: "owner",
    budgetTokens: 3000,
  });
  assert(dependencyPrepared.receipt.checkpointId);
  await memory.updateRecord(dependencySource.id, dependencyPrepared.receipt.checkpointId, {
    content: "IMPORTED_MISSING_SUMMARY_CORRECTION",
  });
  const dependencyExport = await memory.exportMemory(dependencySource.id);
  const exportedDependency = dependencyExport.records.find(
    (entry) => entry.record.id === dependencyPrepared.receipt.checkpointId,
  );
  assert(
    exportedDependency?.valid &&
      exportedDependency.record.dependencies.some((dependency) => dependency.id === "summary:required-manual-summary"),
  );

  const dependencyTarget = await chats.create({
    name: "Standalone dependency target",
    mode: "roleplay",
    characterIds: ["alice"],
    connectionId: connection!.id,
  });
  assert(dependencyTarget);
  await chats.createMessagesBatch(
    dependencyTarget.id,
    dependencyMessages.map((message) => ({ role: "user" as const, content: message.content })),
  );
  const targetMessages = await chats.listMessages(dependencyTarget.id);
  await chats.patchMetadata(dependencyTarget.id, {
    groupChatMode: "individual",
    advancedMemory: { ...dependencySettings, knowledgeStarts: { alice: targetMessages[2]!.id } },
  });
  await memory.initialize(dependencyTarget.id);
  const localScene = (await memory.status(dependencyTarget.id)).records.find(
    (record) => record.kind === "scene" && record.content && !record.audienceCharacterIds.length,
  );
  assert(localScene);
  await memory.updateRecord(dependencyTarget.id, localScene.id, {
    content: "LOCAL_CORRECTION_UNCHANGED",
    enabled: false,
  });
  const beforeImportMetadata = (await chats.getById(dependencyTarget.id))!.metadata;
  const importWithMissingDependencies = {
    ...dependencyExport,
    records: [
      ...dependencyExport.records,
      {
        ...exportedDependency,
        record: {
          ...exportedDependency.record,
          id: "valid-import-control",
          kind: "temporary",
          sceneId: `temporary-${dependencyMessages[1]!.id}`,
          audienceCharacterIds: [],
          content: "VALID_IMPORTED_CONTROL",
          dependencies: [],
        },
      },
      {
        ...exportedDependency,
        record: {
          ...exportedDependency.record,
          id: "missing-record-control",
          kind: "continuity",
          sceneId: `continuity-${dependencyMessages[1]!.id}`,
          audienceCharacterIds: [],
          content: "MISSING_RECORD_CORRECTION",
          dependencies: [{ id: "record:unavailable-record", revision: "unknown" }],
        },
      },
      {
        ...exportedDependency,
        record: {
          ...exportedDependency.record,
          id: "macro-control",
          kind: "temporary",
          sceneId: `temporary-${dependencyMessages[2]!.id}`,
          audienceCharacterIds: [],
          content: "INCOMPATIBLE_MACRO_CORRECTION",
          dependencies: [{ id: "macro-variables", revision: "not-the-target-variables" }],
        },
      },
    ],
  };
  const dependencyImport = await memory.importMemory(dependencyTarget.id, importWithMissingDependencies);
  for (const content of [
    "IMPORTED_MISSING_SUMMARY_CORRECTION",
    "MISSING_RECORD_CORRECTION",
    "INCOMPATIBLE_MACRO_CORRECTION",
  ]) {
    const imported = dependencyImport.records.find((record) => record.content === content);
    assert(
      imported && !imported.enabled,
      `${content} remains inspectable but disabled without its source dependencies`,
    );
  }
  assert(
    dependencyImport.records.some(
      (record) =>
        record.kind === "excerpt" &&
        record.audienceCharacterIds.includes("alice") &&
        record.messageIds.includes(targetMessages[0]!.id) &&
        !record.enabled,
    ),
    "an imported excerpt outside current character knowledge is disabled",
  );
  assert(
    dependencyImport.records.some(
      (record) => record.kind === "excerpt" && !record.audienceCharacterIds.length && record.enabled,
    ),
    "valid imported source records stay enabled",
  );
  assert(
    dependencyImport.records.some((record) => record.content === "VALID_IMPORTED_CONTROL" && record.enabled),
    "a newly inserted compatible memory stays enabled",
  );
  const retainedLocal = dependencyImport.records.find((record) => record.id === localScene.id);
  assert.equal(retainedLocal?.content, "LOCAL_CORRECTION_UNCHANGED");
  assert.equal(retainedLocal?.enabled, false);
  assert.equal(
    (await chats.getById(dependencyTarget.id))!.metadata,
    beforeImportMetadata,
    "standalone memory import does not change target metadata authority",
  );

  const maintenanceTarget = await chats.create({
    name: "Disabled import maintenance",
    mode: "roleplay",
    characterIds: ["alice"],
    connectionId: connection!.id,
  });
  assert(maintenanceTarget);
  await chats.createMessagesBatch(
    maintenanceTarget.id,
    dependencyMessages.map((message) => ({ role: "user" as const, content: message.content })),
  );
  await chats.patchMetadata(maintenanceTarget.id, { groupChatMode: "individual", advancedMemory: dependencySettings });
  const maintenanceImport = await memory.importMemory(maintenanceTarget.id, dependencyExport);
  const disabledImportedScene = maintenanceImport.records.find(
    (record) => record.content === "IMPORTED_DISABLED_SCENE_CORRECTION",
  );
  assert(disabledImportedScene && !disabledImportedScene.enabled && disabledImportedScene.manualOverride);
  await memory.initialize(maintenanceTarget.id);
  const maintenanceStatus = await memory.status(maintenanceTarget.id);
  assert.equal(
    maintenanceStatus.job.status,
    "ready",
    "disabled unsupported manual imports do not block initialization",
  );
  assert.deepEqual(
    maintenanceStatus.records.find((record) => record.id === disabledImportedScene.id),
    disabledImportedScene,
    "maintenance preserves the disabled correction for inspection",
  );
  const maintainedPrompt = await memory.prepare({
    chatId: maintenanceTarget.id,
    messages: await chats.listMessages(maintenanceTarget.id),
    audienceCharacterIds: [],
    audienceMode: "owner",
    budgetTokens: 1000,
  });
  assert(
    ![
      maintainedPrompt.chatSummary,
      maintainedPrompt.currentSceneSummary,
      maintainedPrompt.recalledScenes,
      maintainedPrompt.recalledMessages,
    ].some((part) => part?.includes("IMPORTED_DISABLED_SCENE_CORRECTION")),
    "disabled correction text remains excluded from generation",
  );
  await memory.updateRecord(maintenanceTarget.id, disabledImportedScene.id, { enabled: true });
  await assert.rejects(
    memory.initialize(maintenanceTarget.id),
    /manually corrected memory.*changed source messages/iu,
    "enabled stale manual corrections still require explicit review",
  );
  assert.equal(
    (await memory.status(maintenanceTarget.id)).records.find((record) => record.id === disabledImportedScene.id)
      ?.content,
    "IMPORTED_DISABLED_SCENE_CORRECTION",
  );

  await memory.updateRecord(maintenanceTarget.id, disabledImportedScene.id, { enabled: false });
  const editedExcerpt = (await memory.status(maintenanceTarget.id)).records.find(
    (record) => record.kind === "excerpt" && !record.audienceCharacterIds.length && record.messageIds.length === 3,
  );
  assert(editedExcerpt);
  await memory.updateRecord(maintenanceTarget.id, editedExcerpt.id, {
    content: "DISABLED_EXCERPT_CORRECTION",
    enabled: false,
  });
  await chats.updateMessageContent(
    editedExcerpt.messageIds[0]!,
    "The source promise changed after editing this excerpt.",
  );
  const beforeExcerptMaintenance = (await memory.status(maintenanceTarget.id)).records.find(
    (record) => record.id === editedExcerpt.id,
  );
  await memory.initialize(maintenanceTarget.id);
  const afterExcerptMaintenance = await memory.status(maintenanceTarget.id);
  assert.equal(
    afterExcerptMaintenance.job.status,
    "ready",
    "a disabled corrected excerpt does not block maintenance after its source changes",
  );
  assert.deepEqual(
    afterExcerptMaintenance.records.find((record) => record.id === editedExcerpt.id),
    beforeExcerptMaintenance,
    "the disabled excerpt remains unchanged and inspectable",
  );
  await memory.updateRecord(maintenanceTarget.id, editedExcerpt.id, { enabled: true });
  await assert.rejects(
    memory.initialize(maintenanceTarget.id),
    /manually corrected memory.*changed source messages/iu,
    "re-enabled stale excerpt corrections retain the explicit-review guard",
  );
  assert.equal(
    (await memory.status(maintenanceTarget.id)).records.find((record) => record.id === editedExcerpt.id)?.content,
    "DISABLED_EXCERPT_CORRECTION",
  );

  const joinedChat = await chats.create({
    name: "Joined waiter cancellation",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection!.id,
  });
  assert(joinedChat);
  await chats.patchMetadata(joinedChat.id, {
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 4096,
      summaryBudgetTokens: 512,
    },
  });
  await chats.createMessagesBatch(joinedChat.id, [
    { role: "user", content: "A compass promise." },
    { role: "assistant", content: "SCENE_CHANGE A new room." },
  ]);
  let releaseSummary: () => void = () => {};
  let summaryEntered: () => void = () => {};
  const heldSummary = new Promise<void>((resolve) => {
    releaseSummary = resolve;
  });
  const enteredSummary = new Promise<void>((resolve) => {
    summaryEntered = resolve;
  });
  beforeSummary = async () => {
    summaryEntered();
    await heldSummary;
  };
  const sharedInitialization = memory.initialize(joinedChat.id);
  await enteredSummary;
  try {
    const waiterController = new AbortController();
    const waiter = memory.initialize(joinedChat.id, { signal: waiterController.signal, blocking: true });
    const cancelledWait = assert.rejects(waiter, /joined waiter stopped/iu);
    waiterController.abort(new Error("joined waiter stopped"));
    await cancelledWait;
  } finally {
    releaseSummary();
  }
  await sharedInitialization;
  assert.equal(
    (await memory.status(joinedChat.id)).job.status,
    "ready",
    "cancelling a joined caller does not stop shared preparation",
  );

  const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
  const Fastify = requireServer("fastify") as typeof import("fastify").default;
  const { advancedMemoryRoutes } = await import("../../packages/server/src/routes/advanced-memory.routes.js");
  const routeApp = Fastify();
  routeApp.decorate("db", db);
  await routeApp.register(advancedMemoryRoutes, { prefix: "/api/chats" });
  try {
    for (const limits of [
      { retrieveMinMessages: 0, retrieveMaxMessages: 0 },
      { retrieveMinMessages: 0, retrieveMaxMessages: 3 },
      { retrieveMinMessages: 1, retrieveMaxMessages: 3 },
    ]) {
      const updated = await routeApp.inject({
        method: "PATCH",
        url: `/api/chats/${recallChat.id}/advanced-memory/settings`,
        payload: limits,
      });
      assert.equal(updated.statusCode, 200, "zero and positive excerpt limits are accepted by the settings API");
      const persisted = await routeApp.inject({ method: "GET", url: `/api/chats/${recallChat.id}/advanced-memory` });
      assert.equal(persisted.statusCode, 200);
      assert.equal(persisted.json().settings.retrieveMinMessages, limits.retrieveMinMessages);
      assert.equal(persisted.json().settings.retrieveMaxMessages, limits.retrieveMaxMessages);
      assert.equal(persisted.json().settings.enabled, true, "zero limits do not reset the remaining settings");
    }
    const invalidReindex = await routeApp.inject({
      method: "POST",
      url: `/api/chats/${joinedChat.id}/advanced-memory/reindex`,
      payload: { debugMode: "invalid" },
    });
    assert.equal(invalidReindex.statusCode, 400);
    assert.match(
      invalidReindex.json().error,
      /debugMode/,
      "reindex exposes the same validation detail as initialization",
    );
    const invalidSettings = { retrieveMinMessages: 10, retrieveMaxMessages: 2 };
    assert.equal(
      (
        await routeApp.inject({
          method: "POST",
          url: `/api/chats/${joinedChat.id}/advanced-memory/initialize`,
          payload: { settings: invalidSettings },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await routeApp.inject({
          method: "PATCH",
          url: `/api/chats/${joinedChat.id}/advanced-memory/settings`,
          payload: invalidSettings,
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await routeApp.inject({
          method: "PATCH",
          url: `/api/chats/${importChat.id}/advanced-memory/records/${reorderedPrepared.receipt.checkpointId}`,
          payload: { content: "   " },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await routeApp.inject({
          method: "PATCH",
          url: `/api/chats/${joinedChat.id}/advanced-memory/records/not-found`,
          payload: { enabled: false },
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await routeApp.inject({
          method: "GET",
          url: `/api/chats/${joinedChat.id}/advanced-memory/records/not-found/sources`,
        })
      ).statusCode,
      404,
    );
    const beforeReset = await memory.status(chat.id);
    assert.deepEqual(
      new Set(beforeReset.records.map((record) => record.kind)),
      new Set(["scene", "continuity", "temporary", "excerpt"]),
    );
    const resetSource = await chats.listMessages(chat.id);
    const resetResponse = await routeApp.inject({ method: "DELETE", url: `/api/chats/${chat.id}/advanced-memory` });
    assert.equal(resetResponse.statusCode, 200);
    const cleared = resetResponse.json();
    assert.deepEqual(cleared.records, []);
    assert.equal(cleared.job.status, "idle");
    assert.equal(cleared.job.completed, 0);
    assert.equal(cleared.job.processedMessageId, undefined);
    assert.equal(cleared.job.classifiedMessageId, undefined);
    assert.equal(cleared.latestReceipt, undefined);
    assert.deepEqual(cleared.settings, beforeReset.settings);
    assert.deepEqual(await chats.listMessages(chat.id), resetSource, "reset never edits the original transcript");
    assert.deepEqual(
      await db.select().from(advancedMemoryRecords).where(eq(advancedMemoryRecords.chatId, chat.id)),
      [],
    );
  } finally {
    await routeApp.close();
  }
  const failureApp = Fastify();
  failureApp.decorate(
    "db",
    new Proxy(db, {
      get(target, key, receiver) {
        if (key === "select")
          return () => {
            throw new Error("Unexpected storage failure");
          };
        return Reflect.get(target, key, receiver);
      },
    }),
  );
  await failureApp.register(advancedMemoryRoutes, { prefix: "/api/chats" });
  try {
    assert.equal(
      (
        await failureApp.inject({
          method: "PATCH",
          url: `/api/chats/${joinedChat.id}/advanced-memory/settings`,
          payload: {},
        })
      ).statusCode,
      500,
      "unknown storage failures remain server errors",
    );
  } finally {
    await failureApp.close();
  }

  const markerChat = await chats.create({
    name: "Historical marker compaction",
    mode: "roleplay",
    characterIds: ["alice"],
    connectionId: connection!.id,
  });
  assert(markerChat);
  await chats.patchMetadata(markerChat.id, {
    groupChatMode: "individual",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 4096,
      summaryBudgetTokens: 512,
      knowledgeStarts: { alice: null },
    },
  });
  await chats.createMessagesBatch(
    markerChat.id,
    Array.from({ length: 40 }, (_, index) => ({
      role: "user" as const,
      content: `Earlier allowed compass promise ${index} remains part of this historical conversation.`,
      extra: index === 35 ? { conversationStartForCharacterIds: ["alice"] } : undefined,
    })),
  );
  const markerSource = await chats.listMessages(markerChat.id);
  const historicalMarker = await memory.prepare({
    chatId: markerChat.id,
    messages: markerSource.slice(0, 30),
    audienceCharacterIds: ["alice"],
    budgetTokens: 700,
  });
  assert(historicalMarker.currentSceneSummary, "historical prefix must compact despite a later manual start");
  await memory.validatePrepared(markerChat.id, markerSource.slice(0, 30), historicalMarker.receipt);
  await assert.rejects(
    memory.prepare({
      chatId: markerChat.id,
      messages: markerSource,
      audienceCharacterIds: [],
      budgetTokens: 3000,
      readOnly: true,
    }),
    /requires a responding character/iu,
  );
  const owner = await memory.prepare({
    chatId: markerChat.id,
    messages: markerSource,
    audienceCharacterIds: [],
    audienceMode: "owner",
    budgetTokens: 3000,
    readOnly: true,
  });
  assert(
    owner.messageIds.every((id) => markerSource.slice(35).some((message) => message.id === id)),
    "explicit owner mode keeps manual start rules",
  );

  const hiddenMiddleChat = await chats.create({
    name: "Private partial cache",
    mode: "roleplay",
    characterIds: ["alice", "bob"],
    connectionId: connection!.id,
  });
  assert(hiddenMiddleChat);
  await chats.patchMetadata(hiddenMiddleChat.id, {
    groupChatMode: "individual",
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 4096,
      summaryBudgetTokens: 512,
      knowledgeStarts: { alice: null, bob: null },
    },
  });
  await chats.createMessagesBatch(
    hiddenMiddleChat.id,
    Array.from({ length: 300 }, (_, index) => ({
      role: "user" as const,
      content: `${index === 250 ? "SCENE_CHANGE " : ""}${index === 50 ? "HIDDEN_MIDDLE_SECRET" : "Shared compass promise along the mountain path"} ${index}.`,
      extra: index === 50 ? { hiddenFromAICharacterIds: ["bob"] } : undefined,
    })),
  );
  const privateController = new AbortController();
  const beforePrivateCache = requests.length;
  await assert.rejects(
    memory.initialize(hiddenMiddleChat.id, {
      signal: privateController.signal,
      onProgress: (event) => {
        if (event.stage === "summarizing" && event.completed === 1 && event.total > 1)
          privateController.abort(new Error("pause scoped summary"));
      },
    }),
  );
  assert.equal(
    (await memory.status(hiddenMiddleChat.id)).job.status,
    "cancelled",
    "a discontiguous scoped partial result can checkpoint before cancellation",
  );
  const firstPrivateBatch = requests.slice(beforePrivateCache).find((request) => request.kind === "summary");
  assert(firstPrivateBatch && !firstPrivateBatch.text.includes("HIDDEN_MIDDLE_SECRET"));
  const privateResumeStart = requests.length;
  await memory.initialize(hiddenMiddleChat.id);
  assert.notEqual(
    requests.slice(privateResumeStart).find((request) => request.kind === "summary")?.text,
    firstPrivateBatch.text,
    "scoped summary resumes after its already paid batch",
  );

  const confirmationChat = await chats.create({
    name: "Confirmation progress",
    mode: "roleplay",
    characterIds: ["newcomer"],
    connectionId: connection!.id,
  });
  assert(confirmationChat);
  await chats.createMessagesBatch(confirmationChat.id, [{ role: "user", content: "Earlier conversation." }]);
  await chats.patchMetadata(confirmationChat.id, {
    groupChatMode: "individual",
    advancedMemory: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: true },
  });
  let confirmationShown = false;
  await assert.rejects(
    memory.initialize(confirmationChat.id, {
      blocking: true,
      onProgress: (event) => {
        if (event.status === "needs_confirmation") confirmationShown = !!event.id && event.blocking === true;
      },
    }),
  );
  assert(confirmationShown, "first-use knowledge confirmation carries a blocking drawer job");

  const raceChat = await chats.create({
    name: "Source race",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection!.id,
  });
  assert(raceChat);
  await chats.createMessagesBatch(raceChat.id, [
    { role: "user", content: "Original event." },
    { role: "assistant", content: "SCENE_CHANGE A new room." },
  ]);
  await chats.patchMetadata(raceChat.id, {
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      maxContextTokens: 4096,
      summaryBudgetTokens: 512,
    },
  });
  const raceSource = await chats.listMessages(raceChat.id);
  beforeSummary = async () => {
    await chats.updateMessageContent(raceSource[0]!.id, "Changed while summarizing.");
  };
  await assert.rejects(memory.initialize(raceChat.id), /messages changed|sources.*changed/iu);
  assert(
    !(await memory.status(raceChat.id)).records.some((record) => record.kind === "scene" && record.content),
    "a stale model result is not committed",
  );
  const cadenceChat = await chats.create({
    name: "Post-generation scene cadence",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection!.id,
  });
  assert(cadenceChat);
  await memory.updateSettings(cadenceChat.id, {
    enabled: true,
    maxContextTokens: 4096,
    summaryBudgetTokens: 512,
    sceneCheckInterval: 5,
  });
  await memory.initialize(cadenceChat.id);
  const classifyCount = () => requests.filter((request) => request.kind === "classify").length;
  const beforeOngoing = classifyCount();
  await chats.createMessagesBatch(
    cadenceChat.id,
    Array.from({ length: 4 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      content: `Recent scene message ${index}.`,
    })),
  );
  await memory.prepare({
    chatId: cadenceChat.id,
    messages: await chats.listMessages(cadenceChat.id),
    audienceCharacterIds: [],
    budgetTokens: 3000,
  });
  assert.equal(classifyCount(), beforeOngoing, "ongoing pre-generation preparation never calls the scene classifier");
  assert.equal(
    await memory.getSceneCheck(cadenceChat.id),
    null,
    "four new messages are below the default five-message cadence",
  );
  await chats.createMessage({
    chatId: cadenceChat.id,
    role: "assistant",
    content: "The fifth message closes a later episode.",
  });
  const cadenceSource = await chats.listMessages(cadenceChat.id);
  const sceneRequest = await memory.getSceneCheck(cadenceChat.id);
  assert(sceneRequest);
  assert.deepEqual(
    sceneRequest.messages.map((message) => message.messageId),
    cadenceSource.map((message) => message.id),
  );
  assert(
    await memory.commitSceneCheck(cadenceChat.id, sceneRequest, {
      starts: [{ messageId: cadenceSource[2]!.id }, { messageId: cadenceSource[4]!.id }],
    }),
  );
  await memory.maintain(cadenceChat.id);
  const cadenceRecords = (await memory.status(cadenceChat.id)).records;
  assert.equal(
    cadenceRecords.filter((record) => record.kind === "scene" && record.status === "closed").length,
    2,
    "one delayed decision retains multiple scene boundaries",
  );
  assert.equal(
    classifyCount(),
    beforeOngoing,
    "tracker commits and archive maintenance do not launch another classifier",
  );
  const editedScene = cadenceRecords.find((record) => record.kind === "scene" && record.status === "closed")!;
  await memory.updateRecord(cadenceChat.id, editedScene.id, { content: "CORRECTED_GOLD compass." });
  await chats.createMessagesBatch(
    cadenceChat.id,
    Array.from({ length: 5 }, (_, index) => ({ role: "assistant" as const, content: `New window message ${index}.` })),
  );
  sceneFinishReason = "error";
  await assert.rejects(memory.checkScenesAfterGeneration(cadenceChat.id), /did not complete/);
  assert.equal(
    JSON.parse((await chats.getById(cadenceChat.id))!.metadata as string).advancedMemoryState.sceneCheckMessageId,
    cadenceSource[4]!.id,
    "valid-looking JSON from an errored completion cannot advance the scene cursor",
  );
  sceneFinishReason = "stop";
  const beforeConcurrentChecks = classifyCount();
  await Promise.all([
    memory.checkScenesAfterGeneration(cadenceChat.id),
    memory.checkScenesAfterGeneration(cadenceChat.id),
  ]);
  assert.equal(
    classifyCount() - beforeConcurrentChecks,
    1,
    "concurrent due checks share the committed cursor rather than rebilling the same window",
  );
  assert(
    (await memory.status(cadenceChat.id)).records.some(
      (record) => record.id === editedScene.id && record.content === "CORRECTED_GOLD compass." && record.manualOverride,
    ),
    "post-generation scaffolds preserve manual scene corrections",
  );
  const latestSceneSource = await chats.listMessages(cadenceChat.id);
  const olderCheck = await memory.getSceneCheck(cadenceChat.id, { force: true, asOfMessageId: cadenceSource[4]!.id });
  assert(olderCheck);
  assert.equal(
    await memory.commitSceneCheck(cadenceChat.id, olderCheck, { starts: [] }),
    false,
    "an older regenerated window cannot overwrite a later checked timeline",
  );
  assert.equal(
    JSON.parse((await chats.getById(cadenceChat.id))!.metadata as string).advancedMemoryState.sceneCheckMessageId,
    latestSceneSource.at(-1)!.id,
  );
  const staleCheck = await memory.getSceneCheck(cadenceChat.id, { force: true });
  assert(staleCheck);
  await chats.updateMessageContent(latestSceneSource.at(-1)!.id, "A changed latest swipe opens a new room.");
  assert.equal(
    await memory.commitSceneCheck(cadenceChat.id, staleCheck, { starts: [] }),
    false,
    "a changed source cannot commit an old scene decision",
  );
  const changedCheck = await memory.getSceneCheck(cadenceChat.id);
  assert(changedCheck, "a changed checked source is due even without five new messages");
  assert(
    await memory.commitSceneCheck(cadenceChat.id, changedCheck, {
      starts: [{ messageId: latestSceneSource.at(-1)!.id }],
    }),
  );
  await memory.maintain(cadenceChat.id);
  await chats.updateMessageContent(latestSceneSource.at(-1)!.id, "The rerolled reply stays in the same room.");
  const rerolledCheck = await memory.getSceneCheck(cadenceChat.id);
  assert(rerolledCheck);
  assert(await memory.commitSceneCheck(cadenceChat.id, rerolledCheck, { starts: [] }));
  assert(
    !(await memory.status(cadenceChat.id)).records.some(
      (record) => record.id === `scene-${latestSceneSource.at(-1)!.id}`,
    ),
    "the old swipe's boundary is removed when its replacement has none",
  );
  assert.equal(
    (await chats.listMessages(cadenceChat.id)).length,
    latestSceneSource.length,
    "delayed and replaced decisions never delete source history",
  );
  const filteredCheck = await memory.getSceneCheck(cadenceChat.id, { force: true });
  assert(filteredCheck);
  await chats.createMessage({ chatId: cadenceChat.id, role: "user", content: "A further source message." });
  const filteredNewCheck = await memory.getSceneCheck(cadenceChat.id, { force: true });
  assert(filteredNewCheck);
  const withheld = filteredNewCheck.messages[0]!;
  await assert.rejects(
    memory.commitSceneCheck(
      cadenceChat.id,
      { ...filteredNewCheck, messages: filteredNewCheck.messages.slice(1) },
      { starts: [{ messageId: withheld.messageId }] },
    ),
    /invalid scene decision/,
    "tracker output cannot use an ID omitted from its character-scoped payload",
  );
  const preservedBoundary = filteredNewCheck.messages[2]!.messageId;
  assert(
    await memory.commitSceneCheck(cadenceChat.id, filteredNewCheck, { starts: [{ messageId: preservedBoundary }] }),
  );
  await chats.createMessage({ chatId: cadenceChat.id, role: "assistant", content: "Another tracker-scoped reply." });
  const partialWindow = await memory.getSceneCheck(cadenceChat.id, { force: true });
  assert(partialWindow && partialWindow.windowStartMessageId !== preservedBoundary);
  assert(
    await memory.commitSceneCheck(
      cadenceChat.id,
      {
        ...partialWindow,
        messages: partialWindow.messages.filter((message) => message.messageId !== preservedBoundary),
      },
      { starts: [] },
    ),
  );
  assert(
    (await memory.status(cadenceChat.id)).records.some((record) => record.id === `scene-${preservedBoundary}`),
    "a filtered tracker cannot erase a valid boundary whose source was never sent to it",
  );

  const deferredHistory = await chats.create({
    name: "Explicit historical segmentation",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection!.id,
  });
  assert(deferredHistory);
  await memory.updateSettings(deferredHistory.id, { enabled: true, maxContextTokens: 4096, summaryBudgetTokens: 512 });
  await chats.createMessagesBatch(deferredHistory.id, [
    { role: "user", content: "An older scene." },
    { role: "assistant", content: "SCENE_CHANGE The party reaches another town." },
  ]);
  const beforeDeferred = classifyCount();
  await memory.maintain(deferredHistory.id);
  assert.equal(classifyCount(), beforeDeferred);
  await memory.prepare({
    chatId: deferredHistory.id,
    messages: await chats.listMessages(deferredHistory.id),
    audienceCharacterIds: [],
    budgetTokens: 3000,
  });
  assert.equal(
    classifyCount(),
    beforeDeferred,
    "ordinary recall never backfills history or reruns the scene classifier",
  );
  await chats.createMessage({
    chatId: deferredHistory.id,
    role: "assistant",
    content: "SCENE_CHANGE Another episode begins.",
  });
  const pendingSource = await chats.listMessages(deferredHistory.id);
  let signalInitialSummary!: () => void;
  let releaseInitialSummary!: () => void;
  const initialSummaryEntered = new Promise<void>((resolve) => {
    signalInitialSummary = resolve;
  });
  const initialSummaryHeld = new Promise<void>((resolve) => {
    releaseInitialSummary = resolve;
  });
  beforeSummary = async () => {
    signalInitialSummary();
    await initialSummaryHeld;
  };
  let signalResetTransaction!: () => void;
  let releaseResetTransaction!: () => void;
  const resetTransactionEntered = new Promise<void>((resolve) => {
    signalResetTransaction = resolve;
  });
  const resetTransactionHeld = new Promise<void>((resolve) => {
    releaseResetTransaction = resolve;
  });
  const originalTransaction = db.transaction.bind(db);
  let holdResetTransaction = false;
  db.transaction = (async (...args: Parameters<typeof originalTransaction>) => {
    if (holdResetTransaction) {
      holdResetTransaction = false;
      signalResetTransaction();
      await resetTransactionHeld;
    }
    return originalTransaction(...args);
  }) as typeof db.transaction;
  let queuedReset: ReturnType<typeof memory.reset> | undefined;
  let pendingInitialization: Promise<void> | undefined;
  try {
    pendingInitialization = memory.initialize(deferredHistory.id, {
      onProgress: (event) => {
        if (event.status !== "ready" || queuedReset) return;
        holdResetTransaction = true;
        queuedReset = memory.reset(deferredHistory.id);
      },
    });
    await initialSummaryEntered;
    const pendingPreparation = memory.prepare({
      chatId: deferredHistory.id,
      messages: pendingSource,
      audienceCharacterIds: [],
      budgetTokens: 3000,
    });
    const rejectedPreparation = assert.rejects(pendingPreparation, /being reset|changed|abort/iu);
    await new Promise<void>((resolve) => setImmediate(resolve));
    releaseInitialSummary();
    await resetTransactionEntered;
    await assert.rejects(
      memory.initialize(deferredHistory.id),
      /being reset/iu,
      "pending prepare cannot overwrite the reset operation after its initialization wait",
    );
    const queuedPreview = memory.prepare({
      chatId: deferredHistory.id,
      messages: pendingSource,
      audienceCharacterIds: [],
      budgetTokens: 3000,
      readOnly: true,
    });
    releaseResetTransaction();
    await pendingInitialization;
    await queuedReset;
    await rejectedPreparation;
    const postResetPreview = await queuedPreview;
    await memory.validatePrepared(deferredHistory.id, pendingSource, postResetPreview.receipt);
    assert.deepEqual(
      (await memory.status(deferredHistory.id)).records,
      [],
      "read-only preparation waits for a consistent reset snapshot and never recreates records",
    );
  } finally {
    releaseInitialSummary();
    releaseResetTransaction();
    db.transaction = originalTransaction;
    await pendingInitialization?.catch(() => undefined);
    await queuedReset?.catch(() => undefined);
  }

  const resetChat = await chats.create({
    name: "Reset during preparation",
    mode: "roleplay",
    characterIds: ["alice"],
    connectionId: connection!.id,
  });
  assert(resetChat);
  await chats.createMessagesBatch(resetChat.id, [
    { role: "user", content: "Keep this original compass promise." },
    { role: "assistant", content: "SCENE_CHANGE The journey resumes." },
  ]);
  const resetSettings = {
    ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
    enabled: true,
    maxContextTokens: 4096,
    summaryBudgetTokens: 512,
    knowledgeStarts: { alice: null },
  };
  await chats.patchMetadata(resetChat.id, { groupChatMode: "individual", advancedMemory: resetSettings });
  const beforeResetSource = await chats.listMessages(resetChat.id);
  const emptyArchivePrompt = await memory.prepare({
    chatId: resetChat.id,
    messages: beforeResetSource,
    audienceCharacterIds: ["alice"],
    budgetTokens: 1800,
    readOnly: true,
  });
  assert.deepEqual(emptyArchivePrompt.receipt.recordRevisions, {});
  await chats.updateMessageExtra(beforeResetSource.at(-1)!.id, {
    advancedMemoryReceipt: emptyArchivePrompt.receipt,
    unrelatedExtra: "preserve me",
  });
  const preservedResetSource = await chats.listMessages(resetChat.id);
  assert((await memory.status(resetChat.id)).latestReceipt);
  let signalResetSummary!: () => void;
  let releaseResetSummary!: () => void;
  let finishedResetSummary!: () => void;
  const resetSummaryEntered = new Promise<void>((resolve) => (signalResetSummary = resolve));
  const heldResetSummary = new Promise<void>((resolve) => (releaseResetSummary = resolve));
  const resetSummaryFinished = new Promise<void>((resolve) => (finishedResetSummary = resolve));
  beforeSummary = async () => {
    signalResetSummary();
    await heldResetSummary;
    finishedResetSummary();
  };
  const runningBeforeReset = memory.initialize(resetChat.id);
  const cancelledByReset = assert.rejects(runningBeforeReset, /reset|abort/iu);
  try {
    await resetSummaryEntered;
    const resetting = memory.reset(resetChat.id);
    await assert.rejects(memory.initialize(resetChat.id), /being reset/iu);
    const resetResult = await resetting;
    await cancelledByReset;
    assert.equal(resetResult.job.status, "idle", "old cancellation cleanup cannot overwrite reset progress");
    assert.deepEqual(resetResult.settings, resetSettings, "reset preserves confirmed character knowledge boundaries");
    assert.equal(resetResult.latestReceipt, undefined);
    await assert.rejects(
      memory.validatePrepared(resetChat.id, preservedResetSource, emptyArchivePrompt.receipt),
      /settings or summary corrections changed/iu,
      "reset also invalidates cached prompts that depended on no archive record",
    );
  } finally {
    releaseResetSummary();
    await runningBeforeReset.catch(() => undefined);
  }
  await resetSummaryFinished;
  assert.deepEqual(
    await db.select().from(advancedMemoryRecords).where(eq(advancedMemoryRecords.chatId, resetChat.id)),
    [],
    "a cancelled provider response cannot recreate records or partial summary work after reset",
  );
  assert.deepEqual(await chats.listMessages(resetChat.id), preservedResetSource);
  assert.equal((await memory.status(resetChat.id)).job.status, "idle");
  await memory.initialize(resetChat.id);
  const restarted = await memory.status(resetChat.id);
  assert.equal(restarted.job.status, "ready", "Prepare can rebuild memory from the untouched chat after reset");
  assert(restarted.records.some((record) => record.kind === "scene" && record.content));
  assert(restarted.records.some((record) => record.kind === "excerpt"));
  assert.deepEqual(await chats.listMessages(resetChat.id), preservedResetSource);
  const backlog = await chats.create({
    name: "Initial history behind a recent-only scene checkpoint",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection!.id,
  });
  assert(backlog);
  await memory.updateSettings(backlog.id, { enabled: true, maxContextTokens: 4096, summaryBudgetTokens: 512 });
  await chats.createMessagesBatch(
    backlog.id,
    Array.from({ length: 120 }, (_, index) => ({
      role: "user" as const,
      content: `${[30, 75, 117].includes(index) ? "SCENE_CHANGE " : ""}Historical event ${index}. ${"The journey continued. ".repeat(20)}`,
    })),
  );
  const backlogSource = await chats.listMessages(backlog.id);
  const recentCheck = await memory.getSceneCheck(backlog.id);
  assert(recentCheck);
  assert(
    await memory.commitSceneCheck(backlog.id, recentCheck, { starts: [{ messageId: backlogSource[117]!.id }] }),
    "the recent-only checkpoint must be committed before backfill",
  );
  const beforeBackfill = requests.length;
  const pauseBackfill = new AbortController();
  await assert.rejects(
    memory.initialize(backlog.id, {
      signal: pauseBackfill.signal,
      onProgress: (event) => {
        if (event.stage === "classifying" && event.completed > 0) pauseBackfill.abort(new Error("pause backfill"));
      },
    }),
  );
  await memory.initialize(backlog.id);
  await memory.prepare({ chatId: backlog.id, messages: backlogSource, audienceCharacterIds: [], budgetTokens: 50000 });
  const historicalCalls = requests.slice(beforeBackfill).filter((request) => request.kind === "classify");
  assert(historicalCalls.length > 1, "initial history spans multiple provider context windows");
  assert(backlogSource.every((message) => historicalCalls.some((request) => request.text.includes(message.id))));
  assert.deepEqual(
    (await memory.status(backlog.id)).records
      .filter((record) => record.kind === "scene" && record.status === "closed")
      .map((record) => [record.startIndex, record.endIndex]),
    [
      [1, 30],
      [31, 75],
      [76, 117],
    ],
    "recent-only closed scaffolds must not cause initial preparation to skip older scenes",
  );
  console.info(
    "Advanced Memory core regression passed (800 messages, resume, scope, compaction, previews, corrections and races).",
  );
} finally {
  beforeSummary = null;
  await db._fileStore.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(directory, { recursive: true, force: true });
}
