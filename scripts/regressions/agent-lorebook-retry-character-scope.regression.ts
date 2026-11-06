import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-retry-reference-scope-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
const { characterDataSchema, replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");
replaceBuiltInAgentDefinitions([
  {
    id: "retry-scope-writer",
    name: "Scope writer",
    description: "Reference scope fixture",
    category: "writer",
    phase: "post_processing",
    defaultPromptTemplate: "RETRY_SCOPE_TASK",
  },
]);
const prompts: string[] = [];
OpenAIProvider.prototype.chat = async function* (messages) {
  prompts.push(messages.map((message) => String(message.content)).join("\n"));
  yield "The crystal is quiet.";
  return { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
};
OpenAIProvider.prototype.chatComplete = async (messages) => {
  prompts.push(messages.map((message) => String(message.content)).join("\n"));
  return {
    content: '{"text":"Scoped reference checked."}',
    toolCalls: [],
    finishReason: "stop",
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  };
};
const db = await getDB();
const chats = createChatsStorage(db);
const characters = createCharactersStorage(db);
const agents = createAgentsStorage(db);
const books = createLorebooksStorage(db);
const app = require("fastify")();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Scope fixture",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    model: "fixture",
    apiKey: "fixture",
  });
  const cast = await Promise.all(
    ["A", "B"].map((name) => characters.create(characterDataSchema.parse({ name, tags: [`tag-${name}`] }))),
  );
  assert(connection && cast[0] && cast[1]);
  const a = cast[0];
  const b = cast[1];
  const attached = await books.create({ name: "Attached reference" });
  assert(attached);
  for (const [character, label] of [
    [a, "A"],
    [b, "B"],
  ] as const) {
    await books.createEntry({
      lorebookId: attached.id,
      name: `${label} identity`,
      keys: ["crystal"],
      content: `ENTRY_ID_${label}`,
      characterFilterMode: "include",
      characterFilterIds: [character.id],
    });
    await books.createEntry({
      lorebookId: attached.id,
      name: `${label} tag`,
      keys: ["crystal"],
      content: `ENTRY_TAG_${label}`,
      characterTagFilterMode: "include",
      characterTagFilters: [`tag-${label}`],
    });
  }
  const scopedBooks = await Promise.all(
    [
      [a, "A"],
      [b, "B"],
    ].map(async ([character, label]) => {
      const book = await books.create({ name: `Scoped ${label}`, characterId: character!.id });
      assert(book);
      await books.createEntry({
        lorebookId: book.id,
        name: "Scoped fact",
        keys: ["crystal"],
        content: `BOOK_${label}`,
        characterFilterMode: "include",
        characterFilterIds: [character!.id],
      });
      return book;
    }),
  );
  const configs = await Promise.all(
    ["retry-scope-writer", "custom-retry-scope"].map((type) =>
      agents.create({
        type,
        name: type,
        phase: "post_processing",
        connectionId: connection.id,
        promptTemplate: `RETRY_SCOPE_TASK_${type}`,
        settings: {
          resultType: "context_injection",
          batchWithOtherAgents: false,
          contextSize: 5,
          triggerLorebooksForAgentCalls: true,
        },
      }),
    ),
  );
  assert(configs[0] && configs[1]);
  const chat = await chats.create({
    name: "Targeted retry",
    mode: "roleplay",
    characterIds: [a.id, b.id],
    connectionId: connection.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    enableAgents: true,
    enableTools: false,
    activeAgentIds: configs.map((config) => config!.type),
    groupChatMode: "individual",
    activeLorebookIds: scopedBooks.map((book) => book.id),
    agentLorebookAttachments: { "retry-scope-writer": { enabled: true, lorebookId: attached.id } },
  });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Inspect the crystal." });
  const targets = await Promise.all(
    [a.id, b.id, null, "inactive-former-character"].map((characterId) =>
      chats.createMessage({
        chatId: chat.id,
        role: "assistant",
        content: "The crystal is quiet.",
        characterId,
      }),
    ),
  );
  assert(targets.every(Boolean));
  const checkPrompts = (included: string[], excluded: string[], context: string) => {
    for (const config of configs) {
      const request = prompts.find((prompt) => prompt.includes(`RETRY_SCOPE_TASK_${config!.type}`));
      assert(request, `${context} actually executes ${config!.type}`);
      const block = request.match(/<triggered_lorebook_context>[\s\S]*?<\/triggered_lorebook_context>/u)?.[0] ?? "";
      const prefix = config!.type === "retry-scope-writer" ? ["ENTRY_ID_", "ENTRY_TAG_"] : ["BOOK_"];
      for (const label of included)
        for (const key of prefix) assert(block.includes(key + label), `${context} includes ${key + label}`);
      for (const label of excluded)
        for (const key of prefix) assert(!block.includes(key + label), `${context} excludes ${key + label}`);
    }
  };
  for (const phase of ["post_processing", "pre_generation"] as const) {
    for (const config of configs) await agents.update(config!.id, { phase });
    for (let index = 0; index < targets.length; index += 1) {
      prompts.length = 0;
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/retry-agents",
        payload: {
          chatId: chat.id,
          agentTypes: configs.map((config) => config!.type),
          forMessageId: targets[index]!.id,
        },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert(!response.body.includes('"type":"error"'), response.body);
      checkPrompts(
        index < 2 ? [index === 0 ? "A" : "B"] : ["A", "B"],
        index < 2 ? [index === 0 ? "B" : "A"] : [],
        `${phase} retry target${index}`,
      );
    }
    prompts.length = 0;
    const normal = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, userMessage: "Inspect the crystal again.", forCharacterId: a.id },
    });
    assert.equal(normal.statusCode, 200, normal.body);
    assert(!normal.body.includes('"type":"error"'), normal.body);
    checkPrompts(["A"], ["B"], `${phase} normal single-speaker generation`);
  }
  console.log(
    "PASS: normal/retried single-speaker reference identity/tag/book scope in both phases; whole-cast fallback for unbound or inactive targets.",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
