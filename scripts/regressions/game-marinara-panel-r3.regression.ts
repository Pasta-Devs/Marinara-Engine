/**
 * Sonnet panel round 3 (2026-11-02) bug fixes: a surrendered foe is out of the fight for its own side
 * too (no heals or boons), an ailment isn't offered at a foe immune to it, a boon on the whole side is
 * one log line, and Bloodlust, Sanctified and rune-lent elements show in the log.
 */
import assert from "node:assert/strict";
import {
  createMarinaraDirectorState,
  marinaraCombatSkills,
  marinaraEventText,
  performMarinaraTacticalAction,
} from "../../packages/server/src/services/game/marinara-director.service.js";
import {
  MARINARA_SKILL_EFFECTS,
  buildMarinaraEnemy,
  marinaraHitNumbers,
  marinaraTargetsFor,
  marinaraUsable,
} from "../../packages/shared/src/features/marinara-combat.js";
import { MARINARA_CLASSES } from "../../packages/shared/src/features/marinara-classes.js";

const skill = (id: string) => {
  for (const def of MARINARA_CLASSES) {
    const found = def.skills.find((one) => one.id === id);
    if (found) return { ...found };
  }
  throw new Error(`no skill ${id}`);
};
const unit = (id: string, side: "party" | "enemy", skills: string[] = []) => {
  const fighter = buildMarinaraEnemy({ id, name: id, level: 20, tier: "standard", archetype: "blade" });
  fighter.side = side;
  fighter.row = "front";
  fighter.skills = [...fighter.skills, ...skills.map(skill)];
  fighter.mp = fighter.maxMp = 200;
  fighter.stamina = 200;
  return fighter;
};

// 1. A foe that yielded gets no heal from its side.
{
  const priest = unit("Priest", "enemy", ["mend"]);
  const yielded = unit("Yielded", "enemy");
  yielded.yielded = true;
  yielded.hp = 5;
  const hero = unit("Hero", "party");
  const friends = marinaraTargetsFor(priest, MARINARA_SKILL_EFFECTS.mend!, [priest, yielded, hero]);
  assert.ok(!friends.includes(yielded), "a surrendered foe isn't healed by its side");
  assert.ok(friends.includes(priest));
}

// 2. Rot isn't offered at a foe immune to poison; with none to take it, it can't be used at all.
{
  const hexer = unit("Hexer", "party", ["rot"]);
  const immune = unit("Golem", "enemy");
  immune.affinities = { ...(immune.affinities ?? {}), poison: "immune" };
  const soft = unit("Bandit", "enemy");
  assert.deepEqual(
    marinaraTargetsFor(hexer, MARINARA_SKILL_EFFECTS.rot!, [hexer, immune, soft]).map((one) => one.id),
    ["Bandit"],
  );
  assert.ok(!marinaraUsable(hexer, [hexer, immune]).some((option) => option.id === "rot"));
  const rot = marinaraCombatSkills(hexer, [hexer, immune]).find((one) => one.id === "rot");
  assert.equal(rot?.unavailable, "immune");
}

// 3. A boon on the whole side reads as one line.
{
  const captain = unit("Captain", "party", ["rally"]);
  const b = unit("Bo", "party");
  const c = unit("Cy", "party");
  const foe = unit("Foe", "enemy");
  const state = createMarinaraDirectorState([captain, b, c, foe], 1);
  const lines: string[] = [];
  performMarinaraTacticalAction(
    state,
    "Captain",
    { type: "skill", skillId: "rally" },
    7,
    (text) => lines.push(text),
    () => [],
    () => true,
  );
  const rally = lines.filter((line) => line.includes("uses Rally"));
  assert.equal(rally.length, 1, lines.join("\n"));
  assert.match(rally[0]!, /on their side: .*Bo.*Cy/);
}

// 4. Bloodlust's heal is logged.
{
  const brute = unit("Brute", "party", ["bloodlust"]);
  brute.hp = 1;
  const foe = unit("Foe", "enemy");
  foe.hp = foe.maxHp = 5000;
  const state = createMarinaraDirectorState([brute, foe], 1);
  const lines: string[] = [];
  for (let seed = 1; seed < 40 && !lines.some((line) => /drains \d+ HP \(Bloodlust\)/.test(line)); seed++)
    performMarinaraTacticalAction(
      state,
      "Brute",
      { type: "attack", targetId: "Foe" },
      seed,
      (text) => lines.push(text),
      () => ["Foe"],
      () => true,
    );
  assert.ok(
    lines.some((line) => /drains \d+ HP \(Bloodlust\)/.test(line)),
    lines.join("\n"),
  );
}

// 5. Sanctified and a rune-lent element say so.
{
  const cleric = unit("Cleric", "party", ["sanctified"]);
  const caster = unit("Caster", "enemy");
  const numbers = marinaraHitNumbers(caster, cleric, { kind: "damage", target: "enemy", damage: "magic", power: 10 }, [
    cleric,
    caster,
  ]);
  assert.ok(numbers.notes?.includes("Sanctified"));
  const state = createMarinaraDirectorState([cleric, caster], 1);
  assert.match(
    marinaraEventText(state, { kind: "hit", actorId: "Caster", targetId: "Cleric", amount: 5, notes: ["Sanctified"] }),
    /less from Sanctified/,
  );
  assert.match(
    marinaraEventText(state, {
      kind: "hit",
      actorId: "Cleric",
      targetId: "Caster",
      amount: 5,
      type: "ice",
      notes: ["rune"],
    }),
    /ice lent by runes/,
  );
}

// 6. A foe with a Scout kit never spends a turn on Steal (the party has no loot to take).
{
  const thief = unit("Thief", "enemy", ["steal"]);
  const hero = unit("Hero", "party");
  assert.ok(!marinaraUsable(thief, [thief, hero]).some((option) => option.id === "steal"));
  const rogue = unit("Rogue", "party", ["steal"]);
  assert.ok(marinaraUsable(rogue, [rogue, thief]).some((option) => option.id === "steal"));
}

console.log("game-marinara-panel-r3: ok");
