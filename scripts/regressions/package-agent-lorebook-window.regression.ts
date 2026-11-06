import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-package-reference-window-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { resolvePackageAgentLorebookEntries } =
  await import("../../packages/server/src/services/capability-packages/capability-agent-lorebook.service.js");
const { createAgentLorebookTriggerResolver } =
  await import("../../packages/server/src/services/generation/agent-lorebook-triggers.js");
const { resolveMemoryRecallEmbeddingSource } =
  await import("../../packages/server/src/services/memory-recall-embedding.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
const { replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");
const agentType = "window-reference-writer";
replaceBuiltInAgentDefinitions([
  {
    id: agentType,
    name: "Window reference writer",
    description: "Isolated fixture",
    category: "writer",
    phase: "pre_generation",
    defaultPromptTemplate: "WINDOW_REFERENCE_TASK",
  },
]);
const prompts: string[] = [];
OpenAIProvider.prototype.chat = async function* () {
  yield "The room remains quiet.";
  return { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
};
OpenAIProvider.prototype.chatComplete = async (messages) => {
  prompts.push(messages.map((message) => String(message.content)).join("\n"));
  return {
    content: '{"text":"Reference checked."}',
    toolCalls: [],
    finishReason: "stop",
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  };
};
const embeddingBatches: string[][] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const { input } = JSON.parse(Buffer.concat(chunks).toString()) as { input: string[] };
  embeddingBatches.push(input);
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ data: input.map((_, index) => ({ index, embedding: [0, 1] })) }));
});
const db = await getDB();
const chats = createChatsStorage(db);
const agents = createAgentsStorage(db);
const books = createLorebooksStorage(db);
const app = require("fastify")();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Local reference fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    embeddingModel: "fixture",
    treatAsLocalEndpoint: true,
  });
  const config = await agents.create({
    type: agentType,
    name: agentType,
    phase: "pre_generation",
    connectionId: connection.id,
    promptTemplate: "WINDOW_REFERENCE_TASK",
    settings: { resultType: "context_injection", batchWithOtherAgents: false, contextSize: 2 },
  });
  const book = await books.create({
    name: "Bounded reference",
    vectorQueryDepth: 0,
    vectorIncludeAssistant: true,
    excludeFromVectorization: false,
  });
  assert(config && book);
  for (const [name, key, depth] of [
    ["OLDEST_DEFAULT", "oldest-key", null],
    ["OLDEST_DEPTH_TWO", "oldest-key", 2],
    ["OLDEST_DEPTH_ONE", "oldest-key", 1],
    ["LATEST_DEPTH_ONE", "latest-key", 1],
    ["GUIDE_DEFAULT", "guide-key", null],
    ["GUIDE_DEPTH_ONE", "guide-key", 1],
    ["GUIDE_SCAN_ALL", "guide-key", 0],
    ["OUTSIDE_SCAN_ALL", "outside-key", 0],
  ] as const)
    await books.createEntry({ lorebookId: book.id, name, keys: [key], content: name, scanDepth: depth });
  const makeChat = async (guide: boolean) => {
    const chat = await chats.create({
      name: "Long history",
      mode: "roleplay",
      characterIds: [],
      connectionId: connection.id,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: true,
      enableTools: false,
      activeAgentIds: [agentType],
      agentLorebookAttachments: { [agentType]: { enabled: true, lorebookId: book.id } },
      macroVariables: { guide: "guide-key" },
    });
    for (let index = 0; index < 32; index++)
      await chats.createMessage({ chatId: chat.id, role: "assistant", content: "outside-key" });
    await chats.createMessage({ chatId: chat.id, role: "user", content: "oldest-key" });
    await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      content: "latest-key",
      extra: guide
        ? { generationReplay: { generationGuide: "{{getvar::guide}}", generationGuideSource: "guide" } }
        : {},
    });
    return chat;
  };
  const ordinary = await makeChat(false);
  const guided = await makeChat(true);
  const failures: unknown[] = [];
  const check = (run: () => void) => {
    try {
      run();
    } catch (error) {
      failures.push(error);
    }
  };
  const ordinaryEntries = await resolvePackageAgentLorebookEntries(db, agentType, { chatId: ordinary.id });
  const ordinaryNames = ordinaryEntries.map((entry) => entry.name).sort();
  assert.deepEqual(ordinaryNames, ["LATEST_DEPTH_ONE", "OLDEST_DEFAULT", "OLDEST_DEPTH_TWO"]);
  const storedBefore = await chats.listMessages(guided.id);
  const copies: string[] = [];
  const originalSlice = Array.prototype.slice;
  const originalFilter = Array.prototype.filter;
  const originalReverse = Array.prototype.reverse;
  const noteCopy = (array: unknown[], method: string) => {
    if (
      array.length > 2 &&
      array.every((row) => row && typeof row === "object" && "chatId" in row && row.chatId === guided.id) &&
      new Error().stack?.includes("capability-agent-lorebook.service")
    )
      copies.push(method);
  };
  Array.prototype.slice = function (...args) {
    noteCopy(this, "slice");
    return originalSlice.apply(this, args);
  };
  Array.prototype.filter = function (...args) {
    noteCopy(this, "filter");
    return originalFilter.apply(this, args);
  };
  Array.prototype.reverse = function () {
    noteCopy(this, "reverse");
    return originalReverse.call(this);
  };
  let guidedEntries;
  try {
    guidedEntries = await resolvePackageAgentLorebookEntries(db, agentType, { chatId: guided.id });
  } finally {
    Array.prototype.slice = originalSlice;
    Array.prototype.filter = originalFilter;
    Array.prototype.reverse = originalReverse;
  }
  console.info("Package long-history copies:", copies);
  check(() => assert.deepEqual(copies, [], "the service never copies the full visible transcript"));
  check(() =>
    assert.deepEqual(
      guidedEntries.map((entry) => entry.name).sort(),
      ["GUIDE_DEFAULT", "GUIDE_DEPTH_ONE", "GUIDE_SCAN_ALL", ...ordinaryNames].sort(),
      "the guide supplements the configured history and each entry depth",
    ),
  );
  assert.deepEqual(
    await chats.listMessages(guided.id),
    storedBefore,
    "scan-only guide text and macros never modify stored messages",
  );
  const generated = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: ordinary.id } });
  assert.equal(generated.statusCode, 200, generated.body);
  assert(!generated.body.includes('"type":"error"'), generated.body);
  const agentPrompt = prompts.find((prompt) => prompt.includes("WINDOW_REFERENCE_TASK"));
  assert(agentPrompt, "the actual normal route executes the reference agent");
  for (const name of ordinaryNames) assert(agentPrompt.includes(name!), `normal route retains ${name}`);
  assert(!agentPrompt.includes("OUTSIDE_SCAN_ALL"), "normal and package paths share the configured history boundary");

  const vectorEntry = await books.createEntry({
    lorebookId: book.id,
    name: "Semantic fixture",
    keys: ["absent-key"],
    content: "SEMANTIC",
  });
  assert(vectorEntry);
  const embeddingSource = await resolveMemoryRecallEmbeddingSource(db, { connectionId: connection.id });
  assert(embeddingSource);
  await books.updateEntryEmbedding(vectorEntry.id, [1, 0], embeddingSource.spaceId);
  embeddingBatches.length = 0;
  await resolvePackageAgentLorebookEntries(db, agentType, { chatId: guided.id });
  const query = embeddingBatches.flat().find((text) => text.includes("guide-key"));
  check(() =>
    assert.equal(
      query,
      "oldest-key\nguide-key",
      "embeddings retain both the earlier user and supplemental user guide, without assistant prose",
    ),
  );
  assert(
    embeddingBatches.flat().includes("latest-key"),
    "the assistant semantic query retains only assistant prose, without folding in the guide",
  );
  const supplement = [{ role: "user", content: "guide-key" }];
  const resolverInput = [
    { role: "user", content: "oldest-key" },
    { role: "assistant", content: "latest-key" },
  ];
  const inputBefore = structuredClone(resolverInput);
  const supplementBefore = structuredClone(supplement);
  const resolver = createAgentLorebookTriggerResolver({
    agents: [{ id: agentType, contextSize: 2, source: "manual", sourceLorebookIds: [book.id] }],
    activeCharacterIds: [],
    activeCharacterTags: [],
    entryStateOverrides: {},
    filterSourceLorebookIds: async (ids) => ids,
    listEntriesByLorebookIds: async () => books.listEntriesByLorebooks([book.id]),
    listLorebooks: async () => books.list(),
    gameState: null,
    generationTriggers: ["chat"],
    resolveContent: (value) => value,
    tokenBudget: 0,
    vectorizerAvailable: false,
    supplementalScanMessages: supplement,
  });
  check(() => assert.deepEqual(resolverInput, inputBefore));
  const withSupplement = await resolver(resolverInput);
  check(() =>
    assert.deepEqual(
      withSupplement[agentType]?.map((entry) => entry.name).sort(),
      ["GUIDE_DEFAULT", "GUIDE_DEPTH_ONE", "GUIDE_SCAN_ALL", ...ordinaryNames].sort(),
    ),
  );
  assert.deepEqual(resolverInput, inputBefore, "folding a guide never mutates the caller's history objects");
  assert.deepEqual(supplement, supplementBefore, "folding a guide never mutates the caller's guide objects");
  const guideOnly = await resolver([]);
  check(() =>
    assert.deepEqual(
      guideOnly[agentType]?.map((entry) => entry.name).sort(),
      ["GUIDE_DEFAULT", "GUIDE_DEPTH_ONE", "GUIDE_SCAN_ALL"].sort(),
    ),
  );
  await agents.update(config.id, { settings: { contextSize: 1 } });
  const inputBook = await books.create({ name: "Input reference" });
  assert(inputBook);
  await books.createEntry({ lorebookId: inputBook.id, constant: true, content: "INPUT={{input}}" });
  const inputChat = await chats.create({ name: "Older input", mode: "roleplay", characterIds: [] });
  assert(inputChat);
  await chats.patchMetadata(inputChat.id, {
    agentLorebookAttachments: { [agentType]: { enabled: true, lorebookId: inputBook.id } },
  });
  await chats.createMessage({ chatId: inputChat.id, role: "user", content: "Before boundary" });
  await chats.createMessage({
    chatId: inputChat.id,
    role: "assistant",
    content: "Start",
    extra: { isConversationStart: true },
  });
  await chats.createMessage({ chatId: inputChat.id, role: "user", content: "Original input" });
  for (let index = 0; index < 8; index++)
    await chats.createMessage({ chatId: inputChat.id, role: "assistant", content: "Another reply" });
  await chats.createMessage({ chatId: inputChat.id, role: "system", content: "A visible system message" });
  await chats.createMessage({
    chatId: inputChat.id,
    role: "user",
    content: "Hidden input",
    extra: { hiddenFromAI: true },
  });
  assert.equal(
    (await resolvePackageAgentLorebookEntries(db, agentType, { chatId: inputChat.id }))[0]?.content,
    "INPUT=Original input",
    "last user input survives outside the macro window, hidden messages and system tails",
  );
  for (const trigger of ["chat", "continue"])
    await books.createEntry({
      lorebookId: inputBook.id,
      constant: true,
      content: `TRIGGER_${trigger}`,
      generationTriggerFilterMode: "include",
      generationTriggerFilters: [trigger],
    });
  const priorEntries = await resolvePackageAgentLorebookEntries(db, agentType, { chatId: inputChat.id });
  assert(
    priorEntries.some((entry) => entry.content === "TRIGGER_continue"),
    "the last eligible prior assistant, before a visible system tail, preserves continuation intent",
  );
  assert(!priorEntries.some((entry) => entry.content === "TRIGGER_chat"));
  await chats.createMessage({ chatId: inputChat.id, role: "user", content: "New public input" });
  const latestInputEntries = await resolvePackageAgentLorebookEntries(db, agentType, { chatId: inputChat.id });
  assert(latestInputEntries.some((entry) => entry.content === "INPUT=New public input"));
  assert(latestInputEntries.some((entry) => entry.content === "TRIGGER_chat"));
  assert(!latestInputEntries.some((entry) => entry.content === "TRIGGER_continue"));
  await chats.createMessage({
    chatId: inputChat.id,
    role: "assistant",
    content: "New start",
    extra: { isConversationStart: true, hiddenFromAI: true },
  });
  await chats.createMessage({ chatId: inputChat.id, role: "assistant", content: "No user after the boundary" });
  assert(
    (await resolvePackageAgentLorebookEntries(db, agentType, { chatId: inputChat.id })).some(
      (entry) => entry.content === "INPUT=",
    ),
    "even a hidden start boundary prevents an earlier user from becoming macro input",
  );
  console.info(
    "Window diagnostics:",
    guidedEntries.map((entry) => entry.name),
    "embedding query:",
    query,
  );
  if (failures.length) throw new AggregateError(failures, "Package history window controls failed");
  console.info(
    "PASS: bounded copies, guide history/depth/scan-all, actual normal route, semantic query and input immutability",
  );
} finally {
  await app.close();
  await closeDB();
  await new Promise<void>((resolve, reject) => provider.close((error) => (error ? reject(error) : resolve())));
  rmSync(directory, { recursive: true, force: true });
}
