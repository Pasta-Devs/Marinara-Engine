/**
 * Target tests of where one stands (Capability API 1.755): 5e's Magic Jar, which cannot possess a
 * creature "warded by a protection from evil and good or magic circle spell".
 *
 *   - `outsideZoneOf` names entries, by id or name: a creature standing in a zone one of them left,
 *     whoever cast it, is not one; `insideZoneOf` asks the opposite.
 *   - The install gate.
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
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-target-in-zone-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 755);
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
  const circle = spell("magic-circle", "Magic Circle", {
    kind: "utility",
    area: { shape: "burst", size: 5 },
    range: 60,
    zone: { rounds: 600, triggers: [], forbids: { teleport: true } },
  });
  const jar = (is: Record<string, unknown>) =>
    spell("jar", "Jar", {
      kind: "debuff",
      range: 100,
      targets: "enemy",
      save: { save: "cha_save", onSuccess: "negates" },
      targetTypes: { is },
      applies: [{ condition: "charmed", duration: { rounds: 10 } }],
    });
  const fiveE = (is: Record<string, unknown> = { outsideZoneOf: ["magic-circle"] }): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [circle, jar(is)] });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const block = {
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  } as unknown as RulesetStatBlock;
  const roll = (sides: number) => (sides === 20 ? 15 : 3);
  const fight = (definition: RulesetDefinition): RulesetEncounterState => {
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
            abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
            fields: { level: 11, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "int", slots_max_1: 9 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells: entries },
        },
        { id: "warded", name: "Warded", side: "enemy", block },
        { id: "open", name: "Open", side: "enemy", block },
      ],
      board: {
        grid: { width: 16, height: 9, tiles: Array.from({ length: 9 }, () => Array(16).fill("plains")) },
        placements: { mage: { x: 2, y: 4 }, warded: { x: 8, y: 4 }, open: { x: 12, y: 4 } },
      },
    });
    state.order = ["mage", "warded", "open"];
    state.turn = 0;
    rulesetCombatant(state, "mage")!.budgets.action = 1;
    return state;
  };
  // The mage draws the circle round the warded foe, then may aim the jar again next turn.
  const targets = (definition: RulesetDefinition, drawn = true) => {
    let state = fight(definition);
    if (drawn) {
      const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Magic Circle")!;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "mage", optionId: option.id, targetIds: [], at: { x: 8, y: 4 } },
        roll,
      );
      assert.deepEqual(of(step.events, "refused"), []);
      state = step.state;
      rulesetCombatant(state, "mage")!.budgets.action = 1;
    }
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Jar");
    return option ? rulesetOptionTargets(definition, state, "mage", option).sort() : [];
  };

  // ── Never one standing in a magic circle, by its id or its name ──
  {
    const definition = parsed(fiveE());
    assert.deepEqual(targets(definition, false), ["open", "warded"], "no circle yet");
    assert.deepEqual(targets(definition), ["open"], "the warded foe is not one");
    assert.deepEqual(targets(parsed(fiveE({ outsideZoneOf: ["Magic Circle"] }))), ["open"], "by its name");
  }
  // ── Or only one standing in it ──
  assert.deepEqual(targets(parsed(fiveE({ insideZoneOf: ["magic-circle"] }))), ["warded"]);
  // ── Beside what else it asks, through except ──
  assert.deepEqual(targets(parsed(fiveE({ outsideZoneOf: ["magic-circle"], except: { holding: ["charmed"] } }))), [
    "open",
  ]);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a target test of standing in a zone some entries left (insideZoneOf or outsideZoneOf) requires schemaVersion 2 and capabilityApi 1.755 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(754) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(755) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(754) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Target in zone: Magic Jar never takes one standing in a magic circle, by its id or name, and insideZoneOf asks the opposite; gated at 1.755.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
