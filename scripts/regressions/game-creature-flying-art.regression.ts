/**
 * Flying creature art (Capability API 1.352):
 *
 *   - A creature pack (creaturePackVersion 2) may give a creature a flying block, laid out as a walking one
 *     (three frames across, the four facings down), one per look or one for every look.
 *   - A fighter is drawn in it, its frames played 0, 1, 2, 1, while it is in the air (1.354), up above the
 *     ground, or flies and has no walk.
 */
import assert from "node:assert/strict";

import {
  CREATURE_FLY_STEPS,
  creatureArtFrame,
  parseCreaturePack,
  rulesetCombatantFlying,
  type RulesetCombatant,
  type TacticalGrid,
} from "../../packages/shared/src/index.js";

/** A PNG's signature and header for a picture of this size (all the checks read). */
const png = (width: number, height: number) => {
  const bytes = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes.writeUInt8(8, 24);
  bytes.writeUInt8(6, 25);
  return `data:image/png;base64,${bytes.toString("base64")}`;
};
const pack = (creature: Record<string, unknown>, version = 2) => ({
  creaturePackVersion: version,
  id: "fliers",
  name: "Fliers",
  version: 1,
  tileSize: 48,
  sheets: [{ id: "s1", png: png(576, 384), width: 576, height: 384 }],
  creatures: [
    {
      id: "harpy",
      match: ["harpy"],
      size: "medium",
      w: 1,
      h: 2,
      frames: 3,
      variants: [
        { sheet: "s1", x: 0, y: 0 },
        { sheet: "s1", x: 3, y: 0 },
      ],
      fly: [
        { sheet: "s1", x: 6, y: 0 },
        { sheet: "s1", x: 9, y: 0 },
      ],
      ...creature,
    },
  ],
});
const issues = (input: unknown) => {
  const read = parseCreaturePack(input);
  return read.ok ? [] : read.issues;
};

// ── The pack ──
const read = parseCreaturePack(pack({}));
assert.ok(read.ok, JSON.stringify(read));
const harpy = read.pack.creatures[0]!;
assert.ok(parseCreaturePack(pack({ fly: [{ sheet: "s1", x: 6, y: 0 }] })).ok, "one flying block for every look");
assert.ok(issues(pack({}, 1)).some((issue) => /needs creaturePackVersion 2/.test(issue)));
assert.ok(parseCreaturePack(pack({ fly: undefined }, 1)).ok, "version 1 still reads");
assert.ok(
  issues(pack({ fly: [{ sheet: "s1", x: 10, y: 0 }] })).some((issue) => /flying reaches past the edge/.test(issue)),
  "three frames across",
);
assert.ok(issues(pack({ fly: [{ sheet: "s2", x: 0, y: 0 }] })).some((issue) => /no sheet "s2"/.test(issue)));
assert.ok(
  issues(
    pack({
      variants: [
        { sheet: "s1", x: 0, y: 0 },
        { sheet: "s1", x: 3, y: 0 },
        { sheet: "s1", x: 0, y: 4 },
      ],
    }),
  ).some((issue) => /2 flying blocks: one, or one a look/.test(issue)),
);

// ── The frames ──
assert.deepEqual(CREATURE_FLY_STEPS, [0, 1, 2, 1]);
assert.deepEqual(creatureArtFrame(read.pack, harpy, 1, "left", 1), { sheet: "s1", sx: 192, sy: 96, sw: 48, sh: 96 });
assert.deepEqual(creatureArtFrame(read.pack, harpy, 1, "left", 2, true), {
  sheet: "s1",
  sx: 9 * 48 + 2 * 48,
  sy: 96,
  sw: 48,
  sh: 96,
});
const walker = { ...harpy, fly: undefined };
assert.deepEqual(
  creatureArtFrame(read.pack, walker, 0, "down", 1, true),
  creatureArtFrame(read.pack, walker, 0, "down", 1),
  "no flying block: its walking frames",
);

// ── When it is shown flying ──
const grid: TacticalGrid = {
  width: 4,
  height: 1,
  tiles: [["plains", "plains", "water", "plains"]],
} as TacticalGrid;
const flier = (extra: Partial<RulesetCombatant>) =>
  ({ id: "h", speed: 6, speeds: { fly: 8 }, x: 0, y: 0, ...extra }) as unknown as RulesetCombatant;
assert.equal(rulesetCombatantFlying(grid, flier({})), false, "standing on the ground");
assert.equal(rulesetCombatantFlying(grid, flier({ speeds: undefined })), false, "it does not fly");
assert.equal(rulesetCombatantFlying(grid, flier({ speed: 0 })), true, "no walk: always in the air");
assert.equal(rulesetCombatantFlying(grid, flier({ airborne: true })), true, "in the air (1.354)");
assert.equal(
  rulesetCombatantFlying({ ...grid, elevation: [[0, 0, 0, 0]] } as TacticalGrid, flier({ altitude: 2 })),
  true,
  "up above the ground",
);
assert.equal(rulesetCombatantFlying(grid, flier({ airborne: true, speeds: undefined })), false, "no flight, no wings");

console.log("Flying creature art: read from its block, shown while the fighter flies.");
