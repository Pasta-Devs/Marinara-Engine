import assert from "node:assert/strict";
import {
  assignCombatTactics,
  chooseCombatCandidate,
  combatTacticsSchema,
} from "../../packages/shared/src/features/combat-ai.js";
import {
  applyTacticalTurn,
  decideTacticalAction,
  createTacticalCombat,
  getMovementRange,
  runEnemyPhase,
} from "../../packages/shared/src/features/tactical-combat/index.js";
import { pursueOpponent } from "../../packages/shared/src/features/tactical-combat/profile-ai.js";
import { chooseClassicAction } from "../../packages/server/src/services/game/combat-ai.service.js";
import { resolveCombatRound } from "../../packages/server/src/services/game/combat.service.js";
import type { Combatant, CombatSkill } from "../../packages/shared/src/types/game.js";

const actor = (id: string, side: Combatant["side"] = "enemy"): Combatant => ({
  id,
  name: id,
  side,
  hp: 100,
  maxHp: 100,
  mp: 30,
  maxMp: 30,
  attack: 10,
  defense: 5,
  speed: 10,
  level: 3,
  skills: [],
});
const heal: CombatSkill = { id: "heal", name: "Heal", type: "heal", mpCost: 8, power: 2, cooldown: 3 };
assert.deepEqual(chooseClassicAction(actor("unprofiled"), [], [], 1), { type: "defend" });
assert.deepEqual(chooseClassicAction(actor("unprofiled"), [], [actor("target")], 1), {
  type: "attack",
  targetId: "target",
});
const weaken: CombatSkill = { id: "weaken", name: "Weaken", type: "debuff", mpCost: 5, power: 1, cooldown: 2 };
const beast = {
  ...actor("beast"),
  aiHints: { category: "beast" as const, temperament: "cautious" as const, proficiency: "master" as const },
};
assert.equal(assignCombatTactics(beast, 7).adjective, "mindless");
for (const category of ["other", "unknown"] as const) {
  for (const seed of [0, 7, 21]) {
    assert.equal(
      assignCombatTactics({ ...actor("construct"), aiHints: { category, temperament: "mindless" } }, seed).adjective,
      "mindless",
      "An explicit Mindless hint is honored outside Beast and Monstrosity categories",
    );
  }
}
assert.throws(
  () =>
    assignCombatTactics({ ...beast, tactics: { ...assignCombatTactics(actor("other"), 1), adjective: "reckless" } }, 7),
  /Mindless/,
);
assert.equal(combatTacticsSchema.safeParse({ ...assignCombatTactics(beast, 7), adjective: "cautious" }).success, false);
assert.equal(combatTacticsSchema.safeParse({ ...assignCombatTactics(beast, 7), version: 99 }).success, false);
assert.deepEqual(assignCombatTactics(actor("same"), 21), assignCombatTactics(actor("same"), 21));
const saved = assignCombatTactics(actor("same"), 21);
assert.deepEqual(assignCombatTactics({ ...actor("same"), tactics: saved, level: 90 }, 999), saved);

function arena() {
  const state = createTacticalCombat([actor("hero", "player"), actor("ally", "player")], [beast, actor("medic")], {
    seed: 6,
    difficulty: "normal",
  });
  state.grid = {
    width: 9,
    height: 7,
    tiles: Array.from({ length: 7 }, () => Array.from({ length: 9 }, () => "plains" as const)),
  };
  state.units.forEach((u, i) => {
    u.x = [7, 7, 1, 1][i]!;
    u.y = [1, 5, 1, 5][i]!;
    u.movement = 3;
  });
  return state;
}

// Mindless detours around a U rather than stalling at the closest Manhattan tile.
const detour = arena();
detour.units[1]!.hp = 0;
detour.units[3]!.hp = 0;
const pursuer = detour.units[2]!;
pursuer.x = 2;
pursuer.y = 3;
detour.units[0]!.x = 7;
detour.units[0]!.y = 3;
for (let y = 1; y <= 5; y++) detour.grid.tiles[y]![3] = "wall";
const route = pursueOpponent(detour, pursuer)!;
assert.ok(route.to.y !== 3, "Pursuit finds the route around the wall");
assert.ok(getMovementRange(detour, pursuer.id).some((p) => p.x === route.to.x && p.y === route.to.y));

