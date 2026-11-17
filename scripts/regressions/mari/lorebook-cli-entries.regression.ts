// Mari's CLI add-entry and update-entry: they save the keyword-matching and selective fields, and refuse an invalid
// selective logic. Runs on a fresh database in a temporary folder. After it, the entry row builder add-entry uses:
// unset fields take the stored defaults, set ones are kept, and an invalid selective logic falls back to "and".
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLorebooksStorage } from "../../../packages/server/src/services/storage/lorebooks.storage.js";
import { createChatPresetsStorage } from "../../../packages/server/src/services/storage/chat-presets.storage.js";
import {
  MariDbService,
  buildLorebookEntryCreateRow,
} from "../../../packages/server/src/services/mari-db/mari-db.service.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-mari-lorebook-cli-entries-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;
let closeDb: (() => Promise<void>) | null = null;
try {
  const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  const db = await getDB();
  const lorebookStorage = createLorebooksStorage(db);
  const chatPresetStorage = createChatPresetsStorage(db);
  await chatPresetStorage.ensureDefaults();
  const mariDb = new MariDbService(db);
  const professorMariCliLorebookId = "professor-mari-cli-lorebook-create-regression";
  const professorMariCliLorebookResult = await mariDb.executeCli({
    argv: [
      "lorebooks",
      "create",
      "--id",
      professorMariCliLorebookId,
      "--name",
      "Professor Mari CLI lorebook regression",
      "--apply",
    ],
  });
  assert.equal(
    professorMariCliLorebookResult.ok,
    true,
    `Professor Mari CLI must create visible lorebooks: ${JSON.stringify(professorMariCliLorebookResult)}`,
  );
  const professorMariCliLorebook = await lorebookStorage.getById(professorMariCliLorebookId);
  assert.deepEqual(
    {
      hiddenFromLibrary: professorMariCliLorebook?.hiddenFromLibrary,
      scanDepth: professorMariCliLorebook?.scanDepth,
      tokenBudget: professorMariCliLorebook?.tokenBudget,
      recursiveScanning: professorMariCliLorebook?.recursiveScanning,
      maxRecursionDepth: professorMariCliLorebook?.maxRecursionDepth,
      excludeFromVectorization: professorMariCliLorebook?.excludeFromVectorization,
      vectorQueryDepth: professorMariCliLorebook?.vectorQueryDepth,
      vectorScoreThreshold: professorMariCliLorebook?.vectorScoreThreshold,
      vectorMaxResults: professorMariCliLorebook?.vectorMaxResults,
    },
    {
      hiddenFromLibrary: false,
      scanDepth: 2,
      tokenBudget: 2048,
      recursiveScanning: false,
      maxRecursionDepth: 3,
      excludeFromVectorization: false,
      vectorQueryDepth: 10,
      vectorScoreThreshold: 0.3,
      vectorMaxResults: 10,
    },
  );
  // #4798 — the CLI add-entry / update-entry paths now expose the keyword-matching + selective
  // fields that were previously hardcoded on the CLI. add-entry delegates to buildLorebookEntryCreateRow.
  const professorMariCliAddEntry = await mariDb.executeCli({
    argv: [
      "lorebooks",
      "add-entry",
      professorMariCliLorebookId,
      "--name",
      "Regex CLI entry",
      "--keys",
      "Lycan",
      "--secondary-keys",
      "moon,howl",
      "--selective",
      "--selective-logic",
      "and_all",
      "--match-whole-words",
      "--use-regex",
      "--apply",
    ],
  });
  assert.equal(
    professorMariCliAddEntry.ok,
    true,
    `CLI add-entry must succeed: ${JSON.stringify(professorMariCliAddEntry)}`,
  );
  const professorMariCliEntry = (await lorebookStorage.listEntries(professorMariCliLorebookId)).find(
    (entry) => entry.name === "Regex CLI entry",
  );
  assert.ok(professorMariCliEntry);
  assert.equal(professorMariCliEntry.selective, true, "CLI add-entry must persist --selective");
  assert.equal(professorMariCliEntry.selectiveLogic, "and_all", "CLI add-entry must persist --selective-logic");
  assert.equal(professorMariCliEntry.matchWholeWords, true, "CLI add-entry must persist --match-whole-words");
  assert.equal(professorMariCliEntry.useRegex, true, "CLI add-entry must persist --use-regex");
  assert.deepEqual(
    professorMariCliEntry.secondaryKeys,
    ["moon", "howl"],
    "CLI add-entry must persist --secondary-keys",
  );
  assert.equal(professorMariCliEntry.caseSensitive, false, "unset --case-sensitive stays default");
  const professorMariCliUpdateEntry = await mariDb.executeCli({
    argv: [
      "lorebooks",
      "update-entry",
      professorMariCliEntry.id,
      "--no-match-whole-words",
      "--no-selective",
      "--selective-logic",
      "not",
      "--apply",
    ],
  });
  assert.equal(
    professorMariCliUpdateEntry.ok,
    true,
    `CLI update-entry must succeed: ${JSON.stringify(professorMariCliUpdateEntry)}`,
  );
  const professorMariCliUpdatedEntry = (await lorebookStorage.listEntries(professorMariCliLorebookId)).find(
    (entry) => entry.id === professorMariCliEntry.id,
  );
  assert.ok(professorMariCliUpdatedEntry);
  assert.equal(
    professorMariCliUpdatedEntry.matchWholeWords,
    false,
    "CLI update-entry --no-match-whole-words clears it",
  );
  assert.equal(professorMariCliUpdatedEntry.selective, false, "CLI update-entry --no-selective clears it");
  assert.equal(professorMariCliUpdatedEntry.selectiveLogic, "not", "CLI update-entry patches --selective-logic");
  // An invalid --selective-logic is rejected with a clear error on both CLI subcommands.
  const professorMariCliBadUpdateLogic = await mariDb.executeCli({
    argv: ["lorebooks", "update-entry", professorMariCliEntry.id, "--selective-logic", "bogus", "--apply"],
  });
  assert.equal(professorMariCliBadUpdateLogic.ok, false, "CLI update-entry rejects an invalid --selective-logic");
  assert.match(String(professorMariCliBadUpdateLogic.error), /selective-logic must be one of/u);
  const professorMariCliBadAddLogic = await mariDb.executeCli({
    argv: [
      "lorebooks",
      "add-entry",
      professorMariCliLorebookId,
      "--name",
      "Bad logic",
      "--selective-logic",
      "bogus",
      "--apply",
    ],
  });
  assert.equal(professorMariCliBadAddLogic.ok, false, "CLI add-entry rejects an invalid --selective-logic");
  assert.match(String(professorMariCliBadAddLogic.error), /selective-logic must be one of/u);
  await lorebookStorage.remove(professorMariCliLorebookId);
  assert.equal(await lorebookStorage.getById(professorMariCliLorebookId), null);
} finally {
  await closeDb?.();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(storageRoot, { recursive: true, force: true });
}

