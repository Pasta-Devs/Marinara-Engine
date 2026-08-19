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
} finally {
  await app?.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("Chat branch lineage regression passed");
