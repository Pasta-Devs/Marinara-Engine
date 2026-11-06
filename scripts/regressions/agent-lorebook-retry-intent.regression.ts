import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-retry-reference-intent-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
const { characterDataSchema, replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");
const type = "retry-intent-writer";
replaceBuiltInAgentDefinitions([
  { id: type, name: "Retry intent", description: "Fixture", category: "writer", phase: "post_processing" },
]);
const prompts: string[] = [];
OpenAIProvider.prototype.chat = async function* () {
  yield "The crystal glows.";
  return { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
};
OpenAIProvider.prototype.chatComplete = async (messages) => {
  const prompt = messages.map((message) => String(message.content)).join("\n");
  if (prompt.includes("RETRY_INTENT_TASK")) prompts.push(prompt);
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
const app = require("fastify")();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Retry intent fixture",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    model: "fixture",
    apiKey: "fixture",
  });
  const characters = createCharactersStorage(db);
  const cast = await Promise.all(["A", "B"].map((name) => characters.create(characterDataSchema.parse({ name }))));
  const books = createLorebooksStorage(db);
  const book = await books.create({ name: "Retry trigger reference" });
  assert(connection && cast[0] && cast[1] && book);
  const triggers = ["chat", "continue", "autonomous", "swipe", "impersonate"];
  for (const trigger of triggers)
    await books.createEntry({
      lorebookId: book.id,
      content: `RETRY_TRIGGER_${trigger}`,
      constant: true,
      generationTriggerFilterMode: "include",
      generationTriggerFilters: [trigger],
    });
  const config = await agents.create({
    type,
    name: type,
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "RETRY_INTENT_TASK",
    settings: { contextSize: 1, resultType: "context_injection", batchWithOtherAgents: false },
  });
  const chat = await chats.create({
    name: "Actual group retry intent",
    mode: "roleplay",
    characterIds: cast.map((character) => character!.id),
    connectionId: connection.id,
  });
  assert(config && chat);
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableTools: false,
    groupChatMode: "individual",
    groupResponseOrder: "sequential",
    activeAgentIds: [type],
    agentLorebookAttachments: { [type]: { enabled: true, lorebookId: book.id } },
  });
  const extra = (row: { extra: unknown }) =>
    typeof row.extra === "string" ? JSON.parse(row.extra) : (row.extra as Record<string, unknown>);
  const generate = async (input: Record<string, unknown>) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, ...input },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    return chats.listMessages(chat.id);
  };
  let controls = 0;
  const retry = async (target: string | null, expected: string[], label: string) => {
    await chats.patchMetadata(chat.id, { enableAgents: true });
    for (const phase of ["post_processing", "pre_generation"] as const) {
      await agents.update(config.id, { phase });
      prompts.length = 0;
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/retry-agents",
        payload: { chatId: chat.id, agentTypes: [type], ...(target ? { forMessageId: target } : {}) },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert(!response.body.includes('"type":"error"'), response.body);
      assert.equal(prompts.length, 1, `${label}/${phase} executes exactly one writer call`);
      const block = prompts[0]!.match(/<triggered_lorebook_context>[\s\S]*?<\/triggered_lorebook_context>/u)?.[0] ?? "";
      console.log(
        JSON.stringify({
          label,
          phase,
          triggered: triggers.filter((trigger) => block.includes(`RETRY_TRIGGER_${trigger}`)),
        }),
      );
      for (const trigger of triggers)
        assert.equal(
          block.includes(`RETRY_TRIGGER_${trigger}`),
          expected.includes(trigger),
          `${label}/${phase}: ${trigger}`,
        );
      controls += 1;
    }
    await chats.patchMetadata(chat.id, { enableAgents: false });
  };
  const messages = await generate({ userMessage: "Inspect the crystal." });
  const group = messages.filter((message) => message.role === "assistant");
  assert.equal(group.length, 2, "actual normal generation produced A and B");
  for (const message of group) assert.deepEqual(extra(message).lorebookGenerationTriggers, ["roleplay", "chat"]);
  await retry(group[1]!.id, ["chat"], "actual group B target");
  await chats.createMessage({ chatId: chat.id, role: "system", content: "Visible narrator note" });
  await retry(null, ["chat"], "latest group target across a system tail");
  await generate({ userMessage: null, continueMessageId: group[1]!.id, forCharacterId: cast[1].id });
  await retry(group[1]!.id, ["continue", "autonomous"], "actual no-input continuation");
  await retry(group[0]!.id, ["chat"], "historical A uses own intent despite newer B continuation");
  const guided = (
    await generate({ userMessage: null, generationGuide: "Inspect the crystal.", generationGuideSource: "narrator" })
  )
    .filter((message) => message.role === "assistant")
    .at(-1)!;
  await retry(guided.id, ["chat"], "actual narrator guide");
  await generate({ userMessage: null, regenerateMessageId: guided.id });
  await retry(guided.id, ["swipe"], "actual regenerated swipe");
  await chats.setActiveSwipe(guided.id, 0);
  await retry(guided.id, ["chat"], "original swipe snapshot");
  await chats.setActiveSwipe(guided.id, 1);
  await retry(guided.id, ["swipe"], "regenerated swipe snapshot");
  // These rows deliberately predate saved provenance: retain the conservative adjacent-turn fallback.
  const legacy = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: cast[1].id,
    content: "Legacy group tail.",
  });
  assert(legacy);
  for (const value of [null, [], ["unknown"], ["game", "chat"], ["roleplay", "chat", "continue"]]) {
    await chats.updateMessageExtra(legacy.id, { lorebookGenerationTriggers: value });
    await retry(legacy.id, ["continue", "autonomous"], "invalid or missing legacy group snapshot");
  }
  await chats.createMessage({ chatId: chat.id, role: "user", content: "A legacy question." });
  const single = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: cast[0].id,
    content: "Legacy single response.",
  });
  assert(single);
  await chats.createMessage({ chatId: chat.id, role: "system", content: "Another visible narrator note" });
  await retry(null, ["chat"], "legacy adjacent user with system tail");
  await chats.addSwipe(single.id, "Legacy alternate.", { characterId: cast[0].id });
  await chats.setActiveSwipe(single.id, 1);
  await retry(null, ["swipe"], "legacy active swipe with system tail");
  console.log(
    `PASS: ${controls} actual agent retry routes cover saved group/historical/continuation/guide/swipe intent and conservative invalid/legacy fallbacks in both phases.`,
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