// Short forest path is preferred despite a cheaper plains detour.
const forest = arena();
forest.units[1]!.hp = 0;
forest.units[3]!.hp = 0;
forest.units[0]!.x = 5;
forest.grid.tiles[1]![2] = "forest";
forest.grid.tiles[1]![3] = "forest";
forest.grid.tiles[1]![4] = "forest";
assert.deepEqual(pursueOpponent(forest, forest.units[2]!)!.to, { x: 2, y: 1 });
forest.units[2]!.movement = 4;
assert.deepEqual(decideTacticalAction(forest, forest.units[2]!), {
  type: "wait",
  unitId: "beast",
  to: { x: 3, y: 1 },
});
forest.weather = { version: 1, type: "snow", wind: "calm", visibility: "clear", exposure: "exposed" };
assert.deepEqual(decideTacticalAction(forest, forest.units[2]!), {
  type: "wait",
  unitId: "beast",
  to: { x: 2, y: 1 },
});
assert.ok(getMovementRange(forest, "beast").some((tile) => tile.x === 2 && tile.y === 1));

// Support moves into range and uses finite resources; allies share the same policy.
const support = arena();
const medic = support.units[3]!;
medic.skills = [heal];
medic.tactics!.adjective = "supportive";
support.units[2]!.x = 4;
support.units[2]!.y = 5;
support.units[2]!.hp = 5;
const supportAction = decideTacticalAction(support, medic);
assert.equal(supportAction.type, "skill");
assert.ok("targetId" in supportAction && supportAction.targetId === support.units[2]!.id);
assert.ok("to" in supportAction && supportAction.to && supportAction.to.x > 1);
support.units[2]!.hasActed = true;
support.phase = "enemy";
const resolved = runEnemyPhase(support);
assert.equal(resolved.state.units[3]!.mp, 22);
assert.ok(resolved.state.units[2]!.hp > 5);
assert.equal(support.units[3]!.mp, 30, "Phase resolution does not mutate the input");
assert.deepEqual(
  runEnemyPhase(JSON.parse(JSON.stringify(support))),
  resolved,
  "Saved tactical state replays identically",
);

// An AI companion can be manually moved first; it cannot move twice or act twice.
const companion = arena();
companion.units[1]!.controller = "ai";
companion.units[1]!.hasMoved = true;
const companionStart = { x: companion.units[1]!.x, y: companion.units[1]!.y };
const ended = applyTacticalTurn(companion, { type: "endTurn" });
assert.ok(ended.ok);
if (ended.ok) {
  assert.deepEqual({ x: ended.state.units[1]!.x, y: ended.state.units[1]!.y }, companionStart);
  assert.ok(
    ended.events.filter((e) => e.actorId === "ally" && ["attack", "skill", "status"].includes(e.kind)).length <= 1,
  );
  assert.equal(ended.state.round, 2);
}
assert.equal(applyTacticalTurn(companion, { type: "control", unitId: "beast", controller: "ai" }).ok, false);
const autoEnded = applyTacticalTurn(companion, { type: "defend", unitId: "hero" });
assert.ok(autoEnded.ok);
if (autoEnded.ok) {
  assert.deepEqual(
    autoEnded.events.filter((e) => e.kind === "phase").map((e) => e.phase),
    ["enemy", "player"],
  );
  assert.deepEqual(
    autoEnded.state.log
      .filter((e) => e.kind === "phase")
      .map((e) => e.phase)
      .slice(-2),
    ["enemy", "player"],
  );
}
const forgedBoss = createTacticalCombat(
  [{ ...actor("hero", "player"), boss: { points: 3, anticipation: true } }],
  [{ ...actor("boss"), boss: { points: 3, anticipation: true } }],
  { seed: 1, difficulty: "normal" },
);
assert.equal(forgedBoss.units[0]!.isBoss, false);
assert.equal(forgedBoss.units[0]!.boss, undefined);
assert.equal(forgedBoss.units[1]!.boss?.points, 3);

