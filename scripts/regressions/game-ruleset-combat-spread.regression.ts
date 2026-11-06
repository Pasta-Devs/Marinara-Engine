/**
 * Spreading out under a blast (combat AI S1): where an opponent holds an area that harms and could
 * still use it, standing within its size of a friend is danger, and a walk that closes in picks a
 * cell as near that is not bunched up. Ruleset-neutral: any area with damage, whatever it is.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatantForesees,
  rulesetGap,
  rulesetSheetBuildSchema,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-spread-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { rulesetClosingMove } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const result = parseRulesetDefinition(
    JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
        "utf8",
      ),
    ),
  );
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  const definition: RulesetDefinition = result.definition;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 40 },
  });
  const blast = {
    id: "blast",
    name: "Blast",
    budget: "action",
    // In feet, as a block writes them: 150 feet off, 20 feet about (four cells).
    range: { normal: 150 },
    area: { shape: "burst", size: 20 },
    damage: { count: 8, sides: 6, flat: 0 },
  };
  const club = { id: "club", name: "Club", budget: "action", toHit: 5, damage: { count: 1, sides: 4, flat: 0 } };
  const grid = (): TacticalGrid =>
    ({ width: 20, height: 14, tiles: Array.from({ length: 14 }, () => Array(20).fill("plains")) }) as TacticalGrid;
  const fight = (actions: unknown[], hero?: RulesetStatBlock, seed = 1) => {
    const state = createRulesetEncounter({
      definition,
      seed,
      roller: () => 10,
      combatants: [
        hero
          ? { id: "hero", name: "Hero", side: "party", block: hero }
          : { id: "hero", name: "Hero", side: "party", build },
        { id: "friend", name: "Friend", side: "party", build },
        {
          id: "mage",
          name: "Mage",
          side: "enemy",
          block: {
            health: 60,
            defense: 12,
            initiativeModifier: -20,
            speed: 30,
            actions,
          } as unknown as RulesetStatBlock,
        },
      ],
      board: { grid: grid(), placements: { hero: { x: 0, y: 6 }, friend: { x: 6, y: 1 }, mage: { x: 18, y: 6 } } },
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const walk = (state: RulesetEncounterState) => {
    const move = rulesetClosingMove(definition, state, "hero");
    assert.ok(move?.to, "it closes in");
    const after = { ...who(state, "hero"), x: move.to.x, y: move.to.y };
    return {
      to: move.to,
      friend: rulesetGap(after, who(state, "friend")),
      mage: rulesetGap(after, who(state, "mage")),
      spread: !!(move as { spread?: true }).spread,
    };
  };

  // With nothing that blasts, the nearest cell, which may be beside the friend.
  const plain = walk(fight([club]));
  assert.ok(plain.friend <= 4, `the plain walk ends beside the friend here: ${JSON.stringify(plain)}`);
  // Under a blast, as near the mage, and out of the blast's size of the friend.
  const blasted = walk(fight([club, blast]));
  assert.equal(blasted.mage, plain.mage, `no nearer for spreading: ${JSON.stringify({ plain, blasted })}`);
  assert.ok(blasted.friend > 4, `out of the blast's size of the friend: ${JSON.stringify(blasted)}`);
  // And says so on the debug log (S1c), only where keeping apart moved it.
  assert.equal(blasted.spread, true, "the walk says it kept apart");
  assert.equal(plain.spread, false, "a plain walk says nothing of it");
  // A beast does not think to (S1b): a wolf, or anything mindless, closes in as it would anyway.
  for (const mind of ["instinct", "mindless"] as const) {
    const wolf = {
      health: 40,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      mind,
      actions: [club],
    } as unknown as RulesetStatBlock;
    const beast = walk(fight([club, blast], wolf));
    assert.equal(beast.spread, false, `a ${mind} one says nothing of keeping apart`);
    assert.deepEqual(
      beast.to,
      walk(fight([club], wolf)).to,
      `a ${mind} one ignores the blast: ${JSON.stringify(beast)}`,
    );
  }
  const cunning = {
    health: 40,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    mind: "cunning",
    actions: [club],
  } as unknown as RulesetStatBlock;
  // A cunning one only sometimes thinks to (2026-10-24, Alyssa): in the fights its seed says it does,
  // it keeps apart as a tactician would; in the rest it closes in as a wolf does.
  const thinks = (seed: number) =>
    rulesetCombatantForesees(definition, who(fight([club], cunning, seed), "hero"), seed);
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
  const yes = seeds.find(thinks);
  const no = seeds.find((seed) => !thinks(seed));
  assert.ok(yes !== undefined && no !== undefined, "some fights it thinks of it, some it does not");
  const share = seeds.filter(thinks).length;
  assert.ok(share >= 5 && share <= 15, `about a third of them: ${share} of 30`);
  assert.ok(walk(fight([club, blast], cunning, yes)).friend > 4, "a cunning one that thinks of it spreads");
  assert.deepEqual(
    walk(fight([club, blast], cunning, no)).to,
    walk(fight([club], cunning, no)).to,
    "one that does not ignores the blast",
  );
  // The spacing it deployed with holds on the walk, even where keeping it costs ground (S1a-walk,
  // re-test 2026-10-24: Pip dashed beside Brom on the mage, and the first Fireball caught three).
  {
    const state = fight([club, blast]);
    const friend = who(state, "friend");
    friend.x = 16;
    friend.y = 6;
    const hero = who(state, "hero");
    hero.x = 8;
    hero.y = 6;
    const kept = walk(state);
    assert.ok(kept.friend > 4, `it keeps out of the blast's size of the friend: ${JSON.stringify(kept)}`);
    assert.ok(kept.mage < 10, `and still closes in: ${JSON.stringify(kept)}`);
    // With nothing that blasts, it walks on to the friend's side.
    const open = fight([club]);
    Object.assign(who(open, "friend"), { x: 16, y: 6 });
    Object.assign(who(open, "hero"), { x: 8, y: 6 });
    assert.ok(walk(open).friend <= 4, `with no blast it walks up beside them: ${JSON.stringify(walk(open))}`);
  }
  console.info(
    "Spread under a blast: a walk closes in as near, out of the blast's size of a friend; a beast or a mindless thing does not think to, a cunning one only sometimes; the spacing holds on the walk.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
