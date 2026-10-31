/**
 * An area of only its own cell (Capability API 1.702): 5e's Sphere of Annihilation, a 2-foot sphere.
 *
 *   - Made, it covers one cell, not the cells around it.
 *   - Moved beside somebody, it catches nobody; moved onto them, it does.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_ZONE_CHECK_OPTION_PREFIX,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetZoneCells,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-one-cell-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 702);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const check = {
    check: "arcana",
    difficulty: 14,
    within: 60,
    distanceBy: { abilityMod: "int", times: 5, atLeast: 5 },
    failsToward: 10,
  };
  const document = (area: Record<string, unknown> = { oneCell: true }, moveCheck: Record<string, unknown> = check) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.checks.push({ id: "arcana", label: "Arcana", value: { abilityMod: "int" } });
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      entries: [
        {
          id: "sphere",
          label: "Sphere",
          rows: [{ list: "spells", values: { name: "Sphere", level: 5, prepared: true } }],
          mechanics: {
            kind: "attack",
            area: { shape: "burst", size: 2, ...area },
            range: 60,
            amount: { dice: "4d10" },
            damageType: "force",
            save: { save: "dex_save", onSuccess: "negates" },
            zone: {
              rounds: 100,
              outlasts: true,
              triggers: ["enter"],
              atCast: false,
              move: { budget: "action", distance: 5, check: moveCheck },
            },
          },
        },
      ],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "wizard",
        name: "Wizard",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 10 },
          fields: { level: 9, ac: 12, speed: 30, hp_max: 50, spellcasting_ability: "int", slots_max_5: 1 },
          lists: { spells: entries.flatMap((one) => rowsFromCatalogEntry("spells", one).map((row) => row.row)) },
        }),
        live: {},
        catalogs: { spells: entries },
      },
      {
        id: "fighter",
        name: "Fighter",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
          fields: { level: 9, ac: 16, speed: 30, hp_max: 60 },
        }),
        live: {},
      },
      {
        id: "orc",
        name: "Orc",
        side: "enemy",
        block: {
          health: 30,
          defense: 13,
          initiativeModifier: -20,
          actions: [],
          abilities: { int: 14 },
          checks: { arcana: 6 },
        } as unknown as RulesetStatBlock,
      },
    ],
    board: {
      grid: { width: 20, height: 9, tiles: Array.from({ length: 9 }, () => Array(20).fill("plains")) },
      placements: { wizard: { x: 2, y: 4 }, fighter: { x: 6, y: 4 }, orc: { x: 14, y: 4 } },
    },
  } as never);
  state.order = ["wizard", "fighter", "orc"];
  state.turn = 0;
  const choose = (from: RulesetEncounterState, actorId: string, to?: { x: number; y: number }) => {
    const turn = structuredClone(from);
    turn.turn = turn.order.indexOf(actorId);
    const actor = rulesetCombatant(turn, actorId)!;
    actor.budgets.action = 1;
    const option = rulesetCombatOptions(definition, turn, actorId).find((one) =>
      one.id.startsWith(RULESET_ZONE_CHECK_OPTION_PREFIX),
    );
    assert.ok(option, `${actorId} may try to move it`);
    const step = applyRulesetCombatChoice(
      definition,
      turn,
      { actorId, optionId: option.id, targetIds: [], to: to ?? option.cells![0]! },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    return { option, ...step };
  };
  const sphereAt = (from: RulesetEncounterState) => rulesetCombatant(from, "wizard")!.zones![0]!.at;

  const sphere = (from: RulesetEncounterState) => rulesetCombatant(from, "wizard")!.zones![0]!;
  const castOption = rulesetCombatOptions(definition, state, "wizard").find((one) => one.label === "Sphere");
  assert.ok(castOption, "offered");
  const cast = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "wizard", optionId: castOption.id, targetIds: [], at: { x: 9, y: 4 } },
    () => 10,
  );
  assert.deepEqual(of(cast.events, "refused"), []);
  // ── One cell ──
  assert.deepEqual(rulesetZoneCells(cast.state, rulesetCombatant(cast.state, "wizard")!, sphere(cast.state)), [
    { x: 9, y: 4 },
  ]);
  // ── The orc moves it beside the fighter: nobody caught ──
  const beside = choose(cast.state, "orc", { x: 7, y: 4 });
  assert.deepEqual(sphere(beside.state).at, { x: 7, y: 4 });
  assert.deepEqual(rulesetZoneCells(beside.state, rulesetCombatant(beside.state, "wizard")!, sphere(beside.state)), [
    { x: 7, y: 4 },
  ]);
  assert.equal(of(beside.events, "damage").length, 0, JSON.stringify(beside.events));
  // ── And onto them: caught ──
  const onto = choose(beside.state, "orc", { x: 6, y: 4 });
  assert.ok(
    of(onto.events, "damage").some((one) => one.targetId === "fighter"),
    JSON.stringify(onto.events),
  );

  // ── Refused ──
  refused(document({ oneCell: true, around: true }), /Only a single burst held at a point is one cell/);
  refused(document({ oneCell: true, copies: 2 }), /Only a single burst held at a point is one cell/);

  // ── An item's use as well: the Sphere of Annihilation as a magic item ──
  const withItem = (area: Record<string, unknown>) => {
    const doc = document();
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "magic",
      label: "Magic items",
      holds: "items",
      entries: [
        {
          id: "sphere-item",
          label: "Sphere of Annihilation",
          item: {
            category: "gear",
            use: { budget: "action", kind: "utility", range: 60, area, zone: { rounds: 10, triggers: ["enter"] } },
          },
        },
      ],
    });
    return doc;
  };
  parsed(withItem({ shape: "burst", size: 2, oneCell: true }));
  refused(withItem({ shape: "cone", size: 15, oneCell: true }), /Only a single burst held at a point is one cell/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an area of only the cell it is at (area.oneCell) requires schemaVersion 2 and capabilityApi 1.702 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(701) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(702) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(701) as never, document({})), gate);
  }

  console.log("One cell: the Sphere covers only its own cell, catching only whoever it is moved onto; gated at 1.702.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