const healer: Combatant = { ...actor("healer"), skills: [heal] };
healer.tactics = { ...assignCombatTactics(healer, 1), adjective: "supportive" };
const wounded = { ...actor("wounded"), hp: 1 };
const hero = { ...actor("hero", "player"), attack: 1, defense: 1000, hp: 10000, maxHp: 10000 };
const healChoice = chooseClassicAction(healer, [healer, wounded], [hero], 1);
assert.deepEqual(healChoice, { type: "skill", skillId: "heal", targetId: "wounded" });
const roundUnits = [hero, healer, wounded];
resolveCombatRound(roundUnits, 1, "normal", undefined, { type: "defend" });
assert.equal(healer.mp, 22);
assert.ok(wounded.hp > 1, "Classic enemies can heal another enemy");
assert.equal(healer.skillCooldowns?.heal, 2);
assert.notEqual(chooseClassicAction(healer, [healer, { ...wounded, hp: 1 }], [hero], 2).type, "skill");

// Methodical uses a real defense debuff, then follows up while it is active.
const mage: Combatant = { ...actor("mage"), skills: [weaken] };
mage.tactics = { ...assignCombatTactics(mage, 4), adjective: "methodical" };
assert.equal(chooseClassicAction(mage, [mage], [hero], 1).type, "skill");
hero.statusEffects = [{ name: "Weaken", stat: "defense", modifier: -2, turnsLeft: 2 }];
assert.equal(chooseClassicAction(mage, [mage], [hero], 2).type, "attack");

// Both manual party commands execute in their own initiative slots.
const manualHero = { ...actor("manual-hero", "player"), hp: 1000, maxHp: 1000 };
const manualAlly = { ...actor("manual-ally", "player"), hp: 1000, maxHp: 1000, controller: "manual" as const };
const dummy = { ...actor("dummy"), hp: 10000, maxHp: 10000 };
const manualResult = resolveCombatRound(
  [manualHero, manualAlly, dummy],
  1,
  "normal",
  undefined,
  undefined,
  undefined,
  {
    [manualHero.id]: { type: "attack", targetId: dummy.id },
    [manualAlly.id]: { type: "attack", targetId: dummy.id },
  },
  manualHero.id,
);
assert.equal(manualResult.actions.filter((a) => a.attackerId === manualHero.id).length, 1);
assert.equal(manualResult.actions.filter((a) => a.attackerId === manualAlly.id).length, 1);
for (const queued of [false, true]) {
  const reactor = { ...actor("reactor", "player"), skills: [{ ...heal, reaction: "guard" as const }] };
  const victim = { ...actor("victim"), hp: 10000, maxHp: 10000 };
  const action = { type: "skill" as const, skillId: "heal", targetId: reactor.id };
  const invalidReaction = resolveCombatRound(
    [reactor, victim],
    1,
    "normal",
    undefined,
    action,
    undefined,
    queued ? { [reactor.id]: action } : undefined,
    reactor.id,
  );
  assert.equal(reactor.mp, 30, "An ordinary command cannot spend a reaction skill");
  assert.ok(!invalidReaction.actions.some((a) => a.attackerId === reactor.id));
}

console.info(
  "Combat AI: saved assignment, required taxonomy, pursuit, moving support, finite MP/cooldowns, manual orders and companion turn limits passed.",
);

