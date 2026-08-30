import assert from "node:assert/strict";
import { resolveBeholderStateResponse } from "../../packages/server/src/services/agents/beholder-state.js";

// `missing` and `bare` are manual-only: the extractor may propose them, the agent never
// applies them. Both are destructive when wrong — `missing` takes over a slot and
// cascades distally, `bare` contradicts whatever is worn there — and the model is not
// reliable at either. These pin that the flags never survive a model reply while
// everything else in the same reply does.

const persona = "Rissha";

function slot(state: { characters: Array<{ name: string; body: Record<string, unknown> }> }, name: string, key: string) {
  return state.characters.find((entry) => entry.name === name)?.body[key] as Record<string, unknown> | undefined;
}

const prior = {
  characters: [{ name: "Hesperia", body: { chest: { worn: [{ item: "shirt", damage: "pristine" }] } } }],
};

// A delta proposing `missing` must not take the slot.
{
  const reply = { changed: true, delta: { Hesperia: { body: { left_arm: { missing: true } } } } };
  const { state, valid } = resolveBeholderStateResponse(reply, prior, persona);
  assert.equal(valid, true);
  assert.equal(slot(state, "Hesperia", "left_arm"), undefined, "model-proposed missing must not be applied");
  assert.deepEqual(
    slot(state, "Hesperia", "chest")?.worn,
    [{ item: "shirt", damage: "pristine" }],
    "the rest of the state must survive the strip",
  );
}

// A delta proposing `bare` must not take the slot either.
{
  const reply = { changed: true, delta: { Hesperia: { body: { chest: { bare: true } } } } };
  const { state } = resolveBeholderStateResponse(reply, prior, persona);
  assert.equal(slot(state, "Hesperia", "chest")?.bare, undefined, "model-proposed bare must not be applied");
  assert.deepEqual(
    slot(state, "Hesperia", "chest")?.worn,
    [{ item: "shirt", damage: "pristine" }],
    "a refused bare must not disturb what is worn on that slot",
  );
}

// The flags are dropped, the rest of the same slot is kept.
{
  const reply = {
    changed: true,
    delta: {
      Hesperia: {
        body: {
          head: { wounds: [{ text: "cut", severity: "minor" }], missing: true },
          left_hand: { holding: { item: "lantern" }, bare: true },
        },
      },
    },
  };
  const { state } = resolveBeholderStateResponse(reply, prior, persona);
  assert.equal(slot(state, "Hesperia", "head")?.missing, undefined);
  assert.equal((slot(state, "Hesperia", "head")?.wounds as unknown[])?.length, 1, "wounds must survive");
  assert.equal(slot(state, "Hesperia", "left_hand")?.bare, undefined);
  assert.ok(slot(state, "Hesperia", "left_hand")?.holding, "held items must survive");
}

// A full-snapshot reply is stripped the same way — packages that answer with a whole
// state must not smuggle the flags in through the other branch.
{
  const snapshot = {
    characters: [
      { name: "Hesperia", body: { chest: { worn: [{ item: "coat" }], bare: true }, left_arm: { missing: true } } },
    ],
  };
  const { state } = resolveBeholderStateResponse(snapshot, prior, persona);
  assert.equal(slot(state, "Hesperia", "chest")?.bare, undefined, "snapshot bare must be refused");
  assert.equal(slot(state, "Hesperia", "left_arm"), undefined, "snapshot missing must be refused");
  assert.ok(slot(state, "Hesperia", "chest")?.worn, "the snapshot's real state must survive");
}

// Removing a garment still works — the take-off primitive must not be caught by the strip.
{
  const worn = { characters: [{ name: "Hesperia", body: { chest: { worn: [{ item: "cloak" }, { item: "shirt" }] } } }] };
  const reply = { changed: true, delta: { Hesperia: { body: { chest: { worn_remove: ["cloak"] } } } } };
  const { state } = resolveBeholderStateResponse(reply, worn, persona);
  const remaining = (slot(state, "Hesperia", "chest")?.worn as Array<{ item: string }>) ?? [];
  assert.deepEqual(
    remaining.map((entry) => entry.item),
    ["shirt"],
    "worn_remove must still take the named garment off",
  );
}

console.log("beholder manual-only flags regression passed.");
