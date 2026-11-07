/**
 * Classic Marinara taming (Tracker line, Alyssa 2026-11-01): Tame takes a wild beast or vermin below
 * 30% HP (never a boss or treasure foe; an elite at worse odds) out of the fight; it pays XP, drops nothing and becomes
 * its keeper's companion, kept on the card. A companion raises its keeper's best-matching stat by 10%
 * while a Tracker-tree class is active; Bond makes that 20% and gives the rest of the party half. Sic
 * sends the companion in as a bonus action every other turn.
 */
import assert from "node:assert/strict";
import {
  combatDirectorView,
  createCombatDirector,
} from "../../packages/server/src/services/game/combat-director.service.js";
import {
  marinaraCombatant,
  marinaraEventText,
  performMarinaraAction,
} from "../../packages/server/src/services/game/marinara-director.service.js";
import { marinaraFightEnd } from "../../packages/server/src/services/game/marinara-fight-start.service.js";
import { MARINARA_CLASSES, createMarinaraProgression } from "../../packages/shared/src/features/marinara-classes.js";
import {
  buildMarinaraEnemy,
  marinaraOption,
  marinaraCompanionBonus,
  marinaraTameChance,
  marinaraTargetsFor,
  performMarinaraOption,
  type MarinaraFighter,
} from "../../packages/shared/src/features/marinara-combat.js";
import {
  MARINARA_COMPANION_STABLE,
  marinaraAddCompanion,
  marinaraApplyCompanions,
  marinaraFoeFighters,
  marinaraReleaseCompanion,
  marinaraSetActiveCompanion,
  type MarinaraCardProgression,
} from "../../packages/shared/src/features/marinara-party.js";

const skill = (id: string) => {
  for (const def of MARINARA_CLASSES) {
    const found = def.skills.find((one) => one.id === id);
    if (found) return { ...found };
  }
  throw new Error(`no skill ${id}`);
};
const learnedAt = (classId: string, id: string) =>
  MARINARA_CLASSES.find((def) => def.id === classId)!.skills.find((one) => one.id === id)?.learnedAt;
assert.equal(learnedAt("tracker", "tame"), 12, "Tame is the Tracker's at class level 12");
assert.equal(learnedAt("huntsmaster", "sic"), 22, "Sic the Huntsmaster's at 22");
assert.equal(learnedAt("huntsmaster", "bond"), 26, "Bond at 26");

const hunter = (id: string, skills: string[]): MarinaraFighter => {
  const fighter = buildMarinaraEnemy({ id, name: id, level: 12, tier: "standard", archetype: "marksman" });
  fighter.side = "party";
  fighter.skills = [...fighter.skills, ...skills.map(skill)];
  fighter.mp = fighter.maxMp = 999;
  fighter.stamina = fighter.maxStamina = 999;
  return fighter;
};
const beasts = (tier: "standard" | "elite" = "standard") =>
  marinaraFoeFighters({
    foes: [{ id: "dog", name: "Dog", marinara: { family: { familyId: "hound", tier, level: 12 } } } as never],
    partyLevels: [12],
    partyAverageHp: 100,
    difficulty: "normal",
    keepAll: true,
    setting: "high_fantasy",
  }).fighters;

// Who can be tamed: a hound below 30% HP, not above it; an elite at 20 points lower odds.
{
  const [dog] = beasts();
  assert.ok(dog?.tameable, "a hound can be tamed");
  assert.equal(dog!.tameable!.stat, "strength", "its best stat is the one its family stands out in");
  const tracker = hunter("t", ["tame"]);
  const all = [tracker, dog!];
  const effect = marinaraOption(tracker, "tame", all)!.effect;
  assert.deepEqual(marinaraTargetsFor(tracker, effect, all), [], "not at full HP");
  dog!.hp = Math.floor(dog!.maxHp * 0.2);
  assert.deepEqual(
    marinaraTargetsFor(tracker, effect, all).map((u) => u.id),
    ["dog"],
    "below 30% it can be tamed",
  );
  const chance = marinaraTameChance(tracker, dog!, all);
  assert.ok(chance >= 10 && chance <= 90, `odds in range (${chance}%)`);
  dog!.level = 20;
  assert.ok(marinaraTameChance(tracker, dog!, all) < chance, "a beast above the user is harder");
  const [elite] = beasts("elite");
  assert.ok(elite?.tameable, "an elite can be tamed (23:36)");
  dog!.level = 12;
  const standardOdds = marinaraTameChance(tracker, dog!, all);
  dog!.tier = "elite";
  assert.equal(
    marinaraTameChance(tracker, dog!, all),
    Math.max(10, standardOdds - 20),
    "an elite's odds are 20 points lower",
  );
  dog!.tier = "standard";
  const goblin = buildMarinaraEnemy({ id: "g", name: "Goblin", level: 12, tier: "standard" });
  goblin.hp = 1;
  assert.deepEqual(marinaraTargetsFor(tracker, effect, [tracker, goblin]), [], "only beasts");
}

