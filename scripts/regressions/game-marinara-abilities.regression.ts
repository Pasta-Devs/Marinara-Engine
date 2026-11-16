/**
 * Classic Marinara abilities do what their text says (Alyssa 2026-11-01: "abilities that don't work
 * are bugs"): stun immunity, Slow Time, Elder Oath, Oath of Iron, Thousand Shadows, Undying Light,
 * Siphon, Devour, Backstab, Exploit, Assassinate, Weaken, Crescendo, Tempo, Formation, Raise the
 * Banner, Light Feet and Heavy Draw.
 */
import assert from "node:assert/strict";
import {
  beginMarinaraTurn,
  buildMarinaraEnemy,
  marinaraBasicAttack,
  marinaraEffectiveStat,
  marinaraExpectedHit,
  marinaraHitNumbers,
  marinaraOption,
  marinaraChannelElement,
  marinaraTargetsFor,
  performMarinaraOption,
  type MarinaraFightContext,
  type MarinaraFighter,
} from "../../packages/shared/src/features/marinara-combat.js";
import { MARINARA_CLASSES, marinaraRandom } from "../../packages/shared/src/features/marinara-classes.js";

const ctx = (seed = "abilities"): MarinaraFightContext => ({ random: marinaraRandom(seed), events: [] });
const skill = (id: string) => {
  for (const def of MARINARA_CLASSES) {
    const found = def.skills.find((one) => one.id === id);
    if (found) return { ...found };
  }
  throw new Error(`no skill ${id}`);
};
const unit = (id: string, side: "party" | "enemy", skills: string[] = []): MarinaraFighter => {
  const fighter = buildMarinaraEnemy({ id, name: id, level: 10, tier: "standard", archetype: "blade" });
  fighter.side = side;
  fighter.skills = [...fighter.skills, ...skills.map(skill)];
  return fighter;
};
const use = (actor: MarinaraFighter, id: string, targets: MarinaraFighter[], all: MarinaraFighter[], c = ctx()) => {
  actor.mp = actor.maxMp = 999;
  actor.stamina = actor.maxStamina = 999;
  const option = marinaraOption(actor, id, all);
  assert.ok(option, `${actor.id} can use ${id}`);
  performMarinaraOption(actor, option!, targets, all, c);
  return c;
};
const status = (target: MarinaraFighter, which: "stun" | "sleep" | "doom" | "poison", by?: string) => {
  target.statuses.push({ status: which, turns: 2, ...(by ? { by } : {}) });
};

// Unstoppable: no stun below half HP; Immovable: never.
{
  const cleaver = unit("wb", "party", ["unstoppable"]);
  const wall = unit("wall", "party", ["immovable"]);
  cleaver.hp = cleaver.maxHp;
  const stun = { kind: "status", target: "enemy", status: "stun", chance: 1, duration: 2 } as const;
  const stunner = unit("st", "enemy");
  const stunAll = [stunner, cleaver, wall];
  const option = { id: "test-stun", skill: null, effect: stun } as never;
  performMarinaraOption(stunner, option, [cleaver], stunAll, ctx());
  assert.ok(
    cleaver.statuses.some((s) => s.status === "stun"),
    "above half HP the Cleaver can be stunned",
  );
  cleaver.statuses = [];
  cleaver.hp = Math.floor(cleaver.maxHp / 3);
  performMarinaraOption(stunner, option, [cleaver], stunAll, ctx());
  assert.ok(!cleaver.statuses.some((s) => s.status === "stun"), "below half HP it can't");
  performMarinaraOption(stunner, option, [wall], stunAll, ctx());
  assert.ok(!wall.statuses.some((s) => s.status === "stun"), "Immovable is never stunned");
}

// Elder Oath: no Doom, no sleep.
{
  const elder = unit("el", "party", ["elder-oath"]);
  const foe = unit("f", "enemy");
  const all = [elder, foe];
  for (const which of ["doom", "sleep"] as const) {
    const option = {
      id: "t",
      skill: null,
      effect: { kind: "status", target: "enemy", status: which, chance: 1, duration: 3 },
    } as never;
    performMarinaraOption(foe, option, [elder], all, ctx());
    assert.ok(!elder.statuses.some((s) => s.status === which), `Elder Oath shrugs off ${which}`);
  }
}

