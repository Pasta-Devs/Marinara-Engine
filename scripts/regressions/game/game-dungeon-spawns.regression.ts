/**
 * Dungeon spawns (location spawns, 2026-11-13): every generated map in every setting gets a site whose
 * foes keep the site's band (never the party's), fit a fight's caps, put no boss below level 5, keep the
 * way in empty and the heart held, and roll the same every time. Cleared areas stay empty for three days,
 * then squatters move back in; a dead leader's heart stays empty. The Game Master's text lists the foes
 * and forbids spawning others.
 */
import assert from "node:assert/strict";
import {
  MARINARA_BESTIARY_SETTINGS,
  MARINARA_MAX_FOES,
  MARINARA_TIER_RULES,
  marinaraEnemyFamily,
  marinaraEnemyName,
} from "../../../packages/shared/src/features/marinara-bestiary.js";
import {
  DUNGEON_SETS,
  gameDungeonMapFromDungeon,
  generateDungeonMap,
} from "../../../packages/shared/src/features/world/dungeon-map.js";
import { marinaraFightStart } from "../../../packages/server/src/services/game/marinara-fight-start.service.js";
import {
  dungeonFightEndPatch,
  dungeonFoesHere,
  dungeonSiteHere,
} from "../../../packages/server/src/services/game/dungeon-spawns.service.js";
import type { Combatant } from "../../../packages/shared/src/types/game.js";
import {
  DUNGEON_REFILL_DAYS,
  dungeonAreaFoesNow,
  dungeonAreas,
  dungeonFallbackRegionBand,
  dungeonSiteBand,
  dungeonSiteFate,
  dungeonSiteAfterWin,
  dungeonSiteFor,
  dungeonSiteOrigin,
  dungeonSpawnPromptText,
  gameDungeonSiteStateSchema,
  readGameDungeonSiteTags,
} from "../../../packages/shared/src/features/world/dungeon-spawns.js";

let sites = 0;
let missing = 0;
for (const setting of MARINARA_BESTIARY_SETTINGS) {
  for (const set of DUNGEON_SETS) {
    for (const low of [1, 4, 9, 15, 22]) {
      const origin = dungeonSiteOrigin(set.id, `The ${set.label}`);
      const band = dungeonSiteBand(origin, { low, high: low + 3 });
      const site = dungeonSiteFor({ setId: set.id, name: `The ${set.label}`, setting, band, seed: 7 });
      if (!site) {
        missing++;
        continue;
      }
      sites++;
      assert.deepEqual(
        dungeonSiteFor({ setId: set.id, name: `The ${set.label}`, setting, band, seed: 7 }),
        site,
        "a site draws the same foes every time",
      );
      for (const id of [site.holder, ...(site.leader ? [site.leader] : []), ...site.squatters]) {
        const family = marinaraEnemyFamily(id)!;
        assert.ok(marinaraEnemyName(family, setting, band.low), `${id} lives in ${setting} at ${band.low}`);
        assert.notEqual(family.role, "treasure", "treasure foes come only by the rare roll");
      }
      for (const seed of [1, 2, 3]) {
        const map = gameDungeonMapFromDungeon(generateDungeonMap(set.id, seed, "medium"), set.label, "m");
        const areas = dungeonAreas(map, site, setting);
        assert.equal(areas.length, map.rooms.length);
        assert.deepEqual(dungeonAreas(map, site, setting), areas, "areas roll the same every time");
        const entry = areas.find((area) => area.role === "entry");
        assert.ok(entry && entry.foes.length === 0, "the way in is empty");
        const heart = areas.find((area) => area.role === "heart");
        if (map.rooms.length > 1) assert.ok(heart && heart.foes.length > 0, `${set.id} ${setting} L${low}: heart held`);
        for (const area of areas) {
          assert.ok(area.foes.length <= MARINARA_MAX_FOES, "a fight has room for six");
          assert.ok(area.foes.filter((foe) => foe.tier === "boss").length <= 1, "one boss at most");
          for (const foe of area.foes) {
            assert.ok(foe.level >= band.low && foe.level <= band.high, `level ${foe.level} outside ${band.low}-${band.high}`);
            assert.ok(foe.level >= MARINARA_TIER_RULES[foe.tier].minLevel, `${foe.tier} at level ${foe.level}`);
          }
        }
      }
    }
  }
}
assert.ok(missing / (sites + missing) < 0.05, `${missing} of ${sites + missing} sites found nobody to live there`);

