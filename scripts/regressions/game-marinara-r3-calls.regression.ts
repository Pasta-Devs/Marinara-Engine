/**
 * Alyssa's calls on the Sonnet panel round 3 (2026-11-03): Retaliate's bonus is capped at 25% over
 * a basic attack, a carried Channel Element turns a non-caster's weapon hits to the channeled
 * element, a weakness hit at most doubles, Backstab and Serrated ammunition open a Wound, Elemental
 * Lance costs 7 MP and Convergence hits with power 60.
 */
import assert from "node:assert/strict";
import {
  MARINARA_COUNTER_BONUS_CAP,
  MARINARA_SKILL_EFFECTS,
  MARINARA_WEAKNESS_CAP,
  buildMarinaraEnemy,
  marinaraBasicAttack,
  marinaraChannelElement,
  marinaraChannelsWeapon,
  marinaraCounterAttack,
  marinaraEffectiveStat,
  marinaraHitNumbers,
  marinaraSkillCost,
} from "../../packages/shared/src/features/marinara-combat.js";
import { MARINARA_CLASSES } from "../../packages/shared/src/features/marinara-classes.js";
import { marinaraOwnedAmmo, marinaraOwnsWoundingAmmo } from "../../packages/shared/src/features/marinara-items.js";

const skill = (id: string) => {
  for (const def of MARINARA_CLASSES) {
    const found = def.skills.find((one) => one.id === id);
    if (found) return { ...found };
  }
  throw new Error(`no skill ${id}`);
};
const unit = (id: string, side: "party" | "enemy", archetype: string, skills: string[] = [], classId?: string) => {
  const fighter = buildMarinaraEnemy({ id, name: id, level: 25, tier: "standard", archetype: archetype as never });
  fighter.side = side;
  fighter.row = "front";
  if (classId) fighter.classId = classId;
  fighter.skills = [...fighter.skills, ...skills.map(skill)];
  return fighter;
};

// Panel r4 (2026-11-03): Channel Element carried by a Hexer or Mender turns their staff hits too.
for (const [archetype, own] of [
  ["hexer", "dark"],
  ["mender", "light"],
] as const) {
  const caster = unit(archetype, "party", archetype, ["channel-element"], archetype);
  caster.channelManual = true;
  const foe = unit("Foe", "enemy", "guard");
  foe.affinities = { water: "weak" };
  const all = [caster, foe];
  assert.equal(marinaraHitNumbers(caster, foe, marinaraBasicAttack(caster), all).type, own, `${archetype} unchanneled`);
  assert.ok(marinaraChannelElement(caster, "water"));
  assert.equal(
    marinaraHitNumbers(caster, foe, marinaraBasicAttack(caster), all).type,
    "water",
    `${archetype} channeled`,
  );
}

// Pierce strikes with the loaded ammunition like any shot (panel r4 thought it didn't).
{
  const sniper = unit("Sniper", "party", "marksman", ["pierce"], "sharpshooter");
  sniper.ammoOwned = ["fire", "water"];
  const foe = unit("Foe", "enemy", "guard");
  foe.affinities = {};
  for (const loaded of ["fire", "water"] as const) {
    sniper.ammoLoaded = loaded;
    assert.equal(marinaraHitNumbers(sniper, foe, MARINARA_SKILL_EFFECTS.pierce!, [sniper, foe]).type, loaded);
  }
}

// Retaliate: the Def/Res share adds at most 25% over the basic swing.
{
  const wall = unit("Wall", "party", "guard", ["retaliate"], "sentinel");
  wall.stats = { ...wall.stats, defense: 200, resistance: 10 };
  const all = [wall];
  const basic = marinaraBasicAttack(wall);
  const counter = marinaraCounterAttack(wall, all);
  const swing = marinaraEffectiveStat(wall, "strength", all) + (basic.power ?? 0);
  assert.ok(
    (counter.power ?? 0) - (basic.power ?? 0) <= swing * MARINARA_COUNTER_BONUS_CAP + 1e-9,
    "the counter's bonus is capped",
  );
}

// Channel Element carried by a Blade: weapon basics and weapon skills strike in the channeled element.
{
  const blade = unit("Blade", "party", "blade", ["channel-element", "power-strike"], "blade");
  blade.channelManual = true;
  const foe = unit("Foe", "enemy", "guard");
  foe.affinities = { fire: "weak" };
  const all = [blade, foe];
  assert.ok(marinaraChannelsWeapon(blade));
  assert.notEqual(
    marinaraHitNumbers(blade, foe, marinaraBasicAttack(blade), all).type,
    "fire",
    "unchanneled: the weapon",
  );
  assert.ok(marinaraChannelElement(blade, "fire"));
  assert.equal(marinaraHitNumbers(blade, foe, marinaraBasicAttack(blade), all).type, "fire");
  assert.equal(marinaraHitNumbers(blade, foe, MARINARA_SKILL_EFFECTS["power-strike"]!, all).type, "fire");
  // A Channeler-tree class doesn't turn its weapon: its basics are spells already.
  assert.ok(!marinaraChannelsWeapon(unit("Ch", "party", "channeler", ["channel-element"], "channeler")));
}

// A weakness hit at most doubles, however many weakness bonuses stack.
{
  const sniper = unit("Sniper", "party", "marksman", ["exploit-weakness", "dead-eye"], "marksman");
  const foe = unit("Foe", "enemy", "guard");
  foe.affinities = { pierce: "weak", slash: "weak", blunt: "weak" };
  const numbers = marinaraHitNumbers(sniper, foe, marinaraBasicAttack(sniper), [sniper, foe]);
  assert.ok(numbers.multiplier <= MARINARA_WEAKNESS_CAP + 1e-9, `multiplier ${numbers.multiplier}`);
  assert.ok(numbers.notes?.includes("weakness cap"));
}

// Wound for the Rogue tree (Backstab) and the Marksman (Serrated ammunition).
assert.equal(MARINARA_SKILL_EFFECTS.backstab!.applies?.status, "wound");
assert.ok(marinaraOwnsWoundingAmmo(["Barbed Arrows"]));
assert.ok(!marinaraOwnsWoundingAmmo(["Bodkin Arrows"]));
assert.deepEqual(marinaraOwnedAmmo(["Barbed Arrows"]), ["pierce"]);

// Elemental Lance 7 MP; Convergence power 60.
assert.equal(marinaraSkillCost(unit("E", "party", "channeler", [], "elementalist"), skill("elemental-lance")).cost, 7);
assert.equal(MARINARA_SKILL_EFFECTS.convergence!.power, 60);

console.log("game-marinara-r3-calls: ok");
