/**
 * Zones caught only by moving into them (Capability API 1.764).
 *
 *   - `enterOnlyByMoving: true`: a zone's `enter` catches a creature that moves into it, never one
 *     the zone comes onto, carried with its caster (Spirit Guardians) or moved by them (Moonbeam).
 *   - Without it, a zone that comes onto somebody catches them, and the log says the zone reached them.
 *   - The install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  RULESET_MOVE_OPTION,
  RULESET_ZONE_OPTION_PREFIX,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-zone-enter-only-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 764);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());

  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics: { kind: "attack", autoHit: true, damageType: "radiant", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const guardZone = { rounds: 10, anchor: "caster", triggers: ["enter", "turn-end"], atCast: false };
  const guardMechanics = {
    area: { shape: "burst", size: 5 },
    range: 0,
    friendlyFire: false,
    amount: { flat: 3 },
    concentration: true,
  };
  // Spirit Guardians, small, as 5e words it: only a creature's own moving brings it in.
  const guard = spell("guard", { ...guardMechanics, zone: { ...guardZone, enterOnlyByMoving: true } });
  // The same without the key: carried onto somebody, it catches them.
  const ward = spell("ward", { ...guardMechanics, zone: guardZone });
  const beamZone = { rounds: 10, triggers: ["enter"], move: { budget: "action", distance: 15 } };
  const beamMechanics = { area: { shape: "burst", size: 5 }, range: 60, amount: { flat: 5 }, concentration: true };
  // Moonbeam, small, moved by its caster onto A: A is left be.
  const beam = spell("beam", { ...beamMechanics, zone: { ...beamZone, enterOnlyByMoving: true } });
  const glow = spell("glow", { ...beamMechanics, zone: beamZone });
  const spells = [guard, ward, beam, glow];
  const block: RulesetStatBlock = { health: 100, defense: 5, initiativeModifier: 0, speed: 30, actions: [] };
  const grid = (): TacticalGrid => ({
    width: 15,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(15).fill("plains")),
  });
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
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
        { id: "a", name: "A", side: "enemy", block },
        { id: "b", name: "B", side: "enemy", block },
      ],
      board: { grid: grid(), placements: { mage: { x: 2, y: 7 }, a: { x: 8, y: 7 }, b: { x: 13, y: 13 } } },
    });
    state.order = ["mage", "a", "b"];
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const optionOf = (state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `the mage has no ${label}`);
    return option;
  };
  const cast = (state: RulesetEncounterState, label: string, at: { x: number; y: number }) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: optionOf(state, label).id, targetIds: [], at },
      roll,
    );
  const walk = (state: RulesetEncounterState, actorId: string, to: { x: number; y: number }) =>
    applyRulesetCombatChoice(definition, state, { actorId, optionId: RULESET_MOVE_OPTION, targetIds: [], to }, roll);
  const shift = (state: RulesetEncounterState, label: string, to: { x: number; y: number }) =>
    applyRulesetCombatChoice(
      definition,
      state,
      {
        actorId: "mage",
        optionId: `${RULESET_ZONE_OPTION_PREFIX}${rulesetCombatant(state, "mage")!.zones?.find((one) => one.label === label)?.actionId}`,
        targetIds: [],
        to,
      },
      roll,
    );
  const end = (state: RulesetEncounterState) => advanceRulesetTurn(definition, state, roll);
  const toMage = (state: RulesetEncounterState) => {
    let step: RulesetCombatStep = { state, events: [] };
    do step = end(step.state);
    while (step.state.order[step.state.turn] !== "mage");
    return step;
  };
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;
  const struck = (step: RulesetCombatStep) =>
    step.events.filter(
      (one): one is Extract<RulesetCombatEvent, { type: "zone" }> => one.type === "zone" && one.outcome === "struck",
    );
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");

  // ── Spirit Guardians carried onto A leaves A be; A walking in is caught ──
  {
    let step = cast(fight(), "Guard", { x: 2, y: 7 });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    step = walk(step.state, "mage", { x: 7, y: 7 });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(hp(step.state, "a"), 100, "carried onto A, it does not catch A");
    assert.deepEqual(struck(step), []);
    step = end(step.state); // A's turn.
    step = walk(step.state, "a", { x: 8, y: 10 });
    assert.equal(hp(step.state, "a"), 100, "walking out");
    step = walk(step.state, "a", { x: 8, y: 8 });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(hp(step.state, "a"), 97, "walking back in");
    assert.deepEqual(
      struck(step).map((one) => [one.targetId, one.trigger, one.reached]),
      [["a", "enter", undefined]],
    );
  }

  // ── Without the key, carried onto A it catches A, and says it reached them ──
  {
    let step = cast(fight(), "Ward", { x: 2, y: 7 });
    step = walk(step.state, "mage", { x: 7, y: 7 });
    assert.equal(hp(step.state, "a"), 97);
    assert.deepEqual(
      struck(step).map((one) => [one.targetId, one.trigger, one.reached]),
      [["a", "enter", true]],
    );
  }

  // ── Moonbeam moved onto A leaves A be; without the key it catches A ──
  for (const [label, caught] of [
    ["Beam", false],
    ["Glow", true],
  ] as const) {
    let step = cast(fight(), label, { x: 8, y: 4 });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(hp(step.state, "a"), 100, "out of reach as it appears");
    step = toMage(step.state);
    step = shift(step.state, label, { x: 8, y: 7 });
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    assert.equal(hp(step.state, "a"), caught ? 95 : 100, `${label} moved onto A`);
    assert.deepEqual(
      struck(step).map((one) => [one.targetId, one.reached]),
      caught ? [["a", true]] : [],
    );
  }

  // ── The gate ──
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
      "A ruleset with a zone that catches only a creature moving into it (zone enterOnlyByMoving) requires schemaVersion 2 and capabilityApi 1.764 or newer";
    const withGuard = fiveE((doc) => {
      doc.catalogs.push({ id: "zones", label: "Zones", feeds: ["spells"], entries: [guard] });
    });
    parsed(withGuard);
    assert.equal(getCapabilityPackageInstallIssue(manifest(763) as never, withGuard), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(764) as never, withGuard), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(763) as never, fiveE()), gate, "nothing without the key");
  }

  console.log(
    "Zone enterOnlyByMoving: Spirit Guardians carried and Moonbeam moved onto A leave A be, walking in still catches; without it the log says the zone reached them; gated at 1.764.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
