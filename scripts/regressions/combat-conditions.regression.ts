import { pursueOpponent } from "../../packages/shared/src/features/tactical-combat/profile-ai.js";
import { resolveMessageWeatherAction } from "../../packages/client/src/lib/game-tag-parser.js";
import assert from "node:assert/strict";
import {
  normalizeGameDifficulty,
  normalizeWeatherType,
  combatWeatherEffects,
  weatherHitPenalty,
  classicHitProbability,
  ENEMY_DAMAGE_MULTIPLIERS,
  type CombatWeather,
  createTacticalCombat,
  forecastAttack,
  forecastTacticalAttack,
  getMovementRange,
  assignCombatTactics,
  chooseCombatCandidate,
  decideTacticalAction,
  validateTacticalBattlefieldBrief,
  type Combatant,
} from "../../packages/shared/src/index.js";
import { resolveAttack, resolveCombatRound } from "../../packages/server/src/services/game/combat.service.js";
import { chooseClassicAction } from "../../packages/server/src/services/game/combat-ai.service.js";
import { resolveCombatWeather, generateWeather } from "../../packages/server/src/services/game/weather.service.js";
import { resolveTacticalStartPreferences } from "../../packages/server/src/services/game/tactical-battlefield.service.js";
import {
  createCombatDirector,
  commandCombatDirector,
} from "../../packages/server/src/services/game/combat-director.service.js";
import { buildCombatBossPrompt } from "../../packages/server/src/services/game/combat-boss.service.js";
const unit = (id: string, side: Combatant["side"] = "player"): Combatant => ({
  id,
  name: id,
  side,
  hp: 500,
  maxHp: 500,
  attack: 30,
  defense: 0,
  speed: 10,
  level: 1,
  mp: 30,
  maxMp: 30,
});
const rain: CombatWeather = { version: 1, type: "rain", wind: "windy", visibility: "reduced", exposure: "exposed" };
const storm: CombatWeather = { ...rain, type: "storm", wind: "gale", visibility: "poor" };
const snow: CombatWeather = { ...rain, type: "snow" };
// Exercise the director's actual round boundary so dropping weather en route to
// scripted mechanics cannot silently bypass the shared elemental rules.
const roundMechanicDamage = (weather?: CombatWeather, element?: string) => {
  const state = createCombatDirector({
    id: "weather-mechanic",
    anchor: "a",
    party: [{ ...unit("hero"), speed: 10000 }],
    // Skip ordinary attacks so elemental auras cannot contaminate the mechanic proof.
    enemies: [{ ...unit("foe", "enemy"), speed: 0, element: "fire" }],
    style: "classic",
    gm: false,
    difficulty: "normal",
    seed: 1,
    weather,
    mechanics: [
      {
        name: "Pulse",
        description: "A periodic pulse",
        ownerName: "foe",
        trigger: "round_interval",
        interval: 1,
        effectType: "damage_all",
        power: 0.08,
        element,
      },
    ],
  });
  commandCombatDirector(state, { type: "classic", action: { type: "defend" } });
  assert.equal(state.round, 2);
  return state.log.find((event) => event.kind === "mechanic")?.message?.params?.amount;
};
assert.equal(roundMechanicDamage(rain, "fire"), 15, "Rain reduces fire mechanics before defending mitigation");
assert.equal(roundMechanicDamage(storm, "lightning"), 20, "Storms increase lightning mechanics");
for (const weather of [
  undefined,
  { ...rain, exposure: "sheltered" as const },
  { ...rain, exposure: "unknown" as const },
]) {
  assert.equal(roundMechanicDamage(weather, "fire"), 18, "Old saves and unexposed encounters remain neutral");
}
assert.equal(roundMechanicDamage(rain), 18, "Non-elemental mechanics do not inherit their owner's fire element");
for (const difficulty of Object.keys(ENEMY_DAMAGE_MULTIPLIERS)) {
  assert.equal(normalizeGameDifficulty(` ${difficulty.toUpperCase()} `), difficulty);
}
for (const value of [null, {}, "toString", "impossible"]) assert.equal(normalizeGameDifficulty(value), "normal");
assert.equal(normalizeWeatherType(" Rainy "), "rain");
assert.equal(normalizeWeatherType("HEAVY RAIN"), "heavy_rain");
for (const value of ["constructor", "__proto__"]) assert.equal(normalizeWeatherType(value), undefined);
assert.equal(resolveCombatWeather("rainy", "forest")?.exposure, "exposed");
assert.equal(resolveCombatWeather(rain, "cave")?.exposure, "sheltered");
assert.equal(resolveCombatWeather(rain, "ruins")?.exposure, "unknown");
assert.equal(resolveCombatWeather(rain, "ruins", "sheltered")?.exposure, "sheltered");
assert.equal(resolveCombatWeather("unrecognized", "forest"), undefined);
assert.equal(validateTacticalBattlefieldBrief({ exposure: ["exposed"] }).ok, false);
for (let i = 0; i < 20; i++) {
  const weather = generateWeather("desert", "summer", "blizzard");
  assert.equal(weather.type, "blizzard");
  assert.equal(weather.wind, "gale");
  assert.equal(weather.visibility, "poor");
}
for (const exposure of ["unknown", "sheltered"] as const) {
  assert.deepEqual(combatWeatherEffects({ ...storm, exposure }), combatWeatherEffects(undefined));
}
assert.equal(weatherHitPenalty(storm, { projectile: true, requiresSight: true }), 25);
assert.equal(weatherHitPenalty(storm, {}), 0);
assert.equal(classicHitProbability(0, 0, undefined, {}), 0.525);
assert.ok(classicHitProbability(0, 0, storm, { projectile: true }) < 0.525);
const oldRandom = Math.random;
try {
  Math.random = () => 0.5;
  const enemy = unit("foe", "enemy"),
    hero = unit("hero");
  const normal = resolveAttack(enemy, hero).finalDamage;
  for (const [difficulty, scale] of Object.entries(ENEMY_DAMAGE_MULTIPLIERS)) {
    assert.equal(resolveAttack(enemy, hero, difficulty.toUpperCase()).finalDamage, Math.floor(normal * scale));
    assert.equal(resolveAttack(hero, enemy, difficulty).finalDamage, normal);
  }
  const fire = { ...hero, element: "fire" };
  assert.equal(resolveAttack(fire, enemy, "normal", undefined, rain).finalDamage, Math.floor(normal * 0.85));
  const tagged = { ...hero, projectile: true, requiresSight: true };
  assert.equal(
    resolveAttack(tagged, enemy, "normal", undefined, storm).attackRoll,
    resolveAttack(tagged, enemy).attackRoll - 5,
  );
  assert.equal(
    resolveAttack(hero, enemy, "normal", undefined, storm).attackRoll,
    resolveAttack(hero, enemy).attackRoll,
  );
  const item = (weather?: CombatWeather) =>
    resolveCombatRound(
      [structuredClone(hero), structuredClone(enemy)],
      1,
      "normal",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        actorId: hero.id,
        defendingIds: new Set(),
        weather,
        action: {
          type: "item",
          itemId: "Flask",
          targetId: enemy.id,
          itemEffect: {
            name: "Flask",
            description: "Fire",
            target: "enemy",
            type: "damage",
            power: 0.2,
            element: "fire",
          },
        },
      },
    ).actions[0]!.finalDamage;
  assert.equal(item(rain), Math.floor(item() * 0.85));
} finally {
  Math.random = oldRandom;
}
const arena = () => {
  const s = createTacticalCombat([{ ...unit("hero"), projectile: true, requiresSight: true }], [unit("foe", "enemy")], {
    seed: 8,
    difficulty: "Hard",
  });
  s.grid = { width: 9, height: 9, tiles: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => "plains")) };
  Object.assign(s.units[0]!, { x: 3, y: 3, movement: 4, attackRange: { min: 1, max: 5 } });
  Object.assign(s.units[1]!, { x: 6, y: 3 });
  return s;
};
const s = arena();
assert.equal(s.difficulty, "hard");
const clear = forecastAttack(s, "hero", "foe");
s.weather = storm;
assert.equal(forecastAttack(s, "hero", "foe").hitChance, clear.hitChance - 25);
const untagged = forecastTacticalAttack(s, s.units[0]!, s.units[1]!, s.units[0]!, { traits: {} });
assert.equal(untagged.hitChance, clear.hitChance, "Skills do not inherit basic attack traits");
s.units[0]!.element = "fire";
s.weather = rain;
assert.equal(forecastAttack(s, "hero", "foe").damage, Math.floor(clear.damage * 0.85));
for (const movementMode of ["walk", "fly", "teleport"] as const) {
  s.units[0]!.movementMode = movementMode;
  delete s.weather;
  const dry = getMovementRange(s, "hero");
  s.weather = snow;
  const wet = getMovementRange(s, "hero");
  if (movementMode === "walk") assert.ok(wet.length < dry.length);
  else assert.deepEqual(wet, dry);
}
const preference = (seed: number) =>
  resolveTacticalStartPreferences({
    setup: { seed: 0, size: "small" },
    requestSeed: undefined,
    requestBattlefield: undefined,
    randomSeed: () => seed,
  });