// The band is the place's: a level 2 party and a level 20 one meet the same crypt.
{
  const band = dungeonSiteBand("crypt", { low: 9, high: 12 });
  assert.deepEqual(band, { low: 10, high: 14 });
  const site = dungeonSiteFor({ setId: "dungeon_crypt", name: "Old Barrow", setting: "high_fantasy", band, seed: 3 })!;
  const map = gameDungeonMapFromDungeon(generateDungeonMap("dungeon_crypt", 3, "medium"), "Old Barrow", "m");
  const areas = dungeonAreas(map, site, "high_fantasy");
  const state = gameDungeonSiteStateSchema.parse({ band });
  const guard = areas.find((area) => area.foes.length && area.role !== "heart")!;
  assert.ok(guard, "a crypt has foes outside its heart");
  // Cleared today: empty for three days, then squatters, rolled the same each time.
  const cleared = { ...state, cleared: { [String(guard.area)]: 5 } };
  assert.deepEqual(dungeonAreaFoesNow(guard, site, "high_fantasy", cleared, 7), []);
  const back = dungeonAreaFoesNow(guard, site, "high_fantasy", cleared, 5 + DUNGEON_REFILL_DAYS);
  assert.ok(back.length > 0, "the area fills again");
  assert.deepEqual(dungeonAreaFoesNow(guard, site, "high_fantasy", cleared, 5 + DUNGEON_REFILL_DAYS), back);
  const heart = areas.find((area) => area.role === "heart")!;
  assert.deepEqual(dungeonAreaFoesNow(heart, site, "high_fantasy", { ...state, leaderDead: true }, 1), []);
  assert.deepEqual(
    dungeonAreaFoesNow(heart, site, "high_fantasy", { ...state, cleared: { [String(heart.area)]: 1 } }, 99),
    [],
    "a cleared heart stays empty",
  );
  const text = dungeonSpawnPromptText({ map, site, areas, state, setting: "high_fantasy", today: 1, partyLevel: 3 });
  assert.match(text, /levels 10-14, fixed by the world/u);
  assert.match(text, /never spawn a creature a player asks for/u);
  assert.match(text, /far beyond the party/u);
  assert.ok(text.includes(`[${site.holder}]`), "the holder's family id is given");
}

// A map made by hand has no rosters: its author writes who is there.
{
  const map = { ...gameDungeonMapFromDungeon(generateDungeonMap("cave_rock", 1, "small"), "Den", "m"), hand: true as const };
  const site = dungeonSiteFor({ setId: "cave_rock", name: "Den", setting: "high_fantasy", band: { low: 3, high: 7 }, seed: 1 })!;
  assert.deepEqual(dungeonAreas(map, site, "high_fantasy"), []);
}

// How a place fell decides who holds it: a ruin lost to plague is held by the dead.
{
  const history = {
    events: [
      { yearsAgo: 40, kind: "catastrophe" as const, text: "Plague struck Varn; many died.", places: ["p1"], groups: [], severe: true as const },
      { yearsAgo: 40, kind: "catastrophe" as const, text: "Old Varn was abandoned after it.", places: ["p1"], groups: [], severe: true as const },
    ],
  };
  assert.equal(dungeonSiteFate(history, "Old Varn"), "sickness");
  assert.equal(dungeonSiteFate(history, "Elsewhere"), undefined);
  assert.equal(dungeonSiteFate(history, "Elsewhere", "p1"), "sickness");
  const site = dungeonSiteFor({
    setId: "dungeon_temple",
    name: "Old Varn",
    setting: "high_fantasy",
    band: { low: 6, high: 10 },
    fate: "sickness",
    seed: 1,
  })!;
  assert.ok(["gorger", "bones", "shade"].includes(site.holder), `plague ruin held by ${site.holder}`);
}

// The fallback region band climbs away from where the game began.
{
  const world = { width: 40, height: 30, startId: "s", places: [{ id: "s", at: { x: 5, y: 5 } }] };
  const near = dungeonFallbackRegionBand(world, { x: 6, y: 5 });
  const far = dungeonFallbackRegionBand(world, { x: 39, y: 29 });
  assert.ok(near.low <= 2 && far.low > near.low + 10, `bands ${near.low} and ${far.low}`);
}

// Displaced holders never come back (owner 2026-11-13): a gang that lost its chief scatters, and its posts
// stand empty or squatters take them; beasts that lost their alpha breed back.
{
  const map = gameDungeonMapFromDungeon(generateDungeonMap("dungeon_sewer", 4, "medium"), "Old Drains", "m");
  const gang = { origin: "sewer" as const, band: { low: 6, high: 10 }, holder: "cutpurse", leader: "captain", squatters: ["gnawer"] };
  const areas = dungeonAreas(map, gang, "the_1920s");
  const heart = areas.find((area) => area.role === "heart")!;
  const guards = areas.filter((area) => area.role === "guard");
  assert.ok(guards.length, "the gang has posts");
  const won = dungeonSiteAfterWin(gameDungeonSiteStateSchema.parse({ band: gang.band }), gang, heart, 4);
  assert.ok(won.leaderDead && won.displaced, "a gang without its chief is gone");
  for (const guard of guards)
    for (const foe of dungeonAreaFoesNow(guard, gang, "the_1920s", won, 4))
      assert.ok(foe.familyId !== gang.holder && foe.familyId !== gang.leader, "the gang never comes back");
  const later = dungeonSiteAfterWin(won, gang, guards[0]!, 5);
  for (const foe of dungeonAreaFoesNow(guards[0]!, gang, "the_1920s", later, 30))
    assert.notEqual(foe.familyId, gang.holder, "a refilled post is squatters'");
  assert.match(dungeonSpawnPromptText({ map, site: gang, areas, state: won, setting: "the_1920s", today: 5 }), /gone for good/u);

  const den = dungeonSiteFor({ setId: "cave_rock", name: "Den", setting: "high_fantasy", band: { low: 3, high: 7 }, seed: 1 })!;
  if (!["cunning", "tactical", "genius"].includes(marinaraEnemyFamily(den.holder)!.mind)) {
    const caveMap = gameDungeonMapFromDungeon(generateDungeonMap("cave_rock", 2, "medium"), "Den", "m");
    const caveAreas = dungeonAreas(caveMap, den, "high_fantasy");
    const caveHeart = caveAreas.find((area) => area.role === "heart")!;
    const beaten = dungeonSiteAfterWin(gameDungeonSiteStateSchema.parse({ band: den.band }), den, caveHeart, 1);
    assert.ok(beaten.leaderDead && !beaten.displaced, `${den.holder} breed back`);
    const post = caveAreas.find((area) => area.role === "guard");
    if (post) {
      const cleared = dungeonSiteAfterWin(beaten, den, post, 1);
      assert.deepEqual(dungeonAreaFoesNow(post, den, "high_fantasy", cleared, 1 + DUNGEON_REFILL_DAYS), post.foes);
    }
  }
  assert.equal(readGameDungeonSiteTags("They flee. [site: displaced]").displaced, true);
  assert.equal(readGameDungeonSiteTags("No tag here.").displaced, false);
}

