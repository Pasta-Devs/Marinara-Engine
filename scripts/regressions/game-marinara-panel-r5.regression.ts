/**
 * Sonnet panel round 5 (2026-11-03): runes turn weapon hits to their element and wait for a channel
 * when cast by hand; more passives speak up in the log.
 */
import assert from "node:assert/strict";
import {
  MARINARA_SKILL_EFFECTS,
  buildMarinaraEnemy,
  marinaraBasicAttack,
  marinaraChannelElement,
  marinaraHitNumbers,
  marinaraRuneNeedsChannel,
  performMarinaraOption,
  marinaraOption,
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
  fighter.mp = fighter.maxMp = 100;
  return fighter;
};
const ctx = (): MarinaraFightContext => ({ random: () => 0.5, events: [] });

// Edge Runes: a hand-cast rune waits for a channel, then turns an ally's Power Strike to its element
// even on a neutral foe.
{
  const scholar = unit("R", "party", "channeler", ["edge-runes"], "rune-scholar");
  const blade = unit("B", "party", "blade", ["power-strike"], "blade");
  const foe = unit("F", "enemy", "guard");
  foe.affinities = {};
  const all = [scholar, blade, foe];
  scholar.channelManual = true;
  assert.ok(marinaraRuneNeedsChannel(scholar, MARINARA_SKILL_EFFECTS["edge-runes"]!));
  assert.equal(marinaraOption(scholar, "edge-runes", all), undefined, "unchanneled: not usable by hand");
  assert.ok(marinaraChannelElement(scholar, "fire"));
  const option = marinaraOption(scholar, "edge-runes", all)!;
  assert.ok(option);
  performMarinaraOption(scholar, option, [], all, ctx());
  const hit = marinaraHitNumbers(blade, foe, MARINARA_SKILL_EFFECTS["power-strike"]!, all);
  assert.equal(hit.type, "fire");
  assert.ok(hit.notes?.includes("rune"));
}

// Passives in the log: Battle Rhythm, Pack Tactics, Heavy Draw.
{
  const blade = unit("B", "party", "blade", ["battle-rhythm"], "blade");
  const foe = unit("F", "enemy", "guard");
  assert.ok(marinaraHitNumbers(blade, foe, marinaraBasicAttack(blade), [blade, foe]).notes?.includes("Battle Rhythm"));
  const hunter = unit("H", "party", "marksman", ["pack-tactics"], "huntsmaster");
  foe.marked = 2;
  assert.ok(
    marinaraHitNumbers(blade, foe, marinaraBasicAttack(blade), [blade, hunter, foe]).notes?.includes("Pack Tactics"),
  );
}

console.log("game-marinara-panel-r5: ok");