assert.equal((preference(1) as { seed: number }).seed, 1);
assert.equal((preference(2) as { seed: number }).seed, 2);
let casualMistakes = 0,
  brutalMistakes = 0;
for (let seed = 0; seed < 100; seed++) {
  const actor = unit("foe", "enemy");
  actor.tactics = { ...assignCombatTactics(actor, seed), adjective: "disciplined", proficiency: "trained" };
  const candidates = [
    { action: "better", damage: 0.3 },
    { action: "weaker", damage: 0.27 },
  ];
  casualMistakes += Number(chooseCombatCandidate(structuredClone(actor), candidates, 1, "casual") === "weaker");
  brutalMistakes += Number(chooseCombatCandidate(structuredClone(actor), candidates, 1, "brutal") === "weaker");
}
assert.ok(casualMistakes > brutalMistakes, "Difficulty changes seeded decision consistency");
const companion = {
  ...unit("ally"),
  skills: [{ id: "burst", name: "Burst", type: "attack" as const, power: 1.1, mpCost: 3 }],
};
companion.tactics = assignCombatTactics(companion, 55);
assert.deepEqual(
  chooseClassicAction(structuredClone(companion), [companion], [unit("foe", "enemy")], 1, "casual", storm),
  chooseClassicAction(structuredClone(companion), [companion], [unit("foe", "enemy")], 1, "brutal", storm),
);
const tacticalCompanion = arena();
const low = structuredClone(tacticalCompanion),
  high = structuredClone(tacticalCompanion);
