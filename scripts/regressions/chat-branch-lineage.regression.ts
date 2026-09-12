import assert from "node:assert/strict";
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
  await db
    .insert(advancedMemoryRecords)
    .values([
      memoryFixture(`scene-${first.id}`, `scene-${first.id}`, [first.id], ""),
      memoryFixture("edited-disabled-scene", `scene-${first.id}`, [first.id], "USER_CORRECTED_MEMORY", 0, 1),
      memoryFixture(`scene-${middle.id}`, `scene-${middle.id}`, [middle.id, future.id], ""),
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

  const { chats: chatsTable, messages: messagesTable } = await import("../../packages/server/src/db/schema/chats.js");
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

  const sceneCreateResponse = await app.inject({
    method: "POST",
    url: "/api/scene/create",
    payload: {
      originChatId: conversation.id,
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
    },
  });
  assert.equal(sceneCreateResponse.statusCode, 200);
  const sceneChatId = sceneCreateResponse.json().chatId;
  const sceneChat = (await app.inject({ method: "GET", url: `/api/chats/${sceneChatId}` })).json();
  assert.equal(sceneChat.mode, "roleplay");
  assert.equal(sceneChat.groupId, null, "A converted scene must not join the conversation branch group");

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
