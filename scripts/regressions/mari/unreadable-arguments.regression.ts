// #7999: an argument the tool could not read used to be replaced without a word. An "apply" of 0 or
// "dry-run" wrote on every create (and previewed on every update), and a limit of "ten" or 5000
// came back as the default or the maximum page. Unreadable values are refused now, and a value
// that had to be moved into range is named in the result.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-unreadable-arguments-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageDir;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
try {
  const db = await getDB();
  const { MariDbService } = await import("../../../packages/server/src/services/mari-db/mari-db.service.js");
  const { WorkspaceCommands } =
    await import("../../../packages/server/src/services/professor-mari/workspace-commands.js");
  const mariDb = new MariDbService(db);
  const call = (args: Record<string, unknown>) =>
    mariDb.executeAction(args as never) as Promise<{ ok: boolean; mode: string; error?: string; output?: unknown }>;
  const count = async (action: string) => ((await call({ action })).output as unknown[]).length;

  // An unreadable apply on a create is refused and writes nothing.
  for (const apply of [0, "dry-run"]) {
    const theme = await call({ action: "theme.create", data: { name: "Probe", css: "body{}" }, apply });
    assert.equal(theme.ok, false, `apply ${JSON.stringify(apply)} is refused`);
    assert.match(theme.error ?? "", /"apply" must be true or false \(.+\), so nothing was saved\./);
  }
  assert.equal(await count("theme.list"), 0, "no theme was created");
  // null and "" still mean "left out", as before #7999.
  assert.equal((await call({ action: "theme.create", data: { name: "Kept", css: "body{}" }, apply: null })).ok, true);
  assert.equal((await call({ action: "theme.list", limit: "" })).ok, true);
  // The values it can read still work, and leaving it out still creates.
  assert.equal((await call({ action: "character.create", data: { name: "Aldric" }, apply: "yes" })).ok, true);
  assert.equal((await call({ action: "character.create", data: { name: "Elsie" } })).ok, true);
  assert.equal(await count("character.list"), 2);

  // A 12b sent tags as JSON text: the card stored the string and every character screen crashed on tags.map.
  const tagged = await call({ action: "character.create", data: { name: "Elara", tags: '["chef", "mentor"]' } });
  assert.equal(tagged.ok, true, tagged.error);
  const elaraId = ((await call({ action: "character.list" })).output as { id: string; name: string }[]).find(
    (row) => row.name === "Elara",
  )?.id;
  const tagsOf = async () =>
    ((await call({ action: "character.get", characterId: elaraId })).output as { data: { tags: unknown } }).data.tags;
  assert.deepEqual(await tagsOf(), ["chef", "mentor"]);
  await call({ action: "character.update", characterId: elaraId, patch: { tags: "baker, rival" }, apply: true });
  assert.deepEqual(await tagsOf(), ["baker", "rival"]);
  // Split on commas, the same text kept its brackets: ["[culinary", "lore]"].
  await call({ action: "lorebook.create", data: { name: "Tagged", tags: '["culinary", "lore"]' } });
  const bookId = ((await call({ action: "lorebook.list" })).output as { id: string; name: string }[]).find(
    (row) => row.name === "Tagged",
  )?.id;
  const book = (await call({ action: "lorebook.get", lorebookId: bookId })).output as { tags?: unknown };
  assert.deepEqual(book.tags, ["culinary", "lore"]);
  // A list of objects sent as JSON text meets the same guard as the list itself.
  const objectText = await call({
    action: "lorebook.addEntry",
    lorebookId: bookId,
    data: { name: "Guild", content: "x", keys: '[{"key":"guild","constant":"true"}]' },
  });
  assert.equal(objectText.ok, false);
  assert.match(objectText.error ?? "", /"keys" must be a list of plain strings/);

  // A limit or offset that is not a number is refused, naming the key.
  const ten = await call({ action: "character.list", limit: "ten" });
  assert.equal(ten.ok, false);
  assert.match(ten.error ?? "", /"limit" must be a number \(got "ten"\)/);
  assert.equal(((await call({ action: "character.list", limit: "1" })).output as unknown[]).length, 1);

  // Through the tool, a lowered limit is named before the result.
  const commands = new WorkspaceCommands({ db } as never, () => ({
    permissionsMode: "auto",
    manualSilentMutationBlocked: false,
    askLatchSilentMutationBlocked: false,
    decisionContext: null,
  }));
  let n = 0;
  const run = (name: string, args: Record<string, unknown>) =>
    commands.executeWorkspaceCommand(
      { id: `call-${++n}`, name, arguments: args },
      new AbortController().signal,
      [],
      () => {},
      [],
    );
  const big = await run("app_data", { action: "character.list", limit: 5000 });
  assert.equal(big.success, true);
  // The note goes under the "Command: " header, which stays on line 1: bash's staged-change check reads it there.
  assert.match(big.output, /^Command: [^\n]*\n"limit" 5000 is above this read's maximum, so 1000 was used/);
  const zero = await run("app_data", { action: "character.list", limit: 0 });
  assert.match(zero.output, /^Command: [^\n]*\n"limit" 0 is below 1, so the default 50 was used\./);
  const plain = await run("app_data", { action: "character.list", limit: 10 });
  assert.doesNotMatch(plain.output, /"limit"/, "an in-range limit adds no note");
  assert.equal(big.output.match(/is above this read's maximum/g)?.length, 1, "app_data prints the note once");
  // A direct service call has no app_data wrapper to print the note, so the result carries it.
  const direct = (await mariDb.executeAction({ action: "character.list", limit: 5000 } as never)) as {
    notes?: string[];
  };
  assert.deepEqual(direct.notes, [
    `"limit" 5000 is above this read's maximum, so 1000 was used: this may not be everything.`,
  ]);
  assert.equal(
    ((await mariDb.executeAction({ action: "character.list", limit: 10 } as never)) as { notes?: string[] }).notes,
    undefined,
  );

  // addSection says where the section landed: injectionOrder never places it (T10, round 2).
  await run("app_data", { action: "skill.get", id: "builtin-presets" });
  const preset = await run("app_data", { action: "preset.create", data: { name: "Placement" }, apply: true });
  assert.equal(preset.success, true, preset.output);
  const presetId = (await mariDb.executeAction({ action: "preset.list" } as never)).output as {
    id: string;
    name: string;
  }[];
  const placementId = presetId.find((row) => row.name === "Placement")?.id;
  assert.ok(placementId, "the preset was created");
  await run("app_data", {
    action: "preset.addSection",
    presetId: placementId,
    data: { name: "Chat History" },
    apply: true,
  });
  const weather = await run("app_data", {
    action: "preset.addSection",
    presetId: placementId,
    data: { name: "Weather", injectionOrder: 850 },
    apply: true,
  });
  assert.equal(weather.success, true, weather.output);
  assert.match(
    weather.output,
    /^Readback: store-verified\n"Weather" was added as the last section, after "Chat History"\. "injectionOrder" does not move it\. To place it elsewhere, send preset\.update with the whole "sectionOrder"\./,
  );
  const dryRun = await run("app_data", {
    action: "preset.addSection",
    presetId: placementId,
    data: { name: "Unsaved" },
    apply: false,
  });
  assert.doesNotMatch(dryRun.output, /was added as the last section/, "a dry run adds no placement note");

  // A long preview is cut, but its closing NOT SAVED line is the last thing the model reads.
  await run("app_data", { action: "skill.get", id: "builtin-themes" });
  const longPreview = await run("app_data", {
    action: "theme.create",
    data: { name: "Long", css: ".a{color:red}\n".repeat(20_000) },
    apply: false,
  });
  assert.match(longPreview.output, /NOT SAVED\. Nothing changed and the user sees nothing\. If the user asked/);
  assert.match(longPreview.output, /"apply": true to save it\.$/);

  // The workspace tools follow the same rule.
  const read = await run("read", { path: "package.json", limit: 5000 });
  assert.equal(read.success, true);
  assert.match(read.output, /^"limit" 5000 is outside 1-2000, so 2000 was used\.\nFile: /);
  const badRead = await run("read", { path: "package.json", limit: "ten" });
  assert.equal(badRead.success, false);
  assert.match(badRead.output, /"limit" must be a number from 1 to 2000 \(got "ten"\)\. Leave it out to use 2000\./);
} finally {
  await closeDB();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(storageDir, { recursive: true, force: true });
}

console.log("Professor Mari unreadable arguments regression passed.");
