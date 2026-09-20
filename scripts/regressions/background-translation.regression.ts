import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-background-translation-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { messages: messagesTable } = await import("../../packages/server/src/db/schema/chats.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { characterDataSchema } = await import("../../packages/shared/dist/index.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { translateGeneratedMessage } = await import("../../packages/server/src/services/translation.service.js");
const { getChatTranslationConfig, stripGmTagsKeepReadables } = await import("../../packages/shared/src/index.js");
const db = await getDB();
const chats = createChatsStorage(db);
let duringTranslation: (() => Promise<unknown>) | undefined;
let translated = "Zapisane tłumaczenie.";
const prompts: string[] = [];
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (body.stream) {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "A saved reply survives later errors." }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
    return;
  }
  prompts.push(body.messages.at(-1).content);
  await duringTranslation?.();
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ choices: [{ message: { content: translated }, finish_reason: "stop" }] }));
});
try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Translation fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    treatAsLocalEndpoint: true,
  });
  const chat = await chats.create({ name: "Translation fixture", mode: "roleplay", characterIds: [] });
  const config = getChatTranslationConfig(chat.id, {
    translationProvider: "ai",
    translationConnectionId: connection.id,
    translationTargetLang: "pl",
  });
  assert.equal(config.outputTargetLanguage, "pl", "legacy language settings still apply");
  const resolve = (messageId: string, swipeIndex = 0, mode = "roleplay") =>
    translateGeneratedMessage(db, { chatId: chat.id, messageId, swipeIndex, mode, config });
  const extra = async (id: string) => JSON.parse((await chats.getMessage(id))!.extra);
  const create = (content: string) => chats.createMessage({ chatId: chat.id, role: "assistant", content });
  const first = await create("An original reply.");
  await resolve(first.id);
  assert.equal((await extra(first.id)).translation, translated);
  assert.equal((await extra(first.id)).translationSource, first.content);
  const beforeCached = prompts.length;
  await resolve(first.id);
  assert.equal(prompts.length, beforeCached, "an already translated source is not sent twice");

  await chats.addSwipe(first.id, "An alternative.");
  duringTranslation = () => chats.setActiveSwipe(first.id, 0);
  translated = "Tłumaczenie alternatywy.";
  await resolve(first.id, 1);
  assert.equal(
    (await extra(first.id)).translation,
    "Zapisane tłumaczenie.",
    "a background swipe cannot overwrite the active one",
  );
  await chats.setActiveSwipe(first.id, 1);
  assert.equal((await extra(first.id)).translation, translated);

  const edited = await create("Before an edit.");
  duringTranslation = () => chats.updateMessageContent(edited.id, "Edited while translating.");
  assert.equal(await resolve(edited.id), null);
  assert.equal((await extra(edited.id)).translation, undefined);
  const hidden = await create("Hide this translation.");
  duringTranslation = () => chats.updateMessageExtra(hidden.id, { translationHidden: true });
  assert.equal(await resolve(hidden.id), null);
  assert.equal((await extra(hidden.id)).translationHidden, true);
  const beforeHidden = prompts.length;
  await resolve(hidden.id);
  assert.equal(prompts.length, beforeHidden, "hidden translations remain hidden without another request");

  duringTranslation = undefined;
  const gameContent =
    'The door opens. [music: quiet] [sheet: target="Mari" op="set" path="hp" value=2] [Note: "Read me"]';
  const game = await create(gameContent);
  await resolve(game.id, 0, "game");
  assert.equal((await extra(game.id)).translationSource, stripGmTagsKeepReadables(gameContent));
  assert.ok(prompts.at(-1)!.includes('[Note: "Read me"]'));
  assert.ok(!prompts.at(-1)!.includes("[music:"));
  assert.ok(!prompts.at(-1)!.includes("[sheet:"));
  const failure = await create("A translation failure keeps the reply.");
  translated = "";
  await assert.rejects(resolve(failure.id), /returned no text/);
  assert.equal((await chats.getMessage(failure.id))!.content, failure.content);
  assert.equal((await extra(failure.id)).translation, undefined);
  assert.equal((await extra(failure.id)).automaticTranslationSource, failure.content);

  // Exercise the real generation route: fail metadata persistence AFTER the
  // assistant body has been saved, then let translation use the healthy store.
  const character = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Translator fixture" }));
  assert.ok(character);
  const generatedChat = await chats.create({
    name: "Post-processing failure",
    mode: "roleplay",
    characterIds: [character.id],
    connectionId: connection.id,
  });
  await chats.patchMetadata(generatedChat.id, {
    enableAgents: false,
    enableTools: false,
    autoTranslate: true,
    translationProvider: "ai",
    translationConnectionId: connection.id,
    translationOutputTargetLang: "pl",
  });
  let failedMetadata = false;
  const app = Fastify();
  app.decorate(
    "db",
    new Proxy(db, {
      get(target, key, receiver) {
        if (key !== "update") return Reflect.get(target, key, receiver);
        return (table: Parameters<typeof db.update>[0]) => {
          const builder = target.update(table);
          return new Proxy(builder, {
            get(update, property, owner) {
              if (property !== "set") return Reflect.get(update, property, owner);
              return (values: Record<string, unknown>) => {
                if (
                  table === messagesTable &&
                  !failedMetadata &&
                  typeof values.extra === "string" &&
                  JSON.parse(values.extra).generationInfo
                ) {
                  failedMetadata = true;
                  throw new Error("fixture post-save metadata failure");
                }
                return update.set(values);
              };
            },
          });
        };
      },
    }),
  );
  await app.register(generateRoutes, { prefix: "/api/generate" });
  translated = "Odpowiedź przetrwała późniejszy błąd.";
  try {
    const response = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: generatedChat.id } });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(failedMetadata, true, `the fixture must reach post-save processing: ${response.body}`);
    assert.match(response.body, /fixture post-save metadata failure/);
    const message = (await chats.listMessages(generatedChat.id)).find((row) => row.role === "assistant");
    assert.ok(message);
    for (let attempt = 0; attempt < 100 && !(await extra(message.id)).translation; attempt++) await delay(20);
    assert.equal(
      (await extra(message.id)).translation,
      translated,
      "a saved reply is translated even when later processing fails",
    );
    assert.deepEqual((await app.inject(`/api/generate/status/${generatedChat.id}`)).json(), {
      active: false,
      translating: false,
    });
  } finally {
    await app.close();
  }
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Background translation regression passed.");
