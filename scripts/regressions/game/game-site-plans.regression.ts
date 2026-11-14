/**
 * Building plans (owner 2026-11-14, "Dungeon building plans: design"): a manor, a keep, a temple or a
 * crypt is planned once as a whole building and laid out a level at a time. Every level fits a map, every
 * room is reached from where the party comes onto the level (through locked doors, whose keys are reached
 * without them), the stairs stand at the same cells on both levels they join, the heart is in one room,
 * traps come only where the rules can find them, and walking opens locks and sets off hidden traps.
 */
import assert from "node:assert/strict";
import {
  dungeonFromGameDungeonMap,
  dungeonPath,
  dungeonWalkable,
  gameDungeonMapPromptText,
  gameDungeonMapSchema,
  gameDungeonOnWayOut,
} from "../../../packages/shared/src/features/world/dungeon-map.js";
import {
  SITE_LOCK_PROP,
  SITE_TEMPLATE_IDS,
  gameDungeonPlannedMap,
  readGameDungeonPlanTags,
  siteApplyTags,
  siteLevelMap,
  sitePlan,
  sitePlanInputFor,
  sitePlanInputOf,
  siteTrapPromptText,
  siteWalk,
  type SiteFate,
  type SiteTerrain,
} from "../../../packages/shared/src/features/world/site-plans.js";
import {
  dungeonAreas,
  dungeonFloorBand,
  dungeonPlannedFloor,
  dungeonSiteFor,
} from "../../../packages/shared/src/features/world/dungeon-spawns.js";
import { MARINARA_TIER_RULES } from "../../../packages/shared/src/features/marinara-bestiary.js";

const FATES: Array<SiteFate | undefined> = [undefined, "war", "sickness", "famine", "flood"];
const TERRAINS: Array<SiteTerrain | undefined> = [undefined, "hill", "coast", "wet", "city"];
let levels = 0;
for (const template of SITE_TEMPLATE_IDS)
  for (const wealth of [1, 2, 3] as const)
    for (let seed = 1; seed <= 12; seed++) {
      const fate = FATES[seed % FATES.length];
      const terrain = TERRAINS[(seed * 3) % TERRAINS.length];
      const plan = sitePlan({ template, seed, wealth, fate, terrain, undead: seed % 3 === 0 });
      const label = `${template} w${wealth} s${seed} ${fate ?? "-"} ${terrain ?? "-"}`;
      assert.ok(plan.levels[plan.entry]?.depth === 0, `${label}: entered on its ground level`);
      assert.equal(
        plan.levels.reduce((n, level) => n + level.rooms.filter((room) => room.heart).length, 0),
        1,
        `${label}: one heart`,
      );
      // Same input, same building.
      assert.deepEqual(sitePlan({ template, seed, wealth, fate, terrain, undead: seed % 3 === 0 }), plan);
      const laid = plan.levels.map((_, index) => siteLevelMap(plan, index, { traps: seed % 2 === 0 }));
      let hearts = 0;
      for (const [index, level] of laid.entries()) {
        levels++;
        const where = `${label} ${plan.levels[index]!.name}`;
        const { map } = level;
        assert.ok(map.width <= 64 && map.height <= 48, `${where}: fits a map`);
        assert.ok(level.rooms.length > 0 && level.rooms.length <= 40, `${where}: has rooms`);
        hearts += level.rooms.filter((room) => room.heart).length;
        assert.ok(map.entrance.x >= 0, `${where}: a way onto it`);
        // Every open cell reached from the way on, through locked doors.
        const seen = new Set<number>();
        const queue = [map.entrance.y * map.width + map.entrance.x];
        seen.add(queue[0]!);
        const through = (x: number, y: number) =>
          dungeonWalkable(map, x, y) || map.props[y * map.width + x] === SITE_LOCK_PROP;
        for (let head = 0; head < queue.length; head++) {
          const c = queue[head]!;
          const x = c % map.width;
          const y = (c - x) / map.width;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const n = (y + dy) * map.width + x + dx;
            if (!seen.has(n) && through(x + dx, y + dy)) {
              seen.add(n);
              queue.push(n);
            }
          }
        }
        for (const [n, room] of map.rooms.entries()) {
          let reached = false;
          for (let y = room.y; y < room.y + room.h && !reached; y++)
            for (let x = room.x; x < room.x + room.w; x++) if (seen.has(y * map.width + x)) reached = true;
          assert.ok(reached, `${where}: ${level.rooms[n]!.name} is reached`);
        }
        // A key is reached without the lock it opens.
        for (const lock of level.locks) {
          const key = map.rooms[lock.key]!;
          const cell = (() => {
            for (let y = key.y; y < key.y + key.h; y++)
              for (let x = key.x; x < key.x + key.w; x++) if (dungeonWalkable(map, x, y)) return { x, y };
            return null;
          })();
          assert.ok(
            cell && dungeonPath(map, map.entrance, cell),
            `${where}: the key to ${level.rooms[lock.room]!.name} is reached`,
          );
          assert.notEqual(lock.room, lock.key, `${where}: a key is never behind its own lock`);
        }
        // Links: on the hall, walkable, and at the same cell on the level they lead to.
        for (const link of level.links) {
          assert.ok(dungeonWalkable(map, link.x, link.y), `${where}: its ${link.kind} stands on the floor`);
          const back = laid[link.level]!.links.find((other) => other.level === index && other.kind === link.kind);
          assert.ok(back && back.x === link.x && back.y === link.y, `${where}: its ${link.kind} lines up`);
        }
        assert.equal(
          new Set(level.links.map((link) => `${link.x},${link.y}`)).size,
          level.links.length,
          `${where}: no two links share a cell`,
        );
        // Traps only when asked, never on a link or the way on.
        if (seed % 2 === 1) assert.equal(level.traps.length, 0, `${where}: no traps without rules for them`);
        for (const trap of level.traps) {
          assert.ok(!level.links.some((link) => link.x === trap.x && link.y === trap.y), `${where}: no trap on a link`);
          assert.ok(dungeonWalkable(map, trap.x, trap.y), `${where}: a trap is on the floor`);
        }
      }
      assert.equal(hearts, 1, `${label}: the heart is laid out`);
      if (template === "manor" && seed % 3 === 0)
        assert.ok(
          plan.levels.find((level) => level.id === "crypt")?.rooms.some((room) => room.heart),
          `${label}: undead keep their heart in the family crypt`,
        );
      if (template !== "crypt" && terrain === "hill" && template === "manor")
        assert.ok(
          plan.levels.some((level) => level.id === "rock-cellar"),
          `${label}: a hillside has rock cellars`,
        );
    }
