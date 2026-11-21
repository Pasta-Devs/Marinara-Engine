// Memory Recall adds only messages the prompt no longer sends: nothing while the whole chat fits, and once older
// history is left out to fit, only chunks none of whose messages are still sent.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-recall-window-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
delete process.env.MARINARA_LITE;

const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { memoryChunks } = await import("../../../packages/server/src/db/schema/index.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { chunkAndEmbedMessages, recallMemories } =
  await import("../../../packages/server/src/services/memory-recall.js");
const { resolveMemoryRecallEmbeddingSource } =
  await import("../../../packages/server/src/services/memory-recall-embedding.js");
const { injectMemoryRecallContext } =
  await import("../../../packages/server/src/services/generation/memory-recall-context.js");
const { characterDataSchema } = await import("../../../packages/shared/dist/index.js");
const { runNamedCases } = await import("../fixtures/named-cases.js");
type MemoryRecallWindowMessage =
  import("../../../packages/server/src/services/generation/memory-recall-context.js").MemoryRecallWindowMessage;
type MemoryRecallEmbeddingSource =
  import("../../../packages/server/src/services/memory-recall.js").MemoryRecallEmbeddingSource;

const db = await getDB();
const spaceId = "recall-window-space";
let embedCalls = 0;
const embeddingSource: MemoryRecallEmbeddingSource = {
  label: "recall window regression",
  spaceId,
  embed: async (texts) => {
    embedCalls++;
    return texts.map(() => [1, 0]);
  },
};

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString();
let chatCounter = 0;

/** A chat of `count` history messages of `size` characters each, and its chunks of five, stored as recall would. */
async function windowFixture(
  count: number,
  size: number,
  { imported = [], chunkSize = 0 }: { imported?: Array<{ content: string }>; chunkSize?: number } = {},
) {
  const chatId = `window-chat-${++chatCounter}`;
  const history: MemoryRecallWindowMessage[] = Array.from({ length: count }, (_, index) => ({
    id: `${chatId}-m${index}`,
    role: index % 2 ? "assistant" : "user",
    content: `M${index} `.padEnd(size, "."),
    contextKind: "history",
  }));
  const messageCreatedAt = new Map(history.map((message, index) => [message.id!, at(index)]));
  const chunkNames = ["A", "B", "C", "D", "E", "F"];
  const rows = [];
  for (let start = 0; start + 5 <= count; start += 5) {
    rows.push({
      id: `${chatId}-chunk-${start}`,
      chatId,
      content: `CHUNK_${chunkNames[start / 5]} covers M${start}-M${start + 4}.`.padEnd(chunkSize, "."),
      embedding: JSON.stringify([1, 0]),
      embeddingSpaceId: spaceId,
      messageCount: 5,
      sourceChatId: null,
      firstMessageAt: at(start),
      lastMessageAt: at(start + 4),
      createdAt: at(start + 4),
    });
  }
  imported.forEach((chunk, index) =>
    rows.push({
      id: `${chatId}-imported-${index}`,
      chatId,
      content: chunk.content,
      embedding: JSON.stringify([1, 0]),
      embeddingSpaceId: spaceId,
      messageCount: 5,
      // Another chat's messages: their times can fall anywhere, even inside this chat's window.
      sourceChatId: `${chatId}-source`,
      firstMessageAt: at(count - 3),
      lastMessageAt: at(count - 1),
      createdAt: at(count),
    }),
  );
  if (rows.length) await db.insert(memoryChunks).values(rows);
  const prompt: MemoryRecallWindowMessage[] = [{ role: "system", content: "SYSTEM ".padEnd(50, ".") }, ...history];
  return { chatId, prompt, messageCreatedAt, history };
}

/** A fit by characters: drops the oldest history (never the last message) until the prompt fits in `limit`. */
const charFit =
  (limit: number) =>
  (messages: MemoryRecallWindowMessage[]): MemoryRecallWindowMessage[] => {
    const kept = [...messages];
    const size = () => kept.reduce((sum, message) => sum + message.content.length, 0);
    while (size() > limit) {
      const index = kept.findIndex((message, i) => message.contextKind === "history" && i < kept.length - 1);
      if (index < 0) break;
      kept.splice(index, 1);
    }
    return kept;
  };

async function recallInto(
  fixture: Awaited<ReturnType<typeof windowFixture>>,
  fit: ((messages: MemoryRecallWindowMessage[]) => MemoryRecallWindowMessage[]) | null,
) {
  return injectMemoryRecallContext({
    db,
    messages: fixture.prompt,
    currentInputMessages: [{ role: "user", content: "Where is the lantern?" }],
    chatId: fixture.chatId,
    embeddingSource,
    contextLimit: undefined,
    ...(fit ? { promptWindow: { prompt: fixture.prompt, messageCreatedAt: fixture.messageCreatedAt, fit } } : {}),
    sendProgress: () => {},
    wrapFormat: "none",
  });
}

/** No recalled chunk may cover a history message the prompt still holds, and the prompt must fit as it is. */
function assertNoRepeats(
  fixture: Awaited<ReturnType<typeof windowFixture>>,
  lines: string[],
  fit: (messages: MemoryRecallWindowMessage[]) => MemoryRecallWindowMessage[],
) {
  const sent = fixture.prompt.filter((message) => message.contextKind === "history");
  const oldestSent = Number(/^M(\d+) /.exec(sent[0]!.content)![1]);
  for (const line of lines) {
    const range = /covers M(\d+)-M(\d+)/.exec(line);
    if (range) assert.ok(Number(range[2]) < oldestSent, `${line} repeats history from M${oldestSent} on`);
  }
  assert.equal(fit(fixture.prompt).length, fixture.prompt.length, "the request's own fit has nothing left to drop");
}

const unitCases = [
  {
    name: "recall skips chunks covering a sent message and embeds nothing when none is left",
    async run() {
      const fixture = await windowFixture(20, 10);
      const sentFrom = (first: number) => ({
        chatId: fixture.chatId,
        times: fixture.history.slice(first).map((message) => fixture.messageCreatedAt.get(message.id!)!),
      });
      const calls = embedCalls;
      const outside = await recallMemories(db, "lantern", [fixture.chatId], {
        embeddingSource,
        sentMessages: sentFrom(9),
      });
      assert.deepEqual(
        outside.map((memory) => memory.content.slice(0, 7)).sort(),
        ["CHUNK_A"],
        "a chunk that still has one message in the prompt (M9 of B) is left out",
      );
      assert.equal(embedCalls, calls + 1);
      assert.deepEqual(
        await recallMemories(db, "lantern", [fixture.chatId], { embeddingSource, sentMessages: sentFrom(0) }),
        [],
      );
      assert.equal(embedCalls, calls + 1, "with every chunk in the prompt, the query is not embedded");
      const another = await recallMemories(db, "lantern", [fixture.chatId], {
        embeddingSource,
        sentMessages: { chatId: "another-chat", times: sentFrom(0).times },
      });
      assert.equal(another.length, 4, "sent messages of another chat do not hide this chat's chunks");
    },
  },
  {
    name: "a chat that fits gets no memories, no embedding call and an unchanged prompt",
    async run() {
      const fixture = await windowFixture(20, 100);
      const before = fixture.prompt.map((message) => message.content);
      const calls = embedCalls;
      const lines = await recallInto(fixture, charFit(Number.POSITIVE_INFINITY));
      assert.deepEqual(lines, []);
      assert.equal(embedCalls, calls, "nothing to recall, so the query is not embedded");
      assert.deepEqual(
        fixture.prompt.map((message) => message.content),
        before,
      );
    },
  },
  {
    name: "searching the whole chat still repeats messages the prompt holds",
    async run() {
      const fixture = await windowFixture(20, 100);
      const lines = await recallInto(fixture, null);
      assert.equal(lines.length, 4, "without a prompt window, every chunk can be recalled as before");
      assert.equal(fixture.prompt.filter((message) => message.contextKind === "history").length, 20);
    },
  },
  {
    name: "imported memories are recalled while the whole chat fits",
    async run() {
      const fixture = await windowFixture(20, 100, { imported: [{ content: "IMPORTED memory from another chat." }] });
      const lines = await recallInto(fixture, charFit(Number.POSITIVE_INFINITY));
      assert.deepEqual(lines, ["IMPORTED memory from another chat."]);
      assert.equal(fixture.prompt.filter((message) => message.contextKind === "history").length, 20);
    },
  },
  {
    name: "trimmed history: only chunks outside the sent window, and history the memories push out is recallable",
    async run() {
      // Without memories the fit drops M0-M4. The block needs room, so M5-M9 go too, and chunk B can come back.
      // Chunks as long as the five messages they hold, so the block takes real room.
      const fixture = await windowFixture(20, 800, { chunkSize: 5 * 800 });
      const fit = charFit(50 + 15 * 800);
      assert.equal(fit(fixture.prompt).filter((message) => message.contextKind === "history").length, 15);
      const lines = await recallInto(fixture, fit);
      assert.ok(
        lines.some((line) => line.startsWith("CHUNK_B")),
        `chunk B, pushed out only to make room for the memories, is recalled: ${lines.join(" | ")}`,
      );
      assert.ok(lines.some((line) => line.startsWith("CHUNK_A")));
      assertNoRepeats(fixture, lines, fit);
      const blockIndex = fixture.prompt.findIndex((message) => message.content.includes("recalled fragments"));
      assert.equal(blockIndex, 1, "memories go right before the chat history");
      assert.equal(fixture.prompt[blockIndex + 1]?.contextKind, "history");
    },
  },
  {
    name: "a block smaller than the room reserved for it keeps more history and leaves out what that history covers",
    async run() {
      const fixture = await windowFixture(20, 1000);
      // Room for ten messages beside a full block: M0-M9 are out, so A and B qualify at first.
      const fullBlock = (await import("../../../packages/server/src/services/generation/memory-recall-context.js"))
        .buildMemoryRecallBlock;
      const { sliceTextToTokenBudget } = await import("../../../packages/shared/dist/index.js");
      const reserved = fullBlock([sliceTextToTokenBudget("x".repeat(1024 * 8), 1024)], "none").length;
      const fit = charFit(50 + reserved + 10 * 1000);
      const lines = await recallInto(fixture, fit);
      // The real block is a few hundred characters, so several more messages fit, B's among them.
      assert.deepEqual(
        lines.map((line) => line.slice(0, 7)),
        ["CHUNK_A"],
      );
      const kept = fixture.prompt.filter((message) => message.contextKind === "history").length;
      assert.ok(kept > 10 && kept < 15, `history grew past the reserved window but not into chunk A: ${kept}`);
      assertNoRepeats(fixture, lines, fit);
    },
  },
];

// ── The same through the generate route, with a fake OpenAI-compatible service ──

const prompts: Array<Array<{ role: string; content: string }>> = [];
const queryEmbeddings: string[] = [];
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (req.url?.endsWith("/embeddings")) {
    const texts: string[] = Array.isArray(body.input) ? body.input : [body.input];
    // The query is the newest user message alone; the chunk holding it also holds HISTORY_28.
    for (const text of texts)
      if (text.includes("HISTORY_29_START") && !text.includes("HISTORY_28_START")) queryEmbeddings.push(text);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: texts.map((_, index) => ({ index, embedding: [1, 0, 0] })) }));
    return;
  }
  prompts.push(body.messages);
  const content = "The character answers.";
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
  }
});

