/**
 * Classic Marinara rules the bestiary leans on (2026-11-01): a charged foe ability goes off on the
 * turn after it is charged and an area one lands on its whole area; a boss shrugs off sleep, stun and
 * confusion and hits harder once below half its HP; a fight's start gives party members progressions
 * from their cards and fits opponents to the encounter budget.
 */
import assert from "node:assert/strict";
import {
  beginMarinaraTurn,
  buildMarinaraEnemy,
  buildMarinaraPartyFighter,
  marinaraHitNumbers,
  performMarinaraOption,
  registerMarinaraEnemySkills,
  releaseMarinaraCharge,
  marinaraOption,
  marinaraEffectiveStat,
  marinaraLeeched,
  marinaraRowOf,
  MARINARA_GRAVE_HUNGER,
  type MarinaraFightContext,
} from "../../packages/shared/src/features/marinara-combat.js";
import {
  MARINARA_CLASSES,
  awardMarinaraXp,
  createMarinaraProgression,
  marinaraRandom,
} from "../../packages/shared/src/features/marinara-classes.js";
import {
  marinaraFightEnd,
  marinaraFightStart,
} from "../../packages/server/src/services/game/marinara-fight-start.service.js";
import type { Combatant } from "../../packages/shared/src/types/game.js";

const ctx = (): MarinaraFightContext => ({ random: marinaraRandom("rules"), events: [] });
const party = (id: string) =>
  buildMarinaraPartyFighter({
    id,
    name: id,
    progression: createMarinaraProgression({ seed: id, primary: "guard", temperament: "disciplined" }),
  });

// Grave Hunger: a Hexer takes a share of every foe in spell reach's Defense and Resistance.
{
  const progression = awardMarinaraXp(
    createMarinaraProgression({ seed: "hex", primary: "hexer", temperament: "cruel" }),
    800,
    marinaraRandom("hex"),
  ).progression;
  const hexer = buildMarinaraPartyFighter({ id: "hex", name: "Hex", progression, row: "back" });
  // Alyssa 2026-11-01: Grave Hunger is the Witch's (class level 12), Grave Tithe the Carrion Lord's (22).
  const witch = MARINARA_CLASSES.find((one) => one.id === "witch")!;
  const lord = MARINARA_CLASSES.find((one) => one.id === "carrion-lord")!;
  assert.equal(witch.skills.find((one) => one.id === "grave-hunger")?.learnedAt, 12, "the Witch learns Grave Hunger");
  assert.equal(lord.skills.find((one) => one.id === "grave-tithe")?.learnedAt, 22, "the Carrion Lord, Grave Tithe");
  assert.ok(!hexer.skills.some((skill) => skill.id === "grave-hunger"), "a base Hexer has neither");
  hexer.skills = [
    ...hexer.skills,
    witch.skills.find((one) => one.id === "grave-hunger")!,
    lord.skills.find((one) => one.id === "grave-tithe")!,
  ];
  const foes = ["f1", "f2"].map((id) => buildMarinaraEnemy({ id, name: id, level: 9, tier: "standard" }));
  foes[1]!.row = "back";
  const guard = party("g");
  guard.row = "front";
  const all = [hexer, guard, ...foes];
  assert.equal(marinaraLeeched(hexer, all).length, 2, "every foe, either row, from either row");
  const taken = (pct: number) => foes.reduce((sum, foe) => sum + foe.stats.defense * pct, 0);
  assert.ok(
    Math.abs(marinaraEffectiveStat(hexer, "defense", all) - (hexer.stats.defense + taken(MARINARA_GRAVE_HUNGER.pct))) <
      1e-9,
  );
  assert.ok(!marinaraOption(hexer, "grave-tithe", all), "Grave Tithe needs the front row");
  hexer.row = "front";
  assert.ok(
    Math.abs(
      marinaraEffectiveStat(hexer, "defense", all) - (hexer.stats.defense + taken(MARINARA_GRAVE_HUNGER.frontPct)),
    ) < 1e-9,
    "more from the front",
  );
  assert.ok(marinaraOption(hexer, "grave-tithe", all), "and Grave Tithe opens");
  assert.ok(marinaraEffectiveStat(foes[0]!, "defense", all) < foes[0]!.stats.defense, "the foe loses it");
  foes[1]!.hp = 0;
  assert.equal(marinaraLeeched(hexer, all).length, 1, "a fallen foe gives nothing");
  hexer.spellFoes = [];
  assert.equal(marinaraLeeched(hexer, all).length, 0, "on a board, only foes in spell reach");
}

