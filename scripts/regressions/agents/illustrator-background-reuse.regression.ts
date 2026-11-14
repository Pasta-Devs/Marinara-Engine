import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-illustrator-reuse-"));
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = "test";

const { matchLibraryBackgroundForPlace, normalizePlaceText, readBackgroundLibrary } =
  await import("../../../packages/server/src/services/generation/illustrator-background-reuse.js");

try {
  assert.equal(normalizePlaceText("John’s Bedroom"), "john bedroom", "curly apostrophe possessive folds");
  assert.equal(normalizePlaceText("Café-Kitchen"), "cafe kitchen", "accents and dashes fold");

  const library = [
    { filename: "bedroom.png", tags: ["interior"] },
    { filename: "john-bedroom.png", tags: [] },
    { filename: "generated-smith-house-kitchen.webp", tags: ["generated", "roleplay", "smith house kitchen"] },
    { filename: "castle_cliff_2.jpg", tags: ["night"] },
    { filename: "my-upload.png", tags: ["guest room"] },
  ];

  assert.equal(
    matchLibraryBackgroundForPlace("Smith House, John's bedroom", library),
    "john-bedroom.png",
    "the most specific name wins over a plain 'bedroom'",
  );
  assert.equal(matchLibraryBackgroundForPlace("Mary's bedroom", library), "bedroom.png", "a generic room still serves");
  assert.equal(
    matchLibraryBackgroundForPlace("Smith House kitchen", library),
    "generated-smith-house-kitchen.webp",
    "an Illustrator picture is found by its own name without the generated- prefix",
  );
  assert.equal(
    matchLibraryBackgroundForPlace("Castle cliff at dusk", library),
    "castle_cliff_2.jpg",
    "numbering drops",
  );
  assert.equal(
    matchLibraryBackgroundForPlace("Inn, guest room upstairs", library),
    "my-upload.png",
    "a tag of two or more words names a place",
  );
  assert.equal(matchLibraryBackgroundForPlace("Night market", library), null, "one-word tags never name a place");
  assert.equal(matchLibraryBackgroundForPlace("Johnson bedroomette", library), null, "whole words only");
  assert.equal(matchLibraryBackgroundForPlace("", library), null);
  assert.equal(matchLibraryBackgroundForPlace(null, library), null);

  const dir = join(dataDir, "backgrounds");
  assert.deepEqual(readBackgroundLibrary(dir), [], "no library folder yet");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "john-bedroom.png"), "x");
  writeFileSync(join(dir, "notes.txt"), "x");
  writeFileSync(join(dir, "meta.json"), JSON.stringify({ "john-bedroom.png": { tags: ["johns room", 4] } }));
  assert.deepEqual(readBackgroundLibrary(dir), [{ filename: "john-bedroom.png", tags: ["johns room"] }]);
  assert.equal(matchLibraryBackgroundForPlace("John's bedroom", readBackgroundLibrary()), "john-bedroom.png");

  console.log("illustrator background reuse regression passed");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
