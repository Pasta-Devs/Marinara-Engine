// The import window's "Lorebooks" choice (All / Hidden / None) reaches the server: a hidden import makes the
// card's lorebook linked to the character but hidden from the Lorebook library, None makes no lorebook, and
// updating a character from a newer card keeps the visibility its lorebook already has.
import assert from "node:assert/strict";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";
import multipart from "../../../packages/server/node_modules/@fastify/multipart/index.js";
import { closeDB, getDB } from "../../../packages/server/src/db/connection.js";
import { errorHandler } from "../../../packages/server/src/middleware/error-handler.js";
import { importRoutes } from "../../../packages/server/src/routes/import.routes.js";
import { importSTCharacter } from "../../../packages/server/src/services/import/st-character.importer.js";
import { createLorebooksStorage } from "../../../packages/server/src/services/storage/lorebooks.storage.js";

const db = await getDB();
const lorebooks = createLorebooksStorage(db);
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(multipart);
await app.register(importRoutes, { prefix: "/api/import" });

const card = (name: string) => ({
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: { name, character_book: { name: "Lore", entries: [{ keys: ["harbor"], content: "Harbor lore" }] } },
});
const hiddenOf = async (lorebookId: string | undefined) => {
  assert.ok(lorebookId, "a lorebook was made");
  return (await lorebooks.getById(lorebookId))!.hiddenFromLibrary;
};
const batch = async (name: string, fields: Record<string, string>) => {
  const boundary = "marinara-embedded-lorebook-choice";
  const parts = Object.entries(fields).map(
    ([key, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
  );
  const response = await app.inject({
    method: "POST",
    url: "/api/import/st-character/batch",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(parts.join("")),
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${name}.json"\r\n` +
          "Content-Type: application/json\r\n\r\n",
      ),
      Buffer.from(JSON.stringify(card(name))),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.json().results[0] as { success: boolean; lorebook?: { lorebookId?: string } };
};

try {
  // ── The importer ──
  const shown = await importSTCharacter(card("Shown"), db);
  assert.equal(await hiddenOf(shown.lorebook?.lorebookId), false, "lorebooks are shown by default");

  const hidden = await importSTCharacter(card("Hidden"), db, { hideEmbeddedLorebook: true });
  assert.equal(await hiddenOf(hidden.lorebook?.lorebookId), true, "Hidden imports the lorebook hidden");
  const hiddenBook = (await lorebooks.getById(hidden.lorebook!.lorebookId!))!;
  assert.deepEqual(hiddenBook.characterIds, [hidden.characterId], "a hidden lorebook stays linked to its character");
  assert.equal(hiddenBook.enabled, true, "and stays on");

  const none = await importSTCharacter(card("None"), db, { importEmbeddedLorebook: false, hideEmbeddedLorebook: true });
  assert.equal(none.lorebook, undefined, "None makes no lorebook");
  assert.equal(none.embeddedLorebook?.skipped, true);

  // Updating from a newer card refills the lorebook but keeps the visibility it has now.
  const updatedShown = await importSTCharacter(card("Shown"), db, {
    updateCharacterId: shown.characterId,
    hideEmbeddedLorebook: true,
  });
  assert.equal(updatedShown.success, true);
  assert.equal(await hiddenOf(shown.lorebook?.lorebookId), false, "an update leaves a shown lorebook shown");

  // ── The import window's upload ──
  const viaBatch = await batch("Batch hidden", { importEmbeddedLorebook: "true", hideEmbeddedLorebook: "true" });
  assert.equal(viaBatch.success, true);
  assert.equal(await hiddenOf(viaBatch.lorebook?.lorebookId), true, "the batch upload honours Hidden");
  const viaBatchShown = await batch("Batch shown", { importEmbeddedLorebook: "true", hideEmbeddedLorebook: "false" });
  assert.equal(await hiddenOf(viaBatchShown.lorebook?.lorebookId), false, "and All");
  const viaBatchNone = await batch("Batch none", { importEmbeddedLorebook: "false", hideEmbeddedLorebook: "false" });
  assert.equal(viaBatchNone.lorebook, undefined, "and None");

  // ── A single JSON card ──
  const json = await app.inject({
    method: "POST",
    url: "/api/import/st-character",
    payload: { ...card("Json hidden"), hideEmbeddedLorebook: true },
  });
  assert.equal(json.statusCode, 200, json.body);
  assert.equal(await hiddenOf(json.json().lorebook?.lorebookId), true, "the JSON route honours Hidden");
} finally {
  await app.close();
  await closeDB();
}
