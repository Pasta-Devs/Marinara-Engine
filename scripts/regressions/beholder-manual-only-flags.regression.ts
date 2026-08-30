import assert from "node:assert/strict";
import { resolveBeholderStateResponse } from "../../packages/server/src/services/agents/beholder-state.js";

// `missing` and `bare` are manual-only: the extractor may propose them, the agent never
// applies them. Both are destructive when wrong — `missing` takes over a slot and
// cascades distally, `bare` contradicts whatever is worn there — and the model is not
// reliable at either. These pin that the flags never survive a model reply while
// everything else in the same reply does.

const persona = "Rissha";

function slot(
  state: { characters: Array<{ name: string; body: Record<string, unknown> }> },
  name: string,
  key: string,
) {
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
  const worn = {
    characters: [{ name: "Hesperia", body: { chest: { worn: [{ item: "cloak" }, { item: "shirt" }] } } }],
  };
  const reply = { changed: true, delta: { Hesperia: { body: { chest: { worn_remove: ["cloak"] } } } } };
  const { state } = resolveBeholderStateResponse(reply, worn, persona);
  const remaining = (slot(state, "Hesperia", "chest")?.worn as Array<{ item: string }>) ?? [];
  assert.deepEqual(
    remaining.map((entry) => entry.item),
    ["shirt"],
    "worn_remove must still take the named garment off",
  );
}

// A refusal makes the reply a no-op, but only when it happened on a real slot. A
// delta naming a slot that does not exist is malformed whatever it carried, and the
// strip must not excuse it — otherwise every junk delta carrying `bare` would be
// reported as a clean no-op.
{
  const reply = { changed: true, delta: { Hesperia: { body: { invented_slot: { bare: true } } } } };
  const { state, valid } = resolveBeholderStateResponse(reply, prior, persona);
  assert.equal(valid, false, "an invalid slot must stay invalid even when the strip empties it");
  assert.deepEqual(state, prior, "an invalid delta must leave prior state untouched");
}

// Whereas a refusal on a REAL slot is a no-op, not an error: the agent declined it
// on purpose, so there is nothing for the operator to act on.
{
  const reply = { changed: true, delta: { Hesperia: { body: { left_arm: { bare: true } } } } };
  const { state, valid } = resolveBeholderStateResponse(reply, prior, persona);
  assert.equal(valid, true, "a refused-but-well-formed delta is a valid no-op");
  assert.deepEqual(state, prior, "and it changes nothing");
}

// A full snapshot must not erase the operator's manual flags. They are set by hand and
// never by extraction, so a snapshot that simply does not mention them is silence, not
// a clearing — and treating it as a clearing undoes every correction on the next turn,
// which is the whole thing this file exists to prevent.
const priorWithManualFlags = {
  characters: [
    {
      name: "Hesperia",
      body: {
        chest: { worn: [{ item: "shirt", damage: "pristine" }] },
        left_arm: { missing: true },
        right_hand: { bare: true },
      },
    },
  ],
};

// Case 1: the snapshot omits the flagged slots entirely.
{
  const snapshot = {
    characters: [{ name: "Hesperia", body: { chest: { worn: [{ item: "coat", damage: "pristine" }] } } }],
  };
  const { state, valid } = resolveBeholderStateResponse(snapshot, priorWithManualFlags, persona);
  assert.equal(valid, true);
  assert.equal(slot(state, "Hesperia", "left_arm")?.missing, true, "an omitted slot must keep its manual missing");
  assert.equal(slot(state, "Hesperia", "right_hand")?.bare, true, "an omitted slot must keep its manual bare");
  assert.deepEqual(
    slot(state, "Hesperia", "chest")?.worn,
    [{ item: "coat", damage: "pristine" }],
    "and the snapshot still wins for everything it does carry",
  );
}

// Case 2: the snapshot names the slots and contradicts the flags.
{
  const snapshot = {
    characters: [
      {
        name: "Hesperia",
        body: {
          left_arm: { missing: false, worn: [{ item: "sleeve", damage: "pristine" }] },
          right_hand: { bare: false },
        },
      },
    ],
  };
  const { state, valid } = resolveBeholderStateResponse(snapshot, priorWithManualFlags, persona);
  assert.equal(valid, true);
  assert.equal(slot(state, "Hesperia", "left_arm")?.missing, true, "a snapshot may not overrule a manual missing");
  assert.equal(slot(state, "Hesperia", "right_hand")?.bare, true, "a snapshot may not overrule a manual bare");
  assert.deepEqual(
    slot(state, "Hesperia", "left_arm")?.worn,
    [{ item: "sleeve", damage: "pristine" }],
    "the rest of the snapshot's slot is still taken",
  );
}

console.log("beholder manual-only flags regression passed.");