// Slow Time: a debuffed foe's turns come later.
{
  const dream = unit("dr", "party", ["slow-time"]);
  const plain = unit("pl", "party");
  const foe = unit("f", "enemy");
  foe.statuses.push({ status: "poison", turns: 3 });
  const turn = (all: MarinaraFighter[]) => {
    foe.next = 0;
    foe.hp = foe.maxHp;
    beginMarinaraTurn(foe, all, ctx());
    return foe.next;
  };
  const without = turn([plain, foe]);
  foe.statuses = [{ status: "poison", turns: 3 }];
  const withSlow = turn([dream, foe]);
  assert.ok(withSlow > without * 1.2, `Slow Time pushes the debuffed foe back (${without} -> ${withSlow})`);
}

// Slow Time: a status ailment that lands slows the rest of the foe's wait at once, and only once.
{
  const dream = unit("dr", "party", ["slow-time"]);
  const foe = unit("f", "enemy");
  const all = [dream, foe];
  dream.turnAt = 100;
  foe.next = 200;
  const poison = {
    id: "t",
    skill: null,
    effect: { kind: "status", target: "enemy", status: "poison", chance: 1, duration: 3 },
  } as never;
  performMarinaraOption(dream, poison, [foe], all, ctx());
  assert.ok(
    foe.statuses.some((s) => s.status === "poison"),
    "the poison lands",
  );
  assert.equal(Math.round(foe.next), 225, "the 100 left to wait becomes 125 (Speed -20%)");
  performMarinaraOption(dream, poison, [foe], all, ctx());
  assert.equal(Math.round(foe.next), 225, "a second ailment in the same wait does not slow it again");
  const plain = unit("pl", "party");
  const other = unit("o", "enemy");
  plain.turnAt = 100;
  other.next = 200;
  performMarinaraOption(plain, poison, [other], [plain, other], ctx());
  assert.equal(other.next, 200, "without Slow Time the wait is unchanged");
}

// Oath of Iron: nobody drops below 1 HP until their next turn.
{
  const oath = unit("oa", "party", ["oath-of-iron"]);
  const ally = unit("al", "party");
  const foe = unit("f", "enemy");
  const all = [oath, ally, foe];
  use(oath, "oath-of-iron", [oath], all);
  ally.hp = 1;
  foe.stats.strength = 500;
  const hit = {
    id: null,
    skill: null,
    effect: { kind: "damage", target: "enemy", basic: true, hitBonus: 500 },
  } as never;
  performMarinaraOption(foe, hit, [ally], all, ctx());
  assert.equal(ally.hp, 1, "the sworn ally keeps standing");
}

// Thousand Shadows: three decoys take the next three hits on the party, however long that takes.
{
  const shade = unit("sh", "party", ["thousand-shadows"]);
  const ally = unit("al", "party");
  const foe = unit("f", "enemy");
  const all = [shade, ally, foe];
  use(shade, "thousand-shadows", [shade], all);
  shade.mods = shade.mods.filter((mod) => mod.stat !== "shadows"); // no time limit: decoys outlast the buff
  const hp = ally.hp;
  const hit = {
    id: null,
    skill: null,
    effect: { kind: "damage", target: "enemy", basic: true, hitBonus: 500 },
  } as never;
  for (let i = 0; i < 3; i++) performMarinaraOption(foe, hit, [ally], all, ctx(`d${i}`));
  assert.equal(ally.hp, hp, "three hits taken by decoys");
  performMarinaraOption(foe, hit, [ally], all, ctx("d4"));
  assert.ok(ally.hp < hp, "the fourth lands");
  // A miss doesn't use up a decoy (Alyssa 2026-11-02: only hits that would land).
  shade.decoys = 1;
  const miss = {
    id: null,
    skill: null,
    effect: { kind: "damage", target: "enemy", basic: true, hitBonus: -1000 },
  } as never;
  let misses = 0;
  for (let i = 0; i < 8; i++) {
    shade.decoys = 1;
    const c = ctx(`dmiss${i}`);
    performMarinaraOption(foe, miss, [ally], all, c);
    if (!c.events.some((e) => e.kind === "miss")) continue;
    misses++;
    assert.equal(shade.decoys, 1, "a miss leaves the decoy");
  }
  assert.ok(misses > 0, "some attacks missed");
}

// Undying Light: every downed ally gets up at half HP.
{
  const saint = unit("sa", "party", ["undying-light"]);
  const downed = [unit("d1", "party"), unit("d2", "party")];
  for (const one of downed) one.hp = 0;
  const all = [saint, ...downed, unit("f", "enemy")];
  use(saint, "undying-light", [downed[0]!], all);
  for (const one of downed) assert.equal(one.hp, Math.round(one.maxHp * 0.5), `${one.id} is back at half`);
}