// Profile differences are observable with the same legal kit and opponents.
const spell: CombatSkill = { id: "burst", name: "Burst", type: "attack", mpCost: 30, power: 1.2 };
const caster: Combatant = { ...actor("caster"), skills: [spell] };
const fitCaster = (adjective: NonNullable<Combatant["tactics"]>["adjective"]) => ({
  ...caster,
  tactics: { ...assignCombatTactics(caster, 9), adjective, proficiency: "master" as const },
});
assert.equal(chooseClassicAction(fitCaster("cautious"), [caster], [actor("target")], 1).type, "attack");
assert.equal(chooseClassicAction(fitCaster("reckless"), [caster], [actor("target")], 1).type, "skill");
const coward = { ...fitCaster("cowardly"), hp: 10 };
assert.equal(chooseClassicAction(coward, [coward], [actor("target")], 1).type, "defend");
assert.notEqual(
  chooseClassicAction(coward, [coward], [actor("target")], 2).type,
  "defend",
  "A unit does not defend indefinitely",
);
const patient = { ...fitCaster("patient"), skillCooldowns: { burst: 1 } };
assert.equal(chooseClassicAction(patient, [patient], [actor("target")], 1).type, "defend");
const coordinator = fitCaster("coordinated");
const teammate = fitCaster("disciplined");
teammate.id = "teammate";
teammate.tactics.targetId = "focused";
assert.equal(
  chooseClassicAction(coordinator, [coordinator, teammate], [actor("other"), actor("focused")], 1).targetId,
  "focused",
);
const guard = fitCaster("protective");
const protectedAlly = { ...actor("ward"), hp: 20 };
const threat = { ...actor("threat"), tactics: { ...assignCombatTactics(actor("threat"), 1), targetId: "ward" } };
assert.equal(chooseClassicAction(guard, [guard, protectedAlly], [actor("other"), threat], 1).targetId, "threat");
const beastClassic = { ...beast, tactics: assignCombatTactics(beast, 2) };
const beforeHealthChange = chooseClassicAction(
  beastClassic,
  [beastClassic],
  [actor("left"), actor("right")],
  1,
).targetId;
assert.equal(
  chooseClassicAction(beastClassic, [beastClassic], [{ ...actor("left"), hp: 1 }, actor("right")], 1).targetId,
  beforeHealthChange,
);

// Flying can cross the gap; a short-range teleporter cannot invent a landing.
const gap = arena();
gap.units[1]!.hp = 0;
gap.units[3]!.hp = 0;
for (const row of gap.grid.tiles) for (let x = 2; x <= 5; x++) row[x] = "water";
gap.units[2]!.movementMode = "teleport";
assert.equal(pursueOpponent(gap, gap.units[2]!), null);
gap.units[2]!.movementMode = "fly";
assert.ok(pursueOpponent(gap, gap.units[2]!));

// Max accepted board/unit bounds, representative mixed movement and skills.
const large = createTacticalCombat(
  Array.from({ length: 20 }, (_, i) => actor(`party-${i}`, "player")),
  Array.from({ length: 20 }, (_, i) => ({ ...actor(`enemy-${i}`), skills: [heal, weaken] })),
  { seed: 31, difficulty: "normal" },
);
large.grid = {
  width: 64,
  height: 64,
  tiles: Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => "plains" as const)),
};
large.units.forEach((u, i) => {
  u.x = i < 20 ? 5 : 58;
  u.y = (i % 20) * 3;
  u.movementMode = ["walk", "fly", "teleport"][i % 3] as "walk" | "fly" | "teleport";
});
large.phase = "enemy";
const started = performance.now();
const largeResult = runEnemyPhase(large);
assert.equal(largeResult.state.round, 2);
console.info(
  `40-unit / 64×64 mixed-movement ordinary phase: ${Math.round(performance.now() - started)} ms on this host.`,
);

const legacyBattle = arena();
for (const u of legacyBattle.units) {
  delete u.tactics;
  delete u.controller;
}
legacyBattle.phase = "enemy";
legacyBattle.units[2]!.x = legacyBattle.units[0]!.x - 1;
legacyBattle.units[2]!.hasMoved = true;
assert.equal(
  decideTacticalAction(legacyBattle, legacyBattle.units[2]!).type,
  "attack",
  "The public decision entry point preserves legacy attacks when a profile is absent",
);
assert.ok(
  runEnemyPhase(legacyBattle).state.units.every((u) => u.tactics === undefined),
  "Restoring a legacy snapshot does not silently assign new personalities",
);
const legacyMedic = legacyBattle.units[3]!;
legacyMedic.skills = [{ ...heal, reaction: "guard" }];
Object.assign(legacyBattle.units[2]!, { x: legacyMedic.x + 1, y: legacyMedic.y, hp: 1 });
assert.notEqual(
  decideTacticalAction(legacyBattle, legacyMedic, () => 0).type,
  "skill",
  "Legacy Tactical healing cannot spend a reaction outside its window",
);

