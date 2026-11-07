/**
 * Classic Marinara classes and growth (2026-10-31): the trees are whole and reachable, a character
 * trains only in their primary and secondary trees, Pure characters open the pure branch, promotion
 * waits on class level, carried skills are capped at four, aptitudes stay in range and add up, and
 * growth keeps its floor and drift guard so a character never falls far behind their expected stats.
 */
import assert from "node:assert/strict";
import {
  MARINARA_APTITUDE_RANGE,
  MARINARA_APTITUDE_TOTAL,
  MARINARA_ARCHETYPE_BASES,
  MARINARA_ARCHETYPES,
  MARINARA_CARRY_SLOTS,
  MARINARA_CLASSES,
  MARINARA_GROWTH_FLOOR,
  MARINARA_LEVEL_CAP,
  MARINARA_PARTY_TEMPERAMENTS,
  MARINARA_STATS,
  MARINARA_TEMPERAMENT_TREES,
  awardMarinaraXp,
  createMarinaraProgression,
  marinaraClassBody,
  expectedMarinaraStats,
  marinaraClass,
  marinaraClassBlock,
  marinaraLearnedSkills,
  marinaraOpenClasses,
  marinaraRandom,
  marinaraTrees,
  marinaraUsableSkills,
  marinaraSkillsLeftBehind,
  rollMarinaraAptitudes,
  rollMarinaraLevelUp,
  scaleMarinaraXp,
  setMarinaraCarried,
  setMarinaraClass,
  type MarinaraProgression,
} from "../../packages/shared/src/features/marinara-classes.js";

// Every tree: 7 classes, one base, three advanced (one pure), three masters each promoting from an
// advanced class of the same tree; ids unique; every class has a skill marked worth carrying.
assert.equal(MARINARA_CLASSES.length, 56);
assert.equal(new Set(MARINARA_CLASSES.map((def) => def.id)).size, 56);
assert.equal(
  new Set(MARINARA_CLASSES.flatMap((def) => def.skills.map((skill) => skill.id))).size,
  MARINARA_CLASSES.reduce((sum, def) => sum + def.skills.length, 0),
  "skill ids are unique",
);
for (const archetype of MARINARA_ARCHETYPES) {
  const line = MARINARA_CLASSES.filter((def) => def.archetype === archetype);
  assert.equal(line.length, 7, archetype);
  assert.equal(line.filter((def) => def.tier === "base").length, 1, archetype);
  assert.equal(line.filter((def) => def.tier === "advanced").length, 3, archetype);
  assert.equal(line.filter((def) => def.pure).length, 2, archetype);
  for (const def of line) {
    if (def.tier === "base") assert.equal(def.from, undefined);
    else {
      const parent = marinaraClass(def.from!);
      assert.ok(parent && parent.archetype === archetype, `${def.id} promotes inside its tree`);
      assert.equal(parent.tier, def.tier === "advanced" ? "base" : "advanced", `${def.id} tier order`);
      assert.equal(parent.pure, def.tier === "master" ? def.pure : false, `${def.id} pure line`);
    }
    assert.ok(
      def.skills.some((skill) => skill.carryPick),
      `${def.id} has a carry pick`,
    );
  }
}

// Temperaments: every party temperament opens one tree; opponent-only ones are not party temperaments.
assert.equal(MARINARA_PARTY_TEMPERAMENTS.length, 13);
for (const temperament of ["fanatical", "territorial", "hungry", "mindless"])
  assert.ok(!(MARINARA_PARTY_TEMPERAMENTS as readonly string[]).includes(temperament), temperament);
for (const temperament of MARINARA_PARTY_TEMPERAMENTS)
  assert.ok(MARINARA_ARCHETYPES.includes(MARINARA_TEMPERAMENT_TREES[temperament]), temperament);
assert.deepEqual(marinaraTrees("blade", "supportive"), { primary: "blade", secondary: "mender", pure: false });
assert.deepEqual(marinaraTrees("blade", "reckless"), { primary: "blade", secondary: null, pure: true });

