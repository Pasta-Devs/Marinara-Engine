/**
 * Class lab: measures Classic Marinara's classes in simulated fights (Alyssa 2026-10-31).
 *
 *   node packages/server/node_modules/tsx/dist/cli.mjs scripts/class-lab/class-lab.ts <phase> [out.md] [characters]
 *
 * Phases: 1 damage (dummies: one big, three spread out, five grouped), 2 tank (survival against
 * standard attackers, and how much a front-liner spares the back row), 3 utility (a party of four
 * where one slot rotates, compared with a Channeler in that slot). A promoted character carries up to four skills from the classes it came through (its
 * marked carry picks first). Every class is run at the two
 * levels its tier is played at (base 1 and 10, advanced 10 and 20, master 20 and 30), with many
 * characters each, so the spread of hidden aptitudes shows (p10, median, p90).
 */
import { pickCarries } from "./carries.js";
import { writeFileSync } from "node:fs";
import {
  MARINARA_ARCHETYPES,
  MARINARA_CLASSES,
  MARINARA_STATS,
  marinaraCarriedStat,
  marinaraFightHpMultiplier,
  MARINARA_TEMPERAMENT_TREES,
  MARINARA_PARTY_TEMPERAMENTS,
  awardMarinaraXp,
  createMarinaraProgression,
  expectedMarinaraStats,
  MARINARA_CARRY_SLOTS,
  marinaraClass,
  marinaraLearnedSkills,
  marinaraRandom,
  setMarinaraCarried,
  marinaraClassTraits,
  marinaraUsableSkills,
  setMarinaraClass,
  type MarinaraAffinities,
  type MarinaraArchetype,
  type MarinaraClassDef,
  type MarinaraProgression,
  type MarinaraStats,
} from "../../packages/shared/src/features/marinara-classes.js";
import { makeUnit, runFight, skillTally, type LabUnit } from "./combat.js";

const RANGED: ReadonlySet<MarinaraArchetype> = new Set(["marksman"]);
const CASTERS: ReadonlySet<MarinaraArchetype> = new Set(["channeler", "hexer", "mender", "herald"]);
const FRONT: ReadonlySet<MarinaraArchetype> = new Set(["blade", "guard", "scout"]);

const levelsFor = (def: MarinaraClassDef) =>
  def.tier === "base" ? [1, 10] : def.tier === "advanced" ? [10, 20] : [20, 30];

/** The chain of classes from the base class to this one. */
function pathTo(def: MarinaraClassDef): MarinaraClassDef[] {
  const chain = [def];
  while (chain[0]!.from) chain.unshift(marinaraClass(chain[0]!.from)!);
  return chain;
}

function temperamentFor(def: MarinaraClassDef, index: number) {
  const fits = MARINARA_PARTY_TEMPERAMENTS.filter((t) =>
    def.pure ? MARINARA_TEMPERAMENT_TREES[t] === def.archetype : MARINARA_TEMPERAMENT_TREES[t] !== def.archetype,
  );
  return fits[index % fits.length]!;
}

/** A character of this class at this level, grown with real level-ups and promotions. */
export function buildCharacter(def: MarinaraClassDef, level: number, seed: string): MarinaraProgression {
  const random = marinaraRandom(`grow:${seed}`);
  let character = createMarinaraProgression({
    seed,
    primary: def.archetype,
    temperament: temperamentFor(def, Number.parseInt(seed.replace(/\D/g, "").slice(-3) || "0", 10)),
  });
  const chain = pathTo(def);
  for (let step = 0; step < chain.length; step++) {
    const target = step === chain.length - 1 ? level : Math.min(level, (step + 1) * 10);
    if (step > 0) character = setMarinaraClass(character, chain[step]!.id);
    if (target > character.level)
      character = awardMarinaraXp(character, (target - character.level) * 100, random).progression;
  }
  // A player carries the best of what earlier classes taught: their marked picks first, then actives.
  // A tree trait the class already keeps (Cover, Hold the Line) takes no carry slot.
  const traits = marinaraClassTraits(character.activeClass);
  const earlier = marinaraLearnedSkills(character).filter(
    (skill) =>
      skill.classId !== character.activeClass &&
      !(
        traits.includes(skill.id) &&
        marinaraClass(skill.classId)?.archetype === marinaraClass(character.activeClass)!.archetype
      ),
  );
  const ranked = [...earlier].sort(
    (a, b) =>
      Number(Boolean(b.carryPick)) - Number(Boolean(a.carryPick)) ||
      Number(b.kind === "active") - Number(a.kind === "active") ||
      b.learnedAt - a.learnedAt,
  );
  return setMarinaraCarried(character, pickCarries(character, ranked));
}

