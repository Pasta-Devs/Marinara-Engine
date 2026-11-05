/**
 * Height on the combat board (combat C6b), for the Engine's own fights and the board itself.
 *
 *   - Walking: climbing a level costs one more, coming down nothing, and a step of two levels or more is a
 *     cliff nobody walks, either way; flyers take no notice. The AI's own routes agree.
 *   - Sight: ground higher than both ends is a ridge that blocks it; from on top, the ridge is no wall.
 *     Shooting down from higher ground, low cover between hides nothing.
 *   - High ground: +10 to hit, and one more cell for a ranged attack (not a melee one).
 *   - Generated boards (version 2): foothills read off the tiles, a mountain two levels and its
 *     neighbours one, so no generated board ever has a cliff; boards with no mountain stay flat.
 *   - Boards painted by hand may carry heights, cliffs included; a tile a cliff cuts off is refused.
 */
import assert from "node:assert/strict";

import {
  applyAction,
  climbCost,
  coverTier,
  createTacticalCombat,
  decideTacticalAction,
  forecastAttack,
  foothillElevation,
  getMovementRange,
  getTargetsInRange,
  hasLineOfSight,
  madeTacticalBattlefield,
  summarizeTacticalBattlefield,
  tacticalMadeBoardIssues,
  type Combatant,
  type TacticalGrid,
  type TacticalTerrain,
} from "../../packages/shared/src/index.js";
import { pursueOpponent } from "../../packages/shared/src/features/tactical-combat/profile-ai.js";
import {
  worldBattlefieldGrid,
  worldBattlefieldMapSchema,
} from "../../packages/shared/src/features/world/battlefield-maps.js";

const board = (rows: string[], heights?: string[]): TacticalGrid => {
  const terrain: Record<string, TacticalTerrain> = { ".": "plains", f: "forest", m: "mountain", "#": "wall" };
  return {
    width: rows[0]!.length,
    height: rows.length,
    tiles: rows.map((row) => [...row].map((char) => terrain[char]!)),
    ...(heights ? { elevation: heights.map((row) => [...row].map(Number)) } : {}),
  };
};

// ── Walking ──
{
  const grid = board(["....."], ["01231"]);
  assert.equal(climbCost(grid, { x: 0, y: 0 }, { x: 1, y: 0 }), 1, "up a level");
  assert.equal(climbCost(grid, { x: 2, y: 0 }, { x: 1, y: 0 }), 0, "down a level");
  assert.equal(climbCost(grid, { x: 3, y: 0 }, { x: 4, y: 0 }), null, "a cliff down");
  assert.equal(climbCost(grid, { x: 4, y: 0 }, { x: 3, y: 0 }), null, "a cliff up");
  assert.equal(climbCost(board(["..."]), { x: 0, y: 0 }, { x: 1, y: 0 }), 0, "a flat board");
}
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
  mp: 60,
  maxMp: 60,
});
const arena = (grid: TacticalGrid, at: Record<string, { x: number; y: number }>, more: Record<string, object> = {}) => {
  const s = createTacticalCombat([unit("hero")], [unit("foe", "enemy")], { seed: 4, difficulty: "normal" });
  s.grid = grid;
  for (const u of s.units) Object.assign(u, at[u.id], more[u.id] ?? {});
  return s;
};
{
  // A walker with three points: up two gentle levels costs 2 + 2, so it stops at the first; a cliff it
  // never takes; a flyer goes where it likes.
  const hill = board([".......", "......."], ["0120000", "0000000"]);
  const walker = arena(hill, { hero: { x: 0, y: 0 }, foe: { x: 6, y: 1 } }, { hero: { movement: 3 } });
  const reach = new Set(getMovementRange(walker, "hero").map((cell) => `${cell.x},${cell.y}`));
  assert.ok(reach.has("1,0"), "one level up for two points");
  assert.ok(!reach.has("2,0"), "and not the next, a further three");
  const cliff = board(["......."], ["0030000"]);
  const blocked = arena(cliff, { hero: { x: 0, y: 0 }, foe: { x: 6, y: 0 } }, { hero: { movement: 6 } });
  const walked = new Set(getMovementRange(blocked, "hero").map((cell) => `${cell.x},${cell.y}`));
  assert.ok(!walked.has("2,0") && !walked.has("3,0"), "a cliff is no way, up or along");
  const flyer = arena(
    cliff,
    { hero: { x: 0, y: 0 }, foe: { x: 6, y: 0 } },
    { hero: { movement: 6, movementMode: "fly" } },
  );
  assert.ok(new Set(getMovementRange(flyer, "hero").map((c) => `${c.x},${c.y}`)).has("2,0"), "a flyer takes no notice");
  // The AI's own route agrees: with a cliff column across the board and one gap, it heads for the gap.
  const wall = board(["........", "........", "........"], ["00030000", "00030000", "00000000"]);
  const hunter = arena(
    wall,
    { hero: { x: 6, y: 0 }, foe: { x: 1, y: 0 } },
    { foe: { movement: 2, attackRange: { min: 1, max: 1 } } },
  );
  const route = pursueOpponent(
    hunter,
    hunter.units.find((u) => u.id === "foe")!,
  );
  assert.ok(route && route.to.y > 0, `it walks round, not over: ${JSON.stringify(route)}`);
}

