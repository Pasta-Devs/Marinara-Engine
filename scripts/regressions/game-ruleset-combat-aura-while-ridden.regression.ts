/**
 * An aura while ridden (Capability API 1.735): a goat of terror.
 *
 *   - A condition's aura with `whileRidden` spreads only while somebody rides its holder.
 *   - Its sides are read from the rider's: `enemies` are the rider's foes.
 *   - Import and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetAuraReaches,
  rulesetCombatant,
  supportedCapabilityApi,
  type RulesetConditionAura,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-aura-while-ridden-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 735);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const terror = (aura: Record<string, unknown> = {}) => ({
    distance: 30,
    side: "enemies",
    whileRidden: true,
    save: {
      save: "wis_save",
      difficulty: 15,
      applies: [{ condition: "frightened", duration: { rounds: 10 } }],
    },
    ...aura,
  });
  const fiveE = (aura: Record<string, unknown> = terror()): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "terror_aura", label: "Aura of Terror" });
    doc.combat.conditions.push({ condition: "terror_aura", effects: [], auras: [aura] });
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const aura = definition.combat!.conditions!.find((one) => one.condition === "terror_aura")!
    .auras![0]! as RulesetConditionAura;
  const block = (extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 30,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      actions: [],
      ...extra,
    }) as unknown as RulesetStatBlock;
  // The goat is on nobody's side in particular: the enemy's, here, ridden by the party's knight.
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      { id: "goat", name: "Goat of Terror", side: "enemy", block: block({ keepsOn: ["terror_aura"] }) },
      { id: "knight", name: "Knight", side: "party", block: block() },
      { id: "squire", name: "Squire", side: "party", block: block() },
      { id: "orc", name: "Orc", side: "enemy", block: block() },
    ],
  });
  const goat = rulesetCombatant(state, "goat")!;
  const reaches = (id: string) => rulesetAuraReaches(definition, state, goat, aura, rulesetCombatant(state, id)!);

  // ── Unridden: nobody ──
  assert.deepEqual(["knight", "squire", "orc"].filter(reaches), []);
  // ── Ridden by the knight: the knight's foes ──
  goat.riddenBy = "knight";
  assert.deepEqual(["knight", "squire", "orc"].filter(reaches), ["orc"]);
  // ── Without whileRidden, the goat's own side reads it, ridden or not ──
  const plain = { ...aura, whileRidden: undefined };
  assert.deepEqual(
    ["knight", "squire", "orc"].filter((id) =>
      rulesetAuraReaches(definition, state, goat, plain, rulesetCombatant(state, id)!),
    ),
    ["knight", "squire"],
  );

  // ── The install gate ──
  const gate =
    "A ruleset with an aura that spreads only while its holder is ridden (auras[].whileRidden) requires schemaVersion 2 and capabilityApi 1.735 or newer";
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(734) as never, fiveE()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(735) as never, fiveE()), gate);
  assert.notEqual(
    getCapabilityPackageInstallIssue(manifest(734) as never, fiveE(terror({ whileRidden: undefined }))),
    gate,
  );

  console.log("Goat of terror: an aura spreading only while ridden, at its rider's foes; gated at 1.735.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
