/**
 * A returning opponent's spent pools stay spent until it rests (Alyssa 2026-10-25: "make their spell
 * slots recharge on long or short rests like whatever class they are supposed to be built off of").
 *
 *   - A foe that gets away carries its sheet's pools other than health, or a block caster's slots left.
 *   - It comes back with them still spent, unless the game clock says it has rested since: a short
 *     rest once an hour has passed, any other (a night's) once 8 hours have.
 *   - A block caster's slots and health come back only with a night's rest.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-returning-rests-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { rulesetBringBackFoe, rulesetFightReturningFoes, rulesetRestsBetween } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const doc = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url)), "utf8"),
  ) as Record<string, any>;
  doc.rests.unshift({ id: "short", label: "Catch your breath", restore: [{ pool: "luck", by: { const: 1 } }] });
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, JSON.stringify(!result.ok && result));
  const definition = (result as { definition: RulesetDefinition }).definition;

  // ── Which rests a stretch of game time holds ──
  assert.deepEqual(rulesetRestsBetween(definition, 100, 130), []);
  assert.deepEqual(rulesetRestsBetween(definition, 100, 160), ["short"]);
  assert.deepEqual(
    rulesetRestsBetween(definition, 100, 600),
    ["short", "camp"],
    "a rest not called short is a night's",
  );
  assert.deepEqual(rulesetRestsBetween(definition, undefined, 600), [], "no clock when it left, no rest counted");
  assert.deepEqual(rulesetRestsBetween(definition, 600, 100), []);

  const build = defaultRulesetSheetBuild(definition);
  const sheetFoe = (luck: number) =>
    ({
      id: "mage",
      name: "Mage",
      side: "enemy",
      uses: {},
      conditions: [],
      tracked: [],
      sheet: { build, live: { pools: { grit: { value: 99 }, luck: { value: luck } } } },
    }) as any;

  // ── It carries its spent pools away, health left to `taken` ──
  {
    const one = sheetFoe(0);
    Object.assign(one, { defeated: true, away: { by: "mage", label: "Fled", left: true } });
    const fight = { encounter: { combatants: [one] }, made: { mage: { name: "Mage", proposed: {} } } } as any;
    const gone = rulesetFightReturningFoes(definition, fight).fled[0]!;
    assert.deepEqual(gone.pools, { luck: { value: 0 } }, "health is not among the pools carried");
  }

  // ── Comes back still spent, then rested ──
  {
    const fresh = sheetFoe(3);
    rulesetBringBackFoe(definition, fresh, { name: "Mage", pools: { luck: { value: 0 } }, clock: 100 }, 130);
    assert.equal(fresh.sheet.live.pools.luck.value, 0, "no time to rest: still spent");
    const breathed = sheetFoe(3);
    rulesetBringBackFoe(definition, breathed, { name: "Mage", pools: { luck: { value: 0 } }, clock: 100 }, 170);
    assert.equal(breathed.sheet.live.pools.luck.value, 1, "a short rest gives back what it gives back");
    const slept = sheetFoe(3);
    rulesetBringBackFoe(definition, slept, { name: "Mage", pools: { luck: { value: 0 } }, clock: 100 }, 100 + 9 * 60);
    assert.equal(slept.sheet.live.pools.luck.value, 2, "short then camp: one, then one more");
  }

  // ── A block caster's slots ──
  {
    const block = () =>
      ({
        id: "m",
        name: "M",
        side: "enemy",
        uses: { "slot:1": 4, "slot:3": 2 },
        conditions: [],
        tracked: [],
        health: { value: 30, max: 30, temp: 0 },
      }) as any;
    const kept = block();
    rulesetBringBackFoe(
      definition,
      kept,
      { name: "M", health: 30, taken: 10, slotsLeft: { 1: 1, 3: 0 }, clock: 100 },
      200,
    );
    assert.deepEqual(kept.uses, { "slot:1": 1, "slot:3": 0 }, "an hour's rest is no night's");
    assert.equal(kept.health.value, 20);
    const rested = block();
    rulesetBringBackFoe(
      definition,
      rested,
      { name: "M", health: 30, taken: 10, slotsLeft: { 1: 1, 3: 0 }, clock: 100 },
      700,
    );
    assert.deepEqual(rested.uses, { "slot:1": 4, "slot:3": 2 }, "a night's rest gives them all back");
    assert.equal(rested.health.value, 30);
  }

  console.log("game-ruleset-returning-rests: ok");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
