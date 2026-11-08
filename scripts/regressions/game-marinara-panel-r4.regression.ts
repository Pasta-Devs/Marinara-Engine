/**
 * Sonnet panel round 4 (2026-11-03): passives that worked with no sign now say so in the log.
 */
import assert from "node:assert/strict";
import {
  beginMarinaraTurn,
  buildMarinaraEnemy,
  marinaraBasicAttack,
  marinaraHitNumbers,
  type MarinaraFightContext,
} from "../../packages/shared/src/features/marinara-combat.js";
import { MARINARA_CLASSES } from "../../packages/shared/src/features/marinara-classes.js";

const skill = (id: string) => {
  for (const def of MARINARA_CLASSES) {
    const found = def.skills.find((one) => one.id === id);
    if (found) return { ...found };
  }
  throw new Error(`no skill ${id}`);
};
const unit = (id: string, side: "party" | "enemy", archetype: string, skills: string[] = [], classId?: string) => {
  const fighter = buildMarinaraEnemy({ id, name: id, level: 20, tier: "standard", archetype: archetype as never });
  fighter.side = side;
  fighter.row = "front";
  if (classId) fighter.classId = classId;
  fighter.skills = [...fighter.skills, ...skills.map(skill)];
  return fighter;
};
const ctx = (): MarinaraFightContext => ({ random: () => 0.5, events: [] });

// Bloodrage: a hurt user's hits say it.
{
  const blade = unit("B", "party", "blade", ["bloodrage"], "blade");
  const foe = unit("F", "enemy", "guard");
  const all = [blade, foe];
  assert.ok(
    !marinaraHitNumbers(blade, foe, marinaraBasicAttack(blade), all).notes?.includes("Bloodrage"),
    "whole: silent",
  );
  blade.hp = Math.round(blade.maxHp / 3);
  assert.ok(marinaraHitNumbers(blade, foe, marinaraBasicAttack(blade), all).notes?.includes("Bloodrage"));
}

// Steady: armour partly ignored is named.
{
  const sniper = unit("S", "party", "marksman", ["steady"], "sharpshooter");
  const foe = unit("F", "enemy", "guard");
  assert.ok(marinaraHitNumbers(sniper, foe, marinaraBasicAttack(sniper), [sniper, foe]).notes?.includes("Steady"));
}

// Mana Tide: the MP it gives back is an event; Hold the Line's early first turn is said once (Classic).
{
  const sage = unit("M", "party", "mender", ["mana-tide"], "mender");
  sage.mp = 0;
  const c = ctx();
  beginMarinaraTurn(sage, [sage], c);
  assert.ok(c.events.some((e) => e.kind === "passive" && e.skillId === "mana-tide" && (e.amount ?? 0) > 0));
  const guard = unit("G", "party", "guard", ["hold-the-line"], "guard");
  const first = ctx();
  beginMarinaraTurn(guard, [guard], first);
  assert.ok(first.events.some((e) => e.kind === "passive" && e.skillId === "hold-the-line"));
  const second = ctx();
  beginMarinaraTurn(guard, [guard], second);
  assert.ok(!second.events.some((e) => e.kind === "passive" && e.skillId === "hold-the-line"), "said once");
}

console.log("game-marinara-panel-r4: ok");
