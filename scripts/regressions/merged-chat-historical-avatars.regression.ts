/**
 * Merged Roleplay narrator avatars (#8762): a saved reply keeps the active roster it was generated with,
 * so automatic or manual roster changes affect only later replies. A streaming reply follows the live
 * roster (a continuation keeps its saved one too), and a reply saved before the snapshot existed shows the
 * members its expression result names plus the live roster: it neither shrinks to one avatar nor revives
 * a member who was inactive. Continuing such a reply keeps those members, on the stream and once saved, and
 * continuing any reply keeps a member who has left the chat on its roster, hidden until they rejoin, even when
 * their leaving takes the chat down to one member.
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
const { characterDataSchema, mergedReplyRoster } = await import("../../packages/shared/dist/index.js");

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
    if (!payload.continueMessageId && !payload.regenerateMessageId) {
      await chats.createMessage({ chatId, role: "user", content: "We look around." });
    }
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

  // Ana alone again: continuing an older reply keeps the members its expression result names (never the persona),
  // on the stream as RegeneratingMessageContent seeds it and once saved, while a regeneration follows the live roster.
  await chats.patchMetadata(chat.id, { inactiveCharacterIds: [ben.id, cal.id] });
  const olderReplies = {
    "a reply with an expression sprite list": {
      spriteExpressions: { [ana.id]: "smile" },
      expressionSpriteIds: [ana.id, ben.id, "persona-not-a-member"],
    },
    "an older reply with only expression keys": {
      spriteExpressions: { [ana.id]: "smile", [ben.id]: "frown", "persona-not-a-member": "calm" },
    },
  };
  for (const [kind, legacyExtra] of Object.entries(olderReplies)) {
    const older = await chats.createMessage({
      chatId: chat.id,
      role: "assistant",
      characterId: ana.id,
      content: "An older reply.",
      extra: legacyExtra,
    } as never);
    const olderExtra = JSON.parse(older.extra) as Record<string, unknown>;
    assert.deepEqual(roster(olderExtra, narrowed), [ana.id, ben.id], `${kind} shows Ana and Ben`);
    const continuationStream = {
      ...olderExtra,
      mergedRosterCharacterIds: mergedReplyRoster(olderExtra, chatCharacterIds),
    };
    assert.deepEqual(roster(continuationStream, narrowed, true), [ana.id, ben.id], `${kind} streams Continue with Ben`);
    const olderContinued = await generate(chat.id, { continueMessageId: older.id });
    assert.equal(olderContinued.id, older.id);
    assert.deepEqual(olderContinued.extra.mergedRosterCharacterIds, [ana.id, ben.id], `${kind} keeps Ben on Continue`);
    const regenerationStream = { ...olderExtra, mergedRosterCharacterIds: null };
    assert.deepEqual(roster(regenerationStream, narrowed, true), [ana.id], `${kind} regenerates with the live roster`);
    const regenerated = await generate(chat.id, { regenerateMessageId: older.id });
    assert.equal(regenerated.id, older.id);
    assert.deepEqual(
      regenerated.extra.mergedRosterCharacterIds,
      [ana.id],
      `${kind}: a new swipe saves the live roster`,
    );
  }

  // Ben leaves the chat: continuing a reply written with Ana and Ben keeps him on its saved roster, so his avatar
  // stays hidden while he is out and comes back once he is added back. The Continue stream shows what gets saved.
  const departed = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: ana.id,
    content: "Ana and Ben share a reply.",
    extra: { mergedRosterCharacterIds: [ana.id, ben.id] },
  } as never);
  const members = async (): Promise<string[]> => JSON.parse(String((await chats.getById(chat.id))!.characterIds));
  const rosterIn = (memberIds: string[], extra: unknown, isLive = false) =>
    resolveMergedAvatarRoster({
      extra: extra as Record<string, unknown>,
      chatCharacterIds: memberIds,
      liveRoster: narrowed,
      isLive,
    });
  await chats.update(chat.id, { characterIds: [ana.id, cal.id] });
  const withoutBen = await members();
  const departedExtra = JSON.parse(departed.extra) as Record<string, unknown>;
  const departedStream = { ...departedExtra, mergedRosterCharacterIds: mergedReplyRoster(departedExtra, withoutBen) };
  assert.deepEqual(
    rosterIn(withoutBen, departedStream, true),
    [ana.id],
    "Continue streams without Ben while he is out",
  );
  const departedContinued = await generate(chat.id, { continueMessageId: departed.id });
  assert.equal(departedContinued.id, departed.id);
  assert.deepEqual(
    departedContinued.extra.mergedRosterCharacterIds,
    [ana.id, ben.id],
    "Continue keeps a departed member on the saved roster",
  );
  assert.deepEqual(rosterIn(withoutBen, departedContinued.extra), [ana.id], "Ben stays hidden while he is out");
  await chats.update(chat.id, { characterIds: chatCharacterIds });
  assert.deepEqual(rosterIn(await members(), departedContinued.extra), [ana.id, ben.id], "and is back once he rejoins");

  // The same when Ben's leaving takes a merged chat down to Ana alone, which is no longer a merged group. An older
  // reply without a roster still gets none, so its expression result keeps deciding instead of pinning it to Ana.
  const pairChat = await createChat([ana.id, ben.id]);
  await chats.createMessage({ chatId: pairChat.id, role: "user", content: "We look around." });
  const pairMessage = (extra: Record<string, unknown>) =>
    chats.createMessage({
      chatId: pairChat.id,
      role: "assistant",
      characterId: ana.id,
      content: "Ana and Ben share a reply.",
      extra,
    } as never);
  const pairReply = await pairMessage({ mergedRosterCharacterIds: [ana.id, ben.id] });
  await chats.update(pairChat.id, { characterIds: [ana.id] });
  const pairContinued = await generate(pairChat.id, { continueMessageId: pairReply.id });
  assert.equal(pairContinued.id, pairReply.id);
  assert.deepEqual(
    pairContinued.extra.mergedRosterCharacterIds,
    [ana.id, ben.id],
    "Continue keeps the saved roster in a chat left with one member",
  );
  const pairLegacy = await pairMessage({ spriteExpressions: { [ana.id]: "smile", [ben.id]: "frown" } });
  const pairLegacyContinued = await generate(pairChat.id, { continueMessageId: pairLegacy.id });
  assert.equal(pairLegacyContinued.id, pairLegacy.id);
  assert.deepEqual(pairLegacyContinued.extra.mergedRosterCharacterIds, [], "an older reply stays without a roster");
  await chats.update(pairChat.id, { characterIds: [ana.id, ben.id] });
  const pairMembers: string[] = JSON.parse(String((await chats.getById(pairChat.id))!.characterIds));
  for (const [kind, extra] of [
    ["the continued reply", pairContinued.extra],
    ["the continued older reply", pairLegacyContinued.extra],
  ] as const) {
    assert.deepEqual(
      resolveMergedAvatarRoster({ extra, chatCharacterIds: pairMembers, liveRoster: [ana.id], isLive: false }),
      [ana.id, ben.id],
      `${kind} shows Ben again once he rejoins`,
    );
  }

  // The roster grows again: saved replies still keep what they were written with.
  assert.deepEqual(roster(soloReply.extra, chatCharacterIds), [ana.id], "a narrowed reply does not grow back");
  assert.deepEqual(roster(fullReply.extra, chatCharacterIds), [ana.id, ben.id]);
  assert.deepEqual(roster({}, chatCharacterIds, true), chatCharacterIds, "a new reply shows everyone active");
  // A character later removed from the chat drops out. A saved roster with no member left shows the live roster,
  // as it will once continued, and never the expression result, which only stands in for a missing roster.
  const fallback = (extra: Record<string, unknown>) =>
    resolveMergedAvatarRoster({ extra, chatCharacterIds: [ana.id, cal.id], liveRoster: [ana.id], isLive: false });
  assert.deepEqual(fallback({ mergedRosterCharacterIds: [ben.id, ana.id] }), [ana.id]);
  assert.deepEqual(
    fallback({ mergedRosterCharacterIds: [ben.id, 7, null], spriteExpressions: { [cal.id]: "calm" } }),
    [ana.id],
    "a roster of departed members does not fall back to the expression result",
  );

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
  assert.match(
    clientSource("ChatRoleplaySurface.tsx"),
    /:\s*\{\s*mergedRosterCharacterIds: mergedReplyRoster\(parsedExtra, rest\.chatCharacterIds \?\? \[\]\)\s*\}\),/u,
    "a continued reply streams with its own roster, which the server also keeps",
  );
  console.log("Merged Roleplay replies keep the avatar roster they were generated with.");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
