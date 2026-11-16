import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyCharacterTagEdit,
  isEmptyCharacterTagEdit,
  normalizeCharacterTagEdit,
  summarizeCharacterTagEdit,
} from "../../../packages/shared/src/utils/character-tag-edits.js";

// ── Pure tag edits ──
assert.deepEqual(applyCharacterTagEdit(["Fantasy", "NPC"], { add: ["noble", "npc"] }), ["Fantasy", "NPC", "noble"]);
assert.deepEqual(applyCharacterTagEdit(["Fantasy", "NPC"], { remove: ["npc"] }), ["Fantasy"]);
assert.deepEqual(
  applyCharacterTagEdit(["a", "Old", "b"], { rename: [{ from: "old", to: "New" }] }),
  ["a", "New", "b"],
  "rename keeps position",
);
assert.deepEqual(
  applyCharacterTagEdit(["Old", "New"], { rename: [{ from: "Old", to: "new" }] }),
  ["new"],
  "rename into an existing tag merges instead of duplicating",
);
assert.deepEqual(
  applyCharacterTagEdit(["x"], { rename: [{ from: "x", to: "y" }], remove: ["y"], add: ["z"] }),
  ["z"],
  "rename, then remove, then add",
);
assert.deepEqual(normalizeCharacterTagEdit({ add: [" a ", "A", ""], rename: [{ from: "q", to: "q" }] }), {
  add: ["a"],
  remove: [],
  rename: [],
});
assert.equal(isEmptyCharacterTagEdit({ add: ["  "], rename: [{ from: "a", to: "" }] }), true);

const summary = summarizeCharacterTagEdit(
  [
    { id: "1", tags: ["old", "keep"] },
    { id: "2", tags: ["keep"] },
    { id: "3", tags: ["drop", "new"] },
  ],
  { rename: [{ from: "old", to: "new" }], remove: ["drop"], add: ["keep"] },
);
assert.deepEqual(summary.changedIds, ["1", "3"]);
assert.deepEqual(summary.renamed, [{ from: "old", to: "new", count: 1 }]);
assert.deepEqual(summary.removed, [{ tag: "drop", count: 1 }]);
assert.deepEqual(summary.added, [{ tag: "keep", count: 1 }], "only cards missing the tag count as added");

// ── Character editor tag suggestions (#7427) ──
const characterEditorSource = readFileSync(
  new URL("../../../packages/client/src/components/characters/CharacterEditor.tsx", import.meta.url),
  "utf8",
);
const metadataTabStart = characterEditorSource.indexOf("function MetadataTab(");
assert.ok(metadataTabStart >= 0, "the Metadata tab remains discoverable");
const metadataTabSource = characterEditorSource.slice(metadataTabStart);
assert.match(
  metadataTabSource,
  /addTag\(\[\.\.\.newTag\.split\(","\)\.slice\(0, -1\), tag\]\.join\(","\)\)/u,
  "picking a suggestion replaces only the last draft part, keeping earlier comma-separated tags",
);
assert.match(
  metadataTabSource,
  /if \(event\.nativeEvent\.isComposing \|\| event\.keyCode === 229\) return;\s*if \(event\.key === "ArrowDown" && tagSuggestions\.length > 0\)/u,
  "keys that confirm an IME composition never pick a suggestion or add a half-typed tag",
);
assert.match(
  metadataTabSource,
  /role="option"\s+tabIndex=\{-1\}/u,
  "suggestions stay out of the Tab order; focus stays on the input",
);
assert.match(
  metadataTabSource,
  /\.slice\(0, MAX_TAG_SUGGESTIONS\)/u,
  "a large library does not render every tag as a suggestion",
);
assert.match(
  metadataTabSource,
  /useAllCharacterCatalog\(tagCatalogRequested\)/u,
  "the whole library is only fetched once the tag field is used",
);