low.difficulty = "casual";
high.difficulty = "brutal";
// No incoming counter/danger difference: this proves the companion decision tuning is independent.
low.units[1]!.attack = high.units[1]!.attack = 0;
assert.deepEqual(decideTacticalAction(low, low.units[0]!), decideTacticalAction(high, high.units[0]!));
for (const style of ["classic", "tactical"] as const) {
  const battle = createCombatDirector({
    id: "weather",
    anchor: "a",
    party: [unit("hero")],
    enemies: [{ ...unit("boss", "enemy"), boss: { points: 1, anticipation: true } }],
    style,
    gm: true,
    difficulty: "Brutal",
    weather: rain,
    seed: 3,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(battle)).weather, rain);
  assert.equal(battle.difficulty, "brutal");
  if (style === "tactical") assert.deepEqual(battle.tactical!.weather, rain);
  // No provider call needed to inspect the actual prompt boundary.
  battle.window = { id: "w", actorId: "boss", kind: "ordinary", controller: "gm", options: [] };
  const prompt = buildCombatBossPrompt(battle)
    .map((m) => m.content)
    .join("\n");
  assert.match(prompt, /"difficulty":"brutal"/);
  assert.match(prompt, /"weatherEffects"/);
  assert.match(prompt, /"exposure":"exposed"/);
  assert.doesNotMatch(prompt, /"seed"|"pending"|"tasks"/);
}
console.info(
  "Combat conditions: casing, enemy-only scaling, weather aliases/exposure/traits/forecasts/movement, seed retirement, AI consistency and boss context passed.",
);