// Combat floors attack-skill power at 1. The AI must value a low-authored-power
// area skill consistently with that result instead of favoring a weaker single hit.
const areaBattle = arena();
const areaCaster = areaBattle.units[3]!;
Object.assign(areaCaster, { x: 1, y: 1, attack: 20, hasMoved: true });
areaCaster.tactics!.adjective = "reckless";
areaCaster.tactics!.proficiency = "master";
areaCaster.skills = [
  { id: "burst", name: "Burst", type: "attack", mpCost: 0, power: 0.2, areaRadius: 1, range: 4 },
  { id: "needle", name: "Needle", type: "attack", mpCost: 0, power: 1.2, range: 4 },
];
areaBattle.units[2]!.hp = 0;
for (const [index, target] of areaBattle.units.slice(0, 2).entries())
  Object.assign(target, { x: 3, y: 1 + index, hp: 1000, maxHp: 1000, defense: 0 });
const areaChoice = decideTacticalAction(areaBattle, areaCaster);
assert.ok(areaChoice.type === "skill" && areaChoice.skillName === "Burst");
const preferred = new Set(["methodical", "cautious", "disciplined"]);
let noviceFit = 0,
  masterFit = 0,
  masterRare = 0;
for (let seed = 0; seed < 1000; seed++) {
  const base = { ...actor("mage"), combatClass: "mage" };
  const novice = assignCombatTactics({ ...base, aiHints: { proficiency: "novice" } }, seed);
  const master = assignCombatTactics({ ...base, aiHints: { proficiency: "master" } }, seed);
  noviceFit += Number(preferred.has(novice.adjective));
  masterFit += Number(preferred.has(master.adjective));
  masterRare += Number(master.adjective === "reckless");
}
assert.ok(
  masterFit > noviceFit && masterRare > 0,
  "Training favors role-suited personalities without eliminating unusual veterans",
);

// A new Methodical profile favors actual damage over an untargeted hold; then retains a real target.
const methodical = {
  ...actor("methodical"),
  tactics: {
    ...assignCombatTactics(actor("methodical"), 9),
    adjective: "methodical" as const,
    proficiency: "master" as const,
  },
};
assert.equal(
  chooseCombatCandidate(
    methodical,
    [
      { action: "hold", hold: true },
      { action: "attack", targetId: "foe", damage: 0.2 },
    ],
    1,
  ),
  "attack",
);
assert.equal(
  chooseCombatCandidate(
    methodical,
    [
      { action: "new", targetId: "other", damage: 0.3 },
      { action: "focused", targetId: "foe", damage: 0.2 },
    ],
    2,
  ),
  "focused",
);
// Legacy units must respect authored attack-skill range, too.
const legacyRange = arena();
legacyRange.units = legacyRange.units.slice(0, 2);
const [legacyCaster, legacyTarget] = legacyRange.units;
legacyCaster!.side = "enemy";
legacyCaster!.x = 1;
legacyCaster!.y = 1;
legacyCaster!.hasMoved = true;
delete legacyCaster!.tactics;
legacyCaster!.skills = [{ id: "touch", name: "Touch", type: "attack", power: 100, mpCost: 0, range: 1 }];
legacyTarget!.x = 3;
legacyTarget!.y = 1;
const rangedChoice = decideTacticalAction(legacyRange, legacyCaster!);
assert.notEqual(rangedChoice.type, "skill", "Legacy AI cannot cast a range-one skill at distance two");
legacyCaster!.skills[0]!.range = 2;
assert.equal(
  decideTacticalAction(legacyRange, legacyCaster!).type,
  "skill",
  "The same skill is available at its declared range",
);

legacyCaster!.skills = [{ ...heal, range: 1 }];
legacyTarget!.side = legacyCaster!.side;
legacyTarget!.hp = 10;
assert.notEqual(
  decideTacticalAction(legacyRange, legacyCaster!).type,
  "skill",
  "Legacy healing also respects range one",
);
legacyCaster!.skills[0]!.range = 2;
assert.equal(
  decideTacticalAction(legacyRange, legacyCaster!).type,
  "skill",
  "A wounded ally becomes healable at the declared range",
);
