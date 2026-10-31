/**
 * Damage that heals a creature instead (Capability API 1.541).
 *
 *   - A flesh golem's Lightning Absorption: lightning deals it nothing and gives back as much as it
 *     would have dealt, never past its maximum; slashing still hurts.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-healed-by-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 541);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const hit = (id: string, label: string, damageType: string, flat: number) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 0, prepared: true } }],
      mechanics: { kind: "attack", targets: "enemy", range: 120, autoHit: true, amount: { flat }, damageType },
    }) as unknown as RulesetCatalogEntry;
  const entries = [hit("cut", "Cut", "slashing", 10), hit("zap", "Zap", "Lightning", 7)];
  const fiveE = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push({
        id: "golem",
        label: "Flesh Golem",
        creature: {
          health: 93,
          defense: 9,
          initiativeModifier: 0,
          speed: 30,
          tier: "cr_5",
          actions: [{ id: "slam", name: "Slam", budget: "action", toHit: 7, damage: { flat: 13 }, reach: 5 }],
          healedBy: ["lightning"],
        },
      });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(fiveE());
  const golem = rulesetCreatureBlock(
    definition,
    definition.catalogs.flatMap((catalog) => catalog.entries).find((one) => one.id === "golem"),
  );
  assert.ok(golem);
  assert.deepEqual(golem.healedBy, ["lightning"]);
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "mage",
        name: "Mage",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
          fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int" },
          lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
        }),
        catalogs: { spells: entries },
      },
      { id: "golem", name: "Flesh Golem", side: "enemy", block: golem },
    ],
    board: {
      grid: { width: 12, height: 12, tiles: Array.from({ length: 12 }, () => Array(12).fill("plains")) },
      placements: { mage: { x: 1, y: 1 }, golem: { x: 6, y: 6 } },
    },
  });
  state.order = ["mage", "golem"];
  state.turn = 0;
  const cast = (from: RulesetEncounterState, label: string) => {
    from.turn = 0;
    rulesetCombatant(from, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, from, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      from,
      { actorId: "mage", optionId: option.id, targetIds: ["golem"] },
      () => 10,
    );
    assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const hp = (from: RulesetEncounterState) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(from, "golem")!).value;

  // ── Slashing hurts; lightning heals ──
  const cut = cast(state, "Cut");
  assert.equal(hp(cut.state), 83);
  const zapped = cast(cut.state, "Zap");
  assert.equal(hp(zapped.state), 90, "7 lightning: 7 back");
  assert.deepEqual(
    of(zapped.events, "heal").map((one) => [one.targetId, one.amount]),
    [["golem", 7]],
  );
  assert.deepEqual(
    of(zapped.events, "damage").map((one) => one.dealt),
    [0],
    "it takes none",
  );
  const again = cast(zapped.state, "Zap");
  assert.equal(hp(again.state), 93, "never past its maximum");

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a creature healed by a damage type (healedBy) requires schemaVersion 2 and capabilityApi 1.541 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(540) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(541) as never, fiveE()), gate);
  }

  console.log(
    "Healed by: a flesh golem cut by slashing takes it, struck by lightning takes none and regains as much, never past its maximum; gated at 1.541.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