// Element IDs, rather than translated names, make both policies prefer lightning in rain.
const mage: Combatant = {
  ...unit("mage", "enemy"),
  skills: [
    { id: "a", name: "First", type: "attack", power: 2, mpCost: 0, element: "fire", range: 12 },
    { id: "b", name: "Second", type: "attack", power: 1.9, mpCost: 0, element: "lightning", range: 12 },
  ],
};
mage.tactics = { ...assignCombatTactics(mage, 55), adjective: "reckless", proficiency: "master" };
const foe = unit("target");
assert.equal(chooseClassicAction(structuredClone(mage), [mage], [foe], 1, "brutal").skillId, "a");
assert.equal(chooseClassicAction(structuredClone(mage), [mage], [foe], 1, "brutal", rain).skillId, "b");
const weatherChoice = createTacticalCombat([foe], [mage], { seed: 8, difficulty: "brutal" });
weatherChoice.grid = {
  width: 5,
  height: 5,
  tiles: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => "plains")),
};
Object.assign(weatherChoice.units[0]!, { x: 3, y: 1 });
Object.assign(weatherChoice.units[1]!, { x: 1, y: 1, hasMoved: true });
const dryChoice = decideTacticalAction(structuredClone(weatherChoice), structuredClone(weatherChoice.units[1]!));
weatherChoice.weather = rain;
const rainyChoice = decideTacticalAction(weatherChoice, weatherChoice.units[1]!);
assert.ok(dryChoice.type === "skill" && dryChoice.skillName === "First");
assert.ok(rainyChoice.type === "skill" && rainyChoice.skillName === "Second");

// Check the incoming message while the UI still reports exploration, as well as an already-active fight.
for (const content of ["An ambush. [state: combat]", '[combat: enemies="Goblin"]']) {
  assert.equal(resolveMessageWeatherAction("exploration", content), null);
  assert.equal(resolveMessageWeatherAction("dialogue", content), null);
}
assert.equal(resolveMessageWeatherAction("combat", "The fight continues."), null);
assert.equal(resolveMessageWeatherAction("exploration", "A quiet path."), "explore");
assert.equal(resolveMessageWeatherAction("travel_rest", "A quiet camp."), "travel");
assert.equal(resolveMessageWeatherAction("dialogue", "A quiet greeting."), "turn");

// Pursuit must route around expensive tiles, using the same snowy movement budget as actual moves.
const pursuit = arena();
pursuit.weather = snow;
Object.assign(pursuit.units[0]!, { x: 1, y: 2, movementMode: "walk", attackRange: { min: 1, max: 1 } });
Object.assign(pursuit.units[1]!, { x: 5, y: 2 });
for (let x = 2; x <= 4; x++) pursuit.grid.tiles[2]![x] = "mountain";
const pursued = pursueOpponent(pursuit, pursuit.units[0]!);
assert.ok(pursued);
assert.notDeepEqual(pursued.to, { x: 2, y: 2 }, "A short expensive route must not beat the cheaper detour");
assert.ok(getMovementRange(pursuit, "hero").some((tile) => tile.x === pursued.to.x && tile.y === pursued.to.y));
