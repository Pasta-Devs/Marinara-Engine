/**
 * Classic Marinara mercy (Alyssa 2026-11-01): once only foes who yielded are left, the fight waits on
 * the party's word. Spared, they leave as surrendered; finished, they fall. Both end in victory.
 */
import assert from "node:assert/strict";
import {
  combatDirectorView,
  commandCombatDirector,
  createCombatDirector,
} from "../../packages/server/src/services/game/combat-director.service.js";
import { marinaraCombatant } from "../../packages/server/src/services/game/marinara-director.service.js";
import {
  awardMarinaraXp,
  createMarinaraProgression,
  marinaraRandom,
} from "../../packages/shared/src/features/marinara-classes.js";
import { buildMarinaraEnemy, buildMarinaraPartyFighter } from "../../packages/shared/src/features/marinara-combat.js";

function fight(seed: number) {
  let progression = createMarinaraProgression({ seed: "mercy", primary: "blade", temperament: "reckless" });
  progression = awardMarinaraXp(progression, 400, marinaraRandom("mercy:xp")).progression;
  const party = [buildMarinaraPartyFighter({ id: "ana", name: "Ana", progression })];
  const foes = [0, 1].map((i) =>
    buildMarinaraEnemy({ id: `foe${i}`, name: `Foe ${i}`, archetype: "blade", level: 5, tier: "standard" }),
  );
  const s = createCombatDirector({
    id: `mercy${seed}`,
    anchor: "anchor",
    party: party.map((f) => marinaraCombatant(f)),
    enemies: foes.map((f) => marinaraCombatant(f)),
    style: "classic",
    difficulty: "normal",
    seed,
    marinara: [...party, ...foes],
  });
  // Both foes throw down their arms.
  for (const id of ["foe0", "foe1"]) {
    s.morale![id] = { ...s.morale![id], yielded: true };
    s.marinara!.fighters.find((f) => f.id === id)!.yielded = true;
  }
  return s;
}

const spare = fight(1);
assert.deepEqual(combatDirectorView(spare).mercy, { foeIds: ["foe0", "foe1"] }, "the fight waits on mercy");
assert.equal(spare.outcome, undefined);
assert.throws(() => commandCombatDirector(spare, { type: "classic", action: { type: "defend" } }), /spare/);
commandCombatDirector(spare, { type: "mercy", choice: "spare" });
assert.equal(spare.outcome, "victory", "sparing them wins the fight");
assert.equal(spare.gone?.filter((g) => g.left === "surrendered").length, 2, "both leave as surrendered");
assert.equal(combatDirectorView(spare).mercy, undefined);

const finish = fight(2);
combatDirectorView(finish);
commandCombatDirector(finish, { type: "mercy", choice: "finish" });
assert.equal(finish.outcome, "victory", "finishing them wins the fight");
assert.ok(
  finish.enemies.every((u) => u.hp === 0),
  "both fall as beaten",
);
assert.ok(!finish.gone?.length, "nobody left the fight");

const carryOn = fight(3);
combatDirectorView(carryOn);
commandCombatDirector(carryOn, { type: "continue" });
assert.equal(carryOn.outcome, "victory", "carrying on spares them");

console.log("game-marinara-mercy: ok");