// ── Sight and cover ──
{
  // A ridge between two on level ground blocks sight; standing on it, one sees down both sides.
  const ridge = board(["....."], ["00100"]);
  assert.equal(hasLineOfSight(ridge, { x: 0, y: 0 }, { x: 4, y: 0 }), false, "a ridge between them");
  assert.equal(hasLineOfSight(ridge, { x: 2, y: 0 }, { x: 4, y: 0 }), true, "from on top of it");
  assert.equal(hasLineOfSight(board(["....."], ["11111"]), { x: 0, y: 0 }, { x: 4, y: 0 }), true, "a plateau");
  // Shooting down over trees, the trees hide nothing; on level ground they are half cover.
  const trees = board(["......", "..f...", "......"], ["100000", "000000", "000000"]);
  assert.equal(coverTier(trees, { x: 0, y: 0 }, { x: 4, y: 2 }), "none", "from above");
  assert.equal(coverTier(board(["......", "..f...", "......"]), { x: 0, y: 0 }, { x: 4, y: 2 }), "half", "level");
}

// ── High ground ──
{
  const open = board(["......."]);
  const raised = board(["......."], ["1000000"]);
  const at = { hero: { x: 0, y: 0 }, foe: { x: 3, y: 0 } };
  const archer = { hero: { attackRange: { min: 1, max: 2 } } };
  const level = forecastAttack(arena(open, { hero: { x: 0, y: 0 }, foe: { x: 2, y: 0 } }, archer), "hero", "foe");
  const above = forecastAttack(arena(raised, { hero: { x: 0, y: 0 }, foe: { x: 2, y: 0 } }, archer), "hero", "foe");
  assert.equal(above.hitChance, Math.min(100, level.hitChance + 10), "ten more from above");
  // Three cells away is one past a range of two: only from above.
  assert.deepEqual(getTargetsInRange(arena(open, at, archer), "hero"), []);
  assert.deepEqual(getTargetsInRange(arena(raised, at, archer), "hero"), ["foe"], "one more cell from above");
  const shot = applyAction(arena(raised, at, archer), { type: "attack", unitId: "hero", targetId: "foe" });
  assert.ok(shot.ok, shot.ok ? "" : shot.error);
  // Nor does a skill, for the player or the plain AI (a unit with no tactics, as older saves have).
  const caster = arena(raised, at, {
    hero: { attackRange: { min: 1, max: 1 } },
    foe: { tactics: undefined, skills: [{ name: "Bolt", type: "attack", power: 2, mpCost: 0, range: 2 }] },
  });
  Object.assign(
    caster.units.find((u) => u.id === "foe")!,
    { x: 0, y: 0, movement: 0 },
  );
  Object.assign(
    caster.units.find((u) => u.id === "hero")!,
    { x: 3, y: 0 },
  );
  const chosen = decideTacticalAction(
    caster,
    caster.units.find((u) => u.id === "foe")!,
    () => 0,
  );
  assert.ok(!(chosen.type === "skill"), `no skill from three cells: ${JSON.stringify(chosen)}`);
  // A melee strike gains no reach.
  const sword = { hero: { attackRange: { min: 1, max: 1 } } };
  assert.deepEqual(getTargetsInRange(arena(raised, { hero: { x: 0, y: 0 }, foe: { x: 2, y: 0 } }, sword), "hero"), []);
}