// Siphon: takes a buff, or MP when there is none.
{
  const hexer = unit("hx", "party", ["siphon"]);
  const foe = unit("f", "enemy");
  foe.stats.resistance = 0;
  const all = [hexer, foe];
  foe.mods.push({ stat: "damage", pct: 0.3, turns: 3, source: "rally" });
  use(hexer, "siphon", [foe], all, ctx("si"));
  assert.ok(!foe.mods.some((m) => m.source === "rally"), "the buff leaves the foe");
  assert.ok(
    hexer.mods.some((m) => m.stat === "damage" && m.pct === 0.3),
    "and goes to the Hexer",
  );
  foe.mp = foe.maxMp = 100;
  hexer.mp = 0;
  use(hexer, "siphon", [foe], all, ctx("si2"));
  assert.ok(foe.mp < 100, "with no buff, MP drains");
}

// Devour: heals only when a debuff the user placed runs out.
{
  const devourer = unit("dv", "party", ["devour"]);
  const other = unit("ot", "party");
  const foe = unit("f", "enemy");
  const all = [devourer, other, foe];
  devourer.hp = 10;
  foe.statuses = [{ status: "poison", turns: 1, by: "ot", power: 0 }];
  beginMarinaraTurn(foe, all, ctx());
  assert.equal(devourer.hp, 10, "someone else's poison running out feeds nothing");
  foe.statuses = [{ status: "poison", turns: 1, by: "dv", power: 0 }];
  beginMarinaraTurn(foe, all, ctx());
  assert.ok(devourer.hp > 10, "its own poison running out heals it");
}

// Backstab: more damage to a target an ally struck since its last turn.
{
  const rogue = unit("ro", "party", ["backstab"]);
  const ally = unit("al", "party");
  const foe = unit("f", "enemy");
  const all = [rogue, ally, foe];
  const effect = marinaraOption(rogue, "backstab", all)!.effect;
  const alone = marinaraHitNumbers(rogue, foe, effect, all).damage;
  foe.struckBy = "al";
  const flanked = marinaraHitNumbers(rogue, foe, effect, all).damage;
  assert.ok(flanked > alone * 1.2, `Backstab hits harder on a busy target (${alone} -> ${flanked})`);
}

// Exploit: crits more on a debuffed target only.
{
  const rogue = unit("ro", "party", ["exploit"]);
  const foe = unit("f", "enemy");
  const all = [rogue, foe];
  const basic = marinaraOption(rogue, null, all)!.effect;
  const clean = marinaraHitNumbers(rogue, foe, basic, all).critChance;
  foe.statuses.push({ status: "poison", turns: 2 });
  assert.ok(marinaraHitNumbers(rogue, foe, basic, all).critChance >= clean + 20, "debuffed: more crits");
}

// Weaken: the foe's Strength or Magic, whichever it hits with.
{
  const hexer = unit("hx", "party", ["weaken"]);
  const foe = unit("f", "enemy");
  foe.stats.magic = foe.stats.strength + 10;
  const all = [hexer, foe];
  const before = marinaraEffectiveStat(foe, "magic", all);
  const mine = marinaraEffectiveStat(hexer, "magic", all);
  use(hexer, "weaken", [foe], all);
  assert.ok(marinaraEffectiveStat(foe, "magic", all) < before * 0.85, "a caster loses Magic");
  assert.ok(marinaraEffectiveStat(hexer, "magic", all) > mine * 1.15, "the Hexer gains the Magic Weaken saps");
}

// Crescendo: every buff on the party counts twice for a round.
{
  const cantor = unit("ca", "party", ["crescendo"]);
  const ally = unit("al", "party");
  const all = [cantor, ally, unit("f", "enemy")];
  ally.mods.push({ stat: "speed", pct: 0.2, turns: 3, source: "song" });
  const before = marinaraEffectiveStat(ally, "speed", all);
  use(cantor, "crescendo", [cantor], all);
  assert.ok(marinaraEffectiveStat(ally, "speed", all) > before * 1.1, "the Speed song doubles");
}