// A tamed beast leaves the fight, pays XP, drops nothing, and follows its keeper.
{
  const tracker = hunter("t", ["tame"]);
  const [dog] = beasts();
  dog!.hp = 1;
  const s = createCombatDirector({
    id: "tame",
    anchor: "anchor",
    party: [marinaraCombatant(tracker)],
    enemies: [marinaraCombatant(dog!)],
    style: "classic",
    difficulty: "normal",
    seed: 3,
    marinara: [tracker, dog!],
  });
  let tamed = false;
  const wild = () => s.marinara!.fighters.find((one) => one.id === "dog")!;
  for (let seed = 0; seed < 40 && !tamed; seed++) {
    performMarinaraAction(s.marinara!, "t", { type: "skill", skillId: "tame", targetId: "dog" }, seed, false, () => {});
    tamed = !!wild().tamedBy;
  }
  assert.ok(tamed, "Tame lands within a few tries");
  // The director takes the beast off the field on its next step.
  combatDirectorView(s);
  assert.equal(s.gone?.[0]?.left, "tamed", "the beast leaves as tamed");
  assert.equal(s.outcome, "victory", "with no foe left the fight is won");
  const progression = createMarinaraProgression({ seed: "k", primary: "marksman", temperament: "patient" });
  const end = marinaraFightEnd({
    state: s.marinara!,
    outcome: "victory",
    cards: [{ name: "t", marinara: progression }],
    seed: 1,
    permadeath: false,
  });
  const kept = end.cards?.[0]?.marinara as MarinaraCardProgression;
  assert.equal(kept.companions?.[0]?.name, dog!.tameable!.name, "the beast is kept on the card");
  assert.equal(kept.activeCompanion, kept.companions?.[0]?.id, "the first one tamed is active");
  assert.ok(kept.xp > 0, "and it paid XP");
  assert.equal(end.growth[0]?.tamed, dog!.tameable!.name, "the fight's end says so");
  // Once Tame lands the beast is kept, even if the fight is then lost (Sonnet panel r6).
  const lost = marinaraFightEnd({
    state: s.marinara!,
    outcome: "defeat",
    cards: [{ name: "t", marinara: progression }],
    seed: 2,
    permadeath: false,
  });
  const keptAnyway = lost.cards?.[0]?.marinara as MarinaraCardProgression;
  assert.equal(keptAnyway.companions?.[0]?.name, dog!.tameable!.name, "a lost fight keeps the tamed beast");
}

// The companion's bonus: +10% to its stat with a Tracker-tree class active, Bond 20% and half to all.
{
  const base = createMarinaraProgression({ seed: "c", primary: "marksman", temperament: "patient" });
  const one = { id: "c1", name: "Moor Hound", stat: "speed" as const };
  const stabled = { companions: [one], activeCompanion: "c1" };
  const companion = { name: one.name, stat: one.stat };
  const make = (id: string) => buildMarinaraEnemy({ id, name: id, level: 10, tier: "standard", archetype: "scout" });
  const keeper = make("k"),
    friend = make("f");
  const speed = keeper.stats.speed;
  marinaraApplyCompanions([
    { fighter: keeper, progression: { ...base, activeClass: "tracker", ...stabled } },
    { fighter: friend, progression: base },
  ]);
  const bonus = marinaraCompanionBonus(one);
  assert.ok(Math.abs(keeper.stats.speed - speed * (1 + bonus)) < 1e-9, "the bonus to the keeper's Speed");
  assert.equal(friend.stats.speed, speed, "nobody else without Bond");
  assert.deepEqual(
    { name: keeper.companion?.name, stat: keeper.companion?.stat },
    companion,
    "the keeper has its companion for Sic",
  );
  assert.equal(keeper.companion?.lends, bonus, "and what it lends is kept for the fight-start line");
  const off = make("o");
  marinaraApplyCompanions([{ fighter: off, progression: { ...base, activeClass: "marksman", ...stabled } }]);
  assert.equal(off.stats.speed, speed, "no bonus outside the Tracker tree");
  const bonded = make("b"),
    ally = make("a");
  bonded.skills = [...bonded.skills, skill("bond")];
  marinaraApplyCompanions([
    { fighter: bonded, progression: { ...base, activeClass: "huntsmaster", ...stabled } },
    { fighter: ally, progression: base },
  ]);
  assert.ok(Math.abs(bonded.stats.speed - speed * (1 + bonus * 1.5)) < 1e-9, "Bond: half as much again");
  assert.ok(Math.abs(ally.stats.speed - speed * (1 + bonus * 0.75)) < 1e-9, "and half of that to the party");
}

