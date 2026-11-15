/**
 * Picking targets by the health they have left (Capability API 1.196).
 *
 *   - `mechanics.healthPool`: rolled once and shared out from the target with the least health left
 *     upward, each affected only while their health is no more than what remains, which they use up;
 *     the rest are left alone (5e's Sleep, Color Spray). `perCostStep` adds to it.
 *   - `mechanics.healthAtMost`: affects only a target with that much health or less (Power Word Stun).
 *   - `mechanics.kills`: kills whoever it affects outright (Power Word Kill).
 *   - The log line, import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-health-pool-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 191);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
      mechanics: { kind: "debuff", autoHit: true, ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Sleep, small: a 5-foot burst, 5d8 hit points' worth, 2d8 more for each slot above the first.
  const sleep = spell("sleep", "Sleep", {
    range: 90,
    area: { shape: "burst", size: 10 },
    healthPool: { dice: "5d8" },
    targetCount: 4,
    cost: [{ pool: "slots_1", amount: 1 }],
    perCostStep: { dice: "2d8" },
    applies: [{ condition: "unconscious", duration: { rounds: 10 } }],
  });
  // Power Word Stun at 15 hit points, and Power Word Kill at 15.
  const stun = spell("stun", "Stun", {
    range: 60,
    healthAtMost: 15,
    applies: [{ condition: "stunned", duration: { rounds: 1 } }],
  });
  // Killing outright with an amount beside it, which the dead never take.
  const kill = spell("kill", "Kill", { kind: "attack", range: 60, healthAtMost: 15, kills: true, amount: { flat: 5 } });
  // Sleep as 5e has it, passing over whoever cannot be put to sleep.
  const drowse = {
    ...sleep,
    id: "drowse",
    label: "Drowse",
    rows: [{ list: "spells", values: { name: "Drowse", level: 1, prepared: true } }],
    mechanics: { ...sleep.mechanics, targetTypes: { notImmuneTo: ["unconscious"] } },
  } as RulesetCatalogEntry;
  // A pool and a ceiling both: whoever is over the ceiling uses none of the pool.
  const lull = {
    ...sleep,
    id: "lull",
    label: "Lull",
    rows: [{ list: "spells", values: { name: "Lull", level: 1, prepared: true } }],
    mechanics: { ...sleep.mechanics, healthAtMost: 8 },
  } as RulesetCatalogEntry;
  const spells = [sleep, stun, kill, drowse, lull];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const block = (health: number): RulesetStatBlock => ({
    health,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  });
  const grid = (): TacticalGrid => ({
    width: 15,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(15).fill("plains")),
  });
  let face = 4;
  const roll = (sides: number) => (sides === 20 ? 10 : Math.min(face, sides));
  const fight = (healths: Record<string, number>, board = true): RulesetEncounterState => {
    const ids = Object.keys(healths);
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: {
              level: 5,
              ac: 12,
              speed: 30,
              hp_max: 60,
              spellcasting_ability: "wis",
              slots_max_1: 4,
              slots_max_2: 3,
            },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        ...ids.map((id) => ({ id, name: id.toUpperCase(), side: "enemy" as const, block: block(healths[id]!) })),
      ],
      ...(board
        ? {
            board: {
              grid: grid(),
              placements: Object.fromEntries([
                ["mage", { x: 1, y: 7 }],
                ...ids.map((id, index) => [id, { x: 8 + (index % 2), y: 7 + Math.floor(index / 2) }]),
              ]),
            },
          }
        : {}),
    });
    state.order = ["mage", ...ids];
    state.turn = 0;
    return state;
  };
  const optionOf = (state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${rulesetCombatOptions(definition, state, "mage").map((one) => one.label)}`);
    return option;
  };
  const cast = (
    state: RulesetEncounterState,
    label: string,
    choice: { at?: { x: number; y: number }; targetIds?: string[]; payWith?: string },
  ) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: optionOf(state, label).id, targetIds: choice.targetIds ?? [], ...choice },
      roll,
    );
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, rulesetCombatant(state, id)!).includes(condition);
  const poolOf = (events: RulesetCombatEvent[]) => {
    const event = events.find((one) => one.type === "healthPool");
    assert.ok(event && event.type === "healthPool", JSON.stringify(events));
    return event;
  };

  // ── Sleep takes the weakest first, as far as its 20 goes ──
  {
    face = 4;
    const step = cast(fight({ a: 10, b: 20, c: 30, d: 5 }), "Sleep", { at: { x: 8, y: 7 } });
    const pool = poolOf(step.events);
    assert.deepEqual([pool.total, pool.rolls, pool.affected], [20, [4, 4, 4, 4, 4], ["d", "a"]]);
    assert.equal(pool.label, "Sleep");
    for (const id of ["d", "a"]) assert.ok(has(step.state, id, "unconscious"), id);
    for (const id of ["b", "c"]) assert.ok(!has(step.state, id, "unconscious"), id);
    // Health already lost counts: a wounded b goes first.
    const wounded = fight({ a: 10, b: 20, c: 30, d: 5 });
    rulesetCombatant(wounded, "b")!.health!.value = 3;
    const second = cast(wounded, "Sleep", { at: { x: 8, y: 7 } });
    assert.deepEqual(poolOf(second.events).affected, ["b", "d", "a"]);
    // Whoever it may not take uses up none of it.
    const immune = fight({ z: 1, a: 10, b: 20, d: 5 });
    rulesetCombatant(immune, "z")!.block = {
      ...rulesetCombatant(immune, "z")!.block!,
      conditionImmunities: ["unconscious"],
    };
    const passed = poolOf(cast(immune, "Drowse", { at: { x: 8, y: 7 } }).events);
    assert.deepEqual(passed.affected, ["d", "a"]);
    assert.deepEqual(poolOf(cast(fight({ a: 10, b: 20, d: 5 }), "Lull", { at: { x: 8, y: 7 } }).events).affected, [
      "d",
    ]);
    // Somebody with more than the whole pool, alone: nobody.
    const none = cast(fight({ c: 30 }), "Sleep", { at: { x: 8, y: 7 } });
    assert.deepEqual(poolOf(none.events).affected, []);
    assert.ok(!has(none.state, "c", "unconscious"));
    // Cast with a second-level slot: 2d8 more, enough for b as well.
    const higher = cast(fight({ a: 10, b: 20, c: 30, d: 5 }), "Sleep", { at: { x: 8, y: 7 }, payWith: "slots_2" });
    const upcast = poolOf(higher.events);
    assert.deepEqual([upcast.total, upcast.affected], [28, ["d", "a"]]);
    face = 8;
    const big = poolOf(cast(fight({ a: 10, b: 20, c: 30, d: 5 }), "Sleep", { at: { x: 8, y: 7 } }).events);
    assert.deepEqual([big.total, big.affected], [40, ["d", "a", "b"]], "35 used, 5 left is not enough for c");
  }

  // ── Power Word Stun and Kill: only at or below the ceiling ──
  {
    const state = fight({ a: 10, c: 30 });
    const stunned = cast(state, "Stun", { targetIds: ["a"] });
    assert.ok(has(stunned.state, "a", "stunned"));
    const spared = cast(fight({ a: 10, c: 30 }), "Stun", { targetIds: ["c"] });
    assert.ok(!has(spared.state, "c", "stunned"));
    assert.ok(!spared.events.some((one) => one.type === "healthPool"), "a ceiling rolls nothing");
    const exactly = fight({ a: 15 });
    assert.ok(has(cast(exactly, "Stun", { targetIds: ["a"] }).state, "a", "stunned"), "15 is at most 15");
    const killed = cast(fight({ a: 10, c: 30 }), "Kill", { targetIds: ["a"] });
    assert.equal(rulesetCombatant(killed.state, "a")!.defeated, true);
    assert.ok(killed.events.some((one) => one.type === "slain" && one.targetId === "a"));
    assert.ok(!killed.events.some((one) => one.type === "damage"), "nothing else it does matters to the dead");
    const lived = cast(fight({ a: 10, c: 30 }), "Kill", { targetIds: ["c"] });
    assert.equal(rulesetCombatant(lived.state, "c")!.defeated, false);
    assert.ok(!lived.events.some((one) => one.type === "slain"));
  }

  // ── Off a board, a list of targets shares the pool the same way ──
  {
    face = 4;
    const state = fight({ a: 10, b: 20, d: 5 }, false);
    const step = cast(state, "Sleep", { targetIds: ["a", "b", "d"] });
    assert.deepEqual(poolOf(step.events).affected, ["d", "a"]);
  }

  // ── Refusals and the gate ──
  {
    const refused = (mechanics: Record<string, unknown>, pattern: RegExp) => {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          Object.assign(doc.catalogs.at(-1).entries[0].mechanics, mechanics);
        }),
      );
      assert.equal(result.ok, false, `should be refused: ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    refused({ healthPool: {} }, /"healthPool" names dice or a flat number/);
    refused({ healthPool: { dice: "5d8", type: "fire" } }, /healthPool/);
    refused({ healthAtMost: -1 }, /healthAtMost/);
    refused({ kills: false }, /kills/);
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate =
      "A ruleset with entries that share out a pool of health, affect only those at or below some health, or kill outright requires schemaVersion 2 and capabilityApi 1.196 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(195) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(196) as never, fiveE()), gate);
    for (const only of [sleep, stun, kill]) {
      const one = fiveE((doc) => (doc.catalogs.at(-1).entries = [structuredClone(only)]));
      assert.equal(getCapabilityPackageInstallIssue(manifest(195) as never, one), gate, only.id);
    }
    // In a catalog file of its own too.
    const plain = JSON.parse(fiveEText);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(195) as never, plain), gate);
    const files = new Map([["spells.json", { entries: [structuredClone(sleep)] }]]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(195) as never, plain, files as never), gate);
  }

  console.log(
    "Ruleset health pools: Sleep takes the weakest first as far as its roll goes, Power Word Stun and Kill only those with few enough hit points left.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