// Draw Fire / Hold Fast / Kill Zone: an ally draws the foes, takes less, and the party hits harder.
{
  const captain = unit("cp", "party", ["draw-fire", "hold-fast", "kill-zone"]);
  const tank = unit("tk", "party");
  const foe = unit("f", "enemy");
  const all = [captain, tank, foe];
  const option = marinaraOption(captain, "draw-fire", all);
  assert.ok(option, "the captain can use Draw Fire");
  assert.ok(!marinaraTargetsFor(captain, option!.effect, all).includes(captain), "Draw Fire goes on someone else");
  const hitBefore = marinaraExpectedHit(foe, tank, marinaraBasicAttack(foe), all);
  const dealtBefore = marinaraExpectedHit(captain, foe, marinaraBasicAttack(captain), all);
  use(captain, "draw-fire", [tank], all);
  assert.ok(tank.provoking > 0 && captain.provoking === 0, "the tank provokes, not the captain");
  assert.deepEqual(
    marinaraTargetsFor(foe, marinaraBasicAttack(foe), all).map((u) => u.id),
    ["tk"],
    "foes must attack the tank",
  );
  assert.ok(
    marinaraExpectedHit(foe, tank, marinaraBasicAttack(foe), all) < hitBefore,
    "Hold Fast: the tank takes less",
  );
  assert.ok(
    marinaraExpectedHit(captain, foe, marinaraBasicAttack(captain), all) > dealtBefore,
    "Kill Zone: the party deals more",
  );
}

// Morale: the bearer's side shrugs off some ailments.
{
  const bearer = unit("sb", "party", ["morale"]);
  const ally = unit("al", "party");
  const foe = unit("f", "enemy");
  const all = [bearer, ally, foe];
  const poison = {
    id: "t",
    skill: null,
    effect: { kind: "status", target: "enemy", status: "poison", chance: 1, duration: 3 },
  } as never;
  let resisted = 0;
  for (let i = 0; i < 200; i++) {
    ally.statuses = [];
    performMarinaraOption(foe, poison, [ally], all, ctx(`morale-${i}`));
    if (!ally.statuses.some((s) => s.status === "poison")) resisted++;
  }
  assert.ok(resisted > 30 && resisted < 90, `about 30% resisted (${resisted}/200)`);
}

// Raise the Banner: frees the party of confusion and keeps it off.
{
  const bearer = unit("bb", "party", ["raise-the-banner"]);
  const ally = unit("al", "party");
  ally.statuses.push({ status: "confuse", turns: 2 });
  const foe = unit("f", "enemy");
  const all = [bearer, ally, foe];
  use(bearer, "raise-the-banner", [bearer], all);
  assert.ok(!ally.statuses.some((s) => s.status === "confuse"), "confusion lifted");
  const confuse = {
    id: "t",
    skill: null,
    effect: { kind: "status", target: "enemy", status: "confuse", chance: 1, duration: 2 },
  } as never;
  performMarinaraOption(foe, confuse, [ally], all, ctx());
  assert.ok(!ally.statuses.some((s) => s.status === "confuse"), "and can't come back while the banner flies");
}

// Light Feet: harder to hit.
{
  const foe = unit("f", "enemy");
  const scout = unit("sc", "party", ["light-feet"]);
  const plain = unit("pl", "party");
  const basic = marinaraOption(foe, null, [foe, scout])!.effect;
  foe.stats.skill = 0;
  assert.ok(
    marinaraHitNumbers(foe, scout, basic, [foe, scout]).hitChance <
      marinaraHitNumbers(foe, plain, basic, [foe, plain]).hitChance,
    "Light Feet dodges more",
  );
}

// Assassinate: a crit that leaves a foe under 15% finishes it, whatever its HP; never a boss.
{
  const strikeAt = (tier: "standard" | "boss") => {
    const killer = unit("k", "party", ["assassinate"]);
    const foe = buildMarinaraEnemy({ id: "b", name: "b", level: 10, tier });
    foe.maxHp = 1000;
    foe.hp = 140;
    foe.stats.defense = 0;
    killer.stats.strength = 1;
    const basic = marinaraOption(killer, null, [killer, foe])!.effect;
    const option = { id: null, skill: null, effect: { ...basic, critBonus: 1000, hitBonus: 1000 } } as never;
    performMarinaraOption(killer, option, [foe], [killer, foe], ctx("as"));
    return foe.hp;
  };
  assert.ok(strikeAt("standard") <= 0, "a big standard foe is finished");
  assert.ok(strikeAt("boss") > 0, "a boss isn't");
}

// Steady (Alyssa 2026-11-01): every hit ignores 20% of the target's Defense or Resistance.
{
  const plain = unit("pl", "party");
  const steady = unit("sd", "party", ["steady"]);
  const foe = unit("f", "enemy");
  plain.stats.strength = steady.stats.strength = 40;
  foe.stats.defense = 30;
  const all = [plain, steady, foe];
  const basic = marinaraOption(plain, null, all)!.effect;
  const without = marinaraHitNumbers(plain, foe, basic, all).damage;
  const withPen = marinaraHitNumbers(steady, foe, basic, all).damage;
  assert.ok(withPen > without, `Steady hits through armour (${without} -> ${withPen})`);
}