assert.ok(levels > 300, `levels laid out: ${levels}`);

// A vampire's mansion by its name: rich, undead, with a crypt under it.
const vlad = sitePlanInputFor({ template: "manor", name: "Count Vlad's Manor", seed: 41 });
assert.equal(vlad.undead, true);
assert.equal(vlad.wealth, 2);
assert.equal(sitePlanInputFor({ template: "keep", name: "The Ruined Castle", seed: 5 }).wealth, 3);

// As the game keeps it: the map parses, the way out is on the ground level only, the stairs lead on.
const ground = gameDungeonPlannedMap({ plan: vlad, name: "Count Vlad's Manor", id: "m1", traps: true });
assert.ok(gameDungeonMapSchema.safeParse(ground).success, "a planned level is kept");
assert.ok(gameDungeonOnWayOut(ground), "the party comes in by the door");
assert.equal(sitePlanInputOf(ground)?.template, "manor");
const prompt = gameDungeonMapPromptText(ground);
assert.match(prompt, /Ground floor of \d levels/u);
assert.match(prompt, /Entrance hall/u);
assert.match(prompt, /the main stairs to the/u);
const down = ground.links!.find((link) => ground.site!.levels[link.level]!.depth < 0)!;
const cellar = gameDungeonPlannedMap({
  plan: vlad,
  name: "Count Vlad's Manor",
  id: "m2",
  level: down.level,
  from: ground.site!.level,
  traps: true,
});
assert.deepEqual(cellar.at, { x: down.x, y: down.y }, "the party comes down where the stairs are");
assert.ok(!gameDungeonOnWayOut(cellar), "no way out from the cellar");

