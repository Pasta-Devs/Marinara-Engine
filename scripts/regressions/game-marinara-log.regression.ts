/**
 * Classic Marinara's log says the rules it applies (Alyssa 2026-11-02, playtest report): an immunity
 * says immune, a shield says what it soaked, melee into the back row says it was halved, Slow Time,
 * Hold Fast and Kill Zone show when they act, Steal names what it took, and Grand Strategy's ally acts
 * at once, before the commander's own bonus action.
 */
import assert from "node:assert/strict";
import {
  createMarinaraDirectorState,
  marinaraEventText,
} from "../../packages/server/src/services/game/marinara-director.service.js";
import {
  buildMarinaraEnemy,
  marinaraGrantBonus,
  marinaraHitNumbers,
  marinaraBasicAttack,
  nextMarinaraActor,
  type MarinaraFighter,
} from "../../packages/shared/src/features/marinara-combat.js";
import { MARINARA_CLASSES } from "../../packages/shared/src/features/marinara-classes.js";

const skill = (id: string) => {
  for (const def of MARINARA_CLASSES) {
    const found = def.skills.find((one) => one.id === id);
    if (found) return { ...found };
  }
  throw new Error(`no skill ${id}`);
};
const unit = (id: string, side: "party" | "enemy", skills: string[] = [], row: "front" | "back" = "front") => {
  const fighter = buildMarinaraEnemy({ id, name: id, level: 10, tier: "standard", archetype: "blade" });
  fighter.side = side;
  fighter.row = row;
  fighter.skills = [...fighter.skills, ...skills.map(skill)];
  return fighter;
};

const a = unit("Ana", "party", ["grand-strategy"]);
const b = unit("Bo", "party");
const f = unit("Foe", "enemy");
const state = createMarinaraDirectorState([a, b, f], 1);
const text = (event: Parameters<typeof marinaraEventText>[1]) => marinaraEventText(state, event);

assert.match(text({ kind: "resist", actorId: "Ana", targetId: "Foe", skillId: "rot", why: "immune" }), /immune to Rot/);
assert.match(
  text({ kind: "hit", actorId: "Ana", targetId: "Foe", amount: 3, shielded: 9, shieldLeft: 0 }),
  /a shield absorbed 9, now broken/,
);
assert.match(
  text({ kind: "hit", actorId: "Ana", targetId: "Foe", amount: 3, halved: true }),
  /halved, melee into the back row/,
);
assert.match(text({ kind: "hit", actorId: "Ana", targetId: "Foe", amount: 3, notes: ["Kill Zone"] }), /Kill Zone/);
assert.match(text({ kind: "slowed", actorId: "Ana", targetId: "Foe", amount: 20 }), /Slow Time slows Foe/);
assert.match(
  text({ kind: "steal", actorId: "Ana", targetId: "Foe", item: "Smoke Pot" }),
  /steals a Smoke Pot from Foe/,
);
assert.match(text({ kind: "steal", actorId: "Ana", targetId: "Foe", amount: 12 }), /steals 12 gold/);
assert.match(text({ kind: "miss", actorId: "Ana", targetId: "Foe", skillId: "steal" }), /fails to steal/);
assert.match(text({ kind: "command", actorId: "Ana", targetId: "Bo", skillId: "grand-strategy" }), /Bo acts at once/);

// The back row really is halved, and the hit says so.
{
  const front = unit("front", "enemy");
  const back = unit("back", "enemy", [], "back");
  const all: MarinaraFighter[] = [a, front, back];
  assert.equal(marinaraHitNumbers(a, back, marinaraBasicAttack(a), all).halved, true);
  assert.equal(marinaraHitNumbers(a, front, marinaraBasicAttack(a), all).halved, undefined);
}

// Grand Strategy: the commanded ally goes before the commander's own bonus action, whatever the order.
{
  const all = [a, b, f];
  marinaraGrantBonus(b, all);
  marinaraGrantBonus(a, all);
  assert.equal(nextMarinaraActor(all)?.id, "Bo", "the ally acts at once");
}

console.log("game-marinara-log: ok");
