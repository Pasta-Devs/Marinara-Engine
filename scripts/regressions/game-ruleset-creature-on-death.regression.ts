/**
 * What a creature does as it dies (Capability API 1.540).
 *
 *   - A dust mephit's Death Burst: dropped to 0, it bursts around itself, a save against it, on
 *     whoever stands within 5 feet; the one beside it takes it, the caster across the board does not.
 *   - A smoke mephit's cloud: a zone left where it fell, outlasting it.
 *   - Never on its own menu, and nothing happens while it lives.
 *   - Refusals (not centred on it, an unknown save) and the install gate.
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
  rulesetCreatureBlock,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-on-death-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 540);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const entries = [
    {
      id: "cut",
      label: "Cut",
      rows: [{ list: "spells", values: { name: "Cut", level: 0, prepared: true } }],
      mechanics: {
        kind: "attack",
        targets: "enemy",
        range: 120,
        autoHit: true,
        amount: { flat: 10 },
        damageType: "slashing",
      },
    },
  ].map((entry) => entry as unknown as RulesetCatalogEntry);
  const burst = {
    id: "death_burst",
    name: "Death Burst",
    budget: "action",
    save: { save: "dex_save", difficulty: 20, onSuccess: "half" },
    damage: { flat: 4, type: "slashing" },
    area: { shape: "burst", size: 5, around: true },
  };
  const fiveE = (onDeath: Record<string, unknown> = burst): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push({
        id: "mephit",
        label: "Dust Mephit",
        creature: {
          health: 5,
          defense: 12,
          initiativeModifier: 0,
          speed: 30,
          tier: "cr_1_2",
          actions: [{ id: "claws", name: "Claws", budget: "action", toHit: 4, damage: { flat: 4 }, reach: 5 }],
          onDeath,
        },
      });
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const mephitEntry = definition.catalogs.flatMap((catalog) => catalog.entries).find((entry) => entry.id === "mephit");
  const blockOf = (rules: RulesetDefinition) => {
    const entry = rules.catalogs.flatMap((catalog) => catalog.entries).find((one) => one.id === "mephit");
    const block = rulesetCreatureBlock(rules, entry);
    assert.ok(block);
    return block;
  };
  const mephit = blockOf(definition);
  const hero = (id: string, name: string, spells: RulesetCatalogEntry[]) => ({
    id,
    name,
    side: "party" as const,
    build: rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int" },
      lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    }),
    catalogs: { spells },
  });
  const fight = (health?: number, rules = definition, block = mephit) => {
    const state = createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => 10,
      combatants: [
        hero("mage", "Mage", entries),
        hero("fighter", "Fighter", []),
        {
          id: "mephit",
          name: "Dust Mephit",
          side: "enemy",
          block: health ? ({ ...block, health } as RulesetStatBlock) : block,
        },
      ],
      board: {
        grid: { width: 12, height: 12, tiles: Array.from({ length: 12 }, () => Array(12).fill("plains")) },
        placements: { mage: { x: 1, y: 1 }, fighter: { x: 6, y: 7 }, mephit: { x: 6, y: 6 } },
      },
    });
    state.order = ["mage", "fighter", "mephit"];
    state.turn = 0;
    return state;
  };
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;

  // ── Never on its own menu ──
  {
    const state = fight();
    state.turn = 2;
    const labels = rulesetCombatOptions(definition, state, "mephit").map((one) => one.label);
    assert.ok(labels.includes("Claws"), labels.join(", "));
    assert.ok(!labels.includes("Death Burst"), "its death is never chosen");
  }

  // ── Cut down: it bursts on the fighter beside it, not on the mage far off ──
  {
    const state = fight();
    const before = { mage: hp(state, "mage"), fighter: hp(state, "fighter") };
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Cut");
    assert.ok(option);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: ["mephit"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    assert.deepEqual(
      of(step.events, "defeated").map((one) => one.actorId),
      ["mephit"],
    );
    assert.deepEqual(
      of(step.events, "deathBurst").map((one) => [one.actorId, one.label]),
      [["mephit", "Death Burst"]],
    );
    assert.equal(hp(step.state, "fighter"), before.fighter - 4, "a failed save: all 4");
    assert.equal(hp(step.state, "mage"), before.mage, "30 feet off: untouched");
    const types = step.events.map((one) => one.type);
    assert.ok(types.indexOf("deathBurst") > types.indexOf("defeated"), "it bursts as it dies");
  }

  // ── A hit that leaves it standing: no burst ──
  {
    const state = fight(50);
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === "Cut")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: ["mephit"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "deathBurst"), [], "still alive");
  }

  // ── A smoke mephit leaves a cloud where it fell, heavily obscured, outlasting it a minute ──
  {
    const cloud = {
      id: "death_burst",
      name: "Death Burst",
      budget: "action",
      area: { shape: "burst", size: 5, around: true },
      zone: { rounds: 10, anchor: "point", outlasts: true, triggers: [], obscures: {} },
    };
    const smoky = parsed(fiveE(cloud));
    const state = fight(undefined, smoky, blockOf(smoky));
    const option = rulesetCombatOptions(smoky, state, "mage").find((one) => one.label === "Cut")!;
    const step = applyRulesetCombatChoice(
      smoky,
      state,
      { actorId: "mage", optionId: option.id, targetIds: ["mephit"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), []);
    assert.deepEqual(
      of(step.events, "deathBurst").map((one) => one.label),
      ["Death Burst"],
    );
    const zones = rulesetCombatant(step.state, "mephit")!.zones ?? [];
    assert.equal(zones.length, 1, "its cloud stays");
    assert.deepEqual(zones[0]!.at, { x: 6, y: 6 }, "where it fell");
    assert.equal(zones[0]!.cells?.length, 9, "everything within 5 feet of it");
    assert.equal(hp(step.state, "fighter"), hp(fight(), "fighter"), "a cloud, no harm");
    refused(fiveE({ ...cloud, zone: { rounds: 10, anchor: "point", triggers: [] } }), /stays where it fell/);
  }

  // ── Refusals ──
  refused(fiveE({ ...burst, area: { shape: "burst", size: 5 } }), /burst centred on it/);
  refused(
    fiveE({ ...burst, save: { save: "luck_save", difficulty: 10, onSuccess: "half" } }),
    /Unknown save "luck_save"/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature that bursts as it dies (onDeath) requires schemaVersion 2 and capabilityApi 1.540 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(539) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(540) as never, fiveE()), gate);
  }

  console.log(
    "On death: a dust mephit cut down bursts around itself on the fighter beside it and not the mage far off, a smoke mephit leaves its cloud where it fell, never offered on its menu, not while it stands; refused off-centre or with an unknown save; gated at 1.540.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