// ── Route: atomic per character, recorded in version history ──
const dataDir = mkdtempSync(join(tmpdir(), "marinara-bulk-tags-"));
const previous = {
  DATA_DIR: process.env.DATA_DIR,
  FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR,
  MARINARA_FILE_STORAGE_DIR: process.env.MARINARA_FILE_STORAGE_DIR,
  NODE_ENV: process.env.NODE_ENV,
  MARINARA_LITE: process.env.MARINARA_LITE,
};
let app: {
  close(): Promise<void>;
  ready(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<{ statusCode: number; json(): any }>;
} | null = null;

try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
  process.env.NODE_ENV = "test";
  process.env.MARINARA_LITE = "true";

  const [{ buildApp }, { getDB }, { createCharactersStorage }] = await Promise.all([
    import("../../../packages/server/src/app.js"),
    import("../../../packages/server/src/db/connection.js"),
    import("../../../packages/server/src/services/storage/characters.storage.js"),
  ]);
  app = await buildApp();
  await app.ready();
  const db = await getDB();
  const storage = createCharactersStorage(db);

  const card = (name: string, tags: string[]) =>
    ({
      name,
      description: `${name} description`,
      personality: "",
      scenario: "",
      first_mes: "",
      mes_example: "",
      creator_notes: "",
      system_prompt: "",
      post_history_instructions: "",
      tags,
      creator: "",
      character_version: "1.0",
      alternate_greetings: [],
      extensions: {},
      character_book: null,
    }) as never;
  const alpha = await storage.create(card("Alpha", ["Old", "keep"]));
  const beta = await storage.create(card("Beta", ["keep"]));
  assert.ok(alpha && beta);
  const versionsBefore = (await storage.listVersions(alpha.id)).length;

  const empty = await app.inject({ method: "POST", url: "/api/characters/bulk-tags", payload: { ids: [alpha.id] } });
  assert.equal(empty.statusCode, 400, "an edit with no changes is rejected");

  const response = await app.inject({
    method: "POST",
    url: "/api/characters/bulk-tags",
    payload: {
      ids: [alpha.id, beta.id, "missing-id"],
      add: ["Noble"],
      remove: ["keep"],
      rename: [{ from: "old", to: "Elder" }],
    },
  });
  assert.equal(response.statusCode, 200);
  const result = response.json();
  assert.deepEqual(result.updatedIds.sort(), [alpha.id, beta.id].sort());
  assert.deepEqual(result.failedIds, ["missing-id"]);

  const alphaAfter = await storage.getById(alpha.id);
  assert.deepEqual(JSON.parse(alphaAfter!.data).tags, ["Elder", "Noble"]);
  assert.deepEqual(JSON.parse((await storage.getById(beta.id))!.data).tags, ["Noble"]);
  assert.equal(JSON.parse(alphaAfter!.data).description, "Alpha description", "other card fields are untouched");

  const versionsAfter = await storage.listVersions(alpha.id);
  assert.equal(versionsAfter.length, versionsBefore + 1, "the bulk edit is recorded in version history");

  const again = await app.inject({
    method: "POST",
    url: "/api/characters/bulk-tags",
    payload: { ids: [alpha.id], add: ["noble"] },
  });
  assert.deepEqual(again.json().unchangedIds, [alpha.id], "re-adding an existing tag (any case) changes nothing");
  assert.equal((await storage.listVersions(alpha.id)).length, versionsAfter.length, "no version for a no-op");

  // A single failed save reports that card and still processes the rest of the selection.
  const gamma = await storage.create(card("Gamma", []));
  assert.ok(gamma);
  const betaVersionsBeforeFailure = await storage.listVersions(beta.id);
  const { characters } = await import("../../../packages/server/src/db/schema/index.js");
  const originalUpdate = db.update;
  let characterWrites = 0;
  db.update = (table) => {
    if (table === characters && ++characterWrites === 2) throw new Error("Injected bulk tag save failure");
    return originalUpdate(table);
  };
  try {
    const partial = await app.inject({
      method: "POST",
      url: "/api/characters/bulk-tags",
      payload: { ids: [alpha.id, beta.id, gamma.id], add: ["Saved during partial failure"] },
    });
    assert.equal(partial.statusCode, 200, "partial saves return the per-card result");
    assert.deepEqual(partial.json().updatedIds, [alpha.id, gamma.id]);
    assert.deepEqual(partial.json().failedIds, [beta.id]);
    assert.deepEqual(JSON.parse((await storage.getById(beta.id))!.data).tags, ["Noble"]);
    assert.deepEqual(await storage.listVersions(beta.id), betaVersionsBeforeFailure, "failed saves add no version");
    assert.ok(JSON.parse((await storage.getById(gamma.id))!.data).tags.includes("Saved during partial failure"));
  } finally {
    db.update = originalUpdate;
  }

  // Duplicate finder route: read-only grouping with side-by-side basics.
  await storage.create(card("Alpha (copy)", []));
  const duplicates = await app.inject({ method: "GET", url: "/api/characters/duplicates" });
  assert.equal(duplicates.statusCode, 200);
  const alphaGroup = duplicates.json().groups.find((group: { ids: string[] }) => group.ids.includes(alpha.id));
  assert.ok(alphaGroup, "the copy is grouped with the original");
  assert.deepEqual(alphaGroup.characters.map((character: { name: string }) => character.name).sort(), [
    "Alpha",
    "Alpha (copy)",
  ]);
} finally {
  await app?.close();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}

console.log("character-bulk-tags regression passed");