// With nobody standing in its front row, a side's back row is the front: melee hits it in full.
{
  const blade = buildMarinaraEnemy({ id: "b", name: "b", level: 5, tier: "standard", archetype: "blade" });
  const front = party("pf"),
    back = party("pb");
  front.row = "front";
  back.row = "back";
  const all = [blade, front, back];
  const basic = marinaraOption(blade, null)!.effect;
  const shielded = marinaraHitNumbers(blade, back, basic, all).damage;
  assert.equal(marinaraRowOf(back, all), "back");
  front.hp = 0;
  assert.equal(marinaraRowOf(back, all), "front", "the back row steps up");
  assert.ok(marinaraHitNumbers(blade, back, basic, all).damage > shielded, "and takes melee in full");
}

// A charged area ability: charged on one turn, lands on every foe when released.
registerMarinaraEnemySkills({
  "test-breath": { kind: "damage", target: "all-enemies", stat: "magic", power: 10, charge: true, label: "Breath" },
});
{
  const drake = buildMarinaraEnemy({
    id: "drake",
    name: "Drake",
    level: 5,
    tier: "elite",
    enemySkills: ["test-breath"],
  });
  const a = party("a"),
    b = party("b");
  const all = [drake, a, b];
  const c = ctx();
  const option = marinaraOption(drake, "enemy:test-breath");
  assert.ok(option, "the charged ability is offered");
  performMarinaraOption(drake, option!, [a], all, c);
  assert.deepEqual(drake.charging, { skillId: "enemy:test-breath", targetId: "a" }, "an enemy ability charges");
  assert.equal(a.hp, a.maxHp, "nothing lands while charging");
  const turn = beginMarinaraTurn(drake, all, c);
  assert.ok(turn.release, "the charge is released on its next turn");
  releaseMarinaraCharge(drake, turn.release!, all, c);
  assert.ok(a.hp < a.maxHp && b.hp < b.maxHp, "the released area lands on every foe in it");
}

// A boss shrugs off sleep, stun and confusion; a standard foe doesn't.
registerMarinaraEnemySkills({
  "test-stun": { kind: "status", target: "enemy", status: "stun", chance: 1, duration: 2, label: "Stun" },
});
for (const tier of ["boss", "standard"] as const) {
  const foe = buildMarinaraEnemy({ id: "foe", name: "Foe", level: 5, tier });
  const caster = party("caster");
  caster.side = "party";
  caster.enemySkills = ["test-stun"];
  const all = [foe, caster];
  performMarinaraOption(caster, marinaraOption(caster, "enemy:test-stun")!, [foe], all, ctx());
  assert.equal(
    foe.statuses.some((s) => s.status === "stun"),
    tier !== "boss",
    `a ${tier} ${tier === "boss" ? "ignores" : "takes"} a stun`,
  );
}

// A boss below half hits harder, and stays enraged when healed.
{
  const boss = buildMarinaraEnemy({ id: "boss", name: "Boss", level: 5, tier: "boss" });
  const hero = party("hero");
  const all = [boss, hero];
  const calm = marinaraHitNumbers(boss, hero, { kind: "damage", target: "enemy", stat: "strength", power: 0 }, all);
  boss.enraged = true;
  const angry = marinaraHitNumbers(boss, hero, { kind: "damage", target: "enemy", stat: "strength", power: 0 }, all);
  assert.ok(angry.damage > calm.damage, "an enraged boss hits harder");
}

// A fight's start: progressions for cards without one, the fallen kept out, foes fitted to the budget.
{
  const unit = (id: string, name: string, side: "player" | "enemy", extra: Partial<Combatant> = {}): Combatant =>
    ({
      id,
      name,
      side,
      hp: 20,
      maxHp: 20,
      mp: 0,
      maxMp: 0,
      attack: 5,
      defense: 5,
      speed: 5,
      level: 1,
      skills: [],
      ...extra,
    }) as Combatant;
  const fallen = createMarinaraProgression({ seed: "x", primary: "blade", temperament: "reckless" });
  const start = marinaraFightStart({
    gameId: "game",
    cards: [
      { name: "Ayla", class: "Knight", temperament: "protective", temperamentInitial: "protective" },
      { name: "Bren", marinara: { ...fallen, fallen: true } },
    ],
    party: [unit("p1", "Ayla", "player", { sprite: "ayla.png" } as Partial<Combatant>), unit("p2", "Bren", "player")],
    enemies: Array.from({ length: 12 }, (_, i) => unit(`e${i}`, `Goblin ${i}`, "enemy")),
    difficulty: "normal",
    storyFight: false,
  });
  assert.deepEqual(
    start.party.map((u) => u.name),
    ["Ayla"],
    "a fallen party member stays out under permadeath",
  );
  assert.equal((start.party[0] as Combatant & { sprite?: string }).sprite, "ayla.png", "the unit keeps its own look");
  assert.ok(start.cards?.[0]?.marinara, "the new progression is written on the card");
  assert.equal(
    (start.cards?.[1]?.marinara as { fallen?: boolean })?.fallen,
    true,
    "a card with a progression is left as it was",
  );
  assert.ok(start.enemies.length < 12, "a random fight is fitted to the encounter budget");
  assert.ok(start.notes.length > 0, "and says what it changed");
  const story = marinaraFightStart({
    gameId: "game",
    cards: [],
    party: [unit("p1", "Ayla", "player")],
    enemies: Array.from({ length: 12 }, (_, i) => unit(`e${i}`, `Goblin ${i}`, "enemy")),
    difficulty: "normal",
    storyFight: true,
  });
  assert.equal(story.enemies.length, 12, "a story's fight keeps every opponent it wrote");
}

