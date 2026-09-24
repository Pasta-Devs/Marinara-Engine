/**
 * Beholder state merges (batch 27):
 * 1. A "__proto__" key in a lane delta or a take-off repair delta must never reach
 *    Object.prototype through the plain accumulator objects.
 * 2. A slot already holding the worn-item cap, and a state already holding the
 *    character cap, must keep what this delta just added instead of truncating it.
 */
import assert from "node:assert/strict";
import {
  mergeBeholderLaneDeltas,
  mergeBeholderWornRemovals,
  resolveBeholderStateResponse,
} from "../../packages/server/src/services/agents/beholder-state.js";

function assertPrototypeClean(label: string) {
  const probe = {} as Record<string, unknown>;
  for (const key of ["species", "body", "worn", "worn_remove", "tail", "polluted"]) {
    const leaked = probe[key];
    if (leaked !== undefined) {
      // Clean up so a failure does not cascade into later asserts.
      delete (Object.prototype as Record<string, unknown>)[key];
    }
    assert.equal(leaked, undefined, `${label}: Object.prototype gained "${key}"`);
  }
}

// --- Lane deltas: character named __proto__ ---
// Raw JSON text: an object literal would treat __proto__ as the prototype, not a key.
const laneReply = '{"changed":true,"delta":{"__proto__":{"species":"x","body":{"tail":{"worn":[]}}},"Mira":{"species":"elf"}}}';
const laneMerged = mergeBeholderLaneDeltas([laneReply]);
assertPrototypeClean("lane character __proto__");
assert.equal((laneMerged.delta.Mira as { species?: string }).species, "elf", "safe characters still merge");
assert.equal(Object.hasOwn(laneMerged.delta, "__proto__"), false);

// --- Lane deltas: slot named __proto__ and field named __proto__ ---
mergeBeholderLaneDeltas([
  '{"changed":true,"delta":{"Mira":{"body":{"__proto__":{"polluted":true,"worn":[{"item":"cloak"}]}}}}}',
]);
assertPrototypeClean("lane slot __proto__");
mergeBeholderLaneDeltas(['{"changed":true,"delta":{"Mira":{"body":{"chest":{"__proto__":{"polluted":true}}}}}}']);
assertPrototypeClean("lane field __proto__");

// --- Take-off repair: character and slot named __proto__ ---
const repair = JSON.parse(
  '{"__proto__":{"body":{"chest":{"worn_remove":["cloak"]}}},"Mira":{"body":{"__proto__":{"worn_remove":["cloak"]},"chest":{"worn_remove":["shirt"]}}}}',
);
const repaired = mergeBeholderWornRemovals({}, repair);
assertPrototypeClean("repair __proto__");
assert.deepEqual(
  (repaired.Mira as { body: { chest: { worn_remove: string[] } } }).body.chest.worn_remove,
  ["shirt"],
  "safe repair removals still merge",
);

// --- Worn items: a full slot keeps the newly added garment ---
const fullWorn = Array.from({ length: 12 }, (_, index) => ({ item: `ring ${index + 1}` }));
const wornResult = resolveBeholderStateResponse(
  { changed: true, delta: { Mira: { body: { neck: { worn: [{ item: "silver torc" }] } } } } },
  { characters: [{ name: "Mira", body: { neck: { worn: fullWorn } } }] },
  "User",
);
assert.equal(wornResult.valid, true);
const neckWorn = (wornResult.state.characters.find((c) => c.name === "Mira")?.body.neck?.worn ?? []).map(
  (w) => w.item,
);
assert.equal(neckWorn.length, 12, "worn stays capped at 12");
assert.ok(neckWorn.includes("silver torc"), "the garment this delta added must survive the cap");
assert.ok(!neckWorn.includes("ring 1"), "the oldest untouched garment is the one evicted");

// --- Characters: a full roster keeps the newly introduced character ---
const fullRoster = Array.from({ length: 64 }, (_, index) => ({
  name: `Tracked ${index + 1}`,
  species: "human",
  body: {},
}));
const rosterResult = resolveBeholderStateResponse(
  { changed: true, delta: { Newcomer: { species: "dwarf" }, "Tracked 1": { species: "orc" } } },
  { characters: fullRoster },
  "User",
);
assert.equal(rosterResult.valid, true);
const names = rosterResult.state.characters.map((c) => c.name);
assert.equal(names.length, 64, "roster stays capped at 64");
assert.ok(names.includes("Newcomer"), "a newly introduced character must survive the cap");
assert.ok(names.includes("Tracked 1"), "a character this delta touched is kept");
assert.ok(!names.includes("Tracked 2"), "the oldest untouched character is the one evicted");

console.log("server-hunt-b27 regression passed");

// --- Worn swap on a full slot: removals leave before the cap, so nothing else is evicted ---
{
  const swap = resolveBeholderStateResponse(
    { changed: true, delta: { Mira: { body: { neck: { worn: [{ item: "silver torc" }], worn_remove: ["ring 12"] } } } } },
    { characters: [{ name: "Mira", body: { neck: { worn: Array.from({ length: 12 }, (_, i) => ({ item: `ring ${i + 1}` })) } } }] },
    "User",
  );
  const items = (swap.state.characters.find((c) => c.name === "Mira")?.body.neck?.worn ?? []).map((w) => w.item);
  assert.deepEqual(items, [...Array.from({ length: 11 }, (_, i) => `ring ${i + 1}`), "silver torc"], "swap keeps ring 1");
  console.log("server-hunt-b27 worn swap check passed");
}
