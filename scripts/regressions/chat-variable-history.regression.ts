// Chat variables roll back with the reply that changed them (#6923). A swipe
// starts from the values in place before that reply, deleting the reply puts
// them back, and restoring it from the trash brings its changes back. Deleting
// several replies at once undoes them all, and a branch from an earlier message
// starts from the values at that message (#8990). Values typed in Chat Settings
// after the reply are the user's and stay.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-chat-variable-history-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { applyFeatureSettingsValue } = await import("../../packages/server/src/services/features/feature-settings.js");
const { mergeGeneratedChatMacroVariables } = await import("../../packages/server/src/services/prompt/macro-context.js");
const {
  characterDataSchema,
  diffChatVariables,
  mergeChatVariableChanges,
  redoChatVariableChanges,
  undoChatVariableChanges,
} = await import("../../packages/shared/src/index.js");

// The record keeps own keys, even a "__proto__" name only {{setvar}} could create.
const changes = diffChatVariables({ turns: "10", ["__proto__"]: "a" }, { turns: "9", met: "yes", ["__proto__"]: "b" });
assert.deepEqual(Object.keys(changes).sort(), ["__proto__", "met", "turns"]);
assert.deepEqual(changes.met, [null, "yes"]);
assert.deepEqual(undoChatVariableChanges({ turns: "9", met: "yes", mood: "calm", ["__proto__"]: "b" }, [changes]), {
  turns: "10",
  mood: "calm",
  ["__proto__"]: "a",
});
assert.deepEqual(undoChatVariableChanges({ turns: "20", met: "yes" }, [changes]), { turns: "20" }, "edits stay");
assert.deepEqual(redoChatVariableChanges({ turns: "10" }, [changes]), { turns: "9", met: "yes" });
assert.deepEqual(undoChatVariableChanges({ a: "1" }, ["junk", { a: "bad" }, { a: [1, 2] }, null]), { a: "1" });
assert.deepEqual(
  mergeChatVariableChanges({ turns: ["10", "9"], met: [null, "yes"] }, { turns: ["9", "8"], met: ["yes", null] }),
  { turns: ["10", "8"] },
  "a continuation folds into its reply",
);
// Undoing a regenerated reply removes a variable it created, unless the user changed it since.
assert.deepEqual(mergeGeneratedChatMacroVariables({ met: "yes" }, { met: "yes" }, {}), {});
assert.deepEqual(mergeGeneratedChatMacroVariables({ met: "edited" }, { met: "yes" }, {}), { met: "edited" });