// A fight's end: a win pays XP onto the cards, more to who did more; a loss pays nothing; under
// permadeath the one down at the end of a win is gone.
{
  const a = party("Ayla"),
    b = party("Bren");
  a.side = b.side = "party";
  const foes = [0, 1, 2, 3].map((i) =>
    buildMarinaraEnemy({ id: `f${i}`, name: `Foe ${i}`, level: 1, tier: "standard" }),
  );
  for (const foe of foes) foe.hp = 0;
  b.hp = 0;
  const progression = createMarinaraProgression({ seed: "p", primary: "guard", temperament: "disciplined" });
  const cards = [
    { name: "Ayla", marinara: progression },
    { name: "Bren", marinara: progression },
  ];
  const state = {
    fighters: [a, b, ...foes],
    draws: 0,
    credit: { Ayla: { damage: 60, support: 0, foes: [] }, Bren: { damage: 10, support: 0, foes: [] } },
  };
  const won = marinaraFightEnd({ state, outcome: "victory", cards, seed: 1, permadeath: true });
  const ayla = won.growth.find((g) => g.name === "Ayla")!,
    bren = won.growth.find((g) => g.name === "Bren")!;
  assert.ok(ayla.xp > bren.xp && bren.xp > 0, "both earn XP, the one who did more earns more");
  assert.equal(bren.fallen, true, "one down at the end of a won fight falls under permadeath");
  assert.equal((won.cards?.[1]?.marinara as { fallen?: boolean }).fallen, true, "and the card says so");
  assert.ok((won.cards?.[0]?.marinara as { xp: number }).xp > 0, "the XP is written on the card");
  const lost = marinaraFightEnd({ state, outcome: "defeat", cards, seed: 1, permadeath: true });
  assert.equal(lost.growth.length, 0, "a lost fight pays nothing and kills no one");
  const gentle = marinaraFightEnd({ state, outcome: "victory", cards, seed: 1, permadeath: false });
  const fled = buildMarinaraEnemy({ id: "fled", name: "Runner", level: 1, tier: "standard" });
  const drivenOff = marinaraFightEnd({
    state: { fighters: [a], draws: 0, credit: {}, left: [fled] },
    outcome: "victory",
    cards,
    seed: 1,
    permadeath: false,
  });
  assert.ok(drivenOff.growth[0]?.xp, "a foe driven off in a won fight pays its XP");
  assert.ok(!gentle.growth.some((g) => g.fallen), "without permadeath nobody falls");
}

// Bestiary foes: built from their family, fitted by the bestiary's own threat budget.
{
  const { marinaraBestiaryFor } = await import("../../packages/shared/src/features/marinara-bestiary.js");
  const family = marinaraBestiaryFor("high_fantasy", 3).find((one) => one.tiers.includes("standard"))!;
  assert.ok(family, "the fantasy bestiary has a level 3 standard foe");
  const foe = (i: number) =>
    ({
      id: `b${i}`,
      name: `Beast ${i}`,
      side: "enemy",
      hp: 20,
      maxHp: 20,
      mp: 0,
      maxMp: 0,
      attack: 5,
      defense: 5,
      speed: 5,
      level: 1,
      skills: [],
      marinara: { family: { familyId: family.id, tier: "standard", level: 3 } },
    }) as unknown as Combatant;
  const hero = (id: string) =>
    ({
      id,
      name: id,
      side: "player",
      hp: 20,
      maxHp: 20,
      mp: 0,
      maxMp: 0,
      attack: 5,
      defense: 5,
      speed: 5,
      level: 1,
      skills: [],
    }) as Combatant;
  const start = marinaraFightStart({
    gameId: "bestiary",
    cards: [],
    party: [hero("h1"), hero("h2"), hero("h3"), hero("h4")],
    enemies: Array.from({ length: 10 }, (_, i) => foe(i)),
    difficulty: "normal",
    storyFight: false,
    setting: "high_fantasy",
  });
  assert.ok(start.enemies.length > 0 && start.enemies.length < 10, "ten of a family are cut to the budget");
  assert.ok(
    start.notes.some((note) => /fit|Dropped/.test(note)),
    "with the bestiary's own notes",
  );
  assert.ok(["minion", "standard"].includes(start.enemies[0]!.marinara?.tier ?? ""), "fitted down, never up");
}

console.log("game-marinara-rules: ok");
