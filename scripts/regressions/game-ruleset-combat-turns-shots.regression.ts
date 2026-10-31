/**
 * A zone that turns shots aside (Capability API 1.581): Wind Wall.
 *
 *   - An attack from afar with a weapon that is not magical, into, out of or across it, is stopped;
 *     one well clear of it, a magical one, and one it `spares` by label are not.
 *   - The target is refused as out of line to the attacker's own options.
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
  rulesetTargetRefusal,
  rulesetSheetBuildSchema,
  rulesetShotsTurned,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatAction,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-turns-shots-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 581);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const wall = {
    id: "wind-wall",
    label: "Wind Wall",
    rows: [{ list: "spells", values: { name: "Wind Wall", level: 1, prepared: true } }],
    mechanics: {
      kind: "utility",
      area: { shape: "burst", size: 5 },
      range: 120,
      zone: { rounds: 10, triggers: [], turnsShots: { spares: ["Rock"] } },
    },
  };
  const fiveE = (): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [wall] });
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
  const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
  const block = {
    health: 50,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      { name: "Bow", budget: "action", toHit: 4, damage: { flat: 1 }, reach: 60 },
      { name: "Rock", budget: "action", toHit: 9, damage: { flat: 10 }, reach: 60 },
    ],
  } as unknown as RulesetStatBlock;
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "druid",
        name: "Druid",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
          fields: { level: 9, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 9 },
          lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
        }),
        catalogs: { spells: entries },
      },
      { id: "giant", name: "Giant", side: "enemy", block },
    ],
    board: {
      grid: { width: 20, height: 9, tiles: Array.from({ length: 9 }, () => Array(20).fill("plains")) },
      placements: { druid: { x: 1, y: 4 }, giant: { x: 12, y: 4 } },
    },
  });
  state.order = ["druid", "giant"];
  state.turn = 0;
  const option = rulesetCombatOptions(definition, state, "druid").find((one) => one.label === "Wind Wall")!;
  const cast = applyRulesetCombatChoice(
    definition,
    state,
    { actorId: "druid", optionId: option.id, targetIds: [], at: { x: 6, y: 4 } },
    () => 10,
  );
  assert.deepEqual(of(cast.events, "refused"), []);
  const after = cast.state;
  const giant = rulesetCombatant(after, "giant")!;
  const bow = giant.actions.find((one) => one.label === "Bow")!;
  const rock = giant.actions.find((one) => one.label === "Rock")!;

  // ── Across it, the bow is turned; well clear of it, not ──
  assert.equal(rulesetShotsTurned(after, bow, { x: 12, y: 4 }, { x: 1, y: 4 }), true);
  assert.equal(rulesetShotsTurned(after, bow, { x: 12, y: 0 }, { x: 1, y: 0 }), false);
  // A hurled rock it spares, a magical arrow and a spell go through.
  assert.equal(rulesetShotsTurned(after, rock, { x: 12, y: 4 }, { x: 1, y: 4 }), false);
  const magical = { ...bow, qualities: ["magical"] } as RulesetCombatAction;
  assert.equal(rulesetShotsTurned(after, magical, { x: 12, y: 4 }, { x: 1, y: 4 }), false);

  // ── The giant's options: the bow cannot reach the druid behind it, the rock can ──
  after.turn = 1;
  const options = rulesetCombatOptions(definition, after, "giant");
  const bowOption = options.find((one) => one.label === "Bow")!;
  const rockOption = options.find((one) => one.label === "Rock")!;
  assert.equal(rulesetTargetRefusal(after, "giant", bowOption.id, "druid"), "no-line-of-sight");
  assert.equal(rulesetTargetRefusal(after, "giant", rockOption.id, "druid"), null);
  // Shot at, the bow is refused.
  const shot = applyRulesetCombatChoice(
    definition,
    after,
    { actorId: "giant", optionId: bowOption.id, targetIds: ["druid"] },
    () => 10,
  );
  assert.ok(of(shot.events, "refused").length > 0, "turned aside");

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a zone that turns aside attacks from afar with weapons that are not magical (turnsShots) requires schemaVersion 2 and capabilityApi 1.581 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(580) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(581) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(580) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Turns shots: Wind Wall turns aside a bow shot across it but not a giant's rock, a magical arrow or one well clear; gated at 1.581.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
