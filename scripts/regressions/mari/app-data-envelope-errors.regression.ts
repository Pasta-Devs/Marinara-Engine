// #7949 run 3: a live 12b hit three envelope gaps. character.get with a name as the id came back as a bare
// `null`; the handbook gate refused a lorebook.update before it ran, so its real error (a bogus field)
// stayed hidden; and one character.update without "apply" ran as a "successful" dry run five times.
// Each is pinned here through the real WorkspaceCommands against a file-native store.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-app-data-envelope-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageDir;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
try {
  const db = await getDB();
  const { MariDbService } = await import("../../../packages/server/src/services/mari-db/mari-db.service.js");
  const { WorkspaceCommands } =
    await import("../../../packages/server/src/services/professor-mari/workspace-commands.js");
  const { createAppSettingsStorage } =
    await import("../../../packages/server/src/services/storage/app-settings.storage.js");
  const settings = createAppSettingsStorage(db);
  const mariDb = new MariDbService(db);
  await mariDb.executeAction({ action: "character.create", data: { name: "Aldric", description: "Died in 1746." } });
  const aldric = ((await mariDb.executeAction({ action: "character.list" })) as { output: Array<{ id: string }> })
    .output[0]!.id;
  const book = (await mariDb.executeAction({ action: "lorebook.create", data: { name: "Aldric's Chronicles" } })) as {
    ok: boolean;
  };
  assert.equal(book.ok, true);
  const lorebookId = ((await mariDb.executeAction({ action: "lorebook.list" })) as { output: Array<{ id: string }> })
    .output[0]!.id;

  // One chat per call site: the gate runs once per turn, and nothing here starts a new turn (#8391 re-arms it).
  let n = 0;
  const commandsFor = (chatId: string | null, acceptedHeldCalls = false) => {
    const commands = new WorkspaceCommands({ db } as never, () => ({
      permissionsMode: "auto",
      manualSilentMutationBlocked: false,
      askLatchSilentMutationBlocked: false,
      acceptedHeldCalls,
      decisionContext: chatId ? ({ chatId } as never) : null,
    }));
    return (args: Record<string, unknown>) =>
      commands.executeWorkspaceCommand(
        { id: `call-${++n}`, name: "app_data", arguments: args },
        new AbortController().signal,
        [],
        () => {},
        [],
      );
  };
  const run = commandsFor(null);

  // The gate (default on) refuses the first lorebook write, and names the call's own error with it.
  const bogus = await run({
    action: "lorebook.update",
    lorebookId,
    data: { linked_characters: [aldric] },
    apply: true,
  });
  assert.equal(bogus.success, false);
  assert.match(bogus.output, /read skill `builtin-lorebook` first/);
  assert.match(bogus.output, /The call itself would also have failed:\n/);
  // A call with nothing else wrong gets the gate alone, and the probe saved nothing.
  const clean = await run({
    action: "character.update",
    characterId: aldric,
    patch: { description: "x" },
    apply: true,
  });
  assert.match(clean.output, /read skill `builtin-characters` first/);
  assert.doesNotMatch(clean.output, /would also have failed/);
  const untouched = (await mariDb.executeAction({ action: "character.get", id: aldric })) as {
    output: { data: { description: string } };
  };
  assert.equal(untouched.output.data.description, "Died in 1746.", "the gate's probe is a dry run");
  // An edit with "apply" left out would only preview, so the gate says that too (T15, round 2)...
  await mariDb.executeAction({ action: "preset.create", data: { name: "Gated" } });
  const presetId = ((await mariDb.executeAction({ action: "preset.list" })) as { output: Array<{ id: string }> })
    .output[0]!.id;
  const gatedEdit = await run({ action: "preset.update", presetId, patch: { name: "Renamed" } });
  assert.match(gatedEdit.output, /read skill `builtin-presets` first/);
  assert.match(gatedEdit.output, /would also not have saved:\nNothing was saved: preset\.update/);
  // ...while a create saves without it, so its gate stands alone.
  const gatedCreate = await run({ action: "theme.create", data: { name: "Dusk", css: "" } });
  assert.match(gatedCreate.output, /read skill `builtin-themes` first/);
  assert.doesNotMatch(gatedCreate.output, /would also not have saved/);
  // Another spelling of the action is the same surface, so it is gated too.
  const spelled = await commandsFor("spelling")({
    action: "Lorebooks.update",
    lorebookId,
    data: { description: "x" },
    apply: true,
  });
  assert.match(spelled.output, /read skill `builtin-lorebook` first/);
  // Decision content rides on a lorebook write: the decisions handbook comes first, then the lorebook one.
  const decide = commandsFor("decision");
  const decisionWrite = {
    action: "lorebook.update",
    lorebookId,
    data: { description: '{{#if decision:"spare the wolf"}}Kind.{{/if}}' },
    apply: true,
  };
  assert.match((await decide(decisionWrite)).output, /read skill `builtin-decisions` first/);
  assert.match((await decide(decisionWrite)).output, /read skill `builtin-lorebook` first/);
  // Prose that quotes a decision is not decision work: only the lorebook handbook is asked for.
  const prose = commandsFor("prose");
  const proseWrite = {
    action: "lorebook.update",
    lorebookId,
    data: { description: 'Her decision: "stay"' },
    apply: true,
  };
  assert.match((await prose(proseWrite)).output, /read skill `builtin-lorebook` first/);
  // A link is documented in both handbooks, so the characters one covers it (a preview keeps the data as is).
  const link = commandsFor("link");
  await link({ action: "skill.get", id: "builtin-characters" });
  const linkPreview = await link({
    action: "character.linkLorebook",
    lorebookId,
    characterId: aldric,
    reason: "Shares his history",
    apply: false,
  });
  assert.doesNotMatch(linkPreview.output, /read skill/);
  // onboarding.md sends the card patch with the block, so that handbook alone covers character.update.
  const onboarding = commandsFor("onboarding-update");
  await onboarding({ action: "skill.get", id: "builtin-onboarding" });
  const cardPatch = await onboarding({
    action: "character.update",
    characterId: aldric,
    patch: { description: "x" },
    apply: false,
  });
  assert.doesNotMatch(cardPatch.output, /read skill/, "onboarding read covers character.update");
  const cardCreate = await onboarding({ action: "character.create", data: { name: "Other" }, apply: false });
  assert.match(cardCreate.output, /read skill `builtin-characters` first/, "only character.update is covered");
  const cold = await commandsFor("onboarding-cold")({
    action: "character.update",
    characterId: aldric,
    patch: { description: "x" },
    apply: false,
  });
  assert.match(cold.output, /read skill `builtin-characters` first/, "nothing read: still refused");
  // Calls the user accepted were held, so the gate never saw them: Accept applies them all.
  const accepted = await commandsFor(
    "accept",
    true,
  )({
    action: "lorebook.update",
    lorebookId,
    data: { description: "Accepted." },
    apply: true,
  });
  assert.equal(accepted.success, true, accepted.output);

  // A name sent as the id says so, instead of printing `null`.
  const byName = await run({ action: "character.get", characterId: "Aldric" });
  assert.equal(byName.success, false);
  assert.match(byName.output, /No character has the id \\"Aldric\\"\. character ids are generated, never a name/);
  // The id that was sent is echoed, and a theme lookup names an action that exists.
  assert.match((await run({ action: "character.get", characterId: 123 })).output, /got 123/);
  const ghostTheme = (await mariDb.executeAction({
    action: "theme.update",
    id: "dusk",
    data: { name: "x" },
    apply: true,
  })) as { error?: string };
  assert.match(String(ghostTheme.error), /No theme has the id "dusk"[\s\S]*theme\.list/);
  // A nested search query still resolves (#7949), and a quoted name finds its card.
  await mariDb.executeAction({ action: "character.create", data: { name: 'Elspeth "Elsie" MacRae' } });
  const nestedQuery = (await mariDb.executeAction({ action: "character.search", data: { query: "Aldric" } })) as {
    output: unknown[];
  };
  assert.equal(nestedQuery.output.length, 1);
  const quoted = (await mariDb.executeAction({
    action: "character.search",
    query: 'Elspeth "Elsie" MacRae',
  })) as { output: unknown[] };
  assert.equal(quoted.output.length, 1, "a quoted search finds the card it names");

  // The setting turns the gate off; a fresh chat would otherwise be gated again.
  await settings.set("mari-skill-gate", "false");
  const ungated = await commandsFor("another-chat")({
    action: "lorebook.update",
    lorebookId,
    data: { description: "x" },
    apply: true,
  });
  assert.doesNotMatch(ungated.output, /read skill/, "off means no gate");

  // An update with no "apply" is refused, not previewed; the nested one is named.
  const noApply = await run({
    action: "character.update",
    characterId: aldric,
    patch: { description: "Died in 1745." },
  });
  assert.equal(noApply.success, false);
  assert.match(noApply.output, /character\.update changes existing data, so it needs a top-level "apply"/);
  const nested = await run({
    action: "character.update",
    characterId: aldric,
    patch: { description: "Died in 1745.", apply: true },
  });
  assert.match(nested.output, /\(the "apply" inside "patch" is ignored\)/);
  // An explicit preview still previews.
  const preview = await run({
    action: "character.update",
    characterId: aldric,
    patch: { description: "Died in 1745." },
    apply: false,
  });
  assert.equal(preview.success, true);
  assert.match(preview.output, /^NOT SAVED - dry run/);
  // A create still writes by default.
  const create = await run({ action: "character.create", data: { name: "Second", description: "y" } });
  assert.equal(create.success, true);
  assert.doesNotMatch(create.output, /needs a top-level "apply"/);

  // Mari cannot lift the gate herself: the setting row is floor-protected like the runtime.
  const lift = (await mariDb.executeCli({
    argv: ["db", "patch", "app_settings", "mari-skill-gate", "--json", JSON.stringify({ value: "true" }), "--apply"],
    command: "mari db patch",
  })) as { ok: boolean; error?: string };
  assert.equal(lift.ok, false);
  assert.match(JSON.stringify(lift), /only be changed by the user/);
  assert.equal(await settings.get("mari-skill-gate"), "false");
} finally {
  await closeDB();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(storageDir, { recursive: true, force: true });
}

console.log("Professor Mari app_data envelope errors regression passed.");
