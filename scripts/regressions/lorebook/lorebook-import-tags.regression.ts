import assert from "node:assert/strict";
import { closeDB, getDB } from "../../../packages/server/src/db/connection.js";
import { importSTLorebook } from "../../../packages/server/src/services/import/st-lorebook.importer.js";
import { createLorebooksStorage } from "../../../packages/server/src/services/storage/lorebooks.storage.js";

// The online browser sends a lorebook's source tags with the import; they land on the new lorebook.
const db = await getDB();
const lorebooks = createLorebooksStorage(db);
try {
  const tagged = await importSTLorebook(
    {
      name: "Tagged atlas",
      tags: ["Fantasy", " Worldbuilding ", "Fantasy", "", 7],
      entries: [{ keys: ["atlas"], content: "An atlas." }],
    },
    db,
  );
  assert.deepEqual((await lorebooks.getById(tagged.lorebookId))!.tags, ["Fantasy", "Worldbuilding"]);

  // A file without tags imports with none, as before.
  const plain = await importSTLorebook({ name: "Plain atlas", entries: [{ keys: ["plain"], content: "Plain." }] }, db);
  assert.deepEqual((await lorebooks.getById(plain.lorebookId))!.tags, []);
} finally {
  await closeDB();
}
