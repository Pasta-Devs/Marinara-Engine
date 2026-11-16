// Mari reading chat messages: the last requested messages and pages inside a post-number range, plus the dice tool
// an agent gets when roll_dice is on. Runs on a fresh database in a temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chats, messages } from "../../../packages/server/src/db/schema/index.js";
import { createAgentsStorage } from "../../../packages/server/src/services/storage/agents.storage.js";
import { createCustomToolsStorage } from "../../../packages/server/src/services/storage/custom-tools.storage.js";
import { createChatPresetsStorage } from "../../../packages/server/src/services/storage/chat-presets.storage.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-mari-chat-message-ranges-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;
let closeDb: (() => Promise<void>) | null = null;
try {
  const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  const db = await getDB();
  const chatPresetStorage = createChatPresetsStorage(db);
  await chatPresetStorage.ensureDefaults();
  const mariDb = new MariDbService(db);
  const rangedChatId = "professor-mari-range-regression";
  const rangedChatTimestamp = "2026-07-30T12:00:00.000Z";
  await db.insert(chats).values({
    id: rangedChatId,
    name: "Professor Mari range regression",
    mode: "roleplay",
    characterIds: "[]",
    metadata: "{}",
    sortOrder: 0,
    createdAt: rangedChatTimestamp,
    updatedAt: rangedChatTimestamp,
  });
  for (let index = 1; index <= 6; index += 1) {
    await db.insert(messages).values({
      id: `${rangedChatId}-${index}`,
      chatId: rangedChatId,
      role: index % 2 === 0 ? "assistant" : "user",
      content: `Message ${index}`,
      activeSwipeIndex: 0,
      extra: "{}",
      createdAt: `2026-07-30T12:00:0${index}.000Z`,
    });
  }
  const lastMessagesResult = await mariDb.executeCli({
    argv: ["chats", "messages", rangedChatId, "--last", "3"],
  });
  assert.deepEqual(
    (lastMessagesResult.output as Array<{ postNumber: number; content: string }>).map(({ postNumber, content }) => ({
      postNumber,
      content,
    })),
    [
      { postNumber: 4, content: "Message 4" },
      { postNumber: 5, content: "Message 5" },
      { postNumber: 6, content: "Message 6" },
    ],
    "Professor Mari must be able to retrieve exactly the last requested messages",
  );
  const afterPostResult = await mariDb.executeCli({
    argv: ["chats", "messages", rangedChatId, "--after-post", "2", "--limit", "2", "--offset", "1"],
  });
  assert.deepEqual(
    (afterPostResult.output as Array<{ postNumber: number; content: string }>).map(({ postNumber, content }) => ({
      postNumber,
      content,
    })),
    [
      { postNumber: 4, content: "Message 4" },
      { postNumber: 5, content: "Message 5" },
    ],
    "Professor Mari must page inside the requested post-number range",
  );
  const invalidRangeResult = await mariDb.executeCli({
    argv: ["chats", "messages", rangedChatId, "--last", "201"],
  });
  assert.equal(invalidRangeResult.ok, false);
  assert.match(String(invalidRangeResult.error), /--last must be an integer from 1 to 200/u);
  const customToolsStore = createCustomToolsStorage(db);
  const agentsStore = createAgentsStorage(db);
  const customTool = await customToolsStore.create({
    name: "phantom_tool",
    description: "Custom tool deletion regression fixture.",
    parametersSchema: {},
    executionType: "static",
    webhookUrl: null,
    staticResult: "fixture",
    scriptBody: null,
    includeHiddenContext: false,
    enabled: true,
  });
  assert.ok(customTool);
  const toolAgent = await agentsStore.create({
    type: "custom-tool-cleanup-regression",
    name: "Custom Tool Cleanup Regression",
    description: "",
    phase: "parallel",
    connectionId: null,
    imagePath: null,
    promptTemplate: "",
    settings: { enabledTools: ["phantom_tool", "roll_dice"] },
  });
  assert.ok(toolAgent);
  await customToolsStore.remove(customTool.id);
  const cleanedToolAgent = await agentsStore.getById(toolAgent.id);
  assert.deepEqual(JSON.parse(cleanedToolAgent?.settings ?? "{}").enabledTools, ["roll_dice"]);
  const { resolveGenerationTools } =
    await import("../../../packages/server/src/services/generation/tool-resolution-runtime.js");
  const diceAgent = {
    id: "dice-agent-regression",
    type: "dice-agent-regression",
    name: "Dice Agent Regression",
    phase: "parallel",
    promptTemplate: "Roll the configured dice.",
    connectionId: null,
    settings: { enabledTools: ["roll_dice"] },
    isCustomAgent: true,
    provider: {},
    model: "regression",
  } as any;
  await resolveGenerationTools({
    requestBody: {},
    chatId: rangedChatId,
    chatMetadata: {},
    chats: {
      async getMessage() {
        return null;
      },
      async updateMessageContent() {
        return null;
      },
      async patchMetadata(_chatId, patcher) {
        return { metadata: await patcher({}) };
      },
    },
    agentsStore,
    customToolsStore,
    lorebooksStore: {
      async listActiveEntries() {
        return [];
      },
      async getById() {
        return null;
      },
      async listEntries() {
        return [];
      },
      async createEntry() {
        return null;
      },
      async updateEntry() {
        return null;
      },
    },
    resolvedAgents: [diceAgent],
    enabledConfigs: [],
    promptCharacterIds: [],
    personaId: null,
    activeLorebookIds: [],
    excludedLorebookIds: [],
    excludedSourceAgentIds: [],
    gameState: null,
    gameSpotifyMusicEnabled: false,
    agentContext: {
      chatId: rangedChatId,
      chatMode: "roleplay",
      recentMessages: [],
      mainResponse: null,
      gameState: null,
      characters: [],
      persona: null,
      memory: {},
      writableLorebookIds: null,
      chatSummary: null,
    },
    emitMetadataPatch() {},
  });
  assert.deepEqual(
    diceAgent.toolContext?.tools.map((tool: { function: { name: string } }) => tool.function.name),
    ["roll_dice"],
    "An agent that enables roll_dice must receive the built-in dice definition",
  );
  const diceResult = JSON.parse(
    await diceAgent.toolContext.executeToolCall({
      id: "dice-agent-regression-call",
      type: "function",
      function: { name: "roll_dice", arguments: JSON.stringify({ notation: "1d2" }) },
    }),
  );
  assert.ok(
    diceResult.total === 1 || diceResult.total === 2,
    "The agent tool context must execute roll_dice through the shared executor",
  );
} finally {
  await closeDb?.();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(storageRoot, { recursive: true, force: true });
}
