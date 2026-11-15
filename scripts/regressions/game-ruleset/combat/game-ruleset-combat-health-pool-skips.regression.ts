/**
 * Whom a health pool passes over (Capability API 1.199).
 *
 *   - `mechanics.healthPoolSkips.conditions`: whoever holds one is left alone and uses none of the
 *     pool (5e's Sleep, ignoring the unconscious).
 *   - `mechanics.healthPoolSkips.unseeing`: whoever cannot see its maker is too (Color Spray,
 *     ignoring creatures that can't see), on a board and off one.
 *   - Import refusals and the install gate.
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-health-pool-skips-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 194);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
      mechanics: {
        kind: "debuff",
        autoHit: true,
        range: 90,
        area: { shape: "burst", size: 10 },
        healthPool: { flat: 20 },
        targetCount: 4,
        ...mechanics,
      },
    }) as unknown as RulesetCatalogEntry;
  // Sleep: 20 hit points' worth, passing over the unconscious.
  const sleep = spell("sleep", "Sleep", {
    healthPoolSkips: { conditions: ["unconscious"] },
    applies: [{ condition: "unconscious", duration: { rounds: 10 } }],
  });
  // Color Spray: 20 hit points' worth, passing over the unconscious and whoever can't see its caster.
  const spray = spell("spray", "Spray", {
    healthPoolSkips: { conditions: ["unconscious"], unseeing: true },
    applies: [{ condition: "blinded", duration: { rounds: 1 } }],
  });
  // The same with no skips, as 1.196 has it.
  const plain = spell("plain", "Plain", { applies: [{ condition: "unconscious", duration: { rounds: 10 } }] });
  const spells = [sleep, spray, plain];
  // The 5e example where blinded takes the eyes away, so a blinded creature sees nobody.
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.sight = { eyes: "sight" };
    for (const entry of doc.combat.conditions) if (entry.condition === "blinded") entry.lacks = ["sight"];
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
  const roll = (sides: number) => (sides === 20 ? 10 : 4);
  const fight = (
    healths: Record<string, number>,
    holding: Record<string, string> = {},
    board = true,
  ): RulesetEncounterState => {
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
            fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 4 },
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
    for (const [id, condition] of Object.entries(holding)) {
      rulesetCombatant(state, id)!.tracked.push({ condition, source: id, rounds: null });
    }
    state.order = ["mage", ...ids];
    state.turn = 0;
    return state;
  };
  const cast = (state: RulesetEncounterState, label: string, targetIds: string[] = []) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      {
        actorId: "mage",
        optionId: option.id,
        targetIds,
        ...(state.board ? { at: { x: 8, y: 7 } } : {}),
      },
      roll,
    );
  };
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, rulesetCombatant(state, id)!).includes(condition);
  const affectedBy = (events: RulesetCombatEvent[]) => {
    const event = events.find((one) => one.type === "healthPool");
    assert.ok(event && event.type === "healthPool", JSON.stringify(events));
    return event.affected;
  };

  // ── Sleep passes over the unconscious: they use none of its 20 ──
  {
    const asleep = { d: "unconscious" };
    // Without skips, the sleeping d (5) uses 5 of it, leaving 15: not enough for b.
    assert.deepEqual(affectedBy(cast(fight({ a: 10, b: 15, d: 5 }, asleep), "Plain").events), ["d", "a"]);
    // With them, d is passed over: a (5) and b (15) use all 20.
    assert.deepEqual(affectedBy(cast(fight({ a: 5, b: 15, d: 5 }, asleep), "Sleep").events), ["a", "b"]);
    // A creature holding something else is taken as before.
    assert.deepEqual(affectedBy(cast(fight({ a: 5, b: 15, d: 5 }, { d: "prone" }), "Sleep").events), ["a", "d"]);
  }

  // ── Color Spray passes over whoever can't see its caster ──
  {
    const step = cast(fight({ a: 5, b: 15, d: 5 }, { d: "blinded" }), "Spray");
    assert.deepEqual(affectedBy(step.events), ["a", "b"]);
    assert.ok(has(step.state, "b", "blinded"));
    // Sleep does not care whether they see.
    assert.deepEqual(affectedBy(cast(fight({ a: 5, b: 15, d: 5 }, { d: "blinded" }), "Sleep").events), ["a", "d"]);
    // Off a board too.
    const off = cast(fight({ a: 5, b: 15, d: 5 }, { d: "blinded" }, false), "Spray", ["a", "b", "d"]);
    assert.deepEqual(affectedBy(off.events), ["a", "b"]);
    // And the unconscious, for Color Spray as for Sleep.
    assert.deepEqual(affectedBy(cast(fight({ a: 5, b: 15, d: 5 }, { d: "unconscious" }), "Spray").events), ["a", "b"]);
  }

  // ── Import refusals ──
  {
    const refused = (mechanics: Record<string, unknown>, pattern: RegExp) => {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          doc.catalogs.at(-1).entries.push({ ...spell("x", "X", {}), mechanics });
        }),
      );
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const base = (sleep.mechanics ?? {}) as Record<string, unknown>;
    refused({ ...base, healthPool: undefined }, /"healthPoolSkips" says whom a "healthPool" passes over/);
    refused({ ...base, healthPoolSkips: {} }, /"healthPoolSkips" names "conditions", "unseeing" or both/);
    refused({ ...base, healthPoolSkips: { conditions: ["dozing"] } }, /Unknown condition "dozing"/);
    refused({ ...base, healthPoolSkips: { unseeing: false } }, /unseeing/);
  }

  // ── The install gate ──
  {
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
      "A ruleset with health pools that pass over some of their targets requires schemaVersion 2 and capabilityApi 1.199 or newer";
    const withSleep = fiveE();
    assert.equal(getCapabilityPackageInstallIssue(manifest(198) as never, withSleep), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(199) as never, withSleep), gate);
    const without = JSON.parse(fiveEText);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(198) as never, without), gate);
    const files = new Map([["spells.json", { entries: [sleep] }]]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(198) as never, without, files as never), gate);
  }

  console.log(
    "Ruleset health pool skips: Sleep passes over the unconscious, Color Spray also whoever can't see its caster; gated at 1.199.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