// Return Fire (Alyssa 2026-11-01): answers the first attack on any ally, once between its turns.
{
  const shooter = unit("rf", "party", ["return-fire"]);
  shooter.rangedBasic = true;
  const tank = unit("tk", "party");
  const foe = unit("f", "enemy");
  foe.maxHp = foe.hp = 5000;
  const all = [shooter, tank, foe];
  const basic = marinaraOption(foe, null, all)!.effect;
  const hit = { id: null, skill: null, effect: { ...basic, hitBonus: 1000 } } as never;
  const first = ctx("rf1");
  performMarinaraOption(foe, hit, [tank], all, first);
  const shots = (c: MarinaraFightContext) => c.events.filter((e) => e.kind === "counter" && e.actorId === "rf").length;
  assert.equal(shots(first), 1, "an attack on an ally draws Return Fire");
  const second = ctx("rf2");
  performMarinaraOption(foe, hit, [tank], all, second);
  assert.equal(shots(second), 0, "only once between the shooter's turns");
}

// Vanish (Alyssa 2026-11-02): still targetable, so Provoke/Challenge pull foes onto the user, but
// they gain a large evasion bonus until their next turn.
{
  const rogue = unit("vn", "party", ["vanish"]);
  const ally = unit("al", "party");
  const foe = unit("f", "enemy");
  const all = [rogue, ally, foe];
  use(rogue, "vanish", [rogue], all);
  const basic0 = marinaraOption(foe, null, all)!.effect;
  rogue.hidden = false;
  const plainChance = marinaraHitNumbers(foe, rogue, basic0, all).hitChance;
  rogue.hidden = true;
  assert.ok(rogue.hidden, "Vanish marks the user");
  const basic = marinaraOption(foe, null, all)!.effect;
  assert.ok(marinaraTargetsFor(foe, basic, all).includes(rogue), "a vanished user can still be targeted");
  const vanishedChance = marinaraHitNumbers(foe, rogue, basic, all).hitChance;
  assert.ok(vanishedChance < plainChance, `Vanish makes the user harder to hit (${plainChance} -> ${vanishedChance})`);
}

// Vanish's text: the user's next hit that lands gets +40 crit chance, and only that one (playtest A/B
// 2026-11-06: no longer a sure crit).
{
  const rogue = unit("vc", "party", ["vanish"]);
  const foe = unit("f", "enemy");
  foe.hp = foe.maxHp = 100000;
  foe.stats.luck = 200; // no ordinary crits
  foe.stats.speed = 0;
  const all = [rogue, foe];
  use(rogue, "vanish", [rogue], all);
  assert.equal(rogue.mods.find((m) => m.source === "vanish")?.stat, "evasion", "no hidden damage buff");
  let tries = 0;
  const landed = (vanished: boolean) => {
    for (let n = 0; n < 40; n++) {
      if (vanished) rogue.critNext = true;
      const c = ctx(`vanish-crit-${tries++}`);
      performMarinaraOption(rogue, marinaraOption(rogue, null, all)!, [foe], all, c);
      const hit = c.events.find((e) => e.kind === "hit");
      if (hit) return hit;
    }
    throw new Error("nothing landed");
  };
  let crits = 0;
  for (let n = 0; n < 300; n++) if (landed(true).crit) crits++;
  assert.ok(crits > 300 * 0.28 && crits < 300 * 0.52, `about 40% of Vanish hits crit (${crits}/300)`);
  rogue.critNext = undefined;
  let plain = 0;
  for (let n = 0; n < 100; n++) if (landed(false).crit) plain++;
  assert.equal(plain, 0, "without it, no crits on this foe");
  rogue.critNext = true;
  landed(true);
  assert.equal(rogue.critNext, undefined, "used up by the hit that lands");
}

// Dead Eye: a hit on a weakness deals 25% more than it would.
{
  const shooter = unit("de", "party");
  const eye = unit("de2", "party", ["dead-eye"]);
  const foe = unit("f", "enemy");
  foe.affinities = { slash: "weak", pierce: "weak", blunt: "weak" };
  const all = [shooter, eye, foe];
  const basic = marinaraBasicAttack(shooter);
  const plain = marinaraHitNumbers(shooter, foe, basic, all).multiplier;
  const keen = marinaraHitNumbers(eye, foe, basic, all).multiplier;
  assert.ok(Math.abs(keen / plain - 1.25) < 1e-9, `Dead Eye: 25% more on a weakness (${plain} -> ${keen})`);
}