// Walking: a key's room opens its lock; a hidden trap stops the walk and is spent.
{
  const withLock = [0, 1, 2, 3, 4, 5]
    .map((level) => gameDungeonPlannedMap({ plan: vlad, name: "Manor", id: `l${level}`, level }))
    .find((map) => map.locks?.length);
  assert.ok(withLock, "some level is locked");
  const lock = withLock.locks![0]!;
  const keyRoom = withLock.rooms[lock.key]!;
  const cells = dungeonFromGameDungeonMap(withLock);
  let target: { x: number; y: number } | null = null;
  for (let y = keyRoom.y; y < keyRoom.y + keyRoom.h && !target; y++)
    for (let x = keyRoom.x; x < keyRoom.x + keyRoom.w; x++)
      if (dungeonWalkable(cells, x, y) && dungeonPath(cells, withLock.at, { x, y })) {
        target = { x, y };
        break;
      }
  const walked = siteWalk(withLock, dungeonPath(cells, withLock.at, target!)!);
  assert.ok(walked.unlocked.length >= 1, "the key opened its lock");
  assert.ok(!walked.map.locks?.some((each) => each.room === lock.room), "the lock is gone");
  assert.equal(walked.map.props[lock.y * withLock.width + lock.x], "-", "its door is open");
  assert.ok(walked.map.site!.seen[String(withLock.site!.level)]!.includes(lock.key), "the key's room is seen");
  // Kept across levels: laid out again with that state, the lock stays open.
  const again = gameDungeonPlannedMap({
    plan: vlad,
    name: "Manor",
    id: "again",
    level: withLock.site!.level,
    state: { unlocked: walked.map.site!.unlocked },
  });
  assert.ok(!again.locks?.some((each) => each.room === lock.room), "an opened lock stays open");
}
{
  const trapped = [0, 1, 2, 3, 4, 5]
    .map((level) => gameDungeonPlannedMap({ plan: vlad, name: "Manor", id: `t${level}`, level, traps: true }))
    .find((map) => map.traps?.some((trap) => dungeonPath(dungeonFromGameDungeonMap(map), map.at, trap)));
  assert.ok(trapped, "some level has a trap the party can walk onto");
  const cells = dungeonFromGameDungeonMap(trapped);
  const trap = trapped.traps!.find((each) => dungeonPath(cells, trapped.at, each))!;
  const path = dungeonPath(cells, trapped.at, trap)!;
  const walked = siteWalk(trapped, path);
  assert.deepEqual(walked.map.at, { x: trap.x, y: trap.y }, "the walk stops on the trap");
  assert.equal(walked.trap?.dc, trap.dc);
  assert.ok(!walked.map.traps?.some((each) => each.x === trap.x && each.y === trap.y), "a trap set off is spent");
  // The Game Master's tags: found traps show and are walked round, disarmed ones go.
  const other = trapped.traps!.find((each) => each !== trap);
  if (other) {
    const area =
      trapped.rooms.findIndex((r) => other.x >= r.x && other.x < r.x + r.w && other.y >= r.y && other.y < r.y + r.h) +
      1;
    const found = siteApplyTags(trapped, readGameDungeonPlanTags(`They spot it. [trap: found area=${area}]`));
    const marked = found.traps!.find((each) => each.x === other.x && each.y === other.y);
    assert.equal(marked?.found, true, "a found trap is marked");
    assert.ok(!dungeonWalkable(dungeonFromGameDungeonMap(found), other.x, other.y), "a found trap is walked round");
    const gone = siteApplyTags(found, readGameDungeonPlanTags(`[trap: disarmed area=${area}]`));
    assert.ok(!gone.traps?.some((each) => each.x === other.x && each.y === other.y), "a disarmed trap is gone");
  }
  assert.match(siteTrapPromptText(trapped, ["Perception", "Investigation"]), /Perception or Investigation check/u);
  assert.equal(siteTrapPromptText(gameDungeonPlannedMap({ plan: vlad, name: "Manor", id: "n" }), ["Perception"]), "");
}
assert.deepEqual(readGameDungeonPlanTags('[map: unlock area=3] [trap: found area="0"] [trap: disarmed area=12]'), {
  unlock: [3],
  found: [0],
  disarmed: [12],
});

// Spawns follow the rooms: the heart's leader at the top of the band, quiet rooms empty, every foe in
// its level's band and no boss below its floor.
for (const template of SITE_TEMPLATE_IDS)
  for (let seed = 1; seed <= 6; seed++) {
    const input = sitePlanInputFor({ template, name: `Old ${template}`, seed });
    const plan = sitePlan(input);
    const band = { low: 6, high: 14 };
    const setId = plan.set;
    const site = dungeonSiteFor({
      setId,
      name: `Old ${template}`,
      setting: "high_fantasy",
      band,
      seed,
      undead: input.undead,
    })!;
    assert.ok(site, `${template} ${seed} has holders`);
    for (let level = 0; level < plan.levels.length; level++) {
      const map = gameDungeonPlannedMap({ plan: input, name: `Old ${template}`, id: "x", level });
      const areas = dungeonAreas(map, site, "high_fantasy");
      assert.equal(areas.length, map.rooms.length);
      const floor = dungeonFloorBand(band, dungeonPlannedFloor(map));
      for (const area of areas) {
        const info = map.roomInfo![area.area - 1]!;
        if (info.heart) assert.equal(area.role, "heart", `${template} ${seed}: the heart room is the heart`);
        if (info.use === "quiet") assert.equal(area.foes.length, 0, `${template} ${seed}: ${info.name} is quiet`);
        for (const foe of area.foes) {
          assert.ok(
            foe.level >= floor.low - 1 && foe.level <= band.high,
            `${template} ${seed}: ${foe.familyId} L${foe.level} in its band`,
          );
          if (foe.tier === "boss") assert.ok(foe.level >= MARINARA_TIER_RULES.boss.minLevel);
        }
      }
    }
  }

console.log(`site plans: ${levels} levels laid out`);
