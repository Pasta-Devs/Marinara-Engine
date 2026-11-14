/**
 * A zone's own damage type at its triggers (Capability API 1.198), as 5e's Wall of Thorns has it.
 *
 *   - `zone.damageType`: whoever it appears around takes the entry's own type; whoever it catches
 *     later, at one of its triggers, takes this type instead. Without it, its triggers deal the
 *     entry's own type as before.
 *   - Import refusals and the install gate.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-zone-damage-type-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 193);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
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
      mechanics: { kind: "attack", autoHit: true, damageType: "piercing", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Wall of Thorns, small: 5 piercing as it appears, 5 slashing to whoever moves into it.
  const thornsZone = { rounds: 10, triggers: ["enter"], damageType: "slashing" };
  const thorns = spell("thorns", {
    area: { shape: "wall", size: 15 },
    range: 60,
    amount: { flat: 5 },
    zone: thornsZone,
  });
  // The same wall with no type of its own: piercing either way.
  const briars = spell("briars", {
    area: { shape: "wall", size: 15 },
    range: 60,
    amount: { flat: 5 },
    zone: { rounds: 10, triggers: ["enter"] },
  });
  const spells = [thorns, briars];
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
          id: "druid",
          name: "Druid",
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
      board: { grid: grid(), placements: { druid: { x: 2, y: 7 }, a: { x: 5, y: 7 }, b: { x: 10, y: 7 } } },
    });
    state.order = ["druid", "a", "b"];
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const cast = (label: string) => {
    const state = fight();
    const option = rulesetCombatOptions(definition, state, "druid").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const at: RulesetCombatCell = { x: 5, y: 7 };
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "druid", optionId: option.id, targetIds: [], at },
      roll,
    );
  };
  const end = (state: RulesetEncounterState) => advanceRulesetTurn(definition, state, roll).state;
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;
  const typesOn = (events: RulesetCombatEvent[], id: string) =>
    events.flatMap((one) => (one.type === "damage" && one.targetId === id ? [one.damageType] : []));
  const walkIn = (state: RulesetEncounterState) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "b", optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 5, y: 8 } },
      roll,
    );

  // ── Wall of Thorns: piercing as it appears, slashing to whoever moves into it ──
  {
    const step = cast("Thorns");
    assert.deepEqual(typesOn(step.events, "a"), ["piercing"], JSON.stringify(step.events));
    assert.equal(hp(step.state, "a"), 95);
    const into = walkIn(end(end(step.state)));
    assert.deepEqual(typesOn(into.events, "b"), ["slashing"], JSON.stringify(into.events));
    assert.equal(hp(into.state, "b"), 95);
    // The entry itself is left as it was: cast again, it is piercing as it appears.
    const again = end(into.state);
    const option = rulesetCombatOptions(definition, again, "druid").find((one) => one.label === "Thorns")!;
    const recast = applyRulesetCombatChoice(
      definition,
      again,
      { actorId: "druid", optionId: option.id, targetIds: [], at: { x: 5, y: 7 } },
      roll,
    );
    assert.deepEqual(typesOn(recast.events, "a"), ["piercing"], JSON.stringify(recast.events));
  }

  // ── A wall with no type of its own deals the entry's at its triggers ──
  {
    const step = cast("Briars");
    assert.deepEqual(typesOn(step.events, "a"), ["piercing"]);
    const into = walkIn(end(end(step.state)));
    assert.deepEqual(typesOn(into.events, "b"), ["piercing"]);
  }

  // ── Import refusals ──
  {
    const refusedDoc = (mechanics: Record<string, unknown>, pattern: RegExp) => {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          doc.catalogs.push({
            id: "walls",
            label: "Walls",
            feeds: ["spells"],
            entries: [{ ...spell("x", {}), mechanics }],
          });
        }),
      );
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const wallArea = { shape: "wall", size: 15 };
    refusedDoc(
      { kind: "attack", autoHit: true, area: wallArea, zone: thornsZone },
      /A zone's "damageType" is for the entry's own amount/,
    );
    refusedDoc(
      {
        kind: "attack",
        autoHit: true,
        area: wallArea,
        amount: { flat: 5 },
        damageType: "piercing",
        zone: { rounds: 10, triggers: [], damageType: "slashing" },
      },
      /A zone's "damageType" is what it deals at its triggers/,
    );
    refusedDoc(
      {
        kind: "attack",
        autoHit: true,
        area: wallArea,
        amount: { flat: 5 },
        damageType: "piercing",
        zone: { ...thornsZone, damageType: "brambles" },
      },
      /Unknown damage type "brambles"/,
    );
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
      "A ruleset with zones that deal another damage type at their triggers requires schemaVersion 2 and capabilityApi 1.198 or newer";
    const withThorns = fiveE((doc) => {
      doc.catalogs.push({ id: "walls", label: "Walls", feeds: ["spells"], entries: [thorns] });
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(197) as never, withThorns), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(198) as never, withThorns), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(197) as never, fiveE()), gate);
    const files = new Map([["walls.json", { entries: [thorns] }]]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(197) as never, fiveE(), files as never), gate);
  }

  console.log(
    "Ruleset zone damage type: Wall of Thorns deals piercing as it appears and slashing to whoever moves into it; gated at 1.198.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
