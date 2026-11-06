import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-package-reference-intent-"));
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
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { resolvePackageAgentLorebookEntries } =
  await import("../../packages/server/src/services/capability-packages/capability-agent-lorebook.service.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { importSTChat } = await import("../../packages/server/src/services/import/st-chat.importer.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
const { characterDataSchema, DEFAULT_ADVANCED_MEMORY_SETTINGS } = await import("../../packages/shared/dist/index.js");
let output = "The crystal glows.";
OpenAIProvider.prototype.chat = async function* () {
  yield output;
  return { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
};
OpenAIProvider.prototype.chatComplete = async () => ({
  content: "{}",
  toolCalls: [],
  finishReason: "stop",
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
});
const db = await getDB();
const chats = createChatsStorage(db);
const books = createLorebooksStorage(db);
const app = require("fastify")();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
const extra = (row: { extra: unknown }) =>
  typeof row.extra === "string" ? JSON.parse(row.extra) : (row.extra as Record<string, unknown>);
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Intent fixture",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    model: "fixture",
    apiKey: "fixture",
  });
  const characters = createCharactersStorage(db);
  const cast = await Promise.all(["A", "B"].map((name) => characters.create(characterDataSchema.parse({ name }))));
  const book = await books.create({ name: "Trigger reference" });
  assert(connection && cast[0] && cast[1] && book);
  const agent = "intent-reference-package";
  const kinds = ["chat", "continue", "impersonate", "swipe"];
  for (const trigger of kinds)
    await books.createEntry({
      lorebookId: book.id,
      content: `TRIGGER_${trigger}`,
      constant: true,
      generationTriggerFilterMode: "include",
      generationTriggerFilters: [trigger],
    });
  await books.createEntry({ lorebookId: book.id, content: "INPUT={{input}}", constant: true });
  const chat = await chats.create({
    name: "Actual group intent",
    mode: "roleplay",
    characterIds: cast.map((character) => character!.id),
    connectionId: connection.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableTools: false,
    groupChatMode: "individual",
    groupResponseOrder: "sequential",
    agentLorebookAttachments: { [agent]: { enabled: true, lorebookId: book.id } },
  });
  const generate = async (input: Record<string, unknown>) => {
    const result = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id, ...input } });
    assert.equal(result.statusCode, 200, result.body);
    assert(!result.body.includes('"type":"error"'), result.body);
    return chats.listMessages(chat.id);
  };
  const expectIntent = async (expected: string, label: string, chatId = chat.id) => {
    const entries = await resolvePackageAgentLorebookEntries(db, agent, { chatId });
    assert.deepEqual(
      entries.map((entry) => entry.content).filter((content) => content.startsWith("TRIGGER_")),
      [`TRIGGER_${expected}`],
      label,
    );
  };
  const systemTail = async () =>
    chats.createMessage({ chatId: chat.id, role: "system", content: "Visible narrator note" });

  let messages = await generate({ userMessage: "Inspect the crystal." });
  const group = messages.filter((message) => message.role === "assistant");
  assert.equal(group.length, 2, "the real normal route generates both characters");
  await expectIntent("chat", "both replies belong to the submitted user turn, despite consecutive assistant rows");
  for (const message of group) assert.deepEqual(extra(message).lorebookGenerationTriggers, ["roleplay", "chat"]);
  await systemTail();
  await expectIntent("chat", "a visible system tail does not erase the saved normal-turn intent");

  messages = await generate({ userMessage: null, continueMessageId: group[1]!.id, forCharacterId: cast[1]!.id });
  const continued = messages.find((message) => message.id === group[1]!.id)!;
  assert.deepEqual(extra(continued).lorebookGenerationTriggers, ["roleplay", "continue", "autonomous"]);
  await expectIntent("continue", "a real continuation remains continue despite the older submitted user text");
  await systemTail();
  await expectIntent("continue", "a system tail does not change actual continuation intent");

  messages = await generate({
    userMessage: null,
    generationGuide: "Show the crystal.",
    generationGuideSource: "narrator",
  });
  const guided = messages.filter((message) => message.role === "assistant").at(-1)!;
  await systemTail();
  await expectIntent("chat", "the real narrator guide retains chat intent through a system tail");
  await generate({ userMessage: null, regenerateMessageId: guided.id });
  await expectIntent("swipe", "the actual regenerated swipe retains regenerate intent");
  await systemTail();
  await expectIntent("swipe", "a system tail cannot hide swipe provenance");
  await chats.setActiveSwipe(guided.id, 0);
  await expectIntent("chat", "switching to the original swipe restores its original trigger intent");
  await chats.setActiveSwipe(guided.id, 1);
  await expectIntent("swipe", "switching back restores the regenerated swipe's intent");

  const beforeSplitIds = new Set((await chats.listMessages(chat.id)).map((message) => message.id));
  await chats.patchMetadata(chat.id, {
    advancedMemory: {
      ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
      enabled: true,
      helperConnectionId: connection.id,
      knowledgeStarts: Object.fromEntries(cast.map((character) => [character!.id, null])),
      knowledgeConfirmed: true,
      sceneCheckInterval: 100,
    },
  });
  output = "The crystal glows.\n\n***\n\nA new scene opens.";
  messages = await generate({ userMessage: "Follow the crystal.", forCharacterId: cast[0]!.id });
  const parts = messages.filter((message) => message.role === "assistant" && !beforeSplitIds.has(message.id));
  assert.equal(parts.length, 2, "the actual route splits a scene break into two assistant messages");
  for (const part of parts) assert.deepEqual(extra(part).lorebookGenerationTriggers, ["roleplay", "chat"]);
  await systemTail();
  await expectIntent("chat", "both stored scene parts retain the submitted turn's intent");
  await chats.patchMetadata(chat.id, { advancedMemory: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: false } });

  output = "The persona examines the crystal.";
  await generate({ userMessage: "Inspect it carefully.", impersonate: true });
  await systemTail();
  await expectIntent("impersonate", "the actual impersonated user reply retains its own intent");

  // A fresh user turn must win over a previous assistant's snapshot.
  await chats.createMessage({ chatId: chat.id, role: "user", content: "A new question." });
  await expectIntent("chat", "typed user input never borrows earlier generated provenance");
  const typed = (await chats.listMessages(chat.id)).at(-1)!;
  for (const value of [null, [], ["unknown"], ["game", "chat"], ["roleplay", "chat", "continue"]]) {
    await chats.updateMessageExtra(typed.id, { lorebookGenerationTriggers: value });
    await expectIntent("chat", "missing, invalid or contradictory snapshots fall back to transcript derivation");
  }

  const legacy = await chats.create({
    name: "Legacy without saved intent",
    mode: "roleplay",
    characterIds: [cast[0].id],
    connectionId: connection.id,
  });
  assert(legacy);
  await chats.patchMetadata(legacy.id, {
    agentLorebookAttachments: { [agent]: { enabled: true, lorebookId: book.id } },
  });
  await chats.createMessage({ chatId: legacy.id, role: "user", content: "Inspect it." });
  const legacyReply = await chats.createMessage({
    chatId: legacy.id,
    role: "assistant",
    characterId: cast[0].id,
    content: "It glows.",
  });
  assert(legacyReply);
  assert.equal(extra(legacyReply).lorebookGenerationTriggers, undefined);
  await expectIntent("chat", "legacy single reply derives its submitted user turn", legacy.id);
  const note = await chats.createMessage({ chatId: legacy.id, role: "system", content: "Visible narrator note" });
  assert(note);
  await expectIntent("chat", "a visible system tail preserves derivable legacy chat intent", legacy.id);
  await chats.removeMessage(note.id);
  await chats.addSwipe(legacyReply.id, "Another answer.");
  await expectIntent("swipe", "legacy active swipe derives regeneration without saved intent", legacy.id);
  await chats.createMessage({ chatId: legacy.id, role: "system", content: "Another visible narrator note" });
  await expectIntent("swipe", "a visible system tail cannot hide a legacy active swipe", legacy.id);

  const exported = await app.inject({ method: "GET", url: `/api/chats/${chat.id}/export?format=jsonl` });
  assert.equal(exported.statusCode, 200, exported.body);
  assert(
    !exported.body.includes('"lorebookGenerationTriggers"'),
    "portable message and swipe exports omit internal intent",
  );
  const imported = await importSTChat(
    [
      JSON.stringify({ user_name: "User", character_name: "Character" }),
      JSON.stringify({
        name: "Character",
        is_user: false,
        mes: "Imported reply",
        swipes: ["Earlier reply", "Imported reply"],
        swipe_id: 1,
        extra: {
          lorebookGenerationTriggers: ["roleplay", "chat"],
          marinara_swipes: [0, 1].map((index) => ({
            index,
            extra: { lorebookGenerationTriggers: ["roleplay", "impersonate"] },
          })),
        },
      }),
    ].join("\n"),
    db,
  );
  assert(imported.chatId);
  for (const message of await chats.listMessages(imported.chatId)) {
    assert.equal(extra(message).lorebookGenerationTriggers, undefined, "portable imports cannot inject trigger intent");
    for (const swipe of await chats.getSwipes(message.id))
      assert.equal(extra(swipe).lorebookGenerationTriggers, undefined);
  }
  console.info(
    "PASS: actual two-character input, continuation, narrator guide, swipe, split scenes, impersonation and system-tail intent",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
