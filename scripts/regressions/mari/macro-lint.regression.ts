// #7995: an unclosed `{{` used to reach the prompt as literal text, so the model "explained" a
// broken preview instead of fixing the brace. The linter refuses only text whose braces cannot
// balance at all; ambiguous content (unknown macro names, literal pairs) stays allowed.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { macroBalanceProblem } from "../../../packages/server/src/services/mari-db/macro-lint.js";

const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const dir = mkdtempSync(join(tmpdir(), "marinara-mari-macro-lint-"));
process.env.FILE_STORAGE_DIR = dir;

const { MariDbService } = await import("../../../packages/server/src/services/mari-db/mari-db.service.js");
const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");

type Result = { ok?: boolean; error?: string; output?: unknown };
let db: Awaited<ReturnType<typeof createFileNativeDB>> | undefined;

try {
  // Balanced, nested and block macros pass untouched.
  assert.equal(macroBalanceProblem("{{#if bond == apprentice}}A{{/if}} {{temper}}"), null);

  // The two impossible shapes name their spot.
  assert.match(String(macroBalanceProblem("A {{temper")), /opens "\{\{" at character 2/u);
  assert.match(String(macroBalanceProblem("closes }} nothing")), /stray "\}\}" at character 7/u);

  // A card write with an unbalanced macro is refused before it is stored, with the fix.
  db = await createFileNativeDB();
  const mari = new MariDbService(db);
  const broken = (await mari.executeAction({
    action: "character.create",
    name: "Fenris",
    data: { scenario: "{{temper", description: "fine" },
  })) as Result;
  assert.equal(broken.ok, false);
  assert.match(String(broken.error), /scenario opens "\{\{"/u);

  const created = (await mari.executeAction({
    action: "character.create",
    name: "Fenris",
    data: { scenario: "A {{temper}} who waits." },
  })) as Result;
  assert.equal(created.ok, true, `a balanced macro saves: ${String(created.error ?? "")}`);

  // Onboarding text goes through the same lint.
  const listed = (await mari.executeAction({ action: "character.list" })) as Result;
  const characterId = ((listed.output as Array<{ id?: string }>)[0]?.id ?? "") as string;
  assert.ok(characterId, "the created card is listed");
  // Creator Notes carry card CSS (themes handbook), whose nested rules end in "}}".
  const css = (await mari.executeAction({
    action: "character.update",
    characterId,
    patch: { creatorNotes: "<style>@media (max-width: 600px) {.a {color: red}}</style>" },
    apply: true,
  })) as Result;
  assert.equal(css.ok, true, `nested CSS in Creator Notes saves: ${String(css.error ?? "")}`);
  // A card sent back as read nests backstory under extensions; alternate greetings are a list.
  for (const [data, field] of [
    [{ extensions: { backstory: "Raised by {{kin" } }, /backstory opens/u],
    [{ alternate_greetings: ["Hello.", "Back so soon, {{user?"] }, /alternate_greetings\[1\] opens/u],
    [{ system_prompt: "Stay as {{char" }, /system_prompt opens/u],
    [{ postHistoryInstructions: "Keep {{tone" }, /postHistoryInstructions opens/u],
    // Aliases the writer folds into first_mes / mes_example, and a wrapper inside a wrapper it flattens.
    [{ greeting: "Hello {{user" }, /greeting opens/u],
    [{ mesExample: "<START> {{char" }, /mesExample opens/u],
    [{ patch: { description: "Raised by {{kin" } }, /description opens/u],
    [{ patch: { extensions: { appearance: "Eyes like {{sky" } } }, /appearance opens/u],
  ] as const) {
    const refused = (await mari.executeAction({
      action: "character.update",
      characterId,
      data,
      apply: true,
    })) as Result;
    assert.equal(refused.ok, false);
    assert.match(String(refused.error), field);
  }
  // Entries embedded in lorebook.create go through the entry linter too.
  const embedded = (await mari.executeAction({
    action: "lorebook.create",
    data: { name: "Embedded", entries: [{ name: "Gate", content: "Opens at {{dusk" }] },
  })) as Result;
  assert.equal(embedded.ok, false);
  assert.match(String(embedded.error), /^lorebook\.create refused by the macro linter: content opens/u);
  const onboarding = (await mari.executeAction({
    action: "character.onboarding.update",
    characterId,
    onboarding: { description: "{{player} and never closed" },
  })) as Result;
  assert.equal(onboarding.ok, false);
  assert.match(String(onboarding.error), /description opens "\{\{"/u);
  // Lorebook entries are the field the Discord report was about.
  const book = (await mari.executeAction({ action: "lorebook.create", data: { name: "Brace test" } })) as Result;
  assert.equal(book.ok, true, `lorebook.create failed: ${String(book.error ?? "")}`);
  const books = (await mari.executeAction({ action: "lorebook.list" })) as Result;
  const bookId = ((books.output as Array<{ id?: string }>)[0]?.id ?? "") as string;
  const badEntry = (await mari.executeAction({
    action: "lorebook.addEntry",
    lorebookId: bookId,
    data: { content: "The gate opens at {{dusk" },
  })) as Result;
  assert.equal(badEntry.ok, false);
  assert.match(String(badEntry.error), /content opens "\{\{"/u);

  // Slice 2 (#7995): macros are refused in fields that never interpolate them.
  const literalName = (await mari.executeAction({
    action: "character.create",
    name: "{{temper}}",
    data: { scenario: "A name like that is shown as written." },
  })) as Result;
  assert.equal(literalName.ok, false);
  assert.match(String(literalName.error), /never resolves macros/u);

  const literalKey = (await mari.executeAction({
    action: "lorebook.addEntry",
    lorebookId: bookId,
    data: { name: "Gate", keys: ["{{dusk}}"], content: "Literal." },
  })) as Result;
  assert.equal(literalKey.ok, false);
  assert.match(String(literalKey.error), /keys contains "\{\{"/u);

  // The CLI entry update is linted like its siblings.
  const goodEntry = (await mari.executeAction({
    action: "lorebook.addEntry",
    lorebookId: bookId,
    data: { name: "Gate", keys: ["gate"], content: "Opens at dusk." },
  })) as Result;
  assert.equal(goodEntry.ok, true, `lorebook.addEntry failed: ${String(goodEntry.error ?? "")}`);
  const entries = (await mari.executeAction({ action: "lorebook.entries", lorebookId: bookId })) as Result;
  const entryId = String((entries.output as { items: Array<{ id: string }> }).items[0]?.id);
  const cliUpdate = await mari.executeCli({
    argv: ["lorebooks", "update-entry", entryId, "--content", "Opens at {{dusk", "--apply"],
    command: "mari lorebooks update-entry",
  });
  assert.match(JSON.stringify(cliUpdate), /update-entry refused by the macro linter: content opens/u);
  // The card commands share the linter: JSON and flags alike, on create and update.
  const cliCreate = await mari.executeCli({
    argv: ["characters", "create", "--json", '{"name":"Ada","greeting":"Hello {{user"}', "--apply"],
    command: "mari characters create",
  });
  assert.match(JSON.stringify(cliCreate), /characters create refused by the macro linter: greeting opens/u);
  const cliCard = await mari.executeCli({
    argv: ["characters", "update", characterId, "--description", "Waits for {{user", "--apply"],
    command: "mari characters update",
  });
  assert.match(JSON.stringify(cliCard), /characters update refused by the macro linter: description opens/u);

  console.log("macro lint passed");
} finally {
  await db?._fileStore.close();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dir, { recursive: true, force: true });
}
