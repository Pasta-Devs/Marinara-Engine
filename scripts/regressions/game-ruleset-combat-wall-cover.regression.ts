/**
 * Walls that give cover, speeds that are the only ones, regeneration kept off somewhere, and target
 * tests of fliers, conditions held and alternatives (Capability API 1.555).
 *
 *   - Blade Barrier: a zone's `cover` is three-quarters cover against what crosses it, gone where a
 *     section is broken.
 *   - Gaseous Form: a condition's `onlySpeeds` leaves its fly speed as the only way of moving.
 *   - A vampire's regeneration `notIn` sunlight: none at a turn's start in it.
 *   - Wind Wall: `anyOf` tiny fliers or those holding Gaseous Form.
 *   - Refusals and the install gate.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetCoverBonus,
  rulesetModeAllowances,
  rulesetSheetBuildSchema,
  rulesetTargetIs,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-wall-cover-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 555);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const barrier = spell("barrier", "Barrier", {
    kind: "utility",
    area: { shape: "burst", size: 5 },
    range: 60,
    zone: { rounds: 100, triggers: [], cover: "three-quarters" },
  });
  const gas = spell("gas", "Gas", {
    kind: "buff",
    targets: "self",
    autoHit: true,
    applies: [{ condition: "gaseous_form", duration: { rounds: 100 } }],
  });
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone([barrier, gas]) });
    doc.combat.cover.threeQuarters = 5;
    doc.combat.sizes = {
      order: [
        { id: "tiny", label: "Tiny" },
        { id: "medium", label: "Medium" },
      ],
      default: "medium",
    };
    doc.sheet.live.conditions.push({ id: "gaseous_form", label: "Gaseous Form" });
    doc.combat.conditions.push({
      condition: "gaseous_form",
      effects: [],
      speeds: { fly: 10 },
      hover: true,
      onlySpeeds: true,
    });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const block = (extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [],
      ...extra,
    }) as unknown as RulesetStatBlock;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const setUp = (definition: RulesetDefinition, thug: RulesetStatBlock = block(), light?: "sunlight") => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        { id: "thug", name: "Thug", side: "enemy", block: thug },
      ],
      board: {
        grid: { width: 16, height: 9, tiles: Array.from({ length: 9 }, () => Array(16).fill("plains")) },
        placements: { mage: { x: 2, y: 4 }, thug: { x: 8, y: 4 } },
        ...(light ? { light } : {}),
      },
    });
    state.order = ["mage", "thug"];
    state.turn = 0;
    return state;
  };
  const cast = (
    definition: RulesetDefinition,
    state: RulesetEncounterState,
    label: string,
    choice: Record<string, unknown>,
  ) => {
    state.turn = state.order.indexOf("mage");
    rulesetCombatant(state, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], ...choice },
      roll,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };

  // ── Blade Barrier: three-quarters cover across it ──
  {
    const definition = parsed(fiveE());
    const state = setUp(definition);
    const cover = (s: RulesetEncounterState) =>
      rulesetCoverBonus(definition.combat!, s, rulesetCombatant(s, "thug")!, { x: 2, y: 4 }, "attack", "mage");
    assert.equal(cover(state), 0, "open ground");
    // Centred on (5,4): its cells (4..6, 3..5) lie between the mage at (2,4) and the thug at (8,4).
    const placed = cast(definition, state, "Barrier", { at: { x: 5, y: 4 } }).state;
    assert.equal(cover(placed), 5, "three-quarters through the wall");
    assert.equal(
      rulesetCoverBonus(definition.combat!, placed, rulesetCombatant(placed, "mage")!, { x: 8, y: 4 }, "save"),
      5,
      "and from the other side, against a save",
    );
    // Moved round it, the thug is in the open again.
    const round = structuredClone(placed);
    rulesetCombatant(round, "thug")!.y = 8;
    rulesetCombatant(round, "thug")!.x = 2;
    assert.equal(cover(round), 0);
  }

  // ── Gaseous Form: flying 10 feet is all ──
  {
    const definition = parsed(fiveE());
    const state = setUp(definition, block({ speeds: { climb: 30 } }));
    const before = rulesetModeAllowances(definition, definition.combat!, rulesetCombatant(state, "mage")!, state);
    assert.equal(before, undefined, "walking only, before");
    const gassed = cast(definition, state, "Gas", { targetIds: ["mage"] }).state;
    const mage = rulesetCombatant(gassed, "mage")!;
    assert.equal(mage.noWalk, true);
    assert.deepEqual(mage.speeds, { fly: 10 });
    const after = rulesetModeAllowances(definition, definition.combat!, mage, gassed)!;
    assert.equal(after.walk, 0, "no walk");
    assert.equal(after.fly, 2, "two cells of flight");
  }

  // ── A vampire's regeneration, none in sunlight ──
  {
    const definition = parsed(fiveE());
    const vampire = block({ regenerates: { flat: 20, notIn: { light: ["sunlight"] } } });
    const run = (light?: "sunlight") => {
      const state = setUp(definition, vampire, light);
      const thug = rulesetCombatant(state, "thug")!;
      thug.health!.value = 25;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "mage", optionId: "end-turn", targetIds: [] },
        roll,
      );
      return {
        events: of(step.events, "regenerates"),
        health: rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(step.state, "thug")!).value,
      };
    };
    const shade = run();
    assert.deepEqual(shade.events, [{ type: "regenerates", actorId: "thug", amount: 15 }]);
    const sun = run("sunlight");
    assert.deepEqual(sun.events, [], "nothing in sunlight");
    assert.equal(sun.health, 25);
  }

  // ── Wind Wall: tiny fliers, or gases ──
  {
    const definition = parsed(fiveE());
    const wind = { anyOf: [{ upToSize: "tiny", flying: true }, { holding: ["gaseous_form"] }] };
    const state = setUp(definition, block({ size: "tiny", speeds: { fly: 30 } }));
    assert.ok(rulesetTargetIs(definition, rulesetCombatant(state, "thug")!, wind), "a tiny flier");
    const walker = setUp(definition, block({ size: "tiny" }));
    assert.ok(!rulesetTargetIs(definition, rulesetCombatant(walker, "thug")!, wind), "a tiny walker is not");
    assert.ok(!rulesetTargetIs(definition, rulesetCombatant(state, "mage")!, wind), "a medium walker is not");
    const gassed = cast(definition, setUp(definition), "Gas", { targetIds: ["mage"] }).state;
    assert.ok(rulesetTargetIs(definition, rulesetCombatant(gassed, "mage")!, wind), "a gas is");
    // As a zone's keepsOut, it parses.
    parsed(
      fiveE((doc) => {
        doc.catalogs.at(-1).entries[0].mechanics.zone.keepsOut = { is: wind };
      }),
    );
  }

  // ── Refusals ──
  refused(
    fiveE((doc) => {
      doc.catalogs.at(-1).entries[0].mechanics.zone.cover = "total";
    }),
    /cover/,
  );
  refused(
    fiveE((doc) => {
      doc.catalogs.at(-1).entries[0].mechanics.zone.keepsOut = { is: { holding: ["nonsense"] } };
    }),
    /Unknown combat condition "nonsense"/,
  );
  refused(
    fiveE((doc) => {
      doc.catalogs.at(-1).entries[0].mechanics.zone.keepsOut = { is: { anyOf: [{ flying: true }] } };
    }),
    /anyOf/,
  );
  refused(
    fiveE((doc) => {
      doc.combat.conditions.at(-1).regenerates = { flat: 5, notIn: {} };
    }),
    /Say where/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a wall that gives cover, speeds that are the only ones, regeneration kept off somewhere, or a target test of fliers, conditions held or alternatives (zone.cover, onlySpeeds, regenerates.notIn, flying, holding, anyOf) requires schemaVersion 2 and capabilityApi 1.555 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(554) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(555) as never, fiveE()), gate);
    const plain = fiveE();
    plain.combat.conditions.at(-1).onlySpeeds = undefined;
    plain.catalogs.at(-1).entries[0].mechanics.zone.cover = undefined;
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(554) as never, JSON.parse(JSON.stringify(plain))), gate);
  }

  console.log(
    "Wall cover: Blade Barrier gives three-quarters cover across it; Gaseous Form leaves only its flight; a vampire regenerates nothing in sunlight; Wind Wall's test takes tiny fliers and gases; gated at 1.555.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