const provider = createServer(async (request, response) => {
  for await (const _chunk of request);
  const content = "The night goes on.";
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
applyFeatureSettingsValue(JSON.stringify({ messageTrash: true }));
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Local fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
  });
  assert.ok(connection);
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Mira" }));
  assert.ok(character);
  // The issue's setup: an always-on entry that counts down once per turn.
  const lorebooks = createLorebooksStorage(db);
  const book = await lorebooks.create({ name: "Countdown" });
  assert.ok(book);
  await lorebooks.createEntry({
    lorebookId: book.id,
    name: "Countdown",
    content: "Turns left: {{decvar::turns}}{{setvar::met::yes}}",
    constant: true,
  } as never);

  for (const mode of ["roleplay", "conversation", "game"] as const) {
    const chat = (await chats.create({
      name: `Countdown ${mode}`,
      mode,
      characterIds: mode === "game" ? [] : [character.id],
      connectionId: connection.id,
      promptPresetId: null,
    }))!;
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      enableTools: false,
      activeLorebookIds: [book.id],
      macroVariables: { turns: "10" },
    });
    const generate = async (payload: Record<string, unknown>) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: chat.id, ...payload },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.ok(!response.body.includes('"type":"error"'), response.body);
    };
    const variables = async () => {
      const metadata = (await chats.getById(chat.id))!.metadata;
      return (typeof metadata === "string" ? JSON.parse(metadata) : metadata).macroVariables ?? {};
    };
    const editVariables = async (macroVariables: Record<string, string | null>) => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/chats/${chat.id}/metadata`,
        payload: { macroVariables },
      });
      assert.equal(response.statusCode, 200, response.body);
    };
    const remove = async (messageId: string) => {
      const response = await app.inject({ method: "DELETE", url: `/api/chats/${chat.id}/messages/${messageId}` });
      assert.equal(response.statusCode, 200, response.body);
      return response.json() as { trashed: boolean };
    };

    await generate({ userMessage: "Hello." });
    assert.deepEqual(await variables(), { turns: "9", met: "yes" }, `${mode}: the reply counts down once`);
    const reply = (await chats.listMessages(chat.id)).at(-1)!;
    assert.equal(reply.role, "assistant");
    // Continuing is part of the same reply.
    await generate({ continueMessageId: reply.id });
    assert.deepEqual(await variables(), { turns: "8", met: "yes" }, `${mode}: a continuation counts down too`);
    await generate({ regenerateMessageId: reply.id });
    await generate({ regenerateMessageId: reply.id });
    assert.deepEqual(
      await variables(),
      { turns: "9", met: "yes" },
      `${mode}: every swipe starts from the values in place before the reply`,
    );

    // Values typed in Chat Settings after the reply are the user's.
    await editVariables({ turns: "20", mood: "calm" });
    await generate({ regenerateMessageId: reply.id });
    assert.deepEqual(await variables(), { turns: "19", met: "yes", mood: "calm" }, `${mode}: a swipe keeps user edits`);

    // Deleting the reply undoes its own changes only.
    const { trashed } = await remove(reply.id);
    assert.deepEqual(await variables(), { turns: "20", mood: "calm" }, `${mode}: deleting the reply rolls back`);
    assert.equal(trashed, mode !== "game", "Game deletes stay permanent");
    if (trashed) {
      const [entry] = (await app.inject({ method: "GET", url: `/api/chats/${chat.id}/trash` })).json();
      const restored = await app.inject({
        method: "POST",
        url: `/api/chats/${chat.id}/trash/restore`,
        payload: { entryIds: [entry.id] },
      });
      assert.equal(restored.statusCode, 200, restored.body);
      assert.deepEqual(
        await variables(),
        { turns: "19", met: "yes", mood: "calm" },
        `${mode}: restoring the reply brings its changes back`,
      );
      await remove(reply.id);
    }

    // A reply saved before this history existed has nothing to undo: deleting
    // it leaves the values alone, and its next swipe counts from them.
    const older = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "An older reply." });
    assert.ok(older);
    await generate({ regenerateMessageId: older.id });
    assert.deepEqual(await variables(), { turns: "19", met: "yes", mood: "calm" }, `${mode}: an old reply`);
    await generate({ regenerateMessageId: older.id });
    assert.deepEqual(await variables(), { turns: "19", met: "yes", mood: "calm" }, `${mode}: then tracks swipes`);
    const legacy = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Another old reply." });
    assert.ok(legacy);
    await remove(legacy.id);
    assert.deepEqual(await variables(), { turns: "19", met: "yes", mood: "calm" }, `${mode}: nothing to undo`);
  }

  // A branch starts from the values in place at the message it was branched from (#8990),
  // and deleting several replies at once undoes them all, with the trash on and off.
  const story = (await chats.create({
    name: "Branches",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
    promptPresetId: null,
  }))!;
  await chats.patchMetadata(story.id, {
    enableAgents: false,
    enableTools: false,
    activeLorebookIds: [book.id],
    macroVariables: { turns: "10" },
  });
  const turnsIn = async (chatId: string) => {
    const metadata = (await chats.getById(chatId))!.metadata;
    return (typeof metadata === "string" ? JSON.parse(metadata) : metadata).macroVariables?.turns;
  };
  const say = async (chatId: string, userMessage: string) => {
    const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId, userMessage } });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
  };
  for (const text of ["One.", "Two.", "Three."]) await say(story.id, text);
  assert.equal(await turnsIn(story.id), "7");
  const firstReply = (await chats.listMessages(story.id)).find((message) => message.role === "assistant")!;
  const branched = await app.inject({
    method: "POST",
    url: `/api/chats/${story.id}/branch`,
    payload: { upToMessageId: firstReply.id },
  });
  assert.equal(branched.statusCode, 200, branched.body);
  const branch = branched.json() as { id: string };
  assert.equal(await turnsIn(branch.id), "9", "a branch from the first reply has its values");
  await say(branch.id, "Two, again.");
  assert.equal(await turnsIn(branch.id), "8", "the branch counts on from there");
  assert.equal(await turnsIn(story.id), "7", "the source chat keeps its own values");
  const clearBranch = await app.inject({
    method: "POST",
    url: `/api/chats/${branch.id}/messages/bulk-delete`,
    payload: { messageIds: (await chats.listMessages(branch.id)).map((message) => message.id) },
  });
  assert.equal(clearBranch.statusCode, 200, clearBranch.body);
  assert.equal(await turnsIn(branch.id), "10", "the copied reply keeps its changes to undo");
  const latest = await app.inject({ method: "POST", url: `/api/chats/${story.id}/branch`, payload: {} });
  assert.equal(latest.statusCode, 200, latest.body);
  assert.equal(await turnsIn((latest.json() as { id: string }).id), "7", "a branch from the end keeps them all");

  const removeLastExchanges = async (count: number) => {
    const ids = (await chats.listMessages(story.id)).slice(-2 * count).map((message) => message.id);
    const response = await app.inject({
      method: "POST",
      url: `/api/chats/${story.id}/messages/bulk-delete`,
      payload: { messageIds: ids },
    });
    assert.equal(response.statusCode, 200, response.body);
    return (response.json() as { trashed: boolean }).trashed;
  };
  assert.equal(await removeLastExchanges(2), true);
  assert.equal(await turnsIn(story.id), "9", "deleting two exchanges to the trash undoes both");
  for (const text of ["Two.", "Three."]) await say(story.id, text);
  assert.equal(await turnsIn(story.id), "7");
  applyFeatureSettingsValue(JSON.stringify({ messageTrash: false }));
  assert.equal(await removeLastExchanges(2), false);
  assert.equal(await turnsIn(story.id), "9", "deleting two exchanges for good undoes both");
  applyFeatureSettingsValue(JSON.stringify({ messageTrash: true }));

  // The values follow the swipe on screen, as a tracker's do.
  const tellings = await lorebooks.create({ name: "Tellings" });
  assert.ok(tellings);
  await lorebooks.createEntry({
    lorebookId: tellings.id,
    name: "Telling",
    content: "Told as {{setvar::told::{{lastGenerationType}}}}{{getvar::told}}.",
    constant: true,
  } as never);
  const chat = (await chats.create({
    name: "Tellings",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
    promptPresetId: null,
  }))!;
  await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false, activeLorebookIds: [tellings.id] });
  const told = async () => {
    const metadata = (await chats.getById(chat.id))!.metadata;
    return (typeof metadata === "string" ? JSON.parse(metadata) : metadata).macroVariables?.told;
  };
  const request = async (method: "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: object) => {
    const response = await app.inject({ method, url, payload });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes('"type":"error"'), response.body);
  };
  await request("POST", "/api/generate/", { chatId: chat.id, userMessage: "Hello." });
  const reply = (await chats.listMessages(chat.id)).at(-1)!;
  await request("POST", "/api/generate/", { chatId: chat.id, regenerateMessageId: reply.id });
  assert.equal(await told(), "regenerate");
  const showSwipe = (index: number) =>
    request("PUT", `/api/chats/${chat.id}/messages/${reply.id}/active-swipe`, { index });
  await showSwipe(0);
  assert.equal(await told(), "normal", "showing the first swipe brings its values back");
  await showSwipe(1);
  assert.equal(await told(), "regenerate");
  await request("DELETE", `/api/chats/${chat.id}/messages/${reply.id}/swipes/1`);
  assert.equal(await told(), "normal", "deleting the shown swipe shows the next one's values");
  await request("PATCH", `/api/chats/${chat.id}/metadata`, { macroVariables: { told: "mine" } });
  await request("POST", "/api/generate/", { chatId: chat.id, regenerateMessageId: reply.id });
  await showSwipe(0);
  assert.equal(await told(), "mine", "a value typed in Chat Settings stays when the swipe changes");
  // Deleting the reply only undoes the swipe on screen. A hidden swipe once set "regenerate";
  // when the user types that same value, the delete must not treat it as that swipe's change.
  await request("PATCH", `/api/chats/${chat.id}/metadata`, { macroVariables: { told: "regenerate" } });
  await request("DELETE", `/api/chats/${chat.id}/messages/${reply.id}`);
  assert.equal(await told(), "regenerate", "deleting a reply ignores its hidden swipes");

  // A branch undoes the swipe on screen of each later reply, not a hidden one. Here the first
  // swipe of the later reply changes nothing and the one on screen sets "regenerate".
  await request("PATCH", `/api/chats/${chat.id}/metadata`, { macroVariables: {} });
  await request("POST", "/api/generate/", { chatId: chat.id, userMessage: "Hello again." });
  const forkPoint = (await chats.listMessages(chat.id)).at(-1)!;
  assert.equal(await told(), "normal");
  await request("POST", "/api/generate/", { chatId: chat.id, userMessage: "And again." });
  const later = (await chats.listMessages(chat.id)).at(-1)!;
  await request("POST", "/api/generate/", { chatId: chat.id, regenerateMessageId: later.id });
  assert.equal(await told(), "regenerate");
  const forked = await app.inject({
    method: "POST",
    url: `/api/chats/${chat.id}/branch`,
    payload: { upToMessageId: forkPoint.id },
  });
  assert.equal(forked.statusCode, 200, forked.body);
  const forkedMetadata = (await chats.getById((forked.json() as { id: string }).id))!.metadata;
  assert.equal(
    (typeof forkedMetadata === "string" ? JSON.parse(forkedMetadata) : forkedMetadata).macroVariables?.told,
    "normal",
    "a branch undoes the swipe on screen",
  );
} finally {
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await app.close();
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
