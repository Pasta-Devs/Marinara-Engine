/**
 * Region spawns (Overworld, 2026-11-13): every stretch of the map has a fixed level band and a spawn table,
 * so the world does not grow with the party and a player cannot have the Game Master spawn anything.
 *
 *   - Bands are a pure function of the map cell: the start's land is 1 to 4, they never depend on the party,
 *     the game's difficulty shifts them, and the creator's hand bands (edits.bands, per settlement) win.
 *   - A cell's table is never empty, and draws on families whose habitats fit its ground.
 *   - A walk meets the land's foes by a seeded roll (the same walk meets the same foes), at levels in band,
 *     never a boss.
 *   - The land's foes keep their levels in the fight: an outmatched party meets a smaller fight, not foes
 *     pulled down to it; an overmatched one meets the land as it is.
 *   - The fight setup turns a walk's meeting into exactly the rolled foes, and gives unnamed foes the land's
 *     levels, while a named story foe stands apart.
 */
import assert from "node:assert/strict";

import {
  MARINARA_BESTIARY,
  WORLD_STARTER_KITS,
  checkWorldBrief,
  compileGameWorld,
  marinaraBestiarySetting,
  marinaraFoeFighters,
  parseWorldKit,
  worldBandEditIssues,
  worldCellHabitats,
  worldRegionBand,
  worldRegionSpawnTable,
  worldSettlementBand,
  worldWalkEncounter,
  type GameWorld,
  type MarinaraFoeBrief,
} from "../../../packages/shared/src/index.js";
import {
  regionFightEnemies,
  regionFightPlan,
  type RegionSpawnGame,
} from "../../../packages/server/src/services/game/region-spawns.service.js";

const gameOf = (id: string, seed: number): GameWorld => {
  const parsed = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === id)!);
  assert.ok(parsed.ok);
  const kit = parsed.kit;
  const checked = checkWorldBrief(kit, {
    briefVersion: 1,
    premise: "x",
    peopleNames: kit.cultures.map((culture) => ({
      culture: culture.id,
      given: ["Ama", "Tobin", "Hesk", "Mira", "Oswin", "Bryn", "Calla", "Doran"],
      family: ["Holt", "Drey", "Marrow", "Vane"],
      order: "given-family" as const,
    })),
  });
  assert.ok(checked.ok);
  const inputs = { kit, seed, grounding: "expand" as const, brief: checked.brief };
  return { ...inputs, world: compileGameWorld(inputs) };
};

const settlements = (game: GameWorld) => game.world.places.filter((place) => place.rank !== undefined);
const startAt = (game: GameWorld) => {
  const start = game.world.places.find((place) => place.id === game.world.startId)!;
  return (start.rank !== undefined ? start : (settlements(game).find((each) => each.id === start.parentId) ?? start))
    .at;
};

for (const kit of WORLD_STARTER_KITS) {
  const setting = marinaraBestiarySetting(kit.id, null);
  if (!setting) continue;
  const game = gameOf(kit.id, 11);
  const { width, height } = game.world;

  // The start's land is the first band, and every band is a band inside the level cap.
  assert.deepEqual(worldRegionBand(game, startAt(game)), { low: 1, high: 4 }, `${kit.id}: the start's land is 1 to 4`);
  let highest = 0;
  for (let y = 0; y < height; y += 3)
    for (let x = 0; x < width; x += 3) {
      const band = worldRegionBand(game, { x, y });
      assert.ok(band.low >= 1 && band.high <= 30 && band.high - band.low === 3, `${kit.id}: band at ${x},${y}`);
      highest = Math.max(highest, band.high);
      // The table is never empty and holds only families that exist in the band.
      const table = worldRegionSpawnTable(game, { x, y }, setting);
      assert.ok(table.families.length >= 1, `${kit.id}: a table at ${x},${y}`);
      for (const entry of table.families) {
        const family = MARINARA_BESTIARY.find((each) => each.id === entry.familyId)!;
        assert.ok(family.habitats?.length, `${kit.id}: no treasure foe in a table`);
      }
    }
  assert.ok(highest > 8, `${kit.id}: the far land is dangerous (highest band reaches ${highest})`);

  // Difficulty shifts every band; Easy never goes below 1.
  const far = { x: width - 1, y: height - 1 };
  const normal = worldRegionBand(game, far);
  const brutal = worldRegionBand(game, far, "brutal");
  assert.ok(brutal.low >= normal.low, `${kit.id}: Brutal is no gentler`);
  assert.equal(worldRegionBand(game, startAt(game), "casual").low, 1, `${kit.id}: Easy starts at 1`);

  // Hand bands: set for a settlement, they hold for its land; a non-settlement is refused.
  const town = settlements(game).find((place) => place.id !== game.world.startId)!;
  const edited: GameWorld = { ...game, edits: { editsVersion: 3, bands: [{ place: town.id, low: 20, high: 24 }] } };
  assert.deepEqual(worldRegionBand(edited, town.at), { low: 20, high: 24 }, `${kit.id}: a hand band holds`);
  assert.deepEqual(worldRegionBand(edited, town.at, "casual"), { low: 18, high: 22 }, "and difficulty still shifts it");
  assert.ok(worldSettlementBand(game, town.id), "the editor can show a settlement's own band");
  const site = game.world.places.find((place) => place.rank === undefined);
  if (site) assert.equal(worldBandEditIssues(game, { bands: [{ place: site.id }] }).length, 1, "only settlements");

  // Walks: seeded, in band, never a boss.
  const towns = settlements(game);
  let met = 0;
  for (let i = 0; i < 48; i++) {
    const from = towns[i % towns.length]!;
    const to = towns[(i + 1 + Math.floor(i / towns.length)) % towns.length]!;
    if (from.id === to.id) continue;
    const walk = { id: `walk-${i}`, from: from.id, to: to.id };
    const one = worldWalkEncounter({ game, walk, setting, partySize: 4 });
    const again = worldWalkEncounter({ game, walk, setting, partySize: 4 });
    assert.deepEqual(one, again, `${kit.id}: the same walk meets the same foes`);
    if (!one) continue;
    met++;
    assert.ok(one.foes.length >= 1);
    for (const foe of one.foes) {
      assert.ok(foe.level >= one.band.low && foe.level <= one.band.high, `${kit.id}: foes in band`);
      assert.notEqual(foe.tier, "boss", `${kit.id}: no boss on the road`);
    }
    assert.ok(worldCellHabitats(game, one.at).length >= 1);
  }
  assert.ok(met > 0, `${kit.id}: some walks meet foes`);
}