// Adaptive Grip: armored (physical resist) and evasive (evasion bonuses) foes gain nothing against the user.
{
  const plainHand = unit("ag0", "party");
  const grip = unit("ag", "party", ["adaptive-grip"]);
  const foe = unit("f", "enemy", ["light-feet"]);
  foe.affinities = { slash: "resist", pierce: "resist", blunt: "resist" };
  const all = [plainHand, grip, foe];
  const basic = marinaraBasicAttack(grip);
  const plain = marinaraHitNumbers(plainHand, foe, basic, all);
  const gripped = marinaraHitNumbers(grip, foe, basic, all);
  assert.ok(plain.multiplier < 1 && gripped.multiplier === 1, "the armor's resistance doesn't count");
  assert.equal(gripped.hitChance, Math.min(100, plain.hitChance + 10 + 10), "+10% accuracy, and Light Feet's 10 gone");
}

// Peerless: every third action grants a full extra action, not a fixed basic attack.
{
  const paragon = unit("pg", "party", ["peerless"]);
  const foe = unit("f", "enemy");
  foe.hp = foe.maxHp = 100000;
  const all = [paragon, foe];
  paragon.actions = 3;
  performMarinaraOption(paragon, marinaraOption(paragon, null, all)!, [foe], all, ctx());
  assert.equal(paragon.bonusTurns, 1, "the third action grants another");
  paragon.bonusTurns = undefined;
  paragon.actions = 4;
  performMarinaraOption(paragon, marinaraOption(paragon, null, all)!, [foe], all, ctx());
  assert.equal(paragon.bonusTurns, undefined, "the fourth doesn't");
  // The extra action itself never grants another (a chain of them was endless).
  paragon.actions = 3;
  paragon.bonusTurns = 1;
  beginMarinaraTurn(paragon, all, ctx());
  assert.equal(paragon.commanded, true, "the extra action is a commanded turn");
  performMarinaraOption(paragon, marinaraOption(paragon, null, all)!, [foe], all, ctx());
  assert.equal(paragon.bonusTurns, undefined, "and it grants no more");
}

// Double Time (Alyssa 2026-11-02): a bonus action that grants one extra action, so two actions that turn.
{
  const bard = unit("dt", "party", ["double-time"]);
  const foe = unit("f", "enemy");
  const all = [bard, foe];
  const before = bard.next;
  use(bard, "double-time", [bard], all);
  assert.equal(bard.bonusTurns, 2, "Double Time refunds itself and adds one action");
  assert.equal(bard.next, before, "the timeline does not move");
  bard.commanded = true;
  bard.cooldowns = {};
  assert.equal(marinaraOption(bard, "double-time", all), undefined, "not offered on an extra action");
}

// Hard crowd control (Alyssa 2026-11-02): attacks on a stunned or sleeping target always land, either side.
{
  for (const side of ["enemy", "party"] as const) {
    const attacker = unit("atk", side === "enemy" ? "party" : "enemy");
    const target = unit("tgt", side, ["elusive"]);
    target.stats.speed = 500;
    const all = [attacker, target];
    const basic = marinaraOption(attacker, null, all)!.effect;
    assert.ok(marinaraHitNumbers(attacker, target, basic, all).hitChance < 100, "a nimble target can dodge");
    for (const which of ["stun", "sleep"] as const) {
      target.statuses = [];
      status(target, which);
      assert.equal(marinaraHitNumbers(attacker, target, basic, all).hitChance, 100, `${which}: always hit (${side})`);
      const c = ctx(`cc:${which}:${side}`);
      performMarinaraOption(attacker, marinaraOption(attacker, null, all)!, [target], all, c);
      // A hit wakes a sleeper: put it back to sleep for the decoy check.
      target.statuses = [];
      status(target, which);
      target.decoys = 3;
      target.mods.push({ stat: "shadows", pct: 1, turns: 3, source: "thousand-shadows" });
      performMarinaraOption(attacker, marinaraOption(attacker, null, all)!, [target], all, c);
      assert.ok(
        !c.events.some((e) => e.kind === "miss" || e.kind === "evade" || e.kind === "decoy"),
        `${which}: no miss, Elusive dodge or decoy`,
      );
      target.mods = target.mods.filter((m) => m.stat !== "shadows");
    }
  }
}