const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
const address = provider.address();
assert.ok(address && typeof address === "object");
const connections = createConnectionsStorage(db);
const connection = await connections.create({
  name: "Recall window fixture",
  provider: "custom",
  baseUrl: `http://127.0.0.1:${address.port}/v1`,
  model: "fixture",
  apiKey: "fixture",
  maxContext: 200_000,
  embeddingModel: "fixture-embedding",
});
const setContext = async (maxContext: number) => {
  await connections.update(connection.id, { maxContext });
  await connections.updateDefaultParameters(connection.id, { maxContext, maxTokens: 512 });
};
const chats = createChatsStorage(db);
const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Lantern Keeper" }));
assert.ok(character);
const chat = await chats.create({
  name: "Recall window",
  mode: "roleplay",
  characterIds: [character.id],
  connectionId: connection.id,
});
assert.ok(chat);
await chats.patchMetadata(chat.id, { enableMemoryRecall: true, enableAgents: false });
// 30 messages of about 250 tokens each, marked at both ends so a truncated memory still names its messages. The
// character speaks first, so the newest message (29) is the user's.
for (let index = 0; index < 30; index++) {
  await chats.createMessage({
    chatId: chat.id,
    role: index % 2 ? "user" : "assistant",
    characterId: index % 2 ? null : character.id,
    content: `HISTORY_${index}_START ${"The lantern scene goes on. ".repeat(36)}HISTORY_${index}_END`,
  });
}
const source = await resolveMemoryRecallEmbeddingSource(db, {
  chatMetadata: (await chats.getById(chat.id))!.metadata,
  connectionId: connection.id,
});
assert.ok(source, "the fixture connection embeds");
await chunkAndEmbedMessages(
  db,
  chat.id,
  { userName: "User", characterNames: { [character.id]: "Lantern Keeper" } },
  {
    embeddingSource: source,
  },
);

