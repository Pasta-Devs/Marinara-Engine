import assert from "node:assert/strict";
import {
  beholderDeltaLacksRemoval,
  beholderTakeoffClause,
  mergeBeholderWornRemovals,
} from "../../packages/server/src/services/agents/beholder-state.js";

// When one sentence both takes a garment off and puts another on, the extractor
// reports the addition and drops the removal — 2 in 8 against 3 in 3 when the
// take-off stands alone. The garment it failed to remove then stays in state and is
// fed back into every later turn, so one miss compounds for the rest of the scene.
//
// The repair splits the sentence and re-asks the worn lane on the take-off half,
// because removal-only prose is the shape the model handles. These pin the parts that
// decide WHEN it fires and WHAT it asks; firing too eagerly costs a call on every
// turn, not firing at all costs the removal.

// Splits a compound take-off down to the half that shows the garment coming off.
assert.equal(
  beholderTakeoffClause("Maggie hangs the green cloak on a hook by the door and pulls on a pair of black boots."),
  "Maggie hangs the green cloak on a hook by the door.",
);
assert.equal(
  beholderTakeoffClause("She peels off her muddy gloves and ties a wool scarf around her neck."),
  "She peels off her muddy gloves.",
);
assert.equal(
  beholderTakeoffClause("He unbuckles the leather belt and shrugs a heavy coat over his shoulders."),
  "He unbuckles the leather belt.",
);

// A trailing take-off keeps the subject, or the lane cannot tell who is acting.
{
  const clause = beholderTakeoffClause("Maggie ties a scarf around her neck and takes off her boots.");
  assert.ok(clause?.startsWith("Maggie"), `expected the subject to be carried, got ${clause}`);
  assert.ok(clause?.includes("takes off"), clause ?? "");
}

// Stays out of the way when there is nothing to repair, so an ordinary turn pays nothing.
assert.equal(beholderTakeoffClause("Maggie pulls on a pair of black boots."), null, "an addition alone");
assert.equal(beholderTakeoffClause("She wears a long red dress."), null, "a description");
assert.equal(beholderTakeoffClause("Tim kicks off his boots."), null, "a take-off the lane already handles");
assert.equal(beholderTakeoffClause(""), null);
assert.equal(beholderTakeoffClause(undefined as unknown as string), null);

// Always a terminated sentence.
assert.ok(/[.!?]$/u.test(beholderTakeoffClause("Maggie hangs the cloak on a hook and pulls on boots") ?? ""));

// The repair only runs when the reply carried no removal at all.
assert.equal(beholderDeltaLacksRemoval({ Tim: { body: { chest: { worn: [{ item: "coat" }] } } } }), true);
assert.equal(beholderDeltaLacksRemoval({ Tim: { body: { chest: { worn_remove: ["cloak"] } } } }), false);
assert.equal(
  beholderDeltaLacksRemoval({ Tim: { body: { chest: { worn_remove: [] } } } }),
  true,
  "an empty list is no removal",
);
assert.equal(beholderDeltaLacksRemoval(null), true);

// Only worn_remove is taken from the repair answer — never additions, or the second
// call could re-open the whole reply instead of recovering one lost removal.
{
  const delta: Record<string, unknown> = { Tim: { body: { left_foot: { worn: [{ item: "sandal" }] } } } };
  mergeBeholderWornRemovals(delta, {
    Tim: {
      body: {
        left_foot: { worn_remove: ["boot"], worn: [{ item: "SHOULD NOT APPEAR" }] },
        right_foot: { worn_remove: ["boot"] },
      },
    },
  });
  const tim = delta.Tim as { body: Record<string, { worn?: unknown[]; worn_remove?: unknown[] }> };
  assert.deepEqual(tim.body.left_foot?.worn_remove, ["boot"]);
  assert.deepEqual(tim.body.left_foot?.worn, [{ item: "sandal" }], "the repair must not add or replace worn items");
  assert.deepEqual(tim.body.right_foot?.worn_remove, ["boot"], "a slot the reply did not mention is created");
}

// Merging is additive and does not duplicate.
{
  const delta: Record<string, unknown> = { Tim: { body: { chest: { worn_remove: ["cloak"] } } } };
  mergeBeholderWornRemovals(delta, { Tim: { body: { chest: { worn_remove: ["cloak", "scarf"] } } } });
  const tim = delta.Tim as { body: Record<string, { worn_remove?: unknown[] }> };
  assert.deepEqual([...(tim.body.chest?.worn_remove ?? [])].sort(), ["cloak", "scarf"]);
}

console.log("beholder take-off repair regression passed.");

// The narration handed to the lane can span several messages. Taking the subject from
// the first clause of all of them bound the removal to whoever acted first, and the
// repair then stripped that character's garment instead.
{
  const joined = "Tim waits.\nMaggie ties a scarf and takes off her boots.";
  const clause = beholderTakeoffClause(joined);
  assert.ok(clause, "a compound take-off in a later sentence is still recovered");
  assert.match(clause, /^Maggie\b/u, "the subject must come from the take-off's own sentence, not the first one");
  assert.ok(!/^Tim\b/u.test(clause), "binding the removal to the wrong character strips the wrong garment");
  assert.match(clause, /takes off her boots/u);
}

{
  // Same shape, separated by sentences rather than a newline.
  const clause = beholderTakeoffClause("Tim waits. Maggie ties a scarf and takes off her boots.");
  assert.ok(clause && /^Maggie\b/u.test(clause), "sentence-separated narration must behave the same");
}
