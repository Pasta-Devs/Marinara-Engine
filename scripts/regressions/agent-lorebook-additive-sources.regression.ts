import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Lorebook, LorebookEntry } from "../../packages/shared/src/types/lorebook.js";

const directory = mkdtempSync(join(tmpdir(), "marinara-additive-agent-lorebooks-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { createLorebookEntrySchema, estimateTextTokens, replaceBuiltInAgentDefinitions } =
  await import("../../packages/shared/dist/index.js");
const { createAgentLorebookTriggerResolver } =
  await import("../../packages/server/src/services/generation/agent-lorebook-triggers.js");

const entry = (id: string, lorebookId = id, order = 0): LorebookEntry =>
  ({
    ...createLorebookEntrySchema.parse({ lorebookId, name: id, keys: ["crystal"], content: `${id} reference.`, order }),
    id,
  }) as LorebookEntry;
const rows = [entry("A"), entry("B", "B", 1), entry("shared", "shared", 2), entry("blocked", "blocked", 3)];
const calls: Array<{ ids: string[]; source: string }> = [];
const baseOptions = {
  activeCharacterIds: [],
  activeCharacterTags: [],
  entryStateOverrides: {},
  filterSourceLorebookIds: async (ids: string[], source: string) => {
    calls.push({ ids, source });
    return source === "chat_active" ? ids.filter((id) => id !== "blocked") : ids;
  },
  gameState: null,
  generationTriggers: ["chat"],
  // Duplicate rows must neither duplicate injections nor consume the shared budget twice.
  listEntriesByLorebookIds: async () => [rows[0]!, rows[0]!, ...rows.slice(1)],
  listLorebooks: async () =>
    [...rows.map((row) => ({ id: row.lorebookId, enabled: true })), { id: "disabled", enabled: false }] as Lorebook[],
  resolveContent: (value: string) => value,
  tokenBudget: 0,
  vectorizerAvailable: false,
};
const messages = [{ role: "user", content: "Inspect the crystal." }];
const resolve = createAgentLorebookTriggerResolver({
  ...baseOptions,
  agents: [
    {
      id: "reader",
      contextSize: 5,
      sourceLorebookIds: ["A", "shared", "blocked"],
      source: "chat_active",
      additionalManualLorebookIds: ["B", "shared", "blocked", "missing", "disabled"],
    },
  ],
});
assert.deepEqual(
  (await resolve(messages)).reader?.map((row) => row.id),
  ["A", "B", "shared", "blocked"],
);
assert.deepEqual(calls, [
  { ids: ["A", "shared", "blocked"], source: "chat_active" },
  { ids: ["B", "shared", "blocked", "missing", "disabled"], source: "manual" },
]);
const budgeted = await createAgentLorebookTriggerResolver({
  ...baseOptions,
  agents: [
    {
      id: "reader",
      contextSize: 5,
      sourceLorebookIds: ["A"],
      source: "manual",
      additionalManualLorebookIds: ["A", "B", "shared"],
    },
  ],
  tokenBudget: estimateTextTokens(rows[0]!.content) + estimateTextTokens(rows[1]!.content),
})(messages);
assert.deepEqual(
  budgeted.reader?.map((row) => row.id),
  ["A", "B"],
  "all sources share one deduplicated token budget",
);
const missing = await createAgentLorebookTriggerResolver({
  ...baseOptions,
  agents: [
    { id: "reader", contextSize: 5, sourceLorebookIds: [], source: "none", additionalManualLorebookIds: ["missing"] },
  ],
})(messages);
assert.deepEqual(missing.reader, [], "an unavailable attachment never falls back to another book");

const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
replaceBuiltInAgentDefinitions([
  {
    id: "official-additive-writer",
    name: "Official writer",
    description: "Fixture",
    category: "writer",
    phase: "post_processing",
    defaultPromptTemplate: "ADDITIVE_REFERENCE_TASK",
  },
]);
const prompts: string[] = [];
OpenAIProvider.prototype.chat = async function* (chatMessages) {
  prompts.push(chatMessages.map((message) => String(message.content)).join("\n"));
  yield "The crystal waits.";
  return { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
};
OpenAIProvider.prototype.chatComplete = async (chatMessages) => {
  prompts.push(chatMessages.map((message) => String(message.content)).join("\n"));
  return {
    content: '{"text":"Reference checked."}',
    toolCalls: [],
    finishReason: "stop",
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  };
};
const db = await getDB();
const chats = createChatsStorage(db);
const agents = createAgentsStorage(db);
const books = createLorebooksStorage(db);
const app = require("fastify")();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Fixture",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    model: "fixture",
    apiKey: "fixture",
  });
  const [a, b, c] = await Promise.all(
    ["A_LEGACY", "B_ATTACHED", "C_CHAT"].map(async (name) => {
      const book = await books.create({ name });
      assert(book);
      await books.createEntry({ lorebookId: book.id, name, keys: ["crystal"], content: name });
      return book;
    }),
  );
  assert(a && b && c);
  const settings = {
    resultType: "context_injection",
    batchWithOtherAgents: false,
    contextSize: 5,
    sourceLorebookIds: [a.id],
    triggerLorebooksForAgentCalls: true,
  };
  const custom = await agents.create({
    type: "custom-additive-reader",
    name: "Reader",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "ADDITIVE_REFERENCE_TASK",
    settings,
  });
  const official = await agents.create({
    type: "official-additive-writer",
    name: "Official writer",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "ADDITIVE_REFERENCE_TASK",
    settings,
  });
  assert(custom && official);
  const chat = await chats.create({
    name: "Additive sources",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection.id,
  });
  assert(chat);
  const select = (type: string, enabled: boolean, lorebookId = b.id) =>
    chats.patchMetadata(chat.id, {
      enableAgents: true,
      activeAgentIds: [type],
      enableTools: false,
      activeLorebookIds: [c.id],
      agentLorebookAttachments: { [type]: { enabled, lorebookId } },
    });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Inspect the crystal." });
  await chats.createMessage({ chatId: chat.id, role: "assistant", content: "The crystal waits." });
  const checkBoth = async (type: string, included: string[], excluded: string[]) => {
    for (const kind of ["normal", "retry"]) {
      prompts.length = 0;
      const response = await app.inject({
        method: "POST",
        url: kind === "normal" ? "/api/generate/" : "/api/generate/retry-agents",
        payload:
          kind === "normal"
            ? { chatId: chat.id, userMessage: "Inspect the crystal again." }
            : { chatId: chat.id, agentTypes: [type] },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert(!response.body.includes('"type":"error"'), response.body);
      const requests = prompts.filter((prompt) => prompt.includes("ADDITIVE_REFERENCE_TASK"));
      assert(requests.length, `${kind} executes the reference agent`);
      for (const prompt of requests) {
        const reference =
          prompt.match(/<triggered_lorebook_context>[\s\S]*?<\/triggered_lorebook_context>/u)?.[0] ?? "";
        for (const text of included) assert(reference.includes(text), `${kind} retains ${text}`);
        for (const text of excluded) assert(!reference.includes(text), `${kind} excludes ${text}`);
      }
    }
  };
  await select(custom.type, true);
  await checkBoth(custom.type, ["A_LEGACY", "B_ATTACHED"], ["C_CHAT"]);
  await select(custom.type, false);
  await checkBoth(custom.type, ["A_LEGACY"], ["B_ATTACHED", "C_CHAT"]);
  await agents.update(custom.id, { settings: { ...settings, triggerLorebooksForAgentCalls: false } });
  await select(custom.type, true);
  await checkBoth(custom.type, ["B_ATTACHED"], ["A_LEGACY", "C_CHAT"]);
  await select(custom.type, true, "missing-book");
  await checkBoth(custom.type, [], ["A_LEGACY", "B_ATTACHED", "C_CHAT"]);
  await select(official.type, true);
  await checkBoth(official.type, ["B_ATTACHED"], ["A_LEGACY", "C_CHAT"]);
  await agents.update(custom.id, { settings: { ...settings, sourceLorebookIds: [] } });
  await select(custom.type, true);
  await chats.patchMetadata(chat.id, { activeLorebookIds: [a.id, c.id], excludedLorebookIds: [a.id, b.id] });
  await checkBoth(custom.type, ["B_ATTACHED", "C_CHAT"], ["A_LEGACY"]);
  console.info(
    "PASS: additive legacy/attached sources, independent source policies, deduplication, shared budget, and both generation callers",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