const generatedLorebookEntry = buildLorebookEntryCreateRow(
  {
    name: "Glass City",
    content: "A city made from black glass.",
    keys: ["Glass City", "black glass"],
    secondaryKeys: ["rain"],
  },
  "lorebook-generated",
  "entry-generated",
  "2026-07-16T00:00:00.000Z",
);
assert.equal(generatedLorebookEntry.lorebookId, "lorebook-generated");
assert.equal(generatedLorebookEntry.content, "A city made from black glass.");
assert.deepEqual(generatedLorebookEntry.keys, ["Glass City", "black glass"]);
assert.deepEqual(generatedLorebookEntry.secondaryKeys, ["rain"]);
// #4791 — unset keyword-matching/selective fields fall back to the stored defaults.
assert.equal(generatedLorebookEntry.selective, "false");
assert.equal(generatedLorebookEntry.selectiveLogic, "and");
assert.equal(generatedLorebookEntry.matchWholeWords, "false");
assert.equal(generatedLorebookEntry.caseSensitive, "false");
assert.equal(generatedLorebookEntry.useRegex, "false");
// #4791 — Professor Mari can now set them explicitly (previously hardcoded and ignored).
const parameterizedLorebookEntry = buildLorebookEntryCreateRow(
  {
    name: "Vlad",
    content: "The immortal count.",
    keys: ["Vlad"],
    secondaryKeys: ["count", "castle"],
    selective: true,
    selectiveLogic: "and_all",
    matchWholeWords: true,
    caseSensitive: true,
    useRegex: false,
  },
  "lorebook-generated",
  "entry-parameterized",
  "2026-07-16T00:00:00.000Z",
);
assert.equal(parameterizedLorebookEntry.selective, "true");
assert.equal(parameterizedLorebookEntry.selectiveLogic, "and_all");
assert.equal(parameterizedLorebookEntry.matchWholeWords, "true");
assert.equal(parameterizedLorebookEntry.caseSensitive, "true");
assert.equal(parameterizedLorebookEntry.useRegex, "false");
// An invalid selectiveLogic is rejected and falls back to the stored default.
const invalidLogicLorebookEntry = buildLorebookEntryCreateRow(
  { name: "Bad logic", content: "x", selectiveLogic: "nonsense" },
  "lorebook-generated",
  "entry-bad-logic",
  "2026-07-16T00:00:00.000Z",
);
assert.equal(invalidLogicLorebookEntry.selectiveLogic, "and");
// #4796 review — "or" is an accepted legacy selectiveLogic value (behaves like "and").
const orLogicLorebookEntry = buildLorebookEntryCreateRow(
  { name: "Or logic", content: "x", selectiveLogic: "or" },
  "lorebook-generated",
  "entry-or-logic",
  "2026-07-16T00:00:00.000Z",
);
assert.equal(orLogicLorebookEntry.selectiveLogic, "or");
