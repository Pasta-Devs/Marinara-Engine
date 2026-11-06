/**
 * Starting gear taken with Free edit on (2026-10-23 playtest): the Engine's own add may go into one
 * bag past what its bearer can carry, who is then over their limit. Without it, what does not fit is
 * left behind as before, and nothing a client sends can ask for it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyGameInventoryOps,
  gameInventoryOpSchema,
  placeGameInventoryAddition,
  type GameInventoryItemRules,
} from "../../packages/shared/src/index.js";

const rules = {
  bearer: () => ({ limit: 10, encumberedAbove: 5 }),
  itemOf: (ref: string) => (ref === "kit/rock" ? { item: "kit/rock", name: "Rock", weight: 4 } : undefined),
  offers: (ref: string) => ref === "kit/rock",
  itemNamed: (name: string) => (/rock/i.test(name) ? { item: "kit/rock", name: "Rock", weight: 4 } : undefined),
} as unknown as GameInventoryItemRules;

const like = { name: "Rock", item: "kit/rock" };
assert.deepEqual(placeGameInventoryAddition([], like, 4, { holder: "Isolde" }, rules), {
  shares: [{ holder: "Isolde", count: 2 }],
  left: 2,
});
assert.deepEqual(placeGameInventoryAddition([], like, 4, { holder: "Isolde" }, rules, { pastLimit: true }), {
  shares: [{ holder: "Isolde", count: 4 }],
  left: 0,
});

const added = applyGameInventoryOps(
  [],
  [{ op: "add", name: "Rock", item: "kit/rock", count: 4, holder: "Isolde", pastLimit: true }],
  undefined,
  rules,
);
assert.equal(added.results[0]?.ok, true, JSON.stringify(added.results));
assert.equal(
  added.stacks.reduce((sum, stack) => sum + stack.quantity, 0),
  4,
);
// Never from a client.
assert.equal(
  gameInventoryOpSchema.safeParse({ op: "add", name: "Rock", count: 4, holder: "Isolde", pastLimit: true }).success,
  false,
);
// The picker asks for it only with Free edit on.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const picker = readFileSync(join(root, "packages/client/src/components/game/StartingGearPicker.tsx"), "utf8");
assert.match(picker, /onTake\(holder, selection, again, tooHeavy && freeEdit\)/u);

console.log("Past the limit: Free edit's starting gear goes in whole, the Engine's add only.");