// Strength or Magic follows the weapon (Alyssa 2026-11-02): a focus means Magic, anything else Strength.
{
  const caster = unit("pc", "party", ["pierce"]);
  caster.gear = { power: 0, spellPower: 8, weaponType: "blunt" };
  const option = marinaraOption(caster, "pierce", [caster])!;
  assert.equal(option.effect.damage, "magic", "Pierce with a focus deals magic damage");
  assert.equal(option.effect.scales, "magic", "and runs on Magic");
  const fighter = unit("pf", "party", ["pierce"]);
  fighter.gear = { power: 8, spellPower: 0, weaponType: "slash" };
  fighter.stats.magic = fighter.stats.strength + 50;
  assert.equal(marinaraOption(fighter, "pierce", [fighter])!.effect.damage, "physical", "a sword keeps it on Strength");
  const medic = unit("md", "party", ["mend"]);
  medic.gear = { power: 8, spellPower: 0, weaponType: "slash" };
  assert.equal(
    marinaraOption(medic, "mend", [medic])!.effect.scales,
    "strength",
    "a heal with a sword runs on Strength",
  );
  // Armour alone is no weapon: the class decides, so a Mender in robes still heals on Magic.
  medic.gear = { power: 0, spellPower: 0 };
  medic.archetype = "mender";
  assert.equal(marinaraOption(medic, "mend", [medic])!.effect.scales, "magic", "unarmed, the class decides");
}