// The land's foes keep their levels in the fight.
{
  const briefs = (level: number): MarinaraFoeBrief[] =>
    [1, 2, 3, 4].map((n) => ({
      id: `w${n}`,
      name: `Wolf ${n}`,
      marinara: { region: true, family: { familyId: "hound", tier: "standard", level } },
    }));
  const low = marinaraFoeFighters({
    foes: briefs(14),
    partyLevels: [3, 3, 3, 3],
    partyAverageHp: 30,
    difficulty: "normal",
    setting: "high_fantasy",
  });
  assert.ok(low.fighters.length >= 1, "an outmatched party still meets the land's foes");
  assert.ok(low.fighters.length < 4, "but fewer of them");
  for (const fighter of low.fighters) assert.equal(fighter.level, 14, "at the land's level, not the party's");
  const high = marinaraFoeFighters({
    foes: briefs(3),
    partyLevels: [20, 20, 20, 20],
    partyAverageHp: 200,
    difficulty: "normal",
    setting: "high_fantasy",
  });
  assert.equal(high.fighters.length, 4, "an overmatched party meets all of them");
  for (const fighter of high.fighters) assert.equal(fighter.level, 3, "still at the land's level");
  // A foe outside the bestiary, given the land's level.
  const loose = marinaraFoeFighters({
    foes: [{ id: "x", name: "Bandit", marinara: { region: true, level: 9 } }],
    partyLevels: [2, 2],
    partyAverageHp: 20,
    difficulty: "normal",
    keepAll: true,
  });
  assert.equal(loose.fighters[0]!.level, 9);
}

// The fight setup: a walk's meeting is exactly the rolled foes; unnamed foes take the land's levels.
{
  const game = gameOf("high_fantasy", 11);
  const towns = settlements(game);
  const spawns: RegionSpawnGame = { game, setting: "high_fantasy", difficulty: "normal", partyLevels: [5, 5, 5, 5] };
  let walk: { id: string; from: string; to: string; days: number; ways: string[] } | null = null;
  for (let i = 0; i < 50 && !walk; i++) {
    const candidate = {
      id: `w${i}`,
      from: towns[0]!.id,
      to: towns[1 + (i % (towns.length - 1))]!.id,
      days: 1,
      ways: [],
    };
    if (worldWalkEncounter({ game, walk: candidate, setting: "high_fantasy", partySize: 4 })) walk = candidate;
  }
  assert.ok(walk, "some walk from the first town meets foes");
  const messages = [{ role: "assistant", content: "The road was long.", extra: { worldWalk: walk } }];
  const plan = regionFightPlan(spawns, messages, null);
  assert.ok(plan.met && plan.walkId === walk!.id, "the fight is the walk's meeting");
  const enemies = regionFightEnemies(
    spawns,
    plan,
    [{ name: "Whatever", family: "drake", tier: "boss", boss: {} }],
    "s",
  );
  assert.equal(enemies.length, plan.met!.foes.length, "one enemy per rolled foe");
  enemies.forEach((enemy, index) => {
    assert.equal(enemy.family, plan.met!.foes[index]!.familyId);
    assert.equal(enemy.regionFoe.level, plan.met!.foes[index]!.level);
    assert.equal(enemy.boss, undefined, "the model's boss is not the land's");
  });
  assert.equal(regionFightPlan(spawns, messages, walk!.id).met, null, "a meeting is fought once");

  // Without a walk: the table where the party is; a dragon the player asked for is not from here.
  const quiet = regionFightPlan(spawns, [{ role: "assistant", content: "In town.", extra: {} }], null);
  const table = new Set(quiet.table.families.map((entry) => entry.familyId));
  const inTable = [...table][0]!;
  const out = regionFightEnemies(
    spawns,
    quiet,
    [
      { name: "Local", family: inTable },
      { name: "Wyrm", family: table.has("drake") ? "nope" : "drake" },
      { name: "Lord Vexel", family: inTable, aiHints: { named: true } },
    ],
    "t",
  );
  assert.ok(out[0]!.regionFoe.level >= quiet.table.band.low && out[0]!.regionFoe.level <= quiet.table.band.high);
  assert.equal(out[1]!.family, undefined, "a family that does not live here fights by its tier");
  assert.ok(out[1]!.regionFoe, "at the land's level");
  assert.equal(out[2]!.regionFoe, undefined, "a named story foe stands apart");
}

console.log("region spawns: ok");
