import assert from "node:assert/strict";
import {
  BEHOLDER_PASS_LANES,
  isBeholderLaneResponse,
  mergeBeholderLaneDeltas,
  parseBeholderLanePrompts,
  resolveBeholderStateResponse,
} from "../../../packages/server/src/services/agents/beholder-state.js";

// A single-prompt template must not be mistaken for a multi-pass one.
assert.equal(parseBeholderLanePrompts("You track characters' physical state. Return JSON."), null);
assert.equal(parseBeholderLanePrompts(""), null);
assert.equal(parseBeholderLanePrompts(undefined), null);
assert.equal(
  parseBeholderLanePrompts("[worn]\nonly one lane\n[wounds]\nsecond lane"),
  null,
  "A template missing lanes must fall back to the single-call path",
);

const template = [
  "[worn]",
  "Extract ONLY worn items.",
  "",
  "[wounds]",
  "Extract ONLY wounds.",
  "",
  "[holding]",
  "Extract ONLY held items.",
  "",
  "[species]",
  "Extract ONLY species.",
  "",
  "[flags]",
  "Extract ONLY bare and missing flags.",
].join("\n");

const lanes = parseBeholderLanePrompts(template);
assert.ok(lanes, "A template carrying every lane heading must parse");
assert.deepEqual(Object.keys(lanes).sort(), [...BEHOLDER_PASS_LANES].sort());
assert.equal(lanes.worn, "Extract ONLY worn items.");
assert.equal(lanes.flags, "Extract ONLY bare and missing flags.");
assert.ok(
  parseBeholderLanePrompts(template.replaceAll("[worn]", "  [worn]  ")),
  "A lane heading tolerates surrounding whitespace on its own line",
);
assert.equal(
  parseBeholderLanePrompts(template.replace("Extract ONLY species.", "")),
  null,
  "A lane with an empty body must not be treated as a usable pass",
);
assert.equal(
  parseBeholderLanePrompts(template.replace("[species]", "[worn]")),
  null,
  "A template repeating one heading while dropping another must not parse",
);

// Only a lane answering in the extraction contract counts as an answer: a lane
// that returns valid JSON of the wrong shape must not stand in for a real reply.
assert.equal(isBeholderLaneResponse({ changed: false }), true);
assert.equal(isBeholderLaneResponse({ changed: true, delta: { self: {} } }), true);
assert.equal(isBeholderLaneResponse('{"changed": false}'), true);
assert.equal(isBeholderLaneResponse({}), false, "An empty object is not an answer");
assert.equal(isBeholderLaneResponse({ changed: true }), false, "changed:true without a delta is not an answer");
assert.equal(isBeholderLaneResponse([]), false);
assert.equal(isBeholderLaneResponse("not json"), false);
assert.equal(isBeholderLaneResponse(null), false);

// Every lane reporting no change must produce a no-op, not a spurious update.
const quiet = mergeBeholderLaneDeltas([{ changed: false }, { changed: false }, '{"changed": false}']);
assert.equal(quiet.changed, false);
assert.deepEqual(quiet.delta, {});

// The five narrow deltas union into one payload, including across separate slots.
const merged = mergeBeholderLaneDeltas([
  {
    changed: true,
    delta: { self: { body: { chest: { worn: [{ item: "gown", color: "white", damage: "pristine" }] } } } },
  },
  {
    changed: true,
    delta: { self: { body: { chest: { wounds: [{ text: "gash", severity: "serious", bleeding: true }] } } } },
  },
  { changed: true, delta: { self: { body: { right_hand: { holding: { item: "lantern" } } } } } },
  { changed: true, delta: { self: { species: "angel", body: { tail: {} } } } },
  { changed: true, delta: { self: { body: { left_foot: { bare: true } } } } },
]);
assert.equal(merged.changed, true);
const self = merged.delta.self as { species?: string; body: Record<string, Record<string, unknown>> };
assert.equal(self.species, "angel");
assert.ok(Array.isArray(self.body.chest.worn), "The worn lane contributes worn items");
assert.ok(Array.isArray(self.body.chest.wounds), "The wounds lane contributes wounds to the SAME slot");
assert.deepEqual(self.body.right_hand.holding, { item: "lantern" });
assert.equal(self.body.left_foot.bare, true);

// A lane that only carries empty exotic-slot stubs must not count as a change.
const stubsOnly = mergeBeholderLaneDeltas([{ changed: true, delta: { self: { body: { tail: {} } } } }]);
assert.equal(stubsOnly.changed, false, "Empty anatomy stubs alone are not a state change");

// Two lane responses naming removals on the same slot concatenate rather than overwrite.
const removals = mergeBeholderLaneDeltas([
  { changed: true, delta: { self: { body: { chest: { worn_remove: ["coat"] } } } } },
  { changed: true, delta: { self: { body: { chest: { worn_remove: ["shirt"] } } } } },
]);
assert.deepEqual(
  (removals.delta.self as { body: Record<string, { worn_remove?: string[] }> }).body.chest.worn_remove,
  ["coat", "shirt"],
  "worn_remove arrays concatenate across lane responses instead of replacing",
);

// End to end: the unioned delta resolves against prior state through the normal path.
const prior = {
  characters: [{ name: "Rissha", body: { chest: { worn: [{ item: "gown", color: "white", damage: "pristine" }] } } }],
};
const resolved = resolveBeholderStateResponse(merged, prior, "Rissha");
assert.equal(resolved.valid, true);
const rissha = resolved.state.characters.find((entry) => entry.name === "Rissha");
assert.equal(rissha?.species, "angel", "`self` maps back onto the persona");
assert.equal(rissha?.body.right_hand?.holding?.item, "lantern");
assert.equal(rissha?.body.chest?.wounds?.length, 1);

// worn_remove takes a named garment off the slot it occupied, leaving the rest.
const dressed = {
  characters: [
    {
      name: "Rissha",
      body: {
        chest: {
          worn: [
            { item: "coat", color: "black", damage: "pristine" },
            { item: "shirt", color: "white", damage: "pristine" },
          ],
        },
      },
    },
  ],
};
const undressed = resolveBeholderStateResponse(
  { changed: true, delta: { Rissha: { body: { chest: { worn_remove: ["Coat"] } } } } },
  dressed,
  "Rissha",
);
assert.equal(undressed.valid, true);
assert.deepEqual(
  undressed.state.characters.find((entry) => entry.name === "Rissha")?.body.chest?.worn?.map((item) => item.item),
  ["shirt"],
  "worn_remove drops the named garment by identity and keeps the others",
);

// A removal naming a garment that is not on the slot is still a handled turn,
// not an "unusable delta" error — the slot already matches what was asked.
const alreadyOff = resolveBeholderStateResponse(
  { changed: true, delta: { Rissha: { body: { left_foot: { worn_remove: ["boot"] } } } } },
  dressed,
  "Rissha",
);
assert.equal(alreadyOff.valid, true, "A no-op removal must not invalidate the turn");
assert.equal(alreadyOff.error, undefined);
