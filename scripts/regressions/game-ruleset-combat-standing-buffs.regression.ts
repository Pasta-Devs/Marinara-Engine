/**
 * Set up before a fight, with no zone (Capability API 1.465).
 *
 *   - Heroes' Feast, small: `beforeFight` with no zone parses and is never on the fight menu.
 *   - Standing `on` named allies, it is done as the fight starts on those it may be done on, paid off
 *     the sheet; naming nobody, on its user.
 *   - The install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetStandingAtStart,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-standing-buffs-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 465);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const feast = {
    id: "feast",
    label: "Feast",
    rows: [{ list: "spells", values: { name: "Feast", level: 1, prepared: true } }],
    mechanics: {
      kind: "buff",
      targets: "ally",
      targetCount: 12,
      range: 30,
      beforeFight: true,
      cost: [{ pool: "slots_1", amount: 1 }],
      applies: [{ condition: "feasted", duration: { rounds: 100 } }],
    },
  } as unknown as RulesetCatalogEntry;
  const fiveE = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "feasted", label: "Feasted" });
    doc.combat.conditions.push({ condition: "feasted", effects: [] });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [feast] });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const block: RulesetStatBlock = {
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
  } as unknown as RulesetStatBlock;
  const roll = (sides: number) => (sides === 20 ? 10 : 3);
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
          fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 4 },
          lists: { spells: rowsFromCatalogEntry("spells", feast).map((row) => row.row) },
        }),
        catalogs: { spells: [feast] },
      },
      { id: "squire", name: "Squire", side: "party", block },
      { id: "thug", name: "Thug", side: "enemy", block },
    ],
  });
  state.order = ["mage", "squire", "thug"];
  state.turn = 0;
  const holds = (s: RulesetEncounterState) =>
    s.combatants.filter((one) => one.tracked.some((entry) => entry.condition === "feasted")).map((one) => one.id);
  const slots = (s: RulesetEncounterState) => {
    const mage = rulesetCombatant(s, "mage")!;
    return readRulesetLive(definition, mage.sheet!.build, mage.sheet!.live).pools.find(
      (pool) => pool.key === "slots_1",
    )!.value;
  };

  // ── Never on the fight menu ──
  assert.ok(!rulesetCombatOptions(definition, state, "mage").some((one) => one.label === "Feast"));

  // ── Set up before the fight, on the named allies ──
  {
    const stood = rulesetStandingAtStart(definition, state, [
      { casterId: "mage", entry: "Feast", on: ["Squire", "mage", "Thug"] },
    ]);
    assert.deepEqual(stood.skipped, []);
    assert.deepEqual(holds(stood.state).sort(), ["mage", "squire"], "the thug is no ally");
    assert.equal(slots(stood.state), slots(state) - 1, "paid off the sheet");
  }

  // ── Naming nobody, on its user ──
  {
    const stood = rulesetStandingAtStart(definition, state, [{ casterId: "mage", entry: "feast" }]);
    assert.deepEqual(holds(stood.state), ["mage"]);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entries with no zone are set up before a fight only (beforeFight) requires schemaVersion 2 and capabilityApi 1.465 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(464) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(465) as never, fiveE()), gate);
  }

  console.log(
    "Standing buffs: a beforeFight entry with no zone stays off the menu and is done on the named allies as the fight starts; gated at 1.465.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
