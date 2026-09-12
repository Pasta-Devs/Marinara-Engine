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
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
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
      content: `${index === 400 ? "SCENE_CHANGE " : ""}Message ${index}: the compass promise continues along the road.`,
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
          ? "Luna promised to return the silver compass on Sunday."
          : index === 25
            ? "Luna corrected the promise: the silver compass returns on Tuesday, never Sunday."
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
  assert(exactRecall.recalledMessages?.includes("on Sunday"), "lexical recall includes the original promise exactly");
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
  assert.equal(importedPrepared.chatSummary, "IMPORTED_CONTINUITY_CORRECTION");
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
  assert.equal(
    reorderedPrepared.chatSummary,
    "IMPORTED_CONTINUITY_CORRECTION",
    "an imported dependent before duplicate sources resolves their final local IDs",
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
  console.info(
    "Advanced Memory core regression passed (800 messages, resume, scope, compaction, previews, corrections and races).",
  );
} finally {
  beforeSummary = null;
  await db._fileStore.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(directory, { recursive: true, force: true });
}
