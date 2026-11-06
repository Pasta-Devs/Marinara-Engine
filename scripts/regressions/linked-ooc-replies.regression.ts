import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const directory = mkdtempSync(join(tmpdir(), "marinara-linked-ooc-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");

const originalChat = OpenAIProvider.prototype.chat;
let output = "";
let providerCalls = 0;
OpenAIProvider.prototype.chat = async function* () {
  providerCalls++;
  // Include boundaries inside the tags, as a real streamed response can.
  for (let offset = 0; offset < output.length; offset += 3) yield output.slice(offset, offset + 3);
  return { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
};

const db = await getDB();
const chats = createChatsStorage(db);
const characters = createCharactersStorage(db);
const app = requireServer("fastify")();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });

try {
  const connection = await createConnectionsStorage(db).create({
    name: "Linked OOC fixture",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
    maxTokensOverride: 512,
  });
  const character = await characters.create(characterDataSchema.parse({ name: "Dottore" }));
  const persona = await characters.createPersona("Mari", "The player.");
  assert(connection && character && persona);

  const rows = [
    {
      name: "a complete OOC-only linked Roleplay answer is saved visibly without duplicate forwarding",
      output: "<ooc>The next beat should reveal the letter.</ooc>",
      expected: "The next beat should reveal the letter.",
    },
    {
      name: "multiple case-insensitive OOC-only blocks keep their order",
      output: "  <OOC>First thought.</OOC>\n\n<oOc>Second thought.</oOc>  ",
      expected: "First thought.\n\nSecond thought.",
    },
    {
      name: "regeneration saves an OOC-only answer as the same message's new swipe",
      output: "<ooc>The replacement answer survives.</ooc>",
      expected: "The replacement answer survives.",
      operation: "regenerate" as const,
    },
    {
      name: "continuation appends an OOC-only answer visibly without forwarding",
      output: "<ooc>The continuation survives.</ooc>",
      expected: "Earlier reply.\n\nThe continuation survives.",
      operation: "continue" as const,
    },
    {
      name: "mixed prose still forwards each OOC block exactly once to the linked Conversation",
      output: "She opens the letter.\n\n<ooc>First note.</ooc>\n\n<OOC>Second note.</OOC>\n\nThe rain falls.",
      expected: "She opens the letter.\n\nThe rain falls.",
      forwarded: ["First note.", "Second note."],
    },
    {
      name: "an unlinked Roleplay answer retains its existing OOC text",
      output: "<ooc>Keep this unlinked answer.</ooc>",
      expected: "<ooc>Keep this unlinked answer.</ooc>",
      linked: false,
    },
    {
      name: "impersonation retains its existing OOC text and never forwards it",
      output: "<ooc>Keep Mari's answer.</ooc>",
      expected: "<ooc>Keep Mari's answer.</ooc>",
      impersonate: true,
    },
    {
      name: "the connected Conversation answer is not treated as Roleplay OOC forwarding",
      output: "<ooc>Keep this Conversation answer.</ooc>",
      expected: "<ooc>Keep this Conversation answer.</ooc>",
      mode: "conversation" as const,
    },
  ];
  for (const row of rows) {
    await test(row.name, async () => {
      const mode = row.mode ?? "roleplay";
      const chat = await chats.create({
        name: row.name,
        mode,
        characterIds: [character.id],
        personaId: persona.id,
        connectionId: connection.id,
      });
      const linked = await chats.create({
        name: "Linked counterpart",
        mode: mode === "roleplay" ? "conversation" : "roleplay",
        characterIds: [character.id],
        personaId: persona.id,
        connectionId: connection.id,
      });
      assert(chat && linked);
      if (row.linked !== false) await chats.connectChats(chat.id, linked.id);
      await chats.patchMetadata(chat.id, {
        enableAgents: false,
        enableTools: false,
        enableMemoryRecall: false,
        automaticSummaryEnabled: false,
        automaticSceneCheckEnabled: false,
      });
      const prompt = await chats.createMessage({ chatId: chat.id, role: "user", content: "Continue." });
      assert(prompt);
      const target = row.operation
        ? await chats.createMessage({
            chatId: chat.id,
            role: "assistant",
            characterId: character.id,
            content: "Earlier reply.",
          })
        : null;
      output = row.output;
      const callsBefore = providerCalls;
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: {
          chatId: chat.id,
          forCharacterId: character.id,
          ...(row.impersonate && { impersonate: true }),
          ...(row.operation === "regenerate" && { regenerateMessageId: target!.id }),
          ...(row.operation === "continue" && { continueMessageId: target!.id, continueAddsNewline: true }),
        },
      });
      const events = response.body
        .split("\n")
        .filter((line: string) => line.startsWith("data: "))
        .map((line: string) => JSON.parse(line.slice(6)) as Record<string, unknown>);
      const messages = (await chats.listMessages(chat.id)).filter((message) => message.id !== prompt.id);
      const linkedMessages = await chats.listMessages(linked.id);
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(providerCalls - callsBefore, 1, "one actual generation uses the synthetic provider once");
      assert.deepEqual(
        events.filter((event) => event.type === "error"),
        [],
        `a valid reply must not become an empty-response error; stored=${JSON.stringify(messages)}`,
      );
      assert.equal(messages.length, 1, "one generated message is persisted");
      assert.equal(messages[0]!.content, row.expected);
      assert.equal(messages[0]!.role, row.impersonate ? "user" : "assistant");
      if (target) assert.equal(messages[0]!.id, target.id, "regeneration/continuation preserves the message identity");
      if (row.operation === "regenerate") {
        assert.deepEqual(
          (await chats.getSwipes(target!.id)).map((swipe) => swipe.content),
          ["Earlier reply.", row.expected],
          "regeneration retains the original swipe and saves one replacement",
        );
      }
      assert.notEqual(JSON.parse(messages[0]!.extra).hiddenFromUser, true, "the saved answer remains visible");
      const savedEvents = events.filter((event) => event.type === "message_saved");
      assert(savedEvents.some((event) => (event.data as { id?: string })?.id === messages[0]!.id));
      assert.deepEqual(
        linkedMessages.map((message) => message.content),
        row.forwarded ?? [],
      );
      assert(linkedMessages.every((message) => message.role === "assistant"));
      assert.deepEqual(
        events.filter((event) => event.type === "ooc_posted").map((event) => event.data),
        row.forwarded ? [{ chatId: linked.id, count: row.forwarded.length }] : [],
      );
      assert.equal(events.at(-1)?.type, "done");
    });
  }
} finally {
  OpenAIProvider.prototype.chat = originalChat;
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