// Channel Element (Alyssa 2026-11-02): a Channeler's basic attacks and element spells strike with the
// channeled element; a bonus action once between their turns; carried element spells find weaknesses.
{
  const mage = buildMarinaraEnemy({ id: "ch", name: "ch", level: 10, tier: "standard", archetype: "channeler" });
  mage.side = "party";
  mage.classId = "channeler";
  mage.channelManual = true;
  const foe = unit("f", "enemy");
  foe.affinities = { ice: "weak", fire: "resist" };
  const all = [mage, foe];
  const basic = marinaraOption(mage, null, all)!.effect;
  assert.equal(marinaraHitNumbers(mage, foe, basic, all).type, "arcane", "raw magic until first channeled");
  assert.ok(marinaraChannelElement(mage, "ice"), "channels ice");
  assert.equal(marinaraHitNumbers(mage, foe, basic, all).type, "ice", "basic attacks strike with ice");
  assert.equal(marinaraChannelElement(mage, "lightning"), false, "once between their turns");
  // Greater Channel Element (Astral Adept, Starweaver): light and dark too.
  {
    const adept = buildMarinaraEnemy({ id: "aa", name: "aa", level: 10, tier: "standard", archetype: "channeler" });
    adept.classId = "astral-adept";
    assert.equal(marinaraChannelElement(adept, "light"), false, "plain Channel Element has no light");
    adept.skills = [...adept.skills, skill("greater-channel-element")];
    assert.ok(marinaraChannelElement(adept, "dark"), "Greater Channel Element channels dark");
    assert.ok(
      MARINARA_CLASSES.filter((def) => def.id === "astral-adept" || def.id === "starweaver").every((def) =>
        def.skills.some((one) => one.id.startsWith("greater-channel-element")),
      ),
      "Astral Adept and Starweaver both learn Greater Channel Element",
    );
  }
  assert.equal(marinaraChannelElement(mage, "slash" as never), false, "only elements");
  // Run by the AI, a caster channels the element its target fears as it strikes, once a turn.
  const ai = buildMarinaraEnemy({ id: "ai", name: "ai", level: 10, tier: "standard", archetype: "channeler" });
  ai.side = "party";
  ai.classId = "channeler";
  const aiAll = [ai, foe];
  performMarinaraOption(ai, marinaraOption(ai, null, aiAll)!, [foe], aiAll, ctx("aich"));
  assert.equal(ai.channeled, "ice", "the AI channels the target's weakness");
  // Element Mastery: ice Freezes, fire Burns, lightning Shocks.
  const master = buildMarinaraEnemy({ id: "em", name: "em", level: 10, tier: "standard", archetype: "channeler" });
  master.side = "party";
  master.classId = "channeler";
  master.channelManual = true;
  master.skills = [...master.skills, skill("element-mastery")];
  const dummy = unit("d", "enemy");
  dummy.maxHp = dummy.hp = 5000;
  const emAll = [master, dummy];
  const sure = {
    ...marinaraOption(master, null, emAll)!,
    effect: { ...marinaraOption(master, null, emAll)!.effect, hitBonus: 1000 },
  };
  master.channeled = "ice";
  performMarinaraOption(master, sure, [dummy], emAll, ctx("em1"));
  assert.ok(
    dummy.statuses.some((st) => st.status === "freeze"),
    "ice freezes",
  );
  master.channeled = "fire";
  performMarinaraOption(master, sure, [dummy], emAll, ctx("em2"));
  assert.ok(
    dummy.statuses.some((st) => st.status === "burn"),
    "fire burns",
  );
  master.channeled = "lightning";
  const before = marinaraHitNumbers(foe, dummy, marinaraOption(foe, null, [foe, dummy])!.effect, [
    foe,
    dummy,
  ]).critChance;
  performMarinaraOption(master, sure, [dummy], emAll, ctx("em3"));
  assert.ok(
    dummy.statuses.some((st) => st.status === "shock"),
    "lightning shocks",
  );
  const after = marinaraHitNumbers(foe, dummy, marinaraOption(foe, null, [foe, dummy])!.effect, [
    foe,
    dummy,
  ]).critChance;
  assert.equal(after, Math.min(100, before + 10), "Shock adds a flat 10 critical chance against the target");
  // The wuxing elements (Alyssa 2026-11-02): wood Entangle, earth Crumble, water Soak, metal Rend.
  for (const [element, status] of [
    ["wood", "entangle"],
    ["earth", "crumble"],
    ["water", "soak"],
    ["metal", "rend"],
    ["wind", "windswept"],
    ["light", "sear"],
    ["dark", "wound"],
  ] as const) {
    master.channeled = element;
    performMarinaraOption(master, sure, [dummy], emAll, ctx(`em-${element}`));
    assert.ok(
      dummy.statuses.some((st) => st.status === status),
      `${element} inflicts ${status}`,
    );
  }
  const wuxingHit = marinaraHitNumbers(dummy, foe, marinaraOption(dummy, null, [foe, dummy])!.effect, [foe, dummy]);
  dummy.statuses = dummy.statuses.filter((st) => st.status !== "entangle" && st.status !== "rend");
  const cleanHit = marinaraHitNumbers(dummy, foe, marinaraOption(dummy, null, [foe, dummy])!.effect, [foe, dummy]);
  assert.ok(
    Math.abs(cleanHit.hitChance - wuxingHit.hitChance - 15) < 1e-9,
    `Entangle takes 15 off hit chance (${cleanHit.hitChance} -> ${wuxingHit.hitChance})`,
  );
  assert.ok(wuxingHit.damage < cleanHit.damage, "Rend lowers damage dealt");
  // Wuxing generating cycle: wood feeds fire, so fire hits an Entangled foe 15% harder.
  {
    const target = unit("wx", "enemy");
    const all2 = [mage, target];
    const saved = { manual: mage.channelManual, channeled: mage.channeled };
    mage.channelManual = true;
    mage.channeled = "fire";
    const cold = marinaraHitNumbers(mage, target, basic, all2).multiplier;
    target.statuses.push({ status: "entangle", duration: 2 });
    const fed = marinaraHitNumbers(mage, target, basic, all2).multiplier;
    assert.ok(Math.abs(fed / cold - 1.15) < 1e-9, `wood feeds fire (${cold} -> ${fed})`);
    // Lightning and wind are wood, ice is water: fire hits a Shocked foe harder, ice a Rent one.
    target.statuses = [{ status: "shock", duration: 2 }];
    assert.ok(
      Math.abs(marinaraHitNumbers(mage, target, basic, all2).multiplier / cold - 1.15) < 1e-9,
      "Shock (wood phase) feeds fire",
    );
    mage.channeled = "ice";
    const iceCold = marinaraHitNumbers(mage, target, basic, all2).multiplier;
    target.statuses = [{ status: "rend", duration: 2 }];
    assert.ok(
      Math.abs(marinaraHitNumbers(mage, target, basic, all2).multiplier / iceCold - 1.15) < 1e-9,
      "metal feeds ice (water phase)",
    );
    mage.channelManual = saved.manual;
    mage.channeled = saved.channeled;
  }
  // Windswept: attacks against the target gain 15 hit chance.
  const sweptHit = marinaraHitNumbers(foe, dummy, marinaraOption(foe, null, [foe, dummy])!.effect, [foe, dummy]);
  dummy.statuses = dummy.statuses.filter((st) => st.status !== "windswept");
  const calmHit = marinaraHitNumbers(foe, dummy, marinaraOption(foe, null, [foe, dummy])!.effect, [foe, dummy]);
  assert.ok(
    Math.abs(Math.min(100, calmHit.hitChance + 15) - sweptHit.hitChance) < 1e-9,
    `Windswept adds 15 hit chance against them (${calmHit.hitChance} -> ${sweptHit.hitChance})`,
  );
  // Resonance: the channeled element deals 20% more to a foe weak to it.
  const plain = marinaraHitNumbers(mage, foe, basic, all);
  mage.skills = [...mage.skills, skill("resonance")];
  const resonant = marinaraHitNumbers(mage, foe, basic, all);
  assert.ok(Math.abs(resonant.multiplier / plain.multiplier - 1.2) < 1e-9, "Resonance adds 20% on a weakness");
}

console.log("game-marinara-abilities: ok");
