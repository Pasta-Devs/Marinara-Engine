/**
 * Merged Roleplay narrator avatars (#8762): a saved reply keeps the active roster it was generated with,
 * so automatic or manual roster changes affect only later replies. A streaming reply follows the live
 * roster (a continuation keeps its saved one too), and a reply saved before the snapshot existed shows the
 * members its expression result names plus the live roster: it neither shrinks to one avatar nor revives
 * a member who was inactive.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveMergedAvatarRoster } from "../../packages/client/src/components/chat/merged-avatar-roster.ts";

const dir = mkdtempSync(join(tmpdir(), "marinara-merged-avatars-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");

const provider = createServer(async (request, response) => {
  for await (const _chunk of request);
  const chunk = { choices: [{ index: 0, delta: { content: "The scene goes on." }, finish_reason: null }] };
  const stop = { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] };
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(stop)}\n\ndata: [DONE]\n\n`);
});
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Merged avatar fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
  });
  assert(connection);
  const characters = createCharactersStorage(db);
  const [ana, ben, cal] = await Promise.all(
    ["Ana", "Ben", "Cal"].map((name) => characters.create(characterDataSchema.parse({ name }))),
  );
  assert(ana && ben && cal);
  const chatCharacterIds = [ana.id, ben.id, cal.id];
  const createChat = async (characterIds: string[]) => {
    const chat = await chats.create({
      name: "Merged avatars",
      mode: "roleplay",
      characterIds,
      connectionId: connection.id,
      promptPresetId: null,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      enableTools: false,
      enableMemoryRecall: false,
      groupChatMode: "merged",
      groupResponseOrder: "manual",
    });
    return chat;
  };
  const chat = await createChat(chatCharacterIds);
  // Cal is a member who sits out the whole scene.
  await chats.patchMetadata(chat.id, { inactiveCharacterIds: [cal.id] });
  // Replies saved before replies kept their roster: one with an expression result, one without.
  const legacyWithExpressions = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: ana.id,
    content: "Ana and Ben trade looks.",
    extra: {
      spriteExpressions: { [ana.id]: "smile", [ben.id]: "frown" },
      expressionSpriteIds: [ana.id, ben.id, "persona-not-a-member"],
    },
  } as never);
  const legacyPlain = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: ana.id,
    content: "A reply saved before replies kept their roster.",
  });
  const lastReply = async (chatId: string) => {
    const reply = (await chats.listMessages(chatId)).filter((message) => message.role === "assistant").at(-1);
    assert(reply && reply.id !== legacyWithExpressions.id && reply.id !== legacyPlain.id);
    return { id: reply.id, extra: JSON.parse(reply.extra) as Record<string, unknown> };
  };
  const generate = async (chatId = chat.id, payload: Record<string, unknown> = {}) => {
    if (!payload.continueMessageId) await chats.createMessage({ chatId, role: "user", content: "We look around." });
    const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId, ...payload } });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    return lastReply(chatId);
  };
  const inactive = async () => JSON.parse(String((await chats.getById(chat.id))!.metadata)).inactiveCharacterIds;
  const roster = (extra: unknown, liveRoster: string[], isLive = false) =>
    resolveMergedAvatarRoster({ extra: extra as Record<string, unknown>, chatCharacterIds, liveRoster, isLive });

  const fullReply = await generate();
  assert.deepEqual(fullReply.extra.mergedRosterCharacterIds, [ana.id, ben.id], "a merged reply saves its roster");

  // Automatic selection narrows the scene to Ana (the Character Tracker sees only her); the next reply is hers alone.
  const stateStore = createGameStateStorage(db);
  const stateId = await stateStore.create({
    chatId: chat.id,
    messageId: fullReply.id,
    swipeIndex: 0,
    date: null,
    time: null,
    location: "Hall",
    weather: null,
    temperature: null,
    worldCustomFields: [],
    presentCharacters: [{ characterId: ana.id, name: "Ana", mood: "calm" }],
    recentEvents: [],
    personaStats: null,
    playerStats: null,
  } as never);
  await stateStore.commit(stateId, chat.id);
  await chats.patchMetadata(chat.id, { autoActiveCharacters: "tracker" });
  const soloReply = await generate();
  assert.deepEqual(await inactive(), [ben.id, cal.id], "automatic selection narrowed the roster to Ana");
  assert.deepEqual(soloReply.extra.mergedRosterCharacterIds, [ana.id], "the next reply saves the narrowed roster");

  const narrowed = [ana.id];
  assert.deepEqual(roster(fullReply.extra, narrowed), [ana.id, ben.id], "an older reply keeps its roster");
  assert.deepEqual(roster(soloReply.extra, narrowed), [ana.id]);
  assert.deepEqual(
    roster(JSON.parse(legacyWithExpressions.extra), narrowed),
    [ana.id, ben.id],
    "a reply without a saved roster gets back the members its expression result names",
  );
  assert.deepEqual(roster(JSON.parse(legacyPlain.extra), narrowed), [ana.id], "with nothing saved: the live roster");
  assert.deepEqual(roster({}, narrowed, true), [ana.id], "a new streaming reply follows the live roster");
  assert.deepEqual(
    roster({ ...fullReply.extra, mergedRosterCharacterIds: null }, narrowed, true),
    [ana.id],
    "so does a regeneration, which streams with the old swipe's roster cleared",
  );
  // Before #8762, a reply with nothing saved showed the active roster, which never includes inactive Cal.
  for (const legacy of [legacyWithExpressions, legacyPlain]) {
    assert.deepEqual(roster(JSON.parse(legacy.extra), [ana.id, ben.id]), [ana.id, ben.id], "Cal is not revived");
  }

  // Selection off and Ben alone in the scene: continuing Ana's reply keeps her and adds Ben, live and once saved.
  await chats.patchMetadata(chat.id, { autoActiveCharacters: "off", inactiveCharacterIds: [ana.id, cal.id] });
  assert.deepEqual(roster(soloReply.extra, [ben.id], true), [ana.id, ben.id], "a continuation streams with both");
  const continued = await generate(chat.id, { continueMessageId: soloReply.id });
  assert.equal(continued.id, soloReply.id);
  assert.deepEqual(continued.extra.mergedRosterCharacterIds, [ana.id, ben.id], "the server merges them on Continue");

  // The roster grows again: saved replies still keep what they were written with.
  assert.deepEqual(roster(soloReply.extra, chatCharacterIds), [ana.id], "a narrowed reply does not grow back");
  assert.deepEqual(roster(fullReply.extra, chatCharacterIds), [ana.id, ben.id]);
  assert.deepEqual(roster({}, chatCharacterIds, true), chatCharacterIds, "a new reply shows everyone active");
  // A character later removed from the chat drops out; a roster with no member left falls back like a legacy reply.
  const fallback = (mergedRosterCharacterIds: unknown) =>
    resolveMergedAvatarRoster({
      extra: { mergedRosterCharacterIds },
      chatCharacterIds: [ana.id, cal.id],
      liveRoster: [ana.id],
      isLive: false,
    });
  assert.deepEqual(fallback([ben.id, ana.id]), [ana.id]);
  assert.deepEqual(fallback([ben.id, 7, null]), [ana.id]);

  // A reply outside a merged group saves an empty roster, so a swipe never inherits a stale one.
  const soloChat = await createChat([ana.id]);
  assert.deepEqual((await generate(soloChat.id)).extra.mergedRosterCharacterIds, []);

  // Every merged reply in the Roleplay surface (list, Visual Novel, streaming, regenerating) renders through ChatMessage.
  const clientSource = (file: string) =>
    readFileSync(new URL(`../../packages/client/src/components/chat/${file}`, import.meta.url), "utf8");
  assert.match(
    clientSource("ChatMessage.tsx"),
    /resolveMergedAvatarRoster\(\{\s*extra,[^}]*isLive: !!isStreaming,/u,
    "ChatMessage picks narrator avatars through the roster decision",
  );
  assert.match(
    clientSource("ChatRoleplaySurface.tsx"),
    /\.\.\.\(!isContinuation\s*\?\s*\{[^}]*mergedRosterCharacterIds: null,/u,
    "a regenerating reply streams without the old swipe's roster",
  );
  console.log("Merged Roleplay replies keep the avatar roster they were generated with.");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
