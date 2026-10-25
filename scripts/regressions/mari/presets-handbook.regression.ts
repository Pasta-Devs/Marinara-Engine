// #7827: the shipped presets handbook's worked example must actually run, and it must prove the two
// rules the old block got wrong: `sectionOrder` decides inclusion, and a one-section edit through
// `preset.updateSection` leaves the rest of the order intact.
import assert from "node:assert/strict";
import { withHandbook } from "./_handbook.js";

await withHandbook("builtin-presets", async ({ commands, run }) => {
  assert.equal(commands.length, 6, "the worked example has six executable lines");
  const order = (output: { sectionOrder: string[] }) => output.sectionOrder;

  const created = await run(0);
  assert.equal(created.ok, true, "preset.create failed: " + (created.error ?? ""));

  const first = await run(1);
  assert.equal(first.ok, true);
  assert.deepEqual(order(first.output), ["s-card", "s-main"], "sectionOrder lists both sections");

  assert.equal((await run(2)).ok, true, "preset.addChoiceBlock failed");

  const updated = await run(3);
  assert.equal(updated.ok, true, "preset.updateSection failed");

  const section = await run(4);
  assert.equal(section.ok, true);
  assert.match(String(section.output.content), /\{\{pace\}\}/, "the section now reads the new choice");

  const final = await run(5);
  assert.equal(final.ok, true);
  assert.deepEqual(order(final.output), ["s-card", "s-main"], "the single-section edit kept the order");
});

console.log("Professor Mari presets handbook regression passed.");