// Aptitudes: deterministic per seed, in range, summing to the total, leaning the way they are told.
for (let i = 0; i < 200; i++) {
  const aptitudes = rollMarinaraAptitudes(`seed-${i}`);
  assert.deepEqual(aptitudes, rollMarinaraAptitudes(`seed-${i}`));
  assert.equal(
    MARINARA_STATS.reduce((sum, stat) => sum + aptitudes[stat], 0),
    MARINARA_APTITUDE_TOTAL,
  );
  for (const stat of MARINARA_STATS) {
    assert.ok(aptitudes[stat] >= MARINARA_APTITUDE_RANGE.min && aptitudes[stat] <= MARINARA_APTITUDE_RANGE.max);
  }
}
{
  let leaned = 0;
  let plain = 0;
  for (let i = 0; i < 200; i++) {
    leaned += rollMarinaraAptitudes(`lean-${i}`, { magic: 1 }).magic;
    plain += rollMarinaraAptitudes(`lean-${i}`).magic;
  }
  assert.ok(leaned / 200 > plain / 200 + 5, "a Description leaning Magic raises the Magic aptitude");
}

// John: a Blade whose starting temperament is Supportive trains Blade and Mender, never Channeler,
// and never the pure branch.
const john = createMarinaraProgression({ seed: "game-1:john", primary: "blade", temperament: "supportive" });
assert.equal(john.activeClass, "blade");
assert.deepEqual(
  marinaraOpenClasses(john)
    .map((def) => def.id)
    .sort(),
  ["blade", "duelist", "mender", "bloodsworn"].sort(),
  "base classes of both trees and the promotions one step past a trained class",
);
assert.equal(marinaraClassBlock(john, "channeler"), "not-in-trees");
assert.equal(marinaraClassBlock(john, "weaponmaster"), "not-in-trees");
assert.equal(marinaraClassBlock(john, "duelist"), "class-level", "promotion waits on class level 10");
assert.throws(() => setMarinaraClass(john, "duelist"));

// Switching to the secondary tree's base class starts it at class level 1 and keeps the character
// level; the body becomes the Mender's own level-1 body (Alyssa 2026-11-02: body stats follow the
// active class).
const asMender = setMarinaraClass(john, "mender");
assert.equal(asMender.activeClass, "mender");
assert.equal(asMender.classLevels.mender, 1);
assert.equal(asMender.level, john.level);
assert.deepEqual(asMender.stats, MARINARA_ARCHETYPE_BASES.mender.start);

// Level the Blade to class level 10, then promote: the promotion starts at its parent's class level
// and adds its bonus once; switching back and forth adds nothing more.
const random = marinaraRandom("run-1");
let leveled: MarinaraProgression = awardMarinaraXp(john, 900, random).progression;
assert.equal(leveled.level, 10);
assert.equal(leveled.classLevels.blade, 10);
assert.equal(marinaraClassBlock(leveled, "duelist"), null);
const duelist = setMarinaraClass(leveled, "duelist");
assert.equal(duelist.classLevels.duelist, 10);
assert.ok(duelist.stats.speed > leveled.stats.speed, "promotion bonus lands");
const back = setMarinaraClass(setMarinaraClass(duelist, "blade"), "duelist");
assert.deepEqual(back.stats, duelist.stats);

// Body follows the active class: a level-10 Blade switching to a level-1 Mender has a level-1
// Mender body, and switching back restores the same Blade body (each class rolls its own stream).
const leveledMender = setMarinaraClass(leveled, "mender");
assert.equal(leveledMender.level, 10, "character level is kept");
assert.deepEqual(leveledMender.stats, MARINARA_ARCHETYPE_BASES.mender.start);
assert.deepEqual(setMarinaraClass(leveledMender, "blade").stats, leveled.stats, "the Blade body comes back");
assert.deepEqual(leveled.stats, marinaraClassBody(leveled, "blade").stats, "stats are the class body");
// Levelling the Mender grows its own body only.
const menderUp = awardMarinaraXp(leveledMender, 300, random).progression;
assert.ok(menderUp.classLevels.mender! > 1);
assert.deepEqual(menderUp.stats, marinaraClassBody(menderUp, "mender").stats);
assert.deepEqual(setMarinaraClass(menderUp, "blade").stats, leveled.stats);
// A promotion fills empty carry slots with the parent class's actives, so the kit doesn't shrink.
assert.ok(duelist.carried.length > 0 && duelist.carried.length <= 4);
assert.ok(
  duelist.carried.every((id) => marinaraLearnedSkills(leveled).some((s) => s.id === id && s.kind === "active")),
);