export function unitFrom(
  character: MarinaraProgression,
  id: string,
  side: LabUnit["side"],
  row?: LabUnit["row"],
): LabUnit {
  const def = marinaraClass(character.activeClass)!;
  return makeUnit({
    id,
    name: def.label,
    side,
    row: row ?? (FRONT.has(def.archetype) ? "front" : "back"),
    stats: character.stats,
    skills: marinaraUsableSkills(character),
    archetype: def.archetype,
    classId: def.id,
    carriedIds: new Set(character.carried),
    carriedStats: Object.fromEntries(MARINARA_STATS.map((stat) => [stat, marinaraCarriedStat(character, stat)])),
    rangedBasic: RANGED.has(def.archetype),
    magicBasic: CASTERS.has(def.archetype),
    level: character.level,
  });
}

function averageExpected(level: number): MarinaraStats {
  const all = MARINARA_ARCHETYPES.map((a) => expectedMarinaraStats(a, level));
  const out = { ...all[0]! };
  for (const key of Object.keys(out) as Array<keyof MarinaraStats>)
    out[key] = all.reduce((sum, stats) => sum + stats[key], 0) / all.length;
  return out;
}

function quantiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return {
    p10: at(0.1),
    median: at(0.5),
    p90: at(0.9),
    mean: values.reduce((s, v) => s + v, 0) / Math.max(1, values.length),
  };
}

const fmt = (n: number, digits = 1) => (Number.isFinite(n) ? n.toFixed(digits) : "–");

// ── Phase 1: damage ──

function dummy(id: string, level: number, hp: number, affinities?: MarinaraAffinities): LabUnit {
  return makeUnit({
    id,
    name: "Dummy",
    side: "enemy",
    row: "front",
    stats: averageExpected(level),
    dummy: true,
    hpOverride: Math.round(hp),
    level,
    affinities,
  });
}

/** Six foes with typical affinity profiles: beast, flyer, armoured, spirit, fire elemental, undead. */
export const AFFINITY_PROFILES: MarinaraAffinities[] = [
  { slash: "weak", fire: "weak", poison: "weak" },
  { pierce: "weak", lightning: "weak", blunt: "resist" },
  { slash: "resist", pierce: "resist", blunt: "weak", lightning: "weak" },
  { slash: "immune", pierce: "immune", blunt: "immune", light: "weak", dark: "immune", poison: "immune" },
  { fire: "absorb", ice: "weak", slash: "resist", poison: "immune" },
  { pierce: "resist", ice: "resist", blunt: "weak", light: "weak", dark: "absorb", poison: "immune" },
];

