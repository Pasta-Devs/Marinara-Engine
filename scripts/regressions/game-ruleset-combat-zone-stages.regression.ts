/**
 * Zones in stages (Capability API 1.557): Storm of Vengeance.
 *
 *   - As cast, its own effect; on its caster's second turn acid rain on everybody inside, on the
 *     third one bolt (`count`) at the nearest foe with a save for half, and from the fourth hard
 *     going, a heavy cloud and no shots with a ranged weapon through it.
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetSlowedCells,
  rulesetStormStops,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-zone-stages-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 557);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const stages = [
    { from: 2, label: "Acid rain", amount: { flat: 4 }, damageType: "acid" },
    {
      from: 3,
      label: "Lightning",
      amount: { flat: 20 },
      damageType: "lightning",
      save: "dex_save",
      onSave: "half",
      count: 1,
    },
    {
      from: 4,
      label: "Freezing rain",
      amount: { flat: 2 },
      damageType: "cold",
      difficult: true,
      obscures: true,
      noRanged: true,
    },
  ];
  const storm = (zone: Record<string, unknown> = {}) =>
    ({
      id: "storm",
      label: "Storm",
      rows: [{ list: "spells", values: { name: "Storm", level: 1, prepared: true } }],
      mechanics: {
        kind: "attack",
        targets: "enemy",
        area: { shape: "burst", size: 10 },
        range: 120,
        save: { save: "con_save", onSuccess: "negates" },
        amount: { flat: 6 },
        damageType: "thunder",
        zone: { rounds: 100, triggers: [], stages, ...zone },
      },
    }) as unknown as RulesetCatalogEntry;
  const fiveE = (zone?: Record<string, unknown>): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [storm(zone)] });
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
  const block = (): RulesetStatBlock =>
    ({
      health: 200,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [{ name: "Bow", budget: "action", toHit: 4, damage: { flat: 1 }, reach: 60 }],
    }) as unknown as RulesetStatBlock;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const roll = (sides: number) => (sides === 20 ? 2 : 1);
  const definition = parsed(fiveE());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  let state: RulesetEncounterState = createRulesetEncounter({
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
      { id: "near", name: "Near", side: "enemy", block: block() },
      { id: "far", name: "Far", side: "enemy", block: block() },
    ],
    board: {
      grid: { width: 20, height: 9, tiles: Array.from({ length: 9 }, () => Array(20).fill("plains")) },
      placements: { mage: { x: 1, y: 4 }, near: { x: 10, y: 4 }, far: { x: 11, y: 5 } },
    },
  });
  state.order = ["mage", "near", "far"];
  state.turn = 0;
  const health = (s: RulesetEncounterState, id: string) => rulesetCombatant(s, id)!.health!.value;
  const step = (choice: Record<string, unknown>) => {
    const taken = applyRulesetCombatChoice(definition, state, { targetIds: [], ...choice } as never, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(of(taken.events, "refused")));
    state = taken.state;
    return taken.events;
  };
  // Round the others' turns back to the mage's, gathering what happens.
  const round = () => [
    ...step({ actorId: "mage", optionId: "end-turn" }),
    ...step({ actorId: "near", optionId: "end-turn" }),
    ...step({ actorId: "far", optionId: "end-turn" }),
  ];

  // ── As cast: its own thunder ──
  const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Storm")!;
  step({ actorId: "mage", optionId: option.id, at: { x: 10, y: 4 } });
  assert.equal(health(state, "near"), 194);
  assert.equal(health(state, "far"), 194);

  // ── Its second turn: acid rain on everybody inside ──
  {
    const events = round();
    assert.deepEqual(
      of(events, "zone")
        .filter((one) => one.outcome === "stage")
        .map((one) => one.layer),
      ["Acid rain"],
    );
    assert.equal(health(state, "near"), 190);
    assert.equal(health(state, "far"), 190);
  }

  // ── Its third: one bolt, at the foe nearest its middle ──
  {
    round();
    assert.equal(health(state, "near"), 170, "the nearest, its save failed");
    assert.equal(health(state, "far"), 190, "only one bolt");
  }

  // ── Its fourth on: hard going, a heavy cloud, no shots through it ──
  {
    round();
    assert.equal(health(state, "near"), 168);
    const zone = rulesetCombatant(state, "mage")!.zones![0]!;
    assert.deepEqual(zone.obscures, { pierced: [] });
    assert.equal(rulesetSlowedCells(state, rulesetCombatant(state, "near")!).get("10,4")?.times, 2);
    const bow = rulesetCombatant(state, "near")!.actions.find((one) => one.label === "Bow")!;
    assert.equal(rulesetStormStops(state, bow, { x: 10, y: 4 }, { x: 1, y: 4 }), true, "out of it");
    assert.equal(rulesetStormStops(state, bow, { x: 1, y: 1 }, { x: 1, y: 7 }), false, "well clear of it");
    const spell = rulesetCombatant(state, "mage")!.actions.find((one) => one.label === "Storm")!;
    assert.equal(rulesetStormStops(state, spell, { x: 1, y: 4 }, { x: 10, y: 4 }), false, "a spell is no weapon");
  }

  // ── Refusals ──
  refused(fiveE({ stages: [stages[1], stages[0]] }), /Stages run in order/);
  refused(fiveE({ stages: [{ from: 2, label: "Hush", save: "dex_save" }] }), /A stage that strikes says its "amount"/);
  refused(fiveE({ stages: [{ ...stages[0], damageType: "nonsense" }] }), /Unknown damage type "nonsense"/);
  refused(fiveE({ stages: [{ ...stages[1], save: "luck_save" }] }), /Unknown save "luck_save"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a zone in stages (zone.stages) requires schemaVersion 2 and capabilityApi 1.557 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(556) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(557) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(556) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Zone stages: Storm of Vengeance thunders as cast, rains acid on its second turn, sends one bolt at the nearest foe on its third, and from its fourth is hard going, a heavy cloud and no shots through it; gated at 1.557.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
