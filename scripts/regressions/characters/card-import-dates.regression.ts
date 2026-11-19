// Dates on characters made from imported cards. Created is when the card was made: the card's own creation date,
// else the file's date sent with the upload, else the import time. Updated is the import time, so a batch shows one
// "Updated" time whether a card became a new character or updated one; an update keeps the character's Created date.
import assert from "node:assert/strict";
import Fastify from "../../../packages/server/node_modules/fastify/fastify.js";
import multipart from "../../../packages/server/node_modules/@fastify/multipart/index.js";
import { closeDB, getDB } from "../../../packages/server/src/db/connection.js";
import { errorHandler } from "../../../packages/server/src/middleware/error-handler.js";
import { importRoutes } from "../../../packages/server/src/routes/import.routes.js";
import {
  cardCreationTimestamp,
  characterCardImportTimestamps,
} from "../../../packages/server/src/services/import/import-timestamps.js";
import { importSTCharacter } from "../../../packages/server/src/services/import/st-character.importer.js";
import { createCharactersStorage } from "../../../packages/server/src/services/storage/characters.storage.js";

// ── Reading a card's own date ──
const NOW = Date.parse("2026-11-18T12:00:00.000Z");
assert.equal(
  cardCreationTimestamp({ spec: "chara_card_v3", data: { creation_date: 1_700_000_000 } }, NOW),
  "2023-11-14T22:13:20.000Z",
  "V3 creation_date is Unix seconds",
);
assert.ok(
  cardCreationTimestamp({ create_date: "2024-5-12 @14h 3m 22s 123ms", data: {} }, NOW)?.startsWith("2024-05-12"),
  "SillyTavern's create_date beside the card",
);
assert.equal(cardCreationTimestamp({ data: { creation_date: 0 } }, NOW), null, "0 means unknown");
assert.equal(cardCreationTimestamp({ create_date: "2001-01-01" }, NOW), null, "a date before cards existed");
assert.equal(cardCreationTimestamp({ create_date: "2030-01-01" }, NOW), null, "a date in the future");
assert.equal(cardCreationTimestamp({ create_date: "not a date" }, NOW), null);

const fileDate = "2025-03-01T10:00:00.000Z";
assert.deepEqual(
  characterCardImportTimestamps({ data: {} }, { createdAt: fileDate, updatedAt: fileDate }, NOW),
  { createdAt: fileDate, updatedAt: "2026-11-18T12:00:00.000Z" },
  "no card date: Created is the file's date, Updated the import time",
);
assert.deepEqual(
  characterCardImportTimestamps({ data: { creation_date: 1_700_000_000 } }, { createdAt: fileDate }, NOW),
  { createdAt: "2023-11-14T22:13:20.000Z", updatedAt: "2026-11-18T12:00:00.000Z" },
  "the card's own date wins over the file's",
);
assert.deepEqual(
  characterCardImportTimestamps({ data: {} }, undefined, NOW),
  { createdAt: "2026-11-18T12:00:00.000Z", updatedAt: "2026-11-18T12:00:00.000Z" },
  "nothing to go on: both are the import time",
);

// ── Through the import window's upload ──
const db = await getDB();
const characters = createCharactersStorage(db);
const app = Fastify();
app.decorate("db", db);
app.setErrorHandler(errorHandler);
await app.register(multipart);
await app.register(importRoutes, { prefix: "/api/import" });

const card = (name: string, extra: Record<string, unknown> = {}) => ({
  spec: "chara_card_v2",
  spec_version: "2.0",
  ...extra,
  data: { name, creator: "Tester", description: `${name} v1` },
});
const batch = async (name: string, body: unknown, lastModified: number, fields: Record<string, string> = {}) => {
  const boundary = "marinara-card-import-dates";
  const parts = Object.entries({
    ...fields,
    fileTimestamps: JSON.stringify([{ name: `${name}.json`, lastModified }]),
  }).map(([key, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`);
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
      Buffer.from(JSON.stringify(body)),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(response.statusCode, 200, response.body);
  const result = response.json().results[0] as { success: boolean; characterId?: string };
  assert.equal(result.success, true, response.body);
  return result;
};
const datesOf = async (id: string | undefined) => {
  const row = (await characters.getById(id!))!;
  return { createdAt: String(row.createdAt), updatedAt: String(row.updatedAt) };
};

try {
  const oldFile = Date.parse("2025-03-01T10:00:00.000Z");
  const before = new Date().toISOString();

  const plain = await batch("Plain", card("Plain"), oldFile);
  const plainDates = await datesOf(plain.characterId);
  assert.equal(plainDates.createdAt, "2025-03-01T10:00:00.000Z", "Created comes from the file's date");
  assert.ok(plainDates.updatedAt >= before, "Updated is the import time, not the file's date");

  const dated = await batch("Dated", card("Dated", { create_date: "2024-5-12 @14h 3m 22s 123ms" }), oldFile);
  const datedDates = await datesOf(dated.characterId);
  assert.ok(datedDates.createdAt.startsWith("2024-05-1"), `the card's own date wins (${datedDates.createdAt})`);
  assert.ok(datedDates.updatedAt >= before);

  // Updating Plain from a newer card keeps its Created date and stamps Updated now.
  const beforeUpdate = new Date().toISOString();
  await batch(
    "Plain",
    { ...card("Plain"), data: { name: "Plain", creator: "Tester", description: "v2" } },
    Date.now(),
    {
      updateTargets: JSON.stringify([{ index: 0, name: "Plain.json", characterId: plain.characterId }]),
    },
  );
  const updatedDates = await datesOf(plain.characterId);
  assert.equal(updatedDates.createdAt, plainDates.createdAt, "an update keeps Created");
  assert.ok(updatedDates.updatedAt >= beforeUpdate, "an update stamps Updated now");

  // The Card Browser and single-file import send no file date.
  const browser = await importSTCharacter(card("Browser"), db);
  const browserDates = await datesOf(browser.characterId);
  assert.equal(browserDates.createdAt, browserDates.updatedAt, "no dates at all: both are the import time");
} finally {
  await app.close();
  await closeDB();
}