function phase1(count: number): string {
  const rows: string[] = [];
  for (const def of MARINARA_CLASSES) {
    for (const level of levelsFor(def)) {
      const hp = averageExpected(level).hp * marinaraFightHpMultiplier(level);
      const result = {
        single: [] as number[],
        spread: [] as number[],
        grouped: [] as number[],
        neutral: [] as number[],
        affinity: [] as number[],
        coated: [] as number[],
        perMp: [] as number[],
      };
      for (let i = 0; i < count; i++) {
        const character = buildCharacter(def, level, `${def.id}:${level}:${i}`);
        const random = marinaraRandom(`p1:${def.id}:${level}:${i}`);
        const scenarios: Array<[keyof typeof result, LabUnit[], boolean]> = [
          ["single", [dummy("d1", level, hp * 6)], true],
          ["spread", [0, 1, 2].map((n) => dummy(`d${n}`, level, hp * 2)), false],
          ["grouped", [0, 1, 2, 3, 4].map((n) => dummy(`d${n}`, level, hp * 1.2)), true],
          ["neutral", [0, 1, 2, 3, 4, 5].map((n) => dummy(`d${n}`, level, hp)), false],
          ["affinity", AFFINITY_PROFILES.map((a, n) => dummy(`d${n}`, level, hp, a)), false],
          ["coated", AFFINITY_PROFILES.map((a, n) => dummy(`d${n}`, level, hp, a)), false],
        ];
        for (const [name, enemies, grouped] of scenarios) {
          const hero = unitFrom(character, "hero", "party", "front");
          if (name === "coated") {
            if (CASTERS.has(def.archetype)) continue;
            hero.coating = "light"; // holy water
          }
          const log = runFight([hero], enemies, { random, grouped, maxActions: 600 });
          result[name].push(log.winner === "party" ? log.rounds : Number.POSITIVE_INFINITY);
          if (name === "single") {
            const spent = log.mpSpent.hero ?? 0;
            if (spent > 0) result.perMp.push((log.mpSkillDamage.hero ?? 0) / spent);
          }
        }
      }
      const single = quantiles(result.single);
      const spread = quantiles(result.spread);
      const grouped = quantiles(result.grouped);
      const perMp = quantiles(result.perMp);
      const affinity = quantiles(result.affinity);
      const neutral = quantiles(result.neutral);
      const coated = quantiles(result.coated);
      rows.push(
        `| ${def.label} | ${def.tier}${def.pure ? " (pure)" : ""} | ${level} | ${fmt(single.median)} (${fmt(single.p10)}–${fmt(single.p90)}) | ${fmt(spread.median)} (${fmt(spread.p10)}–${fmt(spread.p90)}) | ${fmt(grouped.median)} (${fmt(grouped.p10)}–${fmt(grouped.p90)}) | ${fmt(affinity.median)} (×${fmt(affinity.median / neutral.median, 2)}) | ${result.coated.length ? fmt(coated.median) : "–"} | ${result.perMp.length ? fmt(perMp.median) : "–"} |`,
      );
    }
  }
  return [
    "# Class lab, phase 1: damage potential",
    "",
    `Rounds to clear dummies that never fight back (median, with p10–p90 across ${count} characters per row, each with its own hidden aptitudes). A round is one turn of a Speed 15 character. Lower is better. A promoted class carries up to four skills from the classes it came through (their marked carry picks first). Dummies have the average expected Defense and Resistance of the level. Single: one dummy with 6× a typical HP. Spread: three with 2× each, where a front-row area hits only one. Grouped: five with 1.2× each, all in reach of area attacks. Affinities: six dummies with a typical HP each and typical affinity profiles (beast: weak to slash, fire and poison; flyer: weak to pierce and lightning, resists blunt; armoured: resists slash and pierce, weak to blunt and lightning; spirit: immune to all physical, dark and poison, weak to light; fire elemental: absorbs fire, weak to ice, resists slash, immune to poison; undead: resists pierce and ice, weak to blunt and light, absorbs dark, immune to poison), spread out; the × figure compares it with the same four dummies without affinities (above 1 means affinities slow this class down). Affinities, holy water: the same six with the weapon coated in holy water (a Light rider), for classes that fight with weapons. Physical skills cost stamina, magic skills MP. Damage per MP is the damage of its MP-costing skills on the single dummy, per MP spent; – means it has no damaging skill that costs MP.`,
    "",
    "| Class | Tier | Level | Single | Spread (3) | Grouped (5) | Affinities (6) | Affinities, holy water | Damage per MP |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

// ── Phase 2: tank ──

function attacker(id: string, archetype: MarinaraArchetype, level: number): LabUnit {
  return makeUnit({
    id,
    name: archetype,
    side: "enemy",
    row: FRONT.has(archetype) ? "front" : "back",
    stats: expectedMarinaraStats(archetype, level),
    archetype,
    classId: archetype,
    rangedBasic: RANGED.has(archetype),
    magicBasic: CASTERS.has(archetype),
    hpOverride: 1_000_000,
    level,
  });
}

const standardAttackers = (level: number) => [
  attacker("bruiser", "blade", level),
  attacker("caster", "channeler", level),
];

function phase2(count: number): string {
  const rows: string[] = [];
  for (const def of MARINARA_CLASSES) {
    for (const level of levelsFor(def)) {
      const survive: number[] = [];
      const surviveMagic: number[] = [];
      const backTaken: number[] = [];
      const protectClassic: number[] = [];
      const protectTactical: number[] = [];
      for (let i = 0; i < count; i++) {
        const character = buildCharacter(def, level, `${def.id}:${level}:${i}`);
        const random = marinaraRandom(`p2:${def.id}:${level}:${i}`);
        const physical = runFight(
          [unitFrom(character, "hero", "party", "front")],
          [attacker("b1", "blade", level), attacker("b2", "blade", level)],
          { random, grouped: true, maxActions: 800 },
        );
        survive.push(physical.rounds);
        const magical = runFight(
          [unitFrom(character, "hero", "party", "front")],
          [attacker("c1", "channeler", level), attacker("c2", "channeler", level)],
          { random, grouped: true, maxActions: 800 },
        );
        surviveMagic.push(magical.rounds);
        const casters = [0, 1].map((n) =>
          unitFrom(
            buildCharacter(marinaraClass("channeler")!, Math.min(level, 10), `ally:${level}:${i}:${n}`),
            `back${n}`,
            "party",
            "back",
          ),
        );
        for (const unit of casters) unit.skills = []; // the back row only takes hits here
        for (const unit of casters) unit.dummy = true;
        const front = unitFrom(character, "hero", "party", "front");
        const guarded = runFight([front, ...casters], standardAttackers(level), {
          random,
          grouped: true,
          maxActions: 60,
        });
        const taken = (guarded.damageTaken.back0 ?? 0) + (guarded.damageTaken.back1 ?? 0);
        backTaken.push(taken / Math.max(0.5, guarded.rounds));
        // Protect: two back-row allies with real HP that do not act, against a bruiser, an archer
        // and a caster that go for the back row; rounds until the first ally falls.
        for (const [mode, list] of [
          ["classic", protectClassic],
          ["tactical", protectTactical],
        ] as const) {
          const allies = [0, 1].map((n) => {
            const unit = unitFrom(
              buildCharacter(marinaraClass("channeler")!, Math.max(1, level), `ward:${level}:${i}:${n}`),
              `ally${n}`,
              "party",
              "back",
            );
            unit.skills = [];
            unit.dummy = true;
            return unit;
          });
          const hero = unitFrom(character, "hero", "party", "front");
          const foes = [
            attacker("f1", "blade", level),
            attacker("f2", "marksman", level),
            attacker("f3", "channeler", level),
          ];
          const fight = runFight([hero, ...allies], foes, {
            random: marinaraRandom(`p2${mode}:${def.id}:${level}:${i}`),
            grouped: true,
            maxActions: 400,
            focus: true,
            tactical: mode === "tactical",
            stopWhenDowned: allies.map((u) => u.id),
          });
          list.push(fight.rounds);
        }
      }
      const s = quantiles(survive);
      const m = quantiles(surviveMagic);
      const b = quantiles(backTaken);
      const pc = quantiles(protectClassic);
      const pt = quantiles(protectTactical);
      rows.push(
        `| ${def.label} | ${def.tier}${def.pure ? " (pure)" : ""} | ${level} | ${fmt(s.median)} (${fmt(s.p10)}–${fmt(s.p90)}) | ${fmt(m.median)} (${fmt(m.p10)}–${fmt(m.p90)}) | ${fmt(b.median)} | ${fmt(pc.median)} | ${fmt(pt.median)} |`,
      );
    }
  }
  return [
    "# Class lab, phase 2: tank potential",
    "",
    `Each class alone in the front row against two standard attackers of its level that cannot be killed, with expected stats and no special skills, using its own skills to stay up. Survival is rounds until it falls (median, with p10–p90 across ${count} characters), against two bruisers (physical) and against two casters (magic). Back row taken is the damage per round two back-row allies take while this class holds the front against a bruiser and a caster: lower means it shields them better. Back row lasts: rounds until the first of two back-row allies falls while this class holds the front, against a bruiser, an archer and a caster that go for the back row and the weakest target; in Classic melee foes deal half damage to the back row, in Tactical nothing shields the back row except the class's own skills (taunts, Sworn Ward, Hold the Line). Higher is better.`,
    "",
    "| Class | Tier | Level | Rounds vs physical | Rounds vs magic | Back row taken per round | Back row lasts (Classic) | Back row lasts (Tactical) |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

// ── Phase 3: utility ──

const TEAMMATES: Array<{ line: string[] }> = [
  { line: ["blade", "duelist", "headsman"] },
  { line: ["guard", "sentinel", "stonewall"] },
  { line: ["marksman", "sharpshooter", "farshot"] },
];

function teamClass(line: string[], level: number) {
  return marinaraClass(level < 10 ? line[0]! : level < 20 ? line[1]! : line[2]!)!;
}

function enemyParty(level: number, hpScale: number): LabUnit[] {
  const make = (id: string, archetype: MarinaraArchetype) => {
    const unit = attacker(id, archetype, level);
    unit.maxHp = unit.hp = Math.round(
      expectedMarinaraStats(archetype, level).hp * marinaraFightHpMultiplier(level) * hpScale,
    );
    return unit;
  };
  const foes = [make("e1", "blade"), make("e2", "guard"), make("e3", "marksman"), make("e4", "channeler")];
  // Each foe has one ability a healer would want to undo: bleeding, sundered armour, poison, a wounding curse.
  foes[0]!.enemySkills = ["rend"];
  foes[1]!.enemySkills = ["sunder"];
  foes[2]!.enemySkills = ["venom-arrow"];
  foes[3]!.enemySkills = ["curse"];
  return foes;
}

function partyFight(slot: MarinaraClassDef, level: number, i: number, hpScale: number, tactical = false) {
  return partyFightWith(
    buildCharacter(slot, level, `${slot.id}:${level}:${i}`),
    `${slot.id}`,
    level,
    i,
    hpScale,
    tactical,
  );
}

function partyFightWith(
  character: MarinaraProgression,
  key: string,
  level: number,
  i: number,
  hpScale: number,
  tactical = false,
) {
  const teammates = TEAMMATES.map((t, n) =>
    unitFrom(buildCharacter(teamClass(t.line, level), level, `team:${level}:${i}:${n}`), `t${n}`, "party"),
  );
  const slotted = unitFrom(character, "slot", "party");
  return runFight([...teammates, slotted], enemyParty(level, hpScale), {
    random: marinaraRandom(`p3:${key}:${level}:${i}`),
    grouped: true,
    maxActions: 800,
    focus: true,
    tactical,
  });
}

function phase3(count: number): string {
  // Tune the enemies at each level so the party with a Channeler (advanced/master as the level asks) in the slot wins about 65%.
  const scales = new Map<string, number>();
  for (const tactical of [false, true])
    for (const [tier, level] of [
      ["base", 1],
      ["base", 10],
      ["advanced", 10],
      ["advanced", 20],
      ["master", 20],
      ["master", 30],
    ] as const) {
      const reference = tier === "base" ? "channeler" : tier === "advanced" ? "elementalist" : "stormcaller";
      let lo = 0.3;
      let hi = 6;
      for (let step = 0; step < 12; step++) {
        const mid = (lo + hi) / 2;
        let wins = 0;
        for (let i = 0; i < count; i++)
          if (partyFight(marinaraClass(reference)!, level, i, mid, tactical).winner === "party") wins++;
        if (wins / count > 0.65) lo = mid;
        else hi = mid;
      }
      scales.set(`${tactical ? "t" : "c"}:${tier}:${level}`, (lo + hi) / 2);
    }
  const rows: string[] = [];
  for (const def of MARINARA_CLASSES) {
    for (const level of levelsFor(def)) {
      let wins = 0;
      let tacticalWins = 0;
      const lost: number[] = [];
      const rounds: number[] = [];
      for (let i = 0; i < count; i++) {
        const log = partyFight(def, level, i, scales.get(`c:${def.tier}:${level}`)!);
        if (log.winner === "party") {
          wins++;
          rounds.push(log.rounds);
        }
        lost.push(log.partyHpLostPct * 100);
        if (partyFight(def, level, i, scales.get(`t:${def.tier}:${level}`)!, true).winner === "party") tacticalWins++;
      }
      rows.push(
        `| ${def.label} | ${def.tier}${def.pure ? " (pure)" : ""} | ${level} | ${fmt((wins / count) * 100, 0)}% | ${fmt((tacticalWins / count) * 100, 0)}% | ${fmt(quantiles(lost).median, 0)}% | ${fmt(quantiles(rounds).median)} |`,
      );
    }
  }
  return [
    "# Class lab, phase 3: utility potential",
    "",
    `A party of four: a Blade line, a Guard line and a Marksman line (promoted as their level allows), plus the class being tested in the fourth slot, against four foes of the level (a bruiser, a guard, an archer and a caster with expected stats) that focus their attacks: the back row first, then whoever would fall soonest. The foes' health is tuned for each tier and level so the party wins about 65% of fights with the Channeler line's class of the same tier in the slot (Channeler, Fusionist, Stormcaller), so a row compares a class with the Channeler of its own tier (scales, c = Classic and t = Tactical: ${[...scales].map(([k, s]) => `${k} ×${s.toFixed(2)}`).join(", ")}). Each foe also has one ability a healer would want to undo: the bruiser's Rend (bleeding, 5% of max HP a turn for 3), the guard's Sunder (−25% Defense for 2), the archer's Venom Arrow (poison, 6% for 3) and the caster's Curse (Wound: healing received halved for 3, and −20% damage for 2). In Classic, melee attacks reach the back row at half damage (early Final Fantasy rows); in Tactical there is no row shield and Hold the Line stops melee foes heading for the back row. An area attack that strikes several foes deals 60% to each. ${count} fights per row and mode, each mode calibrated on its own. A class that adds more than a Channeler wins more, loses less HP or ends sooner.`,
    "",
    "| Class in slot | Tier | Level | Win rate (Classic) | Win rate (Tactical) | Party HP lost (Classic, median) | Rounds to win (Classic, median) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

// ── Phase 4: cross-training ──

/** The scale that puts the party with a Channeler-line class of this tier and level at about 65% wins. */
function calibrate(tier: "base" | "advanced" | "master", level: number): number {
  const reference = tier === "base" ? "channeler" : tier === "advanced" ? "elementalist" : "stormcaller";
  let lo = 0.3;
  let hi = 8;
  for (let step = 0; step < 12; step++) {
    const mid = (lo + hi) / 2;
    let wins = 0;
    for (let i = 0; i < 60; i++) if (partyFight(marinaraClass(reference)!, level, i, mid).winner === "party") wins++;
    if (wins / 60 > 0.65) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * A level 20 character of `primary` who spent 10 levels in their secondary tree's base class
 * before promoting at 10: active in the primary tree's first advanced class at class level 10,
 * carrying the best of the secondary class (its marked picks and actives first).
 */
function crossTrained(primary: MarinaraArchetype, secondary: MarinaraArchetype, seed: string): MarinaraProgression {
  const temperament = MARINARA_PARTY_TEMPERAMENTS.find((t) => MARINARA_TEMPERAMENT_TREES[t] === secondary)!;
  const random = marinaraRandom(`grow:${seed}`);
  let character = createMarinaraProgression({ seed, primary, temperament });
  character = awardMarinaraXp(character, 900, random).progression; // primary base to 10
  character = setMarinaraClass(character, secondary);
  character = awardMarinaraXp(character, 1000, random).progression; // secondary base 1 -> 11 (level 20)
  const advanced = MARINARA_CLASSES.find((def) => def.from === primary && !def.pure)!;
  character = setMarinaraClass(character, advanced.id);
  // A tree trait the class already keeps (Cover, Hold the Line) takes no carry slot.
  const traits = marinaraClassTraits(character.activeClass);
  const earlier = marinaraLearnedSkills(character).filter(
    (skill) =>
      skill.classId !== character.activeClass &&
      !(
        traits.includes(skill.id) &&
        marinaraClass(skill.classId)?.archetype === marinaraClass(character.activeClass)!.archetype
      ),
  );
  const ranked = [...earlier].sort(
    (a, b) =>
      Number(b.classId === secondary) - Number(a.classId === secondary) ||
      Number(Boolean(b.carryPick)) - Number(Boolean(a.carryPick)) ||
      Number(b.kind === "active") - Number(a.kind === "active"),
  );
  return setMarinaraCarried(character, pickCarries(character, ranked));
}

function phase4(count: number): string {
  const level = 20;
  const scale = calibrate("advanced", level);
  const hp = averageExpected(level).hp * marinaraFightHpMultiplier(level);
  const measure = (character: MarinaraProgression, key: string) => {
    const single: number[] = [];
    const affinity: number[] = [];
    let wins = 0;
    for (let i = 0; i < count; i++) {
      const random = marinaraRandom(`p4:${key}:${i}`);
      const one = runFight([unitFrom(character, "hero", "party", "front")], [dummy("d", level, hp * 6)], {
        random,
        grouped: true,
        maxActions: 600,
      });
      single.push(one.winner === "party" ? one.rounds : Number.POSITIVE_INFINITY);
      const mixed = runFight(
        [unitFrom(character, "hero", "party", "front")],
        AFFINITY_PROFILES.map((a, n) => dummy(`d${n}`, level, hp, a)),
        { random, grouped: false, maxActions: 600 },
      );
      affinity.push(mixed.winner === "party" ? mixed.rounds : Number.POSITIVE_INFINITY);
      if (partyFightWith(character, key, level, i, scale).winner === "party") wins++;
    }
    return { single: quantiles(single).median, affinity: quantiles(affinity).median, win: wins / count };
  };
  const rows: string[] = [];
  const seeds = 5; // characters per row: each is measured `count` times
  for (const primary of MARINARA_ARCHETYPES) {
    const advanced = MARINARA_CLASSES.find((def) => def.from === primary && !def.pure)!;
    const avg = (list: Array<ReturnType<typeof measure>>) => ({
      single: list.reduce((s, r) => s + r.single, 0) / list.length,
      affinity: list.reduce((s, r) => s + r.affinity, 0) / list.length,
      win: list.reduce((s, r) => s + r.win, 0) / list.length,
    });
    const own = avg(
      Array.from({ length: seeds }, (_, n) =>
        measure(buildCharacter(advanced, level, `${advanced.id}:${level}:${n}`), `own:${primary}:${n}`),
      ),
    );
    rows.push(
      `| ${advanced.label} | own tree only (class level 20) | – | ${fmt(own.single)} | ${fmt(own.affinity)} | ${fmt(own.win * 100, 0)}% |`,
    );
    for (const secondary of MARINARA_ARCHETYPES) {
      if (secondary === primary) continue;
      const crossed = Array.from({ length: seeds }, (_, n) =>
        crossTrained(primary, secondary, `x:${primary}:${secondary}:${n}`),
      );
      const r = avg(crossed.map((c, n) => measure(c, `x:${primary}:${secondary}:${n}`)));
      const carried = crossed[0]!.carried.join(", ");
      rows.push(
        `| ${advanced.label} | + ${marinaraClass(secondary)!.label} 10 | ${carried} | ${fmt(r.single)} | ${fmt(r.affinity)} | ${fmt(r.win * 100, 0)}% |`,
      );
    }
  }
  return [
    "# Class lab, phase 4: cross-training and carried skills",
    "",
    `Level 20 characters. "Own tree only" spent all 20 levels in their primary tree and is a class level 20 advanced class carrying four skills from its base class. "+ X 10" spent levels 10–20 in their secondary tree's base class X (class level 11), then promoted, so its advanced class is only class level 10, and it carries the best four skills it learned outside the active class, secondary first. Single: rounds to clear one 6× HP dummy. Affinities: rounds to clear the six affinity dummies (as in phase 1). Win rate: the phase 3 party fight with this character in the slot, foes scaled ×${scale.toFixed(2)} (Fusionist level 20 wins about 65%). ${seeds} characters per row, ${count} fights each; medians averaged over the characters.`,
    "",
    "| Active class | Training | Carried (first character) | Single | Affinities (6) | Party win rate |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

/** Trace one class in the phase 3 fight: win rate, damage and what it chose. */
function trace(classId: string, level: number, count: number): string {
  const tier = marinaraClass(classId)!.tier;
  const scale = calibrate(tier, level);
  for (const key of Object.keys(skillTally)) delete skillTally[key];
  let wins = 0;
  let dealt = 0;
  let total = 0;
  for (let i = 0; i < count; i++) {
    const log = partyFight(marinaraClass(classId)!, level, i, scale);
    if (log.winner === "party") wins++;
    dealt += log.damageDealt.slot ?? 0;
    total += Object.entries(log.damageDealt)
      .filter(([id]) => !id.startsWith("e"))
      .reduce((sum, [, v]) => sum + v, 0);
  }
  return `${classId} L${level}: wins ${((wins / count) * 100).toFixed(0)}%, share of party damage ${((dealt / total) * 100).toFixed(0)}%, choices ${JSON.stringify(skillTally)}`;
}

// Run only as the entry point, so other lab scripts can import the party builders.
if (process.argv[1]?.endsWith("class-lab.ts")) {
  const phase = process.argv[2] ?? "1";
  if (phase === "trace") {
    console.log(trace(process.argv[3]!, Number(process.argv[4]), Number(process.argv[5] ?? 60)));
    process.exit(0);
  }
  const out = process.argv[3];
  const count = Number(process.argv[4] ?? 100);
  const report =
    phase === "1" ? phase1(count) : phase === "2" ? phase2(count) : phase === "3" ? phase3(count) : phase4(count);
  if (out) writeFileSync(out, `${report}\n`);
  else console.log(report);
}