// ── Generated boards ──
{
  const grid = board(["......", "..m...", "......", "......"]);
  const hills = foothillElevation(grid)!;
  assert.deepEqual(hills, [
    [0, 1, 1, 1, 0, 0],
    [0, 1, 2, 1, 0, 0],
    [0, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ]);
  assert.equal(foothillElevation(board(["....", "..f."])), undefined, "no mountain, no height");
  // Across many seeds and every environment, no generated board has a cliff, even diagonally, and a
  // fight's board carries its heights.
  let raisedBoards = 0;
  for (const environment of ["forest", "mountains", "ruins", "cave", "castle", undefined]) {
    for (let seed = 0; seed < 30; seed++) {
      const s = createTacticalCombat([unit("hero"), unit("ally")], [unit("foe", "enemy"), unit("brute", "enemy")], {
        seed,
        difficulty: "normal",
        ...(environment ? { environment } : {}),
      });
      assert.equal(s.battlefield?.kind === "generated" && s.battlefield.generatorVersion, 3);
      const e = s.grid.elevation;
      const mountains = s.grid.tiles.flat().filter((terrain) => terrain === "mountain").length;
      assert.equal(!!e, mountains > 0, "heights exactly where there are mountains");
      if (!e) continue;
      raisedBoards += 1;
      for (let y = 0; y < s.grid.height; y++)
        for (let x = 0; x < s.grid.width; x++)
          for (const [dx, dy] of [
            [1, 0],
            [0, 1],
            [1, 1],
            [1, -1],
          ] as const) {
            const next = e[y + dy]?.[x + dx];
            if (next !== undefined) assert.ok(Math.abs(next - e[y]![x]!) <= 1, `a cliff at ${x},${y} (seed ${seed})`);
          }
      // Deployment never leaves a stale height: a cleared mountain is level with what is round it.
      assert.deepEqual(e, foothillElevation(s.grid));
      assert.match(summarizeTacticalBattlefield(s) ?? "", /Raised ground: height 1 \d+/);
    }
  }
  assert.ok(raisedBoards >= 20, `mountain boards were met: ${raisedBoards}`);
}

// ── Boards painted by hand ──
{
  const map = {
    id: "b1",
    name: "The Shelf",
    place: "p1",
    size: "small" as const,
    scene: "mountains" as const,
    rows: Array.from({ length: 8 }, () => "p".repeat(12)),
    heights: Array.from({ length: 8 }, (_, y) => (y < 4 ? "000000000000" : "000000000000")),
  };
  assert.ok(worldBattlefieldMapSchema.safeParse(map).success, "heights are optional rows of digits");
  assert.ok(!worldBattlefieldMapSchema.safeParse({ ...map, heights: ["4".repeat(12)] }).success, "0 to 3 only");
  // A plateau with a cliff all round and no way up is cut off.
  const plateau = map.heights.map((row, y) => (y >= 3 && y <= 4 ? "000002200000" : row));
  const grid = worldBattlefieldGrid({ ...map, heights: plateau });
  assert.match(tacticalMadeBoardIssues("small", grid).join(" "), /cut off/);
  // A ramp up to it makes it fair, and a fight on it keeps the painted heights.
  const ramp = plateau.map((row, y) => (y === 3 ? "000012200000" : row));
  const fair = worldBattlefieldGrid({ ...map, heights: ramp });
  assert.deepEqual(tacticalMadeBoardIssues("small", fair), []);
  const made = madeTacticalBattlefield({ id: "b1", name: "The Shelf", size: "small", scene: "mountains", grid: fair });
  assert.ok(made.ok && made.grid.elevation?.[3]?.[6] === 2);
  // A plateau in the first column, a cliff round it, is cut off too: the column's own tiles must meet.
  const ledge = Array.from({ length: 8 }, (_, y) => (y < 4 ? "330000000000" : "000000000000"));
  assert.match(tacticalMadeBoardIssues("small", worldBattlefieldGrid({ ...map, heights: ledge })).join(" "), /cut off/);
  // Heights of another shape than the tiles are refused.
  assert.match(
    tacticalMadeBoardIssues("small", { ...fair, elevation: fair.elevation!.slice(1) }).join(" "),
    /heights are one a tile/,
  );
}

console.log("Combat elevation: climbing, cliffs, ridges, high ground, foothills and painted heights.");