// In a game: the party standing in a held area fights that area's roster at the site's levels, whatever
// the setup wrote and whatever the party's level; winning clears the area, and the clear is kept.
{
  const made = generateDungeonMap("dungeon_crypt", 9, "medium");
  const base = gameDungeonMapFromDungeon(made, "Grey Barrow", "map-1");
  const meta: Record<string, unknown> = {
    gameDungeonMap: base,
    gameSetupConfig: { marinaraClasses: true, genre: "fantasy" },
    gameWorldKit: { id: "high_fantasy" },
    gameTime: { day: 4, hour: 9, minute: 0 },
    gameDungeonSites: { "name:grey barrow": { band: { low: 12, high: 16 }, cleared: {} } },
  };
  const first = dungeonSiteHere({ meta, setup: meta.gameSetupConfig as Record<string, unknown>, world: null })!;
  assert.ok(first && !first.fresh, "the kept band is read");
  const held = first.areas.find((area) => area.foes.length && area.role !== "heart")!;
  const room = base.rooms[held.area - 1]!;
  meta.gameDungeonMap = { ...base, at: { x: room.x, y: room.y } };
  const here = dungeonSiteHere({ meta, setup: meta.gameSetupConfig as Record<string, unknown>, world: null })!;
  const foes = dungeonFoesHere(here, 4)!;
  assert.equal(foes.area.area, held.area);
  const unit = (id: string, name: string, side: "player" | "enemy"): Combatant =>
    ({ id, name, side, hp: 20, maxHp: 20, mp: 0, maxMp: 0, attack: 5, defense: 5, speed: 5, level: 1, skills: [] }) as unknown as Combatant;
  const start = marinaraFightStart({
    gameId: "g",
    cards: [],
    party: [unit("p1", "Ayla", "player")],
    enemies: [unit("e1", "A dragon the player asked for", "enemy")],
    difficulty: "normal",
    storyFight: false,
    setting: "high_fantasy",
    placeFoes: foes.foes,
  });
  assert.ok(!start.enemies.some((one) => one.name.includes("dragon")), "the player's wish does not fight");
  const levels = start.fighters.filter((one) => one.familyId).map((one) => one.level);
  assert.ok(levels.length > 0 && levels.every((level) => level >= 12 && level <= 16), `levels ${levels}`);
  // A story's own fight keeps its own foes.
  const story = marinaraFightStart({
    gameId: "g",
    cards: [],
    party: [unit("p1", "Ayla", "player")],
    enemies: [unit("e1", "The Warden", "enemy")],
    difficulty: "normal",
    storyFight: true,
    setting: "high_fantasy",
    placeFoes: foes.foes,
  });
  assert.deepEqual(story.enemies.map((one) => one.name), ["The Warden"]);

  meta.gameDungeonFight = { key: here.key, area: held.area };
  assert.deepEqual(dungeonFightEndPatch(meta, "flee"), { gameDungeonFight: null }, "fleeing clears nothing");
  const won = dungeonFightEndPatch(meta, "victory");
  const sites = won.gameDungeonSites as Record<string, { cleared: Record<string, number> }>;
  assert.equal(sites["name:grey barrow"]!.cleared[String(held.area)], 4);
  const after = { ...meta, ...won };
  const later = dungeonSiteHere({ meta: after, setup: after.gameSetupConfig as Record<string, unknown>, world: null })!;
  assert.equal(dungeonFoesHere(later, 5), null, "a cleared area stays empty");
  // A game without Classic classes has no dungeon foes.
  assert.equal(dungeonSiteHere({ meta, setup: { marinaraClasses: false }, world: null }), null);
}

console.log(`dungeon spawns: ${sites} sites, ${missing} with nobody`);
