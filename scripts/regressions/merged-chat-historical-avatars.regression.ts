/**
 * Merged Roleplay narrator avatars (#8762): a saved reply keeps the active roster it was generated with,
 * so automatic or manual roster changes affect only later replies. Only a streaming reply follows the
 * live roster, and replies saved before the snapshot existed show the whole chat rather than shrinking.
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
  const chat = await chats.create({
    name: "Merged avatars",
    mode: "roleplay",
    characterIds: chatCharacterIds,
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
    inactiveCharacterIds: [cal.id],
  });
  const legacy = await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: ana.id,
    content: "A reply saved before replies kept their roster.",
  });
  const generate = async () => {
    await chats.createMessage({ chatId: chat.id, role: "user", content: "We look around." });
    const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    const reply = (await chats.listMessages(chat.id)).filter((message) => message.role === "assistant").at(-1);
    assert(reply && reply.id !== legacy.id);
    return JSON.parse(reply.extra) as Record<string, unknown>;
  };
  const roster = (extra: Record<string, unknown>, liveRoster: string[], isLive = false) =>
    resolveMergedAvatarRoster({ savedRoster: extra.mergedRosterCharacterIds, chatCharacterIds, liveRoster, isLive });

  const fullReply = await generate();
  assert.deepEqual(fullReply.mergedRosterCharacterIds, [ana.id, ben.id], "a merged reply saves its active roster");

  // Automatic selection (or the user) narrows the scene to Ana; the next reply is written with her alone.
  await chats.patchMetadata(chat.id, { inactiveCharacterIds: [ben.id, cal.id] });
  const soloReply = await generate();
  assert.deepEqual(soloReply.mergedRosterCharacterIds, [ana.id], "the next reply saves the narrowed roster");
  assert.deepEqual(roster(fullReply, [ana.id]), [ana.id, ben.id], "an older reply keeps its roster after it shrinks");
  assert.deepEqual(roster(soloReply, [ana.id]), [ana.id]);
  assert.deepEqual(
    roster(JSON.parse(legacy.extra), [ana.id]),
    chatCharacterIds,
    "a reply without a saved roster shows the whole chat, not the shrunken live roster",
  );
  assert.deepEqual(roster(fullReply, [ana.id], true), [ana.id], "a streaming reply follows the live roster");
  assert.deepEqual(roster({}, [ana.id], true), [ana.id], "so does a new reply with nothing saved yet");

  // The roster grows again (selection turned off): saved replies still keep what they were written with.
  assert.deepEqual(roster(soloReply, chatCharacterIds), [ana.id], "a narrowed reply does not grow back");
  assert.deepEqual(roster(fullReply, chatCharacterIds), [ana.id, ben.id]);
  assert.deepEqual(roster(fullReply, chatCharacterIds, true), chatCharacterIds);
  // A character later removed from the chat drops out; a roster with no chat member left shows the whole chat.
  assert.deepEqual(
    resolveMergedAvatarRoster({ savedRoster: [ben.id, ana.id], chatCharacterIds: [ana.id, cal.id], isLive: false }),
    [ana.id],
  );
  assert.deepEqual(
    resolveMergedAvatarRoster({ savedRoster: [ben.id, 7, null], chatCharacterIds: [ana.id, cal.id], isLive: false }),
    [ana.id, cal.id],
  );
  // Every merged reply in the Roleplay surface (list, Visual Novel, streaming, regenerating) renders through ChatMessage.
  assert.ok(
    /resolveMergedAvatarRoster\(\{\s*savedRoster: extra\.mergedRosterCharacterIds,[^}]*isLive: !!isStreaming,/u.test(
      readFileSync(new URL("../../packages/client/src/components/chat/ChatMessage.tsx", import.meta.url), "utf8"),
    ),
    "ChatMessage picks narrator avatars through the roster decision",
  );
  console.log("Merged Roleplay replies keep the avatar roster they were generated with.");
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
