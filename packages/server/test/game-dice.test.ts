import test from "node:test";
import assert from "node:assert/strict";
import { isDiceNotation, rollDice } from "../src/services/game/dice.service.js";

test("dice notation accepts quick-roll and modifier forms", () => {
  const valid = ["d20", "D20", "1d20", "2d6", "2d6+3", "4d8-1", "100d1000"];

  for (const notation of valid) {
    assert.equal(isDiceNotation(notation), true, `${notation} should validate`);
  }
});

test("dice notation rejects malformed rolls", () => {
  const invalid = ["", "20", "d", "d0", "0d6", "2dd6", "2d6 + 3", "banana", "2d6+bad"];

  for (const notation of invalid) {
    assert.equal(isDiceNotation(notation), false, `${notation} should not validate`);
  }
});

test("rollDice handles optional count and modifiers", () => {
  const d20 = rollDice("d20");
  assert.equal(d20.notation, "d20");
  assert.equal(d20.rolls.length, 1);
  assert.ok(d20.rolls[0]! >= 1 && d20.rolls[0]! <= 20);
  assert.equal(d20.modifier, 0);
  assert.equal(d20.total, d20.rolls[0]);

  const twoD6Plus3 = rollDice("2d6+3");
  assert.equal(twoD6Plus3.rolls.length, 2);
  assert.equal(twoD6Plus3.modifier, 3);
  assert.equal(twoD6Plus3.total, twoD6Plus3.rolls[0]! + twoD6Plus3.rolls[1]! + 3);

  const d8Minus1 = rollDice("d8-1");
  assert.equal(d8Minus1.rolls.length, 1);
  assert.equal(d8Minus1.modifier, -1);
  assert.equal(d8Minus1.total, d8Minus1.rolls[0]! - 1);
});

test("rollDice rejects zero dice and zero sides after validation", () => {
  assert.throws(() => rollDice("0d6"), /at least 1/);
  assert.throws(() => rollDice("d0"), /at least 1/);
});
