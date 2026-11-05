// #7827: Home widget creates are dry runs unless apply:true — the opposite of every other create,
// and the single most likely thing for Mari to get wrong. This executes the handbook's example (list,
// applied create, list) and pins that the create makes exactly one card. The dry run runs here as a
// fixture, never as an example line she could copy as a "preview round": it saves nothing.
import assert from "node:assert/strict";
import { withHandbook } from "./_handbook.js";

type Output = { widgets?: Array<{ title?: string }> } | Array<{ title?: string }>;

await withHandbook("builtin-home-widgets", async ({ commands, mari, run }) => {
  assert.deepEqual(
    commands.map((command) => command.action),
    ["home_widget.list", "home_widget.create", "home_widget.list"],
    "the example is read, applied create, read back — no dry-run line",
  );
  assert.equal(commands[1]!.apply, true, "the example's create is applied");

  const widgetsOf = (output: Output) => (Array.isArray(output) ? output : (output.widgets ?? []));

  const before = await run(0);
  assert.equal(before.ok, true);
  assert.equal(widgetsOf(before.output as Output).length, 0, "the catalog starts empty");

  // Fixture: the same create without apply is a dry run that saves nothing.
  const previewCommand = { ...commands[1]! };
  delete previewCommand.apply;
  const preview = await mari.executeAction(previewCommand);
  assert.equal(preview.ok, true);
  assert.equal(preview.mode, "dry-run", "a create without apply saves nothing");

  const applied = await run(1);
  assert.equal(applied.ok, true);

  const listed = await run(2);
  const widgets = widgetsOf(listed.output as Output);
  assert.equal(widgets.length, 1, "only the applied create made a card");
  assert.equal(widgets[0]?.title, "Field Formula");
});

console.log("Professor Mari home widgets handbook regression passed.");
