import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-chat-branch-lineage-"));
const fileStorageDir = join(dataDir, "storage");
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = fileStorageDir;
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

let app: { close(): Promise<void>; inject(options: Record<string, unknown>): Promise<any> } | null = null;

try {
  const { buildApp } = await import("../../packages/server/src/app.js");
  const { createCapabilityPersistenceHost } =
    await import("../../packages/server/src/services/capability-packages/capability-persistence.service.js");
  const { getDB } = await import("../../packages/server/src/db/connection.js");
  const { createGameEngineStateStorage } =
    await import("../../packages/server/src/services/storage/game-engine-state.storage.js");

  app = await buildApp();
  await app.ready();
  const db = await getDB();
  const engineStore = createGameEngineStateStorage(db);

  const create = async (name: string, mode: "conversation" | "roleplay" | "game" = "roleplay") => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/chats",
      payload: { name, mode, characterIds: [] },
    });
    assert.equal(response.statusCode, 200);
    return response.json();
  };
  const addMessage = async (chatId: string, content: string, role: "user" | "assistant" = "user") => {
    const response = await app!.inject({
      method: "POST",
      url: `/api/chats/${chatId}/messages`,
      payload: { role, content },
    });
    assert.equal(response.statusCode, 200);
    return response.json();
  };

  const root = await create("Branch root");
  const first = await addMessage(root.id, "before fork");
  const middle = await addMessage(root.id, "fork here");
  await addMessage(root.id, "after fork");
  await engineStore.create({
    chatId: root.id,
    messageId: middle.id,
    swipeIndex: 0,
    gameType: "roleplay-negative-control",
    schemaVersion: 1,
    state: JSON.stringify({ turn: 1 }),
    committed: true,
  });

  const branchResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${root.id}/branch`,
    payload: { upToMessageId: middle.id },
  });
  assert.equal(branchResponse.statusCode, 200);
  const branch = branchResponse.json();
  assert.equal(branch.metadata.branchName, "New Branch");
  assert.equal(branch.metadata.branchParentChatId, root.id);
  assert.equal(branch.metadata.branchParentMessageId, middle.id);
  assert.equal(typeof branch.groupId, "string");

  const branchMessagesResponse = await app.inject({ method: "GET", url: `/api/chats/${branch.id}/messages` });
  assert.equal(branchMessagesResponse.statusCode, 200);
  const branchMessages = branchMessagesResponse.json();
  assert.deepEqual(
    branchMessages.map((message: { content: string }) => message.content),
    ["before fork", "fork here"],
  );
  assert.equal(typeof branch.metadata.branchMessageId, "string");
  assert.equal(branchMessages.at(-1).id, branch.metadata.branchMessageId);
  assert.deepEqual(
    await engineStore.listByChatAndMessage(branch.id, branchMessages.at(-1).id, 0),
    [],
    "Roleplay branches must not copy game-engine rows",
  );

  const childResponse = await app.inject({ method: "POST", url: `/api/chats/${branch.id}/branch`, payload: {} });
  assert.equal(childResponse.statusCode, 200);
  const child = childResponse.json();
  assert.equal(child.metadata.branchParentChatId, branch.id);
  assert.equal(child.metadata.branchParentMessageId, branchMessages.at(-1).id);

  const empty = await create("Empty root");
  const emptyBranchResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${empty.id}/branch`,
    payload: {},
  });
  assert.equal(emptyBranchResponse.statusCode, 200);
  const emptyBranch = emptyBranchResponse.json();
  assert.equal(emptyBranch.metadata.branchParentChatId, empty.id);
  assert.equal(emptyBranch.metadata.branchParentMessageId, null);
  assert.equal(emptyBranch.metadata.branchMessageId, null);

  const chatStorage = (await import("../../packages/server/src/services/storage/chats.storage.js")).createChatsStorage(
    db,
  );
  const { advancedMemoryRecords } = await import("../../packages/server/src/db/schema/advanced-memory.js");
  const { chats: chatsTable, messages: messagesTable } = await import("../../packages/server/src/db/schema/chats.js");
  const { eq } = await import("../../packages/server/src/db/file-query.js");
  const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
  const { remapAdvancedMemoryMetadata } =
    await import("../../packages/server/src/services/advanced-memory-transfer.js");
  const { importSTChat } = await import("../../packages/server/src/services/import/st-chat.importer.js");
  const sourceMessages = await chatStorage.listMessages(root.id);
  const remappedKnowledge = remapAdvancedMemoryMetadata(
    {
      advancedMemory: {
        enabled: true,
        knowledgeConfirmed: true,
        knowledgeStarts: { existing: middle.id, beginning: null, future: "omitted-message" },
      },
      advancedMemoryState: { activeSceneId: "old-scene" },
    },
    new Map([[middle.id, "copied-middle"]]),
    ["existing", "beginning", "future", "new-character"],
  );
  assert.deepEqual((remappedKnowledge.advancedMemory as any).knowledgeStarts, {
    existing: "copied-middle",
    beginning: null,
  });
  assert.equal((remappedKnowledge.advancedMemory as any).knowledgeConfirmed, false);
  assert.equal(
    remappedKnowledge.advancedMemoryState,
    undefined,
    "a missing or future knowledge anchor must never become permission from the beginning",
  );
  const future = sourceMessages.at(-1)!;
  await chatStorage.patchMetadata(root.id, { advancedMemory: { enabled: true } });
  const memoryService = createAdvancedMemoryService(db);
  const memoryFixture = (
    id: string,
    sceneId: string,
    ids: string[],
    content: string,
    enabled = 1,
    manualOverride = 0,
  ) => ({
    id,
    chatId: root.id,
    sceneId,
    kind: "scene",
    status: "closed",
    startMessageId: ids[0]!,
    endMessageId: ids.at(-1)!,
    messageIds: JSON.stringify(ids),
    audienceCharacterIds: "[]",
    content,
    title: "Retained scene",
    timeline: null,
    enabled,
    manualOverride,
    sourceFingerprint: "",
    dependencies: "[]",
    embedding: null,
    embeddingSpaceId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await db.insert(advancedMemoryRecords).values([
    memoryFixture(`scene-${first.id}`, `scene-${first.id}`, [first.id], ""),
    memoryFixture("edited-disabled-scene", `scene-${first.id}`, [first.id], "USER_CORRECTED_MEMORY", 0, 1),
    {
      ...memoryFixture(`scene-${middle.id}`, `scene-${middle.id}`, [middle.id, future.id], ""),
      timeline: "A future ending outside the fork",
    },
    memoryFixture("future-scene-variant", `scene-${middle.id}`, [middle.id, future.id], "FUTURE_SECRET"),
  ]);
  await memoryService.refreshTransferredRecords(root.id);
  const memoryBranchResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${root.id}/branch`,
    payload: { upToMessageId: middle.id },
  });
  assert.equal(memoryBranchResponse.statusCode, 200);
  const memoryBranch = memoryBranchResponse.json();
  const memoryBranchMessages = await chatStorage.listMessages(memoryBranch.id);
  const branchedMemories = await db
    .select()
    .from(advancedMemoryRecords)
    .where(eq(advancedMemoryRecords.chatId, memoryBranch.id));
  assert.equal(
    branchedMemories.some((record) => record.content.includes("FUTURE_SECRET")),
    false,
  );
  const retainedCorrection = branchedMemories.find((record) => record.content === "USER_CORRECTED_MEMORY");
  assert.equal(retainedCorrection?.enabled, 0, "disabled corrections stay disabled on a branch");
  assert.equal(retainedCorrection?.manualOverride, 1);
  assert.deepEqual(JSON.parse(retainedCorrection!.messageIds), [memoryBranchMessages[0]!.id]);
  const reopened = branchedMemories.find((record) => record.id === `scene-${memoryBranchMessages[1]!.id}`);
  assert.equal(reopened?.status, "open", "a branch inside a scene must not inherit the future ending");
  assert.equal(reopened?.content, "");
  assert.equal(reopened?.endMessageId, memoryBranchMessages[1]!.id);
  assert.equal(reopened?.timeline, null, "a clipped scene must not retain its future timeframe");

  const preparedChat = await create("Prepared history branches without rebuilding");
  const { ADVANCED_MEMORY_SCENE_AUDIENCE } = await import("../../packages/shared/src/types/advanced-memory.js");
  const preparedMessages = [];
  for (const content of [
    "OUTDATED_FIRST_SWIPE",
    "Where did we leave the brass compass?",
    "FUTURE_COMPASS_SECRET: the compass was destroyed.",
    "A later, separate journey begins.",
  ])
    preparedMessages.push(await addMessage(preparedChat.id, content, preparedMessages.length ? "user" : "assistant"));
  await db
    .update(messagesTable)
    .set({
      content: "The brass compass was entrusted to us.",
      activeSwipeIndex: 3,
      extra: JSON.stringify({ authoritativeTag: "selected-message-row", isConversationStart: false }),
    })
    .where(eq(messagesTable.id, preparedMessages[0].id));
  assert.deepEqual(
    (await chatStorage.getSwipes(preparedMessages[0].id)).map((swipe) => [swipe.index, swipe.content]),
    [[0, "OUTDATED_FIRST_SWIPE"]],
    "the selected current message has no matching saved swipe row",
  );
  await chatStorage.patchMetadata(preparedChat.id, {
    advancedMemory: { enabled: true, knowledgeConfirmed: true, sceneCheckInterval: 2 },
  });
  const initialCheck = await memoryService.getSceneCheck(preparedChat.id, { force: true });
  assert(initialCheck);
  assert.equal(
    await memoryService.commitSceneCheck(preparedChat.id, initialCheck, {
      ends: [{ messageNumber: 1 }, { messageNumber: 3 }],
    }),
    true,
  );
  await db.insert(advancedMemoryRecords).values([
    {
      ...memoryFixture(
        "retained-compass-summary",
        `scene-${preparedMessages[0].id}`,
        [preparedMessages[0].id],
        "The brass compass was entrusted to us.",
      ),
      chatId: preparedChat.id,
      dependencies: JSON.stringify([ADVANCED_MEMORY_SCENE_AUDIENCE]),
    },
    {
      ...memoryFixture(
        "future-compass-summary",
        `scene-${preparedMessages[1].id}`,
        [preparedMessages[1].id, preparedMessages[2].id],
        "FUTURE_COMPASS_SECRET",
      ),
      chatId: preparedChat.id,
      dependencies: JSON.stringify([ADVANCED_MEMORY_SCENE_AUDIENCE]),
    },
  ]);
  await memoryService.refreshTransferredRecords(preparedChat.id);
  await memoryService.initialize(preparedChat.id, { detectScenes: false, closedOnly: true });
  assert.equal((await memoryService.status(preparedChat.id)).job.status, "ready");
  assert.deepEqual((await memoryService.status(preparedChat.id)).unpreparedScenes, []);
  await db.insert(advancedMemoryRecords).values({
    ...memoryFixture(
      "forked-scene-excerpt",
      `scene-${preparedMessages[1].id}`,
      [preparedMessages[1].id],
      "FORK_SCENE_FINISHED",
    ),
    chatId: preparedChat.id,
    kind: "excerpt",
  });
  await memoryService.refreshTransferredRecords(preparedChat.id);
  await chatStorage.patchMetadata(preparedChat.id, (metadata) => ({
    advancedMemoryState: {
      ...(metadata.advancedMemoryState as Record<string, unknown>),
      historyClassified: true,
      hiddenHistoryClassified: true,
      constantSummarySceneIds: ["retained-compass-summary", "future-compass-summary"],
      contextStarts: [
        {
          messageId: preparedMessages[1].id,
          sceneStartMessageId: preparedMessages[1].id,
          manualStartMessageId: null,
          audienceCharacterIds: [],
        },
        {
          messageId: preparedMessages[3].id,
          sceneStartMessageId: preparedMessages[3].id,
          manualStartMessageId: null,
          audienceCharacterIds: [],
        },
      ],
    },
  }));
  const preparedSourceBefore = await chatStorage.getById(preparedChat.id);
  const preparedSourceMessagesBefore = await chatStorage.listMessages(preparedChat.id);
  const preparedRowsBefore = await db
    .select()
    .from(advancedMemoryRecords)
    .where(eq(advancedMemoryRecords.chatId, preparedChat.id));
  const preparedBranchResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${preparedChat.id}/branch`,
    payload: { upToMessageId: preparedMessages[1].id },
  });
  assert.equal(preparedBranchResponse.statusCode, 200);
  const preparedBranch = preparedBranchResponse.json();
  const preparedBranchMessages = await chatStorage.listMessages(preparedBranch.id);
  const preparedBranchStatus = await memoryService.status(preparedBranch.id);
  assert.equal(preparedBranchStatus.job.status, "ready", "branching prepared history must not require rebuilding");
  assert.equal(preparedBranchMessages[0]!.content, "The brass compass was entrusted to us.");
  assert.equal(preparedBranchMessages[0]!.activeSwipeIndex, 1);
  assert.equal(JSON.parse(preparedBranchMessages[0]!.extra).authoritativeTag, "selected-message-row");
  assert.deepEqual(
    (await chatStorage.getSwipes(preparedBranchMessages[0]!.id)).map((swipe) => [swipe.index, swipe.content]),
    [
      [0, "OUTDATED_FIRST_SWIPE"],
      [1, "The brass compass was entrusted to us."],
    ],
    "branching retains older swipes and synthesizes the authoritative selected swipe",
  );
  assert.deepEqual(preparedBranchStatus.unpreparedScenes, []);
  assert.equal(preparedBranchStatus.settings.knowledgeConfirmed, true);
  assert.equal(preparedBranchStatus.job.processedMessageId, preparedBranchMessages[1]!.id);
  assert.deepEqual(
    preparedBranchStatus.job.contextStarts,
    [
      {
        messageId: preparedBranchMessages[1]!.id,
        sceneStartMessageId: preparedBranchMessages[1]!.id,
        manualStartMessageId: null,
        audienceCharacterIds: [],
      },
    ],
    "only automatic starts with retained anchors survive",
  );
  assert.equal(
    await memoryService.getSceneCheck(preparedBranch.id),
    null,
    "the checked future checkpoint clamps to the copied prefix instead of rechecking old messages",
  );
  const branchRecall = await memoryService.prepare({
    chatId: preparedBranch.id,
    messages: preparedBranchMessages,
    audienceCharacterIds: [],
    budgetTokens: 4096,
    readOnly: true,
  });
  assert.equal(branchRecall.receipt.reasons.includes("preparation-needed"), false);
  assert.match(
    branchRecall.recalledScenes ?? "",
    /The brass compass was entrusted to us\./u,
    "a valid retained summary is available to actual recall immediately",
  );
  assert.deepEqual(branchRecall.receipt.recalledSceneIds, [`scene-${preparedBranchMessages[0]!.id}`]);
  assert.equal(
    preparedBranchStatus.records.some((record) => record.content.includes("FUTURE_COMPASS_SECRET")),
    false,
  );
  const preparedBranchRows = await db
    .select()
    .from(advancedMemoryRecords)
    .where(eq(advancedMemoryRecords.chatId, preparedBranch.id));
  const copiedCompassSummary = preparedBranchRows.find(
    (record) => record.content === "The brass compass was entrusted to us.",
  );
  assert(copiedCompassSummary);
  assert.deepEqual(
    preparedBranch.metadata.advancedMemoryState.constantSummarySceneIds,
    [copiedCompassSummary.id],
    "handled Chat Summary markers retain only their copied scene recap IDs",
  );
  await memoryService.checkScenesAfterGeneration(preparedBranch.id, {
    asOfMessageId: preparedBranchMessages.at(-1)!.id,
  });
  const postGenerationBranchMetadata = JSON.parse((await chatStorage.getById(preparedBranch.id))!.metadata);
  assert.deepEqual(
    postGenerationBranchMetadata.summaryEntries,
    [],
    "a deliberately deleted automatic Chat Summary must not be recreated after branching",
  );
  assert.equal(
    preparedBranchRows.some((record) => record.content === "FORK_SCENE_FINISHED"),
    false,
    "a derived excerpt of the ongoing fork scene is discarded even when its own source messages survived",
  );
  assert.equal(
    preparedBranchStatus.records.find((record) => record.sceneId === `scene-${preparedBranchMessages[1]!.id}`)?.status,
    "open",
  );
  assert.deepEqual((await chatStorage.getById(preparedChat.id))?.metadata, preparedSourceBefore?.metadata);
  assert.deepEqual(await chatStorage.listMessages(preparedChat.id), preparedSourceMessagesBefore);
  assert.deepEqual(
    await db.select().from(advancedMemoryRecords).where(eq(advancedMemoryRecords.chatId, preparedChat.id)),
    preparedRowsBefore,
    "branch preparation must not change the original archive",
  );

  const preparedChildResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${preparedBranch.id}/branch`,
    payload: {},
  });
  assert.equal(preparedChildResponse.statusCode, 200);
  const preparedChild = preparedChildResponse.json();
  const preparedChildMessages = await chatStorage.listMessages(preparedChild.id);
  assert.equal((await memoryService.status(preparedChild.id)).job.status, "ready");
  const childRecall = await memoryService.prepare({
    chatId: preparedChild.id,
    messages: preparedChildMessages,
    audienceCharacterIds: [],
    budgetTokens: 4096,
    readOnly: true,
  });
  assert.equal(childRecall.receipt.reasons.includes("preparation-needed"), false);
  assert.match(
    childRecall.recalledScenes ?? "",
    /The brass compass was entrusted to us\./u,
    "branching a branch preserves the reusable archive",
  );
  await chatStorage.patchMetadata(preparedChild.id, (metadata) => ({
    advancedMemoryState: { ...(metadata.advancedMemoryState as Record<string, unknown>), paused: true },
  }));
  const pausedArchiveResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${preparedChild.id}/branch`,
    payload: {},
  });
  assert.equal(pausedArchiveResponse.statusCode, 200);
  const pausedArchiveId = pausedArchiveResponse.json().id;
  const pausedArchiveStatus = await memoryService.status(pausedArchiveId);
  assert.equal(pausedArchiveStatus.job.paused, true);
  assert.equal(pausedArchiveStatus.job.status, "cancelled", "a prepared paused branch offers Resume");
  assert.equal(await memoryService.getSceneCheck(pausedArchiveId, { force: true }), null);
  const pausedArchiveRecall = await memoryService.prepare({
    chatId: pausedArchiveId,
    messages: await chatStorage.listMessages(pausedArchiveId),
    audienceCharacterIds: [],
    budgetTokens: 4096,
    readOnly: true,
  });
  assert.match(
    pausedArchiveRecall.recalledScenes ?? "",
    /The brass compass was entrusted to us\./u,
    "an explicit pause preserves the copied archive for recall",
  );
  await addMessage(preparedBranch.id, "One new message after the fork.");
  assert.equal(await memoryService.getSceneCheck(preparedBranch.id), null);
  await addMessage(preparedBranch.id, "Two new messages after the fork.");
  assert(await memoryService.getSceneCheck(preparedBranch.id), "normal automatic scene cadence resumes on new turns");

  const boundaryBranchResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${preparedChat.id}/branch`,
    payload: { upToMessageId: preparedMessages[2].id },
  });
  assert.equal(boundaryBranchResponse.statusCode, 200);
  const boundaryBranch = boundaryBranchResponse.json();
  const boundaryMessages = await chatStorage.listMessages(boundaryBranch.id);
  const boundaryStatus = await memoryService.status(boundaryBranch.id);
  assert.equal(boundaryStatus.job.status, "ready");
  assert.deepEqual(boundaryStatus.unpreparedScenes, []);
  const boundaryScene = boundaryStatus.records.find((record) => record.sceneId === `scene-${boundaryMessages[1]!.id}`);
  assert.equal(boundaryScene?.status, "open", "a fork at a saved scene ending makes that scene ongoing");
  assert.equal(
    boundaryScene?.content,
    "",
    "the fork scene's old completed recap must not describe its new continuation",
  );

  const preparedTranscript = await app.inject({ method: "GET", url: `/api/chats/${preparedChat.id}/export` });
  assert.equal(preparedTranscript.statusCode, 200);
  const importedPrepared = await importSTChat(preparedTranscript.body, db, { mode: "roleplay" });
  assert.equal(importedPrepared.success, true);
  const importedPreparedStatus = await memoryService.status(importedPrepared.chatId!);
  assert.equal(importedPreparedStatus.job.status, "idle", "transcript imports still require their own preparation");
  assert.equal(importedPreparedStatus.settings.knowledgeConfirmed, false);

  await chatStorage.updateMessageContent(preparedMessages[0].id, "The earlier compass source was edited.");
  const editedSourceBranchResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${preparedChat.id}/branch`,
    payload: { upToMessageId: preparedMessages[1].id },
  });
  assert.equal(editedSourceBranchResponse.statusCode, 200);
  const editedSourceBranch = editedSourceBranchResponse.json();
  const editedSourceStatus = await memoryService.status(editedSourceBranch.id);
  assert.equal(editedSourceStatus.job.status, "ready", "one changed historical scene must not reset the whole chat");
  assert.equal(editedSourceBranch.metadata.advancedMemoryState.historyClassified, true);
  assert.equal(editedSourceBranch.metadata.advancedMemoryState.hiddenHistoryClassified, true);
  assert.equal(
    editedSourceStatus.job.processedMessageId,
    undefined,
    "a changed source must not inherit an otherwise obsolete processed fingerprint",
  );
  assert.equal(
    await memoryService.getSceneCheck(editedSourceBranch.id),
    null,
    "scene-check cadence still counts new IDs after an ordinary historical edit",
  );
  const editedSourceRecall = await memoryService.prepare({
    chatId: editedSourceBranch.id,
    messages: await chatStorage.listMessages(editedSourceBranch.id),
    audienceCharacterIds: [],
    budgetTokens: 4096,
    readOnly: true,
  });
  assert.equal(editedSourceRecall.receipt.reasons.includes("preparation-needed"), false);

  const individual = await chatStorage.create({
    name: "Individual knowledge branch",
    mode: "roleplay",
    characterIds: ["knows-history", "joins-later", "joins-in-future"],
  });
  assert(individual);
  const privateMessages = [];
  for (const content of ["An earlier private event.", "The newcomer arrives.", "The future arrival."])
    privateMessages.push(await addMessage(individual.id, content));
  await chatStorage.patchMetadata(individual.id, {
    groupChatMode: "individual",
    advancedMemory: {
      enabled: true,
      knowledgeConfirmed: true,
      knowledgeStarts: {
        "knows-history": null,
        "joins-later": privateMessages[1].id,
        "joins-in-future": privateMessages[2].id,
      },
    },
  });
  const individualCheck = await memoryService.getSceneCheck(individual.id, { force: true });
  assert(individualCheck);
  assert.equal(await memoryService.commitSceneCheck(individual.id, individualCheck, { ends: [] }), true);
  const individualBranchResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${individual.id}/branch`,
    payload: {},
  });
  assert.equal(individualBranchResponse.statusCode, 200);
  const individualBranch = individualBranchResponse.json();
  const individualMessages = await chatStorage.listMessages(individualBranch.id);
  const individualStatus = await memoryService.status(individualBranch.id);
  assert.equal(individualStatus.job.status, "ready");
  assert.equal(individualStatus.settings.knowledgeConfirmed, true);
  assert.deepEqual(individualStatus.settings.knowledgeStarts, {
    "knows-history": null,
    "joins-later": individualMessages[1]!.id,
    "joins-in-future": individualMessages[2]!.id,
  });
  const newcomerContext = await memoryService.prepare({
    chatId: individualBranch.id,
    messages: individualMessages,
    audienceCharacterIds: ["joins-later"],
    budgetTokens: 4096,
    readOnly: true,
  });
  assert.deepEqual(
    newcomerContext.messageIds,
    individualMessages.slice(1).map((message) => message.id),
    "branching must not grant the newcomer access to earlier history",
  );
  await chatStorage.patchMetadata(individual.id, (metadata) => ({
    advancedMemoryState: { ...(metadata.advancedMemoryState as Record<string, unknown>), paused: true },
  }));
  const beforeArrivalResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${individual.id}/branch`,
    payload: { upToMessageId: privateMessages[1].id },
  });
  assert.equal(beforeArrivalResponse.statusCode, 200);
  const beforeArrivalStatus = await memoryService.status(beforeArrivalResponse.json().id);
  assert.equal(beforeArrivalStatus.job.status, "needs_confirmation");
  assert.equal(beforeArrivalStatus.job.paused, true, "a missing knowledge anchor must not clear an inherited pause");
  assert.equal(beforeArrivalStatus.settings.knowledgeConfirmed, false);
  assert.equal(
    "joins-in-future" in beforeArrivalStatus.settings.knowledgeStarts,
    false,
    "an omitted future knowledge anchor must never become permission from the beginning",
  );
  assert.deepEqual(beforeArrivalStatus.missingKnowledgeCharacterIds, ["joins-in-future"]);

  const paused = await create("Paused memory stays paused after branching");
  await addMessage(paused.id, "A paused history.");
  for (const status of ["cancelled", "ready"] as const) {
    await chatStorage.patchMetadata(paused.id, {
      advancedMemory: { enabled: true },
      advancedMemoryState: { status, paused: true },
    });
    const pausedBranchResponse = await app.inject({
      method: "POST",
      url: `/api/chats/${paused.id}/branch`,
      payload: {},
    });
    assert.equal(pausedBranchResponse.statusCode, 200);
    const pausedBranchId = pausedBranchResponse.json().id;
    assert.equal(
      (await memoryService.status(pausedBranchId)).job.paused,
      true,
      `${status} preserves an explicit pause`,
    );
    assert.equal((await memoryService.status(pausedBranchId)).job.status, "cancelled");
    assert.equal(await memoryService.getSceneCheck(pausedBranchId, { force: true }), null);
  }

  const sparse = await create("Sparse selected swipe branches densely", "game");
  const sparseMessage = await addMessage(sparse.id, "OLDER_SPARSE_SWIPE", "assistant");
  await db
    .update(messagesTable)
    .set({
      content: "CURRENT_SPARSE_SWIPE",
      activeSwipeIndex: 3,
      extra: JSON.stringify({ authoritativeTag: "sparse-selected-row" }),
    })
    .where(eq(messagesTable.id, sparseMessage.id));
  await engineStore.create({
    chatId: sparse.id,
    messageId: sparseMessage.id,
    swipeIndex: 3,
    gameType: "sparse-swipe-game",
    schemaVersion: 1,
    state: JSON.stringify({ turn: "selected-three" }),
    committed: true,
  });
  const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
  const trackerStore = createGameStateStorage(db);
  await trackerStore.updateByMessage(
    sparseMessage.id,
    3,
    sparse.id,
    { location: "Selected swipe's location" },
    undefined,
    { baseSnapshot: null },
  );
  await chatStorage.patchMetadata(sparse.id, {
    gameInventoryTurn: { messageId: sparseMessage.id, before: [], swipes: { "0": [], "3": [] } },
  });
  const sparseBranchResponse = await app.inject({ method: "POST", url: `/api/chats/${sparse.id}/branch`, payload: {} });
  assert.equal(sparseBranchResponse.statusCode, 200);
  const sparseBranch = sparseBranchResponse.json();
  const [sparseBranchMessage] = await chatStorage.listMessages(sparseBranch.id);
  assert(sparseBranchMessage);
  assert.deepEqual(
    sparseBranch.metadata.gameInventoryTurn,
    {
      messageId: sparseBranchMessage.id,
      before: [],
      swipes: { "0": [], "1": [] },
    },
    "the inventory record follows the same dense swipe mapping",
  );
  assert.equal(
    sparseBranchMessage.activeSwipeIndex,
    1,
    "the synthesized selected swipe follows the retained older one",
  );
  assert.equal(sparseBranchMessage.content, "CURRENT_SPARSE_SWIPE");
  assert.equal(JSON.parse(sparseBranchMessage.extra).authoritativeTag, "sparse-selected-row");
  assert.deepEqual(
    (await chatStorage.getSwipes(sparseBranchMessage.id)).map((swipe) => [swipe.index, swipe.content]),
    [
      [0, "OLDER_SPARSE_SWIPE"],
      [1, "CURRENT_SPARSE_SWIPE"],
    ],
  );
  assert.equal(
    (await engineStore.getByChatAndMessage(sparseBranch.id, sparseBranchMessage.id, 1))?.state,
    JSON.stringify({ turn: "selected-three" }),
    "game state follows the remapped selected swipe",
  );
  assert.equal(
    (await trackerStore.getByChatAndMessage(sparseBranch.id, sparseBranchMessage.id, 1))?.location,
    "Selected swipe's location",
    "tracker state follows the remapped selected swipe",
  );
  assert.deepEqual(await engineStore.listByChatAndMessage(sparseBranch.id, sparseBranchMessage.id, 3), []);
  const sparseAddedSwipe = await app.inject({
    method: "POST",
    url: `/api/chats/${sparseBranch.id}/messages/${sparseBranchMessage.id}/swipes`,
    payload: { content: "NEXT_BRANCH_ALTERNATIVE", silent: true },
  });
  assert.equal(sparseAddedSwipe.statusCode, 200);
  assert.equal(sparseAddedSwipe.json().index, 2, "the next alternate is appended without an index gap");
  const removedSelectedSparse = await app.inject({
    method: "DELETE",
    url: `/api/chats/${sparseBranch.id}/messages/${sparseBranchMessage.id}/swipes/1`,
  });
  assert.equal(removedSelectedSparse.statusCode, 200);
  assert.equal(removedSelectedSparse.json().activeSwipeIndex, 1);
  assert.equal(
    removedSelectedSparse.json().content,
    "NEXT_BRANCH_ALTERNATIVE",
    "deleting the selected swipe shows the alternate that takes its new index",
  );
  assert.deepEqual(
    (await chatStorage.getSwipes(sparseBranchMessage.id)).map((swipe) => [swipe.index, swipe.content]),
    [
      [0, "OLDER_SPARSE_SWIPE"],
      [1, "NEXT_BRANCH_ALTERNATIVE"],
    ],
  );
  assert.equal((await chatStorage.getMessage(sparseMessage.id))?.activeSwipeIndex, 3);
  assert.equal((await chatStorage.getMessage(sparseMessage.id))?.content, "CURRENT_SPARSE_SWIPE");

  const rowIds = async (table: typeof chatsTable | typeof messagesTable | typeof advancedMemoryRecords) =>
    (await db.select().from(table)).map((row) => row.id).sort();
  const beforeFailedBranch = await Promise.all([
    rowIds(chatsTable),
    rowIds(messagesTable),
    rowIds(advancedMemoryRecords),
  ]);
  const originalInsert = db.insert;
  let failedMemoryCopy = false;
  db.insert = (table) => {
    if (table === advancedMemoryRecords && !failedMemoryCopy) {
      failedMemoryCopy = true;
      throw new Error("Injected Advanced Memory branch copy failure");
    }
    return originalInsert(table);
  };
  try {
    const failedBranch = await app.inject({
      method: "POST",
      url: `/api/chats/${root.id}/branch`,
      payload: { upToMessageId: middle.id },
    });
    assert.equal(failedBranch.statusCode, 500);
    assert.equal(failedMemoryCopy, true, "the injected failure must occur inside memory transfer");
  } finally {
    db.insert = originalInsert;
  }
  assert.deepEqual(
    await Promise.all([rowIds(chatsTable), rowIds(messagesTable), rowIds(advancedMemoryRecords)]),
    beforeFailedBranch,
    "a failed memory copy must roll back the new branch and keep all original rows",
  );
  assert.deepEqual(await chatStorage.listMessages(root.id), sourceMessages);

  const transcript = await app.inject({ method: "GET", url: `/api/chats/${root.id}/export` });
  assert.equal(transcript.statusCode, 200);
  const importedMemory = await importSTChat(transcript.body, db, { mode: "roleplay" });
  assert.equal(importedMemory.success, true);
  const importedRows = await db
    .select()
    .from(advancedMemoryRecords)
    .where(eq(advancedMemoryRecords.chatId, importedMemory.chatId!));
  const importedMessages = await chatStorage.listMessages(importedMemory.chatId!);
  const importedIds = new Set(importedMessages.map((message) => message.id));
  assert.equal(importedRows.length, 4, "native transcript export/import keeps the supported scene archive");
  for (const record of importedRows) {
    assert.ok(
      JSON.parse(record.messageIds).every((id: string) => importedIds.has(id)),
      "import remaps every source ID",
    );
    assert.equal(record.embedding, null, "imported vectors must be rebuilt for the current embedding space");
  }
  assert.equal(importedRows.find((record) => record.content === "USER_CORRECTED_MEMORY")?.enabled, 0);
  const changedTranscript = transcript.body
    .split("\n")
    .map((line: string, index: number) => {
      const value = JSON.parse(line);
      if (index === 2) value.mes = "The imported source was edited.";
      return JSON.stringify(value);
    })
    .join("\n");
  const changedImport = await importSTChat(changedTranscript, db, { mode: "roleplay" });
  assert.equal(changedImport.success, true);
  const changedRows = await db
    .select()
    .from(advancedMemoryRecords)
    .where(eq(advancedMemoryRecords.chatId, changedImport.chatId!));
  assert.equal(
    changedRows.some((record) => record.content === "FUTURE_SECRET"),
    false,
    "changed imported source text must not bless an old derived scene as current",
  );

  const macroChat = await create("Macro memory export");
  await chatStorage.patchMetadata(macroChat.id, { advancedMemory: { enabled: true } });
  const macroMessage = await addMessage(macroChat.id, "A promise made to {{user}}.");
  await db.insert(advancedMemoryRecords).values([
    {
      ...memoryFixture(`scene-${macroMessage.id}`, `scene-${macroMessage.id}`, [macroMessage.id], ""),
      chatId: macroChat.id,
    },
    {
      ...memoryFixture("macro-memory", `scene-${macroMessage.id}`, [macroMessage.id], "THE_PROMISE"),
      chatId: macroChat.id,
    },
  ]);
  await memoryService.refreshTransferredRecords(macroChat.id);
  const macroTranscript = await app.inject({ method: "GET", url: `/api/chats/${macroChat.id}/export` });
  assert.equal(macroTranscript.statusCode, 200);
  const exportedMacroMessage = JSON.parse(macroTranscript.body.split("\n")[1]);
  assert.equal(exportedMacroMessage.mes, "A promise made to User.");
  const macroImport = await importSTChat(macroTranscript.body, db, { mode: "roleplay" });
  assert.equal(macroImport.success, true);
  const macroRows = await db
    .select()
    .from(advancedMemoryRecords)
    .where(eq(advancedMemoryRecords.chatId, macroImport.chatId!));
  assert.equal(
    macroRows.find((record) => record.content === "THE_PROMISE")?.enabled,
    1,
    "valid enabled memory survives JSONL macro resolution with the exact exported source digest",
  );
  const tamperedMacro = macroTranscript.body
    .split("\n")
    .map((line: string, index: number) => {
      const value = JSON.parse(line);
      if (index === 1) value.mes = "A different promise.";
      return JSON.stringify(value);
    })
    .join("\n");
  const tamperedMacroImport = await importSTChat(tamperedMacro, db, { mode: "roleplay" });
  assert.equal(tamperedMacroImport.success, true);
  const tamperedMacroRows = await db
    .select()
    .from(advancedMemoryRecords)
    .where(eq(advancedMemoryRecords.chatId, tamperedMacroImport.chatId!));
  assert.equal(
    tamperedMacroRows.some((record) => record.content === "THE_PROMISE"),
    false,
    "resolved-content digests must still reject changed imported source text",
  );

  const game = await create("Branch-scoped GM state", "game");
  const keptGameMessage = await addMessage(game.id, '[widget: clues, add: "First clue"]', "assistant");
  const omittedGameMessage = await addMessage(game.id, '[widget: clues, add: "Future clue"]', "assistant");
  await chatStorage.updateMetadata(game.id, {
    gameBlueprint: {
      hudWidgets: [
        {
          id: "clues",
          type: "list",
          label: "Clues",
          position: "hud_left",
          config: { items: [] },
        },
      ],
    },
    gameWidgetState: [
      {
        id: "clues",
        type: "list",
        label: "Clues",
        position: "hud_left",
        config: { items: ["First clue", "Future clue"] },
      },
    ],
    gameJournal: {
      entries: [
        {
          timestamp: keptGameMessage.createdAt,
          type: "location",
          title: "Discovered: Old Hall",
          content: "The first path.",
          sourceMessageId: keptGameMessage.id,
        },
        {
          timestamp: omittedGameMessage.createdAt,
          type: "location",
          title: "Discovered: Future Vault",
          content: "The abandoned path.",
          sourceMessageId: omittedGameMessage.id,
        },
      ],
      quests: [],
      locations: ["Old Hall", "Future Vault"],
      npcLog: [],
      inventoryLog: [],
    },
  });
  const gameBranchResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${game.id}/branch`,
    payload: { upToMessageId: keptGameMessage.id },
  });
  assert.equal(gameBranchResponse.statusCode, 200);
  const gameBranch = gameBranchResponse.json();
  assert.deepEqual(gameBranch.metadata.gameJournal.locations, ["Old Hall"]);
  assert.deepEqual(
    gameBranch.metadata.gameJournal.entries.map((entry: { title: string }) => entry.title),
    ["Discovered: Old Hall"],
  );
  assert.deepEqual(gameBranch.metadata.gameWidgetState[0].config.items, ["First clue"]);
  const gameBranchMessagesResponse = await app.inject({
    method: "GET",
    url: `/api/chats/${gameBranch.id}/messages`,
  });
  assert.equal(gameBranchMessagesResponse.statusCode, 200);
  const gameBranchMessages = gameBranchMessagesResponse.json();
  assert.equal(gameBranch.metadata.gameJournal.entries[0].sourceMessageId, gameBranchMessages[0].id);
  await addMessage(gameBranch.id, "future branch path", "assistant");
  const nestedGameBranchResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${gameBranch.id}/branch`,
    payload: { upToMessageId: gameBranchMessages[0].id },
  });
  assert.equal(nestedGameBranchResponse.statusCode, 200);
  const nestedGameBranch = nestedGameBranchResponse.json();
  assert.deepEqual(
    nestedGameBranch.metadata.gameJournal.entries.map((entry: { title: string }) => entry.title),
    ["Discovered: Old Hall"],
    "Journal entries must survive branching from a branch",
  );

  const persistence = createCapabilityPersistenceHost(db);
  const listed = await persistence.listChats();
  assert.equal((await persistence.getChat(root.id))?.branch, null);
  const listedBranch = listed.find((chat) => chat.id === branch.id);
  assert.deepEqual(listedBranch?.branch, {
    title: "New Branch",
    parentChatId: root.id,
    parentMessageId: middle.id,
    childMessageId: branch.metadata.branchMessageId,
  });
  assert.deepEqual((await persistence.getChat(branch.id))?.branch, listedBranch?.branch);

  const conversation = await create("Conversation scene origin", "conversation");
  const conversationMessage = await addMessage(conversation.id, "Convert this conversation into a scene");
  const conversationSwipeResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${conversation.id}/messages/${conversationMessage.id}/swipes`,
    payload: { content: "Play the alternate continuation", silent: true },
  });
  assert.equal(conversationSwipeResponse.statusCode, 200);
  const conversationSwipe = conversationSwipeResponse.json();
  assert.equal(conversationSwipe.index, 1);
  const conversationState = JSON.stringify({ position: "after-e4", turn: "black" });
  const olderConversationState = JSON.stringify({ position: "opening", turn: "white" });
  const alternateConversationState = JSON.stringify({ position: "after-d4", turn: "black" });
  const conversationBootstrapState = JSON.stringify({ phase: "waiting-for-players" });
  const olderConversationStateId = await engineStore.create({
    chatId: conversation.id,
    messageId: "legacy-chess-history",
    swipeIndex: 0,
    gameType: "chess",
    schemaVersion: 1,
    state: olderConversationState,
    committed: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 2));
  await engineStore.create({
    chatId: conversation.id,
    messageId: conversationMessage.id,
    swipeIndex: 0,
    gameType: "chess",
    schemaVersion: 1,
    state: conversationState,
    committed: true,
  });
  await engineStore.reanchor(olderConversationStateId, conversationMessage.id, 0);
  assert.equal(
    (await engineStore.getByChatAndMessage(conversation.id, conversationMessage.id, 0))?.state,
    conversationState,
  );
  await engineStore.create({
    chatId: conversation.id,
    messageId: conversationMessage.id,
    swipeIndex: conversationSwipe.index,
    gameType: "chess",
    schemaVersion: 1,
    state: alternateConversationState,
    committed: true,
  });
  await engineStore.create({
    chatId: conversation.id,
    messageId: "",
    swipeIndex: 0,
    gameType: "uno",
    schemaVersion: 1,
    state: conversationBootstrapState,
    committed: true,
  });
  const conversationBranchResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${conversation.id}/branch`,
    payload: {},
  });
  assert.equal(conversationBranchResponse.statusCode, 200);
  const conversationBranch = conversationBranchResponse.json();
  const conversationBranchMessagesResponse = await app.inject({
    method: "GET",
    url: `/api/chats/${conversationBranch.id}/messages`,
  });
  assert.equal(conversationBranchMessagesResponse.statusCode, 200);
  const conversationBranchMessages = conversationBranchMessagesResponse.json();
  const copiedConversationState = await engineStore.listByChatAndMessage(
    conversationBranch.id,
    conversationBranchMessages.at(-1).id,
    0,
  );
  assert.equal(copiedConversationState.length, 1, "Conversation branches must retain turn-game state");
  assert.equal(copiedConversationState[0].gameType, "chess");
  assert.equal(copiedConversationState[0].state, conversationState);
  assert.equal(copiedConversationState[0].committed, 1);
  const copiedAlternateConversationState = await engineStore.listByChatAndMessage(
    conversationBranch.id,
    conversationBranchMessages.at(-1).id,
    conversationSwipe.index,
  );
  assert.equal(copiedAlternateConversationState.length, 1);
  assert.equal(copiedAlternateConversationState[0].messageId, conversationBranchMessages.at(-1).id);
  assert.equal(copiedAlternateConversationState[0].swipeIndex, 1);
  assert.equal(copiedAlternateConversationState[0].state, alternateConversationState);
  const copiedConversationBootstrap = await engineStore.listByChatAndMessage(conversationBranch.id, "", 0);
  assert.equal(copiedConversationBootstrap.length, 1, "Conversation branches must retain bootstrap turn-game state");
  assert.equal(copiedConversationBootstrap[0].gameType, "uno");
  assert.equal(copiedConversationBootstrap[0].state, conversationBootstrapState);
  const groupedConversation = (await app.inject({ method: "GET", url: `/api/chats/${conversation.id}` })).json();
  assert.equal(typeof groupedConversation.groupId, "string");

  const presetResponse = await app.inject({ method: "POST", url: "/api/prompts", payload: { name: "Scene preset" } });
  assert.equal(presetResponse.statusCode, 200);
  const scenePresetId = presetResponse.json().id;
  const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
  const prompts = createPromptsStorage(db);
  await prompts.createSection({
    presetId: scenePresetId,
    identifier: "scene_style",
    name: "Scene style",
    content: "Opening style: {{length}} Model: {{model}}",
    role: "system",
  });
  await prompts.createChoiceBlock({
    presetId: scenePresetId,
    variableName: "length",
    question: "Detail?",
    options: [
      { id: "brief", label: "Brief", value: "Write briefly." },
      { id: "detail", label: "Detailed", value: "Write in detail." },
    ],
  });
  await prompts.update(scenePresetId, { defaultChoices: { length: "Write in detail." } });
  for (const [variableName, multiSelect, randomPick] of [
    ["mood", true, false],
    ["surprise", false, true],
  ] as const) {
    await prompts.createChoiceBlock({
      presetId: scenePresetId,
      variableName,
      question: "Mood?",
      multiSelect,
      randomPick,
      options: [
        { id: "calm", label: "Calm", value: "calm" },
        { id: "bright", label: "Bright", value: "bright" },
      ],
    });
  }
  const sceneCreatePayload = {
    originChatId: conversation.id,
    promptPresetId: scenePresetId,
    presetChoices: { length: "Write briefly.", mood: [], surprise: ["calm", "bright"] },
    initiatorCharId: null,
    plan: {
      name: "Converted roleplay scene",
      description: "A quiet laboratory after midnight.",
      scenario: "Verify cross-mode lineage remains separate.",
      firstMessage: "The instruments hum softly.",
      background: null,
      characterIds: [],
      systemPrompt: "Keep the scene concise.",
      rating: "sfw",
      relationshipHistory: "A regression fixture.",
      participationGuide: "Continue the scene.",
    },
  };
  for (const promptPresetId of [42, "missing-preset"]) {
    const rejected = await app.inject({
      method: "POST",
      url: "/api/scene/create",
      payload: { ...sceneCreatePayload, promptPresetId },
    });
    assert.equal(rejected.statusCode, 400, "Unavailable scene presets must not silently fall back");
  }
  const sceneCreateResponse = await app.inject({
    method: "POST",
    url: "/api/scene/create",
    payload: sceneCreatePayload,
  });
  assert.equal(sceneCreateResponse.statusCode, 200);
  const sceneChatId = sceneCreateResponse.json().chatId;
  const sceneChat = (await app.inject({ method: "GET", url: `/api/chats/${sceneChatId}` })).json();
  assert.equal(sceneChat.mode, "roleplay");
  assert.equal(sceneChat.promptPresetId, scenePresetId);
  const sceneMetadata = typeof sceneChat.metadata === "string" ? JSON.parse(sceneChat.metadata) : sceneChat.metadata;
  assert.deepEqual(sceneMetadata.presetChoices, sceneCreatePayload.presetChoices);
  assert.match(sceneMetadata.sceneSystemPrompt, /^Keep the scene concise\./);
  assert.equal(sceneChat.groupId, null, "A converted scene must not join the conversation branch group");

  // Exercise the actual scene planner/provider boundary, not just metadata persistence.
  const requests: Array<{ messages: Array<{ content: string }> }> = [];
  const provider = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    requests.push(JSON.parse(Buffer.concat(chunks).toString()));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(sceneCreatePayload.plan) }, finish_reason: "stop" }],
      }),
    );
  });
  try {
    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    const address = provider.address();
    assert.ok(address && typeof address !== "string");
    const connection = await app.inject({
      method: "POST",
      url: "/api/connections",
      payload: {
        name: "Scene planner fixture",
        provider: "custom",
        model: "fixture",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
      },
    });
    assert.equal(connection.statusCode, 200, connection.body);
    for (const [selection, expected] of [
      [{ length: "Write briefly." }, "Write briefly."],
      [undefined, "Write in detail."],
      [{}, "Write in detail."],
      [{ length: "" }, ""],
      [{ length: [], mood: [] }, ""],
      [{ mood: ["calm", "bright"], surprise: ["calm", "bright"] }, "Write in detail."],
    ] as const) {
      const response = await app.inject({
        method: "POST",
        url: "/api/scene/plan",
        payload: {
          chatId: conversation.id,
          prompt: "A quiet experiment",
          connectionId: connection.json().id,
          promptPreferences: {
            pov: "first_person",
            tense: "past",
            promptPresetId: scenePresetId,
            presetChoices: selection,
          },
        },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json().plan.firstMessage, sceneCreatePayload.plan.firstMessage);
      const sent = requests
        .at(-1)!
        .messages.map((message) => message.content)
        .join("\n");
      assert.ok(
        sent.includes(`Opening style: ${expected}`),
        "The initial provider request must contain the resolved scene choice",
      );
      assert.ok(!sent.includes("{{length}}"), "Choice placeholders must be resolved before planning");
      assert.ok(sent.includes("Model: fixture"), "Preset model macros must use the scene connection's model");
      assert.ok(sent.includes("Return ONLY a JSON object"), "Scene output format remains authoritative");
    }
    const count = requests.length;
    const chatsBeforeInvalidChoices = (await app.inject({ method: "GET", url: "/api/chats" })).json();
    for (const preferences of [
      { promptPresetId: "missing-preset" },
      { promptPresetId: scenePresetId, presetChoices: { length: 42 } },
      { promptPresetId: scenePresetId, presetChoices: { unknown: "calm" } },
      { promptPresetId: scenePresetId, presetChoices: { length: "outside the preset" } },
      { promptPresetId: scenePresetId, presetChoices: { length: ["Write briefly."] } },
      { promptPresetId: scenePresetId, presetChoices: { length: ["Write briefly.", "Write in detail."] } },
      { promptPresetId: scenePresetId, presetChoices: { mood: "calm" } },
      { promptPresetId: scenePresetId, presetChoices: { mood: ["calm", "calm"] } },
      { promptPresetId: scenePresetId, presetChoices: { mood: ["unknown"] } },
      { promptPresetId: null, presetChoices: { length: "Write briefly." } },
    ]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/scene/plan",
        payload: {
          chatId: conversation.id,
          connectionId: connection.json().id,
          prompt: "A quiet experiment",
          promptPreferences: { pov: "first_person", tense: "past", ...preferences },
        },
      });
      assert.equal(response.statusCode, 400, `Invalid planning choices: ${JSON.stringify(preferences)}`);
      assert.equal(requests.length, count, "Invalid selections must not call the provider");
      const created = await app.inject({
        method: "POST",
        url: "/api/scene/create",
        payload: {
          ...sceneCreatePayload,
          ...preferences,
        },
      });
      assert.equal(created.statusCode, 400, `Invalid creation choices: ${JSON.stringify(preferences)}`);
      assert.deepEqual(
        (await app.inject({ method: "GET", url: "/api/chats" })).json(),
        chatsBeforeInvalidChoices,
        "Invalid choices must not create a scene or change the origin chat metadata",
      );
    }
  } finally {
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }

  const distinctSceneGroupId = "scene-owned-branch-group";
  const distinctScenePatch = await app.inject({
    method: "PATCH",
    url: `/api/chats/${sceneChat.id}`,
    payload: { groupId: distinctSceneGroupId },
  });
  assert.equal(distinctScenePatch.statusCode, 200);
  const distinctGroupForkResponse = await app.inject({
    method: "POST",
    url: "/api/scene/fork",
    payload: { sceneChatId: sceneChat.id, mode: "clone" },
  });
  assert.equal(distinctGroupForkResponse.statusCode, 200);
  const distinctGroupFork = (
    await app.inject({ method: "GET", url: `/api/chats/${distinctGroupForkResponse.json().chatId}` })
  ).json();
  assert.equal(
    distinctGroupFork.groupId,
    distinctSceneGroupId,
    "Forking a scene with its own branch group must preserve that group",
  );

  const legacyScenePatch = await app.inject({
    method: "PATCH",
    url: `/api/chats/${sceneChat.id}`,
    payload: { groupId: groupedConversation.groupId },
  });
  assert.equal(legacyScenePatch.statusCode, 200);
  const sceneForkResponse = await app.inject({
    method: "POST",
    url: "/api/scene/fork",
    payload: { sceneChatId: sceneChat.id, mode: "convert" },
  });
  assert.equal(sceneForkResponse.statusCode, 200);
  const forkedSceneChat = (
    await app.inject({ method: "GET", url: `/api/chats/${sceneForkResponse.json().chatId}` })
  ).json();
  assert.equal(
    forkedSceneChat.groupId,
    null,
    "Forking a legacy converted scene must not retain a cross-mode branch group",
  );

  const exportResponse = await app.inject({
    method: "GET",
    url: `/api/chats/${branch.id}/export?format=jsonl`,
  });
  assert.equal(exportResponse.statusCode, 200);
  const exportedMetadata = JSON.parse(exportResponse.body.split("\n")[0]).chat_metadata;
  assert.equal(exportedMetadata.branchName, "New Branch");
  for (const key of ["branchParentChatId", "branchParentMessageId", "branchMessageId"]) {
    assert.equal(key in exportedMetadata, false);
    assert.equal(key in exportedMetadata.marinara_metadata, false);
  }

  const exportGame = await create("Visible narration export", "game");
  const editedExportMessage = await addMessage(
    exportGame.id,
    "Narration: Original first segment.\n\nNarration: Removed second segment.",
    "assistant",
  );
  await app.inject({
    method: "POST",
    url: `/api/chats/${exportGame.id}/messages/${editedExportMessage.id}/swipes`,
    payload: {
      content: "Narration: Alternate first segment.\n\nNarration: Removed alternate segment.",
      silent: true,
    },
  });
  const deletedExportMessage = await addMessage(exportGame.id, "Narration: Entirely removed message.", "assistant");
  const segmentMetadata = {
    [`segmentEdit:${editedExportMessage.id}:0`]: { content: "Visible edited segment." },
    [`segmentDelete:${editedExportMessage.id}:1`]: true,
    [`segmentDelete:${deletedExportMessage.id}:0`]: true,
  };
  const exportMetadataResponse = await app.inject({
    method: "PATCH",
    url: `/api/chats/${exportGame.id}/metadata`,
    payload: segmentMetadata,
  });
  assert.equal(exportMetadataResponse.statusCode, 200);

  const gameJsonlExport = await app.inject({
    method: "GET",
    url: `/api/chats/${exportGame.id}/export?format=jsonl`,
  });
  assert.equal(gameJsonlExport.statusCode, 200);
  const gameJsonlLines = gameJsonlExport.body.split("\n").map((line: string) => JSON.parse(line));
  assert.equal(gameJsonlLines.length, 2, "an entirely deleted Game message must be omitted from JSONL");
  assert.equal(gameJsonlLines[1].mes, "Visible edited segment.");
  assert.deepEqual(gameJsonlLines[1].swipes, ["Visible edited segment.", "Visible edited segment."]);
  for (const key of Object.keys(segmentMetadata)) {
    assert.equal(key in gameJsonlLines[0].chat_metadata, false);
    assert.equal(key in gameJsonlLines[0].chat_metadata.marinara_metadata, false);
  }

  const gameTextExport = await app.inject({
    method: "GET",
    url: `/api/chats/${exportGame.id}/export?format=text`,
  });
  assert.equal(gameTextExport.statusCode, 200);
  assert.match(gameTextExport.body, /Visible edited segment\./u);
  assert.doesNotMatch(gameTextExport.body, /Removed second segment|Entirely removed message/u);

  const malformed = await create("Malformed metadata");
  const malformedMetadataResponse = await app.inject({
    method: "PATCH",
    url: `/api/chats/${malformed.id}/metadata`,
    payload: {
      branchName: "  Imported sibling  ",
      branchParentChatId: "foreign-chat",
      branchParentMessageId: "only-one-anchor",
      branchMessageId: 12,
    },
  });
  assert.equal(malformedMetadataResponse.statusCode, 200);
  assert.deepEqual((await persistence.getChat(malformed.id))?.branch, {
    title: "Imported sibling",
    parentChatId: null,
    parentMessageId: null,
    childMessageId: null,
  });

  const deleted = await app.inject({ method: "DELETE", url: `/api/chats/${root.id}` });
  assert.equal(deleted.statusCode, 204);
  const survivingChild = await app.inject({ method: "GET", url: `/api/chats/${branch.id}` });
  assert.equal(survivingChild.statusCode, 200);
  assert.equal(survivingChild.json().metadata.branchParentChatId, root.id);

  const profileExport = await app.inject({ method: "GET", url: "/api/backup/export-profile" });
  assert.equal(profileExport.statusCode, 200, profileExport.body);
  const profile = profileExport.json();
  const backedUpRecords = profile.data.fileStorage.tables.advanced_memory_records;
  assert.ok(Array.isArray(backedUpRecords), "native backups must discover the managed memory table");
  const backedUpCorrection = backedUpRecords.find((record: { id: string }) => record.id === retainedCorrection!.id);
  assert.ok(backedUpCorrection);
  await db.delete(advancedMemoryRecords).where(eq(advancedMemoryRecords.id, retainedCorrection!.id));
  const profileImport = await app.inject({ method: "POST", url: "/api/backup/import-profile", payload: profile });
  assert.equal(profileImport.statusCode, 200, profileImport.body);
  const restoredCorrection = (
    await db.select().from(advancedMemoryRecords).where(eq(advancedMemoryRecords.id, retainedCorrection!.id))
  )[0];
  assert.deepEqual(
    restoredCorrection,
    backedUpCorrection,
    "profile restore retains source anchors and manual/disabled provenance",
  );
} finally {
  await app?.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("Chat branch lineage regression passed");
