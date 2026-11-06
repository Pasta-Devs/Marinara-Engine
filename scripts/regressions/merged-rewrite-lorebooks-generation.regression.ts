import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-merged-rewrite-generation-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const { replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");

const types = ["prose-guardian", "continuity", "html"];
replaceBuiltInAgentDefinitions(
  types.map((type) => ({
    id: type,
    name: type,
    description: "Merged rewrite fixture",
    category: "writer",
    phase: "post_processing",
    defaultPromptTemplate: `MERGED_REFERENCE_TASK_${type}`,
  })),
);
const prompts: string[] = [];
OpenAIProvider.prototype.chat = async function* () {
  yield "A crystal glows.";
  return { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
};
OpenAIProvider.prototype.chatComplete = async (messages) => {
  prompts.push(messages.map((message) => String(message.content)).join("\n"));
  return {
    content: '{"editNeeded":false,"editedText":"","changes":[]}',
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
    name: "Merged rewrite fixture",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    model: "fixture",
    apiKey: "fixture",
  });
  assert(connection);
  const bookByType = new Map<string, string>();
  for (const type of [...types, "unrelated"]) {
    const book = await books.create({ name: type });
    assert(book);
    bookByType.set(type, book.id);
    await books.createEntry({
      lorebookId: book.id,
      name: type,
      keys: ["crystal"],
      content: `REFERENCE_${type}`,
    });
    await books.createEntry({
      lorebookId: book.id,
      name: `${type} unmatched`,
      keys: ["absent-keyword"],
      content: `UNMATCHED_${type}`,
    });
  }
  for (const type of types) {
    await agents.create({
      type,
      name: type,
      phase: "post_processing",
      connectionId: connection.id,
      promptTemplate: `MERGED_REFERENCE_TASK_${type}`,
      settings: { resultType: "text_rewrite", contextSize: 4, maxTokens: 512 },
    });
  }
  const chat = await chats.create({
    name: "Merged references",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection.id,
  });
  assert(chat);
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Inspect the crystal." });
  const target = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "A crystal glows." });
  assert(target);
  const selections = [[], ["continuity"], ["prose-guardian"], types];
  for (const attachedTypes of selections) {
    await chats.patchMetadata(chat.id, {
      enableAgents: true,
      enableTools: false,
      activeAgentIds: types,
      activeLorebookIds: [],
      agentLorebookAttachments: Object.fromEntries(
        [...types, "unrelated"].map((type) => [
          type,
          { enabled: type === "unrelated" || attachedTypes.includes(type), lorebookId: bookByType.get(type) },
        ]),
      ),
    });
    for (const kind of ["normal", "retry", "pre_retry"]) {
      for (const type of types) {
        const config = await agents.getByType(type);
        assert(config);
        await agents.update(config.id, { phase: kind === "pre_retry" ? "pre_generation" : "post_processing" });
      }
      prompts.length = 0;
      const response = await app.inject({
        method: "POST",
        url: kind === "normal" ? "/api/generate/" : "/api/generate/retry-agents",
        payload:
          kind === "normal"
            ? { chatId: chat.id, userMessage: "Inspect the crystal again." }
            : { chatId: chat.id, agentTypes: types, ...(kind === "pre_retry" ? { forMessageId: target.id } : {}) },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert(!response.body.includes('"type":"error"'), response.body);
      const merged = prompts.filter((prompt) => prompt.includes("MERGED_REFERENCE_TASK_"));
      assert.equal(merged.length, 1, `${kind} retains exactly one merged rewrite request`);
      const prompt = merged[0]!;
      for (const type of types) {
        assert(prompt.includes(`MERGED_REFERENCE_TASK_${type}`), `${kind} merges ${type}'s instructions`);
        assert.equal(
          prompt.split(`REFERENCE_${type}`).length - 1,
          attachedTypes.includes(type) ? 1 : 0,
          `${kind} resolves ${type}'s own stored keyword entry before merging`,
        );
        assert(!prompt.includes(`UNMATCHED_${type}`), `${kind} excludes unmatched keyword entries`);
      }
      assert(!prompt.includes("REFERENCE_unrelated"), `${kind} excludes another agent's selected book`);
    }
  }
  console.info(
    "PASS: normal generation and both retry phases resolve each original editor's stored keyword attachment before one merged request",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
