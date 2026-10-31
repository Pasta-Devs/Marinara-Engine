/**
 * Scattered terrain in a battlefield brief (laptop playtest 2026-10-30: a brief of "every other cell
 * deep water" came out as 582 plains and 138 water, since a brief could only place up to four patches
 * or barriers). `scatter` turns a share of the open ground into one terrain, outside the deployment
 * strips, and the sides can still reach each other. A share out of bounds, or plains, is refused, and
 * a bad scatter is dropped from a brief whose other parts are kept.
 */
import assert from "node:assert/strict";
import {
  generateTacticalBattlefield,
  salvageTacticalBattlefieldBrief,
  validateTacticalBattlefieldBrief,
} from "../../packages/shared/src/features/tactical-combat/grid-gen.js";
import { deterministicRng } from "../../packages/shared/src/features/tactical-combat/rng.js";

const count = (tiles: string[][], terrain: string) => tiles.flat().filter((tile) => tile === terrain).length;

const plain = generateTacticalBattlefield(4, deterministicRng(5, 0), "plains", { size: "large" });
const flooded = generateTacticalBattlefield(4, deterministicRng(5, 0), "plains", {
  size: "large",
  scatter: { terrain: "water", share: 0.5 },
});
assert.ok(plain.ok && flooded.ok);
// Open ground outside the four columns of deployment strips.
const open = count(plain.grid.tiles, "plains") - 4 * plain.grid.height;
const water = count(flooded.grid.tiles, "water");
assert.ok(
  water - count(plain.grid.tiles, "water") > open * 0.35,
  `about half the open ground is water: ${water} water, with ${open} open cells before`,
);
assert.deepEqual(flooded.battlefield.brief?.scatter, { terrain: "water", share: 0.5 }, "the brief is kept");
// Of the whole board as a player counts it, strips and all (laptop 2026-10-30: 0.5 came out a third
// on a small board), on every size.
for (const size of ["small", "medium", "large"] as const) {
  const board = generateTacticalBattlefield(4, deterministicRng(9, 0), "plains", {
    size,
    scatter: { terrain: "water", share: 0.5 },
  });
  assert.ok(board.ok);
  const share = count(board.grid.tiles, "water") / board.grid.tiles.flat().length;
  assert.ok(share > 0.42 && share < 0.58, `${size}: half the board is water, not ${share.toFixed(2)}`);
}
// The deployment strips (two columns at each side) stay as they were.
for (const row of flooded.grid.tiles)
  for (const x of [0, 1, row.length - 2, row.length - 1]) assert.notEqual(row[x], "water");

assert.equal(validateTacticalBattlefieldBrief({ scatter: { terrain: "plains", share: 0.3 } }).ok, false);
assert.equal(validateTacticalBattlefieldBrief({ scatter: { terrain: "water", share: 0.9 } }).ok, false);
assert.equal(validateTacticalBattlefieldBrief({ scatter: { terrain: "lava", share: 0.3 } }).ok, false);
assert.deepEqual(salvageTacticalBattlefieldBrief({ size: "large", scatter: { terrain: "water", share: 2 } }), {
  size: "large",
});

console.log(
  `Battlefield scatter: half the board is water on every size (${water} cells on a large plain), the strips stay dry.`,
);