// Sic: needs a companion, a bonus action, every other turn.
{
  const master = hunter("m", ["sic"]);
  const foe = buildMarinaraEnemy({ id: "f", name: "Foe", level: 12, tier: "standard" });
  const all = [master, foe];
  assert.equal(marinaraOption(master, "sic", all), undefined, "no companion, no Sic");
  master.companion = { name: "Moor Hound", stat: "speed" };
  const option = marinaraOption(master, "sic", all)!;
  assert.equal(option.effect.from, "speed", "strikes from the user's matching stat");
  const hp = foe.hp;
  performMarinaraOption(master, option, [foe], all, { random: () => 0.5, events: [] });
  assert.ok(foe.hp < hp, "the companion hits");
  assert.equal(master.bonusTurns, 1, "a bonus action");
  assert.equal(master.cooldowns.sic, 2, "then waits a turn");
  // The beast bites with its own natural attack, never the keeper's loaded fire arrows or channel
  // (playtest 2026-11-05).
  const keeper = hunter("k", ["sic"]);
  keeper.companion = { name: "Grave-Mound Wolf", stat: "speed", attackType: "slash" };
  keeper.ammoOwned = ["fire"];
  keeper.ammoLoaded = "fire";
  keeper.channeled = "lightning";
  const target = buildMarinaraEnemy({ id: "f2", name: "Foe", level: 12, tier: "standard" });
  const events: { kind: string; type?: string }[] = [];
  performMarinaraOption(keeper, marinaraOption(keeper, "sic", [keeper, target])!, [target], [keeper, target], {
    random: () => 0.5,
    events: events as never,
  });
  const hit = events.find((one) => one.kind === "hit");
  assert.equal(hit?.type, "slash", "the wolf's claws, not the keeper's ammo or channel");
  delete keeper.companion.attackType;
  keeper.cooldowns = {};
  keeper.bonusTurns = 0;
  events.length = 0;
  performMarinaraOption(keeper, marinaraOption(keeper, "sic", [keeper, target])!, [target], [keeper, target], {
    random: () => 0.5,
    events: events as never,
  });
  assert.equal(events.find((one) => one.kind === "hit")?.type, "pierce", "a bite when the family names none");
  // The log names the beast.
  keeper.companion.name = "Grave-Mound Wolf";
  const fight = createCombatDirector({
    id: "sic",
    anchor: "anchor",
    party: [marinaraCombatant(keeper)],
    enemies: [marinaraCombatant(target)],
    style: "classic",
    difficulty: "normal",
    seed: 1,
    marinara: [keeper, target],
  });
  const line = marinaraEventText(fight.marinara!, {
    ...events.find((one) => one.kind === "hit")!,
    actorId: "k",
    targetId: "f2",
  } as never);
  assert.match(line, /^k's Grave-Mound Wolf strikes Foe \(Sic\) for \d+ pierce/, line);
}

// The stable (Alyssa 23:31): up to 8, one active, new ones join; a full stable waits on a release.
{
  let p: MarinaraCardProgression = createMarinaraProgression({
    seed: "s",
    primary: "marksman",
    temperament: "patient",
  });
  const beast = (n: number) => ({ id: `b${n}`, name: `Beast ${n}`, stat: "hp" as const });
  for (let n = 1; n <= MARINARA_COMPANION_STABLE; n++) p = marinaraAddCompanion(p, beast(n));
  assert.equal(p.companions?.length, 8, "eight kept");
  assert.equal(p.activeCompanion, "b1", "the first stays active");
  p = marinaraAddCompanion(p, beast(9));
  assert.equal(p.companions?.length, 8, "a ninth doesn't fit");
  assert.equal(p.pendingCompanion?.id, "b9", "it waits on a release");
  const freed = marinaraReleaseCompanion(p, "b9");
  assert.equal(freed.pendingCompanion, undefined, "let go, it's gone");
  assert.equal(freed.companions?.length, 8);
  const swapped = marinaraReleaseCompanion(p, "b1");
  assert.ok(
    swapped.companions?.some((one) => one.id === "b9"),
    "releasing an old one keeps the new",
  );
  assert.notEqual(swapped.activeCompanion, "b1", "the released one is no longer active");
  assert.equal(marinaraSetActiveCompanion(swapped, "b5").activeCompanion, "b5", "any stabled one can be made active");
  assert.throws(() => marinaraSetActiveCompanion(swapped, "b1"), /No such companion/);
}

// The bonus scales with the level and rank it was tamed at (Alyssa 23:36).
{
  const pct = (level: number, tier: "minion" | "standard" | "elite") =>
    Math.round(marinaraCompanionBonus({ level, tier }) * 1000) / 10;
  assert.equal(pct(5, "standard"), 6);
  assert.equal(pct(15, "standard"), 10);
  assert.equal(pct(30, "standard"), 16);
  assert.equal(pct(30, "elite"), 24);
  assert.equal(pct(10, "minion"), 4);
}

console.log("game-marinara-tame: ok");
