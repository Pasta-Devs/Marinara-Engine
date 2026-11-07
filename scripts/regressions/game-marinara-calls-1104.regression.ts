/**
 * The owner's class calls of 2026-11-04: the Hexer line's HP drains also take MP or stamina (as the
 * user's own class resource), the Herald's Rekindle gives an ally MP or stamina back, Channel Element
 * comes at Channeler class level 5, and the Channeler's first spell Unravel stacks a Resistance cut.
 */
import assert from "node:assert/strict";
import {
  MARINARA_SKILL_EFFECTS,
  buildMarinaraEnemy,
  marinaraMainResource,
  marinaraOption,
  performMarinaraOption,
  type MarinaraFightContext,
} from "../../packages/shared/src/features/marinara-combat.js";
import { MARINARA_CLASSES, marinaraClass } from "../../packages/shared/src/features/marinara-classes.js";

const skill = (id: string) => ({ ...MARINARA_CLASSES.flatMap((def) => def.skills).find((one) => one.id === id)! });
const unit = (id: string, side: "party" | "enemy", archetype: string, skills: string[] = [], classId?: string) => {
  const fighter = buildMarinaraEnemy({ id, name: id, level: 20, tier: "standard", archetype: archetype as never });
  fighter.side = side;
  fighter.row = "front";
  if (classId) fighter.classId = classId;
  fighter.skills = [...fighter.skills, ...skills.map(skill)];
  return fighter;
};
const ctx = (): MarinaraFightContext => ({ random: () => 0.01, events: [] });

// Main resource: a Carrion Lord runs on MP, a Cleaver on stamina.
const lord = unit("L", "party", "hexer", ["grave-tithe", "carrion-feast"], "carrion-lord");
const cleaver = unit("C", "party", "blade", ["grave-tithe"], "cleaver");
assert.equal(marinaraMainResource(lord), "mp");
assert.equal(marinaraMainResource(cleaver), "stamina");

// Carrion Feast drains MP or stamina from the foe into the user's own resource.
for (const user of [lord, cleaver]) {
  const foe = unit("F", "enemy", "channeler");
  foe.hp = foe.maxHp = 500;
  const all = [user, foe];
  user.mp = 0;
  user.stamina = 0;
  user.skills = [...user.skills, skill("carrion-feast")];
  user.mp = 20;
  const option = marinaraOption(user, "carrion-feast", all)!;
  assert.ok(option, "Carrion Feast usable");
  const c = ctx();
  const mpBefore = user.mp - option.cost;
  const foeMp = foe.mp;
  performMarinaraOption(user, option, [foe], all, c);
  const drained = c.events.find((e) => e.kind === "drain-resource");
  assert.ok(drained && (drained.amount ?? 0) > 0, `${user.classId} drains a resource`);
  assert.ok(foe.mp < foeMp || foe.stamina < foe.maxStamina, "the foe loses it");
  if (marinaraMainResource(user) === "mp") assert.ok(user.mp > mpBefore, "the Carrion Lord gains MP");
  else assert.ok(user.stamina > 0, "the Cleaver gains stamina");
}

// Rekindle: a quarter of an ally's main resource back.
{
  const herald = unit("H", "party", "herald", ["rekindle"], "herald");
  const mage = unit("M", "party", "channeler", [], "elementalist");
  mage.mp = 0;
  const option = marinaraOption(herald, "rekindle", [herald, mage])!;
  assert.ok(option);
  performMarinaraOption(herald, option, [mage], [herald, mage], ctx());
  assert.equal(mage.mp, Math.round(mage.maxMp * 0.25));
}

// Channel Element at Channeler class level 5 (owner, 11-04 11:30); Unravel at 1, its Resistance cut stacks to 15%.
const channeler = marinaraClass("channeler")!;
assert.equal(channeler.skills.find((one) => one.id === "channel-element")!.learnedAt, 5);
assert.equal(channeler.skills.find((one) => one.id === "unravel")!.learnedAt, 1);
{
  const mage = unit("M", "party", "channeler", ["unravel"], "channeler");
  mage.mp = 100;
  const foe = unit("F", "enemy", "guard");
  foe.hp = foe.maxHp = 999;
  const all = [mage, foe];
  for (let i = 0; i < 4; i++) performMarinaraOption(mage, marinaraOption(mage, "unravel", all)!, [foe], all, ctx());
  const cut = foe.mods.filter((mod) => mod.stat === "resistance").reduce((sum, mod) => sum + mod.pct, 0);
  assert.ok(Math.abs(cut + 0.15) < 1e-9, `Resistance cut ${cut}`);
  assert.ok((MARINARA_SKILL_EFFECTS.unravel!.power ?? 0) > 5);
}

console.log("game-marinara-calls-1104: ok");
