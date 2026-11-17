// A Conversation group in Individual mode answers one character at a time, through the real generate route on a fresh
// database in a temporary folder:
// - each character waits only for their own presence delay, counted from when the user sent, so a slow earlier reply
//   uses up a later character's wait;
// - a delayed character reads messages the user sent while they waited, but not old ones outside the context limit;
// - each character's prompt gets their own lorebooks plus the user's character-backed identity, not the others';
// - a Persona's legacy Convo Behavior never steers the prompt, while a character's does.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-conversation-group-responders-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createLorebooksStorage } = await import("../../../packages/server/src/services/storage/lorebooks.storage.js");
const { characterDataSchema, createLorebookEntrySchema, createLorebookSchema } =
  await import("../../../packages/shared/dist/index.js");

// Every model request, in order. `beforeReply` lets a case act while a reply is being written.
const requests: string[] = [];
let beforeReply: (requestIndex: number) => Promise<void> = async () => {};
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  const index = requests.push(JSON.stringify(body.messages)) - 1;
  await beforeReply(index);
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: `Reply ${index}.` }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Conversation fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 8192,
  });
  assert(connection);

  const characters = createCharactersStorage(db);
  const RESPONSE_DELAY_MS = 2_000;
  const character = (name: string, status: "online" | "idle", extensions: Record<string, unknown> = {}) =>
    characters.create(
      characterDataSchema.parse({
        name,
        extensions: {
          conversationStatusOverride: { status, createdAt: new Date().toISOString() },
          // The card's schedule sets how long an idle character takes to answer.
          conversationSchedule: {
            weekStart: "2026-11-16T00:00:00.000Z",
            days: Object.fromEntries(
              ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => [day, []]),
            ),
            inactivityThresholdMinutes: 90,
            talkativeness: 50,
            idleResponseDelayMinutes: RESPONSE_DELAY_MS / 60_000,
          },
          ...extensions,
        },
      }),
    );
  const aya = await character("Aya", "online", {
    convoBehavior: { instruction: "AYA_BEHAVIOR_RULE", insertionStrategy: "constant_after" },
  });
  const bram = await character("Bram", "idle");
  const cara = await character("Cara", "online");
  const dov = await character("Dov", "online");
  const ivy = await character("Ivy", "online");
  assert(aya && bram && cara && dov && ivy);

  const conversation = async (characterIds: string[], extra: Record<string, unknown> = {}) => {
    const chat = await chats.create({
      name: "Conversation group",
      mode: "conversation",
      characterIds,
      connectionId: connection.id,
      ...extra,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      enableMemoryRecall: false,
      groupChatMode: "individual",
      groupResponseOrder: "sequential",
    });
    return chat.id;
  };
  const turn = async (chatId: string, userMessage: string) => {
    requests.length = 0;
    const result = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId, userMessage, streaming: true },
    });
    assert.equal(result.statusCode, 200, result.body);
    assert(!result.body.includes('"type":"error"'), result.body);
    const events = result.body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)));
    return {
      delayed: events.filter((event) => event.type === "delayed"),
      speakers: events.filter((event) => event.type === "group_turn").map((event) => event.data.characterId),
      requests: [...requests],
    };
  };

  // ── Presence delays ──────────────────────────────────────────────────────────
  const waiting = await conversation([aya.id, bram.id]);
  await chats.patchMetadata(waiting, { contextMessageLimit: 2 });
  for (const content of ["Old note 1.", "Old note 2."]) {
    await chats.createMessage({ chatId: waiting, role: "user", characterId: null, content });
    await chats.createMessage({ chatId: waiting, role: "assistant", characterId: aya.id, content: "Noted." });
  }

  // Aya answers at once. Bram is idle, so only Bram waits, and only for what is left of his own delay.
  beforeReply = async () => {};
  const quick = await turn(waiting, "Plans for tonight?");
  assert.deepEqual(quick.speakers, [aya.id, bram.id]);
  assert.equal(quick.requests.length, 2, "one model request per character");
  assert.equal(quick.delayed.length, 1, JSON.stringify(quick.delayed));
  assert.deepEqual(quick.delayed[0].characterIds, [bram.id], "only the idle character waits");
  assert.ok(quick.delayed[0].delayMs > 0 && quick.delayed[0].delayMs <= RESPONSE_DELAY_MS);
  assert.match(quick.requests[1]!, /Plans for tonight\?/u);
  assert.doesNotMatch(
    quick.requests[1]!,
    /Old note 1/u,
    "a delayed character must not pick up old messages outside the context limit",
  );

  // Aya takes longer than Bram's delay, and the user sends another message meanwhile. Bram's wait is used up, so he
  // answers without waiting, and he still reads that message.
  beforeReply = async (index) => {
    if (index !== 0) return;
    await chats.createMessage({
      chatId: waiting,
      role: "user",
      characterId: null,
      content: "Late note: bring snacks.",
    });
    await new Promise((resolve) => setTimeout(resolve, RESPONSE_DELAY_MS + 500));
  };
  const slow = await turn(waiting, "Who's cooking?");
  beforeReply = async () => {};
  assert.deepEqual(slow.speakers, [aya.id, bram.id]);
  assert.deepEqual(slow.delayed, [], "a wait already used up is not waited again");
  assert.match(slow.requests[1]!, /bring snacks/u, "the delayed character reads what the user sent meanwhile");

  // ── Lorebooks per character ──────────────────────────────────────────────────
  const lorebooks = createLorebooksStorage(db);
  for (const [owner, content] of [
    [cara, "CARA_LORE"],
    [dov, "DOV_LORE"],
    [ivy, "IDENTITY_LORE"],
  ] as const) {
    const book = await lorebooks.create(
      createLorebookSchema.parse({ name: `${content} book`, characterIds: [owner.id] }),
    );
    assert(book);
    await lorebooks.createEntry(
      createLorebookEntrySchema.parse({ lorebookId: book.id, name: content, content, keys: [], constant: true }),
    );
  }
  // The user speaks as Ivy, a character card, so Ivy's lorebook belongs to every reply.
  const lore = await conversation([cara.id, dov.id], { personaCharacterId: ivy.id });
  const lored = await turn(lore, "Tell me something.");
  assert.deepEqual(lored.speakers, [cara.id, dov.id]);
  const [caraPrompt, dovPrompt] = lored.requests;
  assert.match(caraPrompt!, /CARA_LORE/u);
  assert.match(caraPrompt!, /IDENTITY_LORE/u);
  assert.doesNotMatch(caraPrompt!, /DOV_LORE/u, "a character never sees another character's lorebook");
  assert.match(dovPrompt!, /DOV_LORE/u, "each character gets their own lorebook, not the first character's");
  assert.match(dovPrompt!, /IDENTITY_LORE/u);
  assert.doesNotMatch(dovPrompt!, /CARA_LORE/u);

  // ── Persona Convo Behavior ───────────────────────────────────────────────────
  const persona = await characters.createPersona("Pat", "The user.", undefined, {
    convoBehavior: JSON.stringify({ instruction: "PERSONA_BEHAVIOR_RULE", insertionStrategy: "constant_after" }),
  });
  assert(persona);
  const personaChat = await conversation([aya.id, cara.id], { personaId: persona.id });
  const personaTurn = await turn(personaChat, "Hello there.");
  assert.match(personaTurn.requests[0]!, /AYA_BEHAVIOR_RULE/u, "a character's Convo Behavior steers its reply");
  for (const prompt of personaTurn.requests) {
    assert.doesNotMatch(prompt, /PERSONA_BEHAVIOR_RULE/u, "a Persona's legacy Convo Behavior never steers a reply");
  }
  console.log("Conversation group responders regression passed.");
} finally {
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
