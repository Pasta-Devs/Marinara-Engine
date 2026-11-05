// #7827: two things about theme writes are easy to get wrong and expensive to believe: they DO verify
// themselves (the old prompt said they do not), and `update` is a silent preview unless applied. This
// executes the handbook's example and pins both, plus that a create can activate in the same call and
// that an update replaces the whole stylesheet. The preview runs here as a fixture, not as an example
// line: a worked example is what she copies, and a lone preview shows the user nothing.
import assert from "node:assert/strict";
import { withHandbook } from "./_handbook.js";

type Row = { id?: string; css?: string };
type Result = { ok?: boolean; mode?: string; error?: string; output?: unknown; readBack?: { status?: string } };

await withHandbook("builtin-themes", async ({ commands, mari, run }) => {
  assert.deepEqual(
    commands.map((command) => command.action),
    ["theme.create", "theme.list", "theme.get", "theme.update", "theme.setActive"],
    "the example is create, list, get, update, deactivate — no preview line",
  );
  for (const command of commands.slice(3)) assert.equal(command.apply, true, `${command.action} is applied`);

  const created = await run(0);
  assert.equal(created.ok, true, `theme.create failed: ${String(created.error ?? "")}`);

  const listed = await run(1);
  assert.equal(listed.ok, true);
  const rows = (
    Array.isArray(listed.output) ? listed.output : ((listed.output as { items?: Row[] }).items ?? [])
  ) as Row[];
  assert.ok(
    rows.some((row) => row.id === "mari-aurora"),
    "the created theme is listed",
  );

  const first = await run(2);
  assert.equal(first.ok, true);
  assert.match(String((first.output as Row).css), /#0a0a12/, "the stored css is the one that was sent");

  // Fixture: the example's update without `apply` is a preview that writes nothing.
  const previewCommand = { ...commands[3]! };
  delete previewCommand.apply;
  const preview = await mari.executeAction(previewCommand);
  assert.equal(preview.mode, "dry-run", "an update without apply is a preview");
  const afterPreview = await run(2);
  assert.match(String((afterPreview.output as Row).css), /#0a0a12/, "the preview wrote nothing");

  const updated = (await run(3)) as Result;
  assert.equal(updated.ok, true, "the applied update failed");
  assert.equal(updated.readBack?.status, "verified");
  const afterApply = String(((await run(2)).output as Row).css);
  assert.match(afterApply, /#c4a0ff/, "the applied update landed");
  assert.match(afterApply, /--background: #0a0a12/, "resending the whole stylesheet kept the other rule");

  // Fixture: a one-rule update replaces the stylesheet — the trap the handbook warns about.
  const oneRule = (await mari.executeAction({
    action: "theme.update",
    id: "mari-aurora",
    patch: { css: ":root { --primary: #c4a0ff; }" },
    apply: true,
  })) as Result;
  assert.equal(oneRule.ok, true);
  assert.doesNotMatch(String(((await run(2)).output as Row).css), /--background/, "css replaces the whole stylesheet");

  assert.equal((await run(4)).ok, true, "deactivating the theme failed");
  const appliedCreate = (await mari.executeAction({
    action: "theme.create",
    id: "mari-aurora-2",
    data: { name: "Aurora Second", css: ":root { --primary: #123456; }", activate: true },
    apply: true,
  })) as Result;
  assert.equal(appliedCreate.ok, true);
  assert.equal(appliedCreate.readBack?.status, "verified", "an applied theme write verifies itself");
  const activeNow = (await mari.executeAction({ action: "theme.list", active: true })) as Result;
  const activeRows = (
    Array.isArray(activeNow.output) ? activeNow.output : ((activeNow.output as { items?: Row[] }).items ?? [])
  ) as Row[];
  assert.equal(activeRows.length, 1, "activating one theme leaves exactly one active");
  assert.equal(activeRows[0]?.id, "mari-aurora-2");
  const empty = (await mari.executeAction({
    action: "theme.update",
    id: "mari-aurora-2",
    patch: { bogus: 1 },
    apply: true,
  })) as Result;
  assert.equal(empty.ok, false);
  assert.match(String(empty.error), /needs a patch with name or css/);
});

console.log("Professor Mari themes handbook regression passed.");
