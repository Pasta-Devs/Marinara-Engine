import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-retry-reference-history-"));
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
  {
    id: "lorebook-keeper",
    name: "Lorebook Keeper",
    description: "History fixture",
    category: "tracker",
    phase: "post_processing",
  },
]);
let storyOutput = "OLD_KEY";
const prompts: string[] = [];
OpenAIProvider.prototype.chat = async function* () {
  yield storyOutput;
  return { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
};
OpenAIProvider.prototype.chatComplete = async (messages) => {
  const prompt = messages.map((message) => String(message.content)).join("\n");
  if (prompt.includes("RETRY_INTENT_TASK")) prompts.push(prompt);
  return {
    content: '{"updates":[]}',
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
    name: "History fixture",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    model: "fixture",
    apiKey: "fixture",
  });
  const characters = createCharactersStorage(db);
  const cast = await Promise.all(["A", "B"].map((name) => characters.create(characterDataSchema.parse({ name }))));
  const books = createLorebooksStorage(db);
  const book = await books.create({ name: "Historical reference" });
  assert(connection && cast[0] && cast[1] && book);
  for (const trigger of ["chat", "autonomous"])
    await books.createEntry({
      lorebookId: book.id,
      content: `HIST_${trigger}`,
      constant: true,
      generationTriggerFilterMode: "include",
      generationTriggerFilters: [trigger],
    });
  for (const key of ["OLD_KEY", "NEW_KEY"])
    await books.createEntry({ lorebookId: book.id, content: `HIST_${key}`, keys: [key] });
  await books.createEntry({ lorebookId: book.id, content: "HIST_INPUT={{input}}", constant: true });
  for (const [index, character] of cast.entries())
    await books.createEntry({
      lorebookId: book.id,
      content: `HIST_SPEAKER_${index}`,
      constant: true,
      characterFilterMode: "include",
      characterFilterIds: [character!.id],
    });
  const extra = (row: { extra: unknown }) =>
    typeof row.extra === "string" ? JSON.parse(row.extra) : (row.extra as Record<string, unknown>);
  const failures: Array<{ variant: string; message: string }> = [];
  for (const variant of ["custom_backfill", "custom_read_behind", "builtin_keeper", "unattached_read_behind"]) {
    const agentType = variant === "builtin_keeper" ? "lorebook-keeper" : `custom-history-${variant}`;
    const config = await agents.create({
      type: agentType,
      name: agentType,
      phase: "post_processing",
      connectionId: connection.id,
      promptTemplate: "RETRY_INTENT_TASK_HISTORY",
      settings: {
        contextSize: 8,
        resultType: "lorebook_update",
        lorebookReadBehindMessages: variant === "custom_backfill" ? 0 : 1,
        lorebookBackfillEnabled: variant === "custom_backfill",
        lorebookBackfillChunkSize: 2,
        batchWithOtherAgents: false,
      },
    });
    assert(config);
    const chat = await chats.create({
      name: variant,
      mode: "roleplay",
      characterIds: cast.map((character) => character!.id),
      connectionId: connection.id,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      enableTools: false,
      groupChatMode: "individual",
      activeAgentIds: [agentType],
      lorebookKeeperReadBehindMessages: 1,
      agentLorebookAttachments: { [agentType]: { enabled: variant !== "unattached_read_behind", lorebookId: book.id } },
    });
    const generate = async (input: Record<string, unknown>) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: chat.id, ...input },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert(!response.body.includes('"type":"error"'), response.body);
    };
    storyOutput = "OLD_KEY";
    await generate({ userMessage: "OLD_INPUT", forCharacterId: cast[0].id });
    const old = (await chats.listMessages(chat.id)).find((message) => message.role === "assistant")!;
    assert.deepEqual(extra(old).lorebookGenerationTriggers, ["roleplay", "chat"]);
    storyOutput = "NEW_KEY";
    await generate({ userMessage: "NEW_INPUT", forCharacterId: cast[1].id });
    const current = (await chats.listMessages(chat.id)).filter((message) => message.role === "assistant").at(-1)!;
    await generate({ userMessage: null, continueMessageId: current.id, forCharacterId: cast[1].id });
    assert.deepEqual(
      extra((await chats.listMessages(chat.id)).find((message) => message.id === current.id)!)
        .lorebookGenerationTriggers,
      ["roleplay", "continue", "autonomous"],
    );
    await chats.patchMetadata(chat.id, { enableAgents: true });
    prompts.length = 0;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/retry-agents",
      payload: {
        chatId: chat.id,
        agentTypes: [agentType],
        ...(variant === "custom_backfill" ? { customLorebookBackfill: true } : {}),
        ...(variant === "builtin_keeper" ? { lorebookKeeperBackfill: true } : {}),
      },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(prompts.length, 1, `${variant} executes one historical agent call`);
    const block = prompts[0]!.match(/<triggered_lorebook_context>[\s\S]*?<\/triggered_lorebook_context>/u)?.[0] ?? "";
    console.log(JSON.stringify({ variant, block }));
    try {
      if (variant === "unattached_read_behind")
        assert.equal(block, "", "an unattached historical call keeps no reference block");
      else {
        for (const expected of ["HIST_chat", "HIST_OLD_KEY", "HIST_INPUT=OLD_INPUT", "HIST_SPEAKER_0"])
          assert(block.includes(expected), `${variant} includes ${expected}`);
        for (const excluded of ["HIST_autonomous", "HIST_NEW_KEY", "HIST_INPUT=NEW_INPUT", "HIST_SPEAKER_1"])
          assert(!block.includes(excluded), `${variant} excludes ${excluded}`);
      }
    } catch (error) {
      failures.push({ variant, message: String(error) });
    }
  }
  assert.deepEqual(failures, [], "every historical reference variant must preserve its own target context");
  console.log(
    "PASS: actual custom backfill/read-behind and builtin keeper calls resolve the selected historical intent, keywords, input macros and speaker; unattached control stays empty.",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
