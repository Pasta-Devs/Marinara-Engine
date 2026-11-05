/** Whom an option cannot be pointed at now, and why, with how far each one it can is (laptop playtest
 *  2026-10-25: Hold Person read "Nobody in reach" at 61 ft with a range of 60, its target list gave
 *  only the odds, and a foe out of sight simply dropped off it). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  type RulesetCombatAction,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const parsed = parseRulesetDefinition(
  JSON.parse(readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8")),
);
assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
const definition = parsed.definition;
const block = (): RulesetStatBlock => ({
  health: 30,
  defense: 12,
  initiativeModifier: 0,
  speed: 30,
  actions: [{ name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { count: 1, sides: 4, flat: 0 } }],
});
const state = createRulesetEncounter({
  definition,
  seed: 1,
  roller: () => 10,
  board: {
    grid: {
      width: 20,
      height: 3,
      tiles: Array.from({ length: 3 }, () => Array.from({ length: 20 }, () => "plains" as const)),
    },
    placements: { mage: { x: 0, y: 1 }, near: { x: 5, y: 1 }, far: { x: 14, y: 1 }, unseen: { x: 3, y: 1 } },
  },
  combatants: [
    { id: "mage", name: "Mage", side: "party", block: block() },
    { id: "near", name: "Near", side: "enemy", block: block() },
    { id: "far", name: "Far", side: "enemy", block: block() },
    { id: "unseen", name: "Unseen", side: "enemy", block: block() },
  ],
});
const mage = rulesetCombatant(state, "mage")!;
const { toHit: _toHit, reach: _reach, ...rest } = mage.actions[0]!;
mage.actions.push({
  ...rest,
  id: "hold",
  label: "Hold",
  range: { normal: 12 },
  seen: true,
  save: { save: "wis_save", difficulty: 15, onSuccess: "negates" },
} as RulesetCombatAction);
state.order = state.combatants.map((one) => one.id);
state.turn = 0;
const { rulesetMenu } = await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
const hold = rulesetMenu(definition, state, "mage").find((option) => option.id === "hold")!;
assert.deepEqual(hold.targetIds, ["near", "unseen"], JSON.stringify(hold));
assert.equal(hold.distances?.near, 5, "five cells off");
const far = hold.beyond?.find((one) => one.id === "far");
assert.equal(far?.why, "out-of-reach");
assert.equal(far?.cells, 14);
assert.equal(far?.reach, 12, "its range, in cells");
assert.equal(hold.beyond?.length, 1, "only the one too far");
// Its eyes kept from one (a gaze averted), a spell that wants its target seen says so of them.
mage.averted = ["near"];
const blind = rulesetMenu(definition, state, "mage").find((option) => option.id === "hold")!;
assert.deepEqual(blind.targetIds, ["unseen"], JSON.stringify(blind));
assert.equal(blind.beyond?.find((one) => one.id === "near")?.why, "unseen", JSON.stringify(blind.beyond));
assert.equal(blind.beyond?.find((one) => one.id === "near")?.cells, 5);
// Nobody off a board.
const plain = createRulesetEncounter({
  definition,
  seed: 1,
  roller: () => 10,
  combatants: [
    { id: "mage", name: "Mage", side: "party", block: block() },
    { id: "near", name: "Near", side: "enemy", block: block() },
  ],
});
plain.order = plain.combatants.map((one) => one.id);
plain.turn = 0;
assert.ok(rulesetMenu(definition, plain, "mage").every((option) => !option.beyond && !option.distances));

console.log("Targets beyond: how far each target is, and why one is not offered: too far, unseen.");