async function generateAndRead() {
  const queriesBefore = queryEmbeddings.length;
  const result = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat!.id } });
  assert.equal(result.statusCode, 200, result.body);
  assert.ok(!result.body.includes('"type":"error"'), result.body);
  const sent = prompts.at(-1)!;
  const block = sent.find((message) => message.content.includes("recalled fragments"));
  const markers = (text: string) => new Set([...text.matchAll(/HISTORY_(\d+)_/g)].map((match) => Number(match[1])));
  const historyMarkers = new Set(
    sent.filter((message) => message !== block).flatMap((message) => [...markers(message.content)]),
  );
  // Remove the reply this generation saved, so every case starts from the same chat.
  const saved = (await chats.listMessages(chat!.id)).at(-1)!;
  assert.equal(saved.content, "The character answers.");
  const contextFit = JSON.parse(saved.extra as string).generationInfo?.contextFit;
  await chats.removeMessage(saved.id);
  return {
    block,
    contextFit,
    recalled: block ? markers(block.content) : new Set<number>(),
    historyMarkers,
    queried: queryEmbeddings.length - queriesBefore,
  };
}

const routeCases = [
  {
    name: "generate: a chat that fits sends no memories and embeds no query",
    async run() {
      await setContext(200_000);
      const { block, historyMarkers, queried } = await generateAndRead();
      assert.equal(block, undefined, "no memories block while the whole chat fits");
      assert.equal(historyMarkers.size, 30, "every message is sent");
      assert.equal(queried, 0);
    },
  },
  {
    name: "generate: once history is trimmed, memories come only from messages not sent",
    async run() {
      await setContext(6_000);
      const { block, recalled, historyMarkers, queried, contextFit } = await generateAndRead();
      assert.ok(block, "older messages are left out, so recall adds memories");
      assert.equal(queried, 1);
      assert.ok(recalled.size > 0);
      assert.ok(historyMarkers.size < 30 && historyMarkers.has(29));
      const oldestSent = Math.min(...historyMarkers);
      for (const index of recalled)
        assert.ok(index < oldestSent, `recalled HISTORY_${index} is also sent (oldest sent: ${oldestSent})`);
      // Recall removes the history it makes room for before the request's own fit; the saved summary, which the
      // reply checkup reads ("N older messages not sent"), still counts it.
      assert.equal(contextFit?.trimmed, true);
      assert.equal(contextFit?.droppedHistory, 30 - historyMarkers.size, "every history message not sent is counted");
      assert.ok(contextFit.tokensBefore > contextFit.inputBudget, "the size reported is the prompt before trimming");
    },
  },
  {
    name: "generate: Recall from the whole chat brings back messages the prompt already sends",
    async run() {
      await setContext(200_000);
      await chats.patchMetadata(chat!.id, { enableMemoryRecallWholeChat: true });
      const { block, recalled, historyMarkers } = await generateAndRead();
      assert.ok(block, "the whole-chat setting recalls while everything fits");
      assert.ok([...recalled].some((index) => historyMarkers.has(index)));
      await chats.patchMetadata(chat!.id, { enableMemoryRecallWholeChat: false });
    },
  },
];

try {
  await runNamedCases([...unitCases, ...routeCases]);
} finally {
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
