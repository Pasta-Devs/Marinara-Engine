import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-background-translation-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
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
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
console.log("Background translation regression passed.");