// The class screen warns what a switch leaves behind; a promotion's carry fill counts as kept.
assert.ok(
  marinaraSkillsLeftBehind(leveled, "duelist").every(
    (skill) => !marinaraUsableSkills(duelist).some((s) => s.id === skill.id),
  ),
);
assert.ok(marinaraSkillsLeftBehind(leveled, "mender").length > 0, "a Blade going Mender leaves its kit behind");
assert.deepEqual(marinaraSkillsLeftBehind(leveled, "blade"), [], "staying put leaves nothing");

// Skills: only the active class's, plus up to four carried from other trained classes.
leveled = awardMarinaraXp(duelist, 500, random).progression; // Duelist class level 15
assert.ok(marinaraLearnedSkills(leveled).some((skill) => skill.id === "keen-edge"));
const asBladeAgain = setMarinaraClass(leveled, "blade");
assert.ok(!marinaraUsableSkills(asBladeAgain).some((skill) => skill.id === "keen-edge"), "not carried, not usable");
const carrying = setMarinaraCarried(asBladeAgain, ["keen-edge", "flurry"]);
assert.ok(marinaraUsableSkills(carrying).some((skill) => skill.id === "keen-edge"));
assert.throws(() => setMarinaraCarried(asBladeAgain, ["power-strike"]), "the active class's own skill is not carried");
assert.throws(() => setMarinaraCarried(asBladeAgain, ["mend"]), "an unlearned skill is not carried");
assert.throws(() => setMarinaraCarried(asBladeAgain, ["a", "b", "c", "d", "e"].slice(0, MARINARA_CARRY_SLOTS + 1)));

// A Pure Blade opens the pure branch and no second tree.
const pure = createMarinaraProgression({ seed: "game-1:pure", primary: "blade", temperament: "reckless" });
assert.deepEqual(
  marinaraOpenClasses(pure)
    .map((def) => def.id)
    .sort(),
  ["blade", "bloodsworn", "duelist", "weaponmaster"],
);
const pureLeveled = awardMarinaraXp(pure, 900, marinaraRandom("pure")).progression;
assert.equal(marinaraClassBlock(pureLeveled, "weaponmaster"), null);
assert.equal(marinaraClassBlock(pureLeveled, "mender"), "not-in-trees");

// Growth: every level raises at least two stats, and over many characters no stat ends far behind
// its expected value (the drift guard), while lucky stats keep their luck.
for (let c = 0; c < 300; c++) {
  let character = createMarinaraProgression({
    seed: `growth-${c}`,
    primary: MARINARA_ARCHETYPES[c % 8]!,
    temperament: MARINARA_PARTY_TEMPERAMENTS[c % 13]!,
  });
  const stream = marinaraRandom(`growth-run-${c}`);
  while (character.level < MARINARA_LEVEL_CAP) {
    const rolled = rollMarinaraLevelUp(character, stream);
    assert.ok(Object.keys(rolled.levelUp.gains).length >= MARINARA_GROWTH_FLOOR, "growth floor");
    character = rolled.progression;
  }
  for (const stat of MARINARA_STATS) {
    assert.ok(character.expected[stat] - character.stats[stat] <= 6, `drift guard: ${stat} ${c}`);
  }
}

// XP: weak foes pay little, strong ones more, and a character behind the party catches up.
assert.ok(scaleMarinaraXp({ base: 20, level: 10, foeLevel: 2, partyAverageLevel: 10 }) <= 2);
assert.ok(scaleMarinaraXp({ base: 20, level: 10, foeLevel: 13, partyAverageLevel: 10 }) > 20);
assert.equal(scaleMarinaraXp({ base: 20, level: 5, foeLevel: 5, partyAverageLevel: 8 }), 30);

// The level cap holds.
const capped = awardMarinaraXp(john, 100_000, marinaraRandom("cap")).progression;
assert.equal(capped.level, MARINARA_LEVEL_CAP);
assert.equal(capped.xp, 0);

// Expected stats rise with level and promotions, and a Guard is expected to out-defend a Channeler.
const guard10 = expectedMarinaraStats("guard", 10);
const guard30 = expectedMarinaraStats("guard", 30);
assert.ok(guard30.defense > guard10.defense && guard30.hp > guard10.hp);
assert.ok(expectedMarinaraStats("guard", 20).defense > expectedMarinaraStats("channeler", 20).defense);
assert.ok(expectedMarinaraStats("channeler", 20).magic > expectedMarinaraStats("guard", 20).magic);

console.log("game-marinara-classes: ok");
