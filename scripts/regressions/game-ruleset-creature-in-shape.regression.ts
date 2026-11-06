/**
 * Actions only in a given shape (Capability API 1.547).
 *
 *   - A wereboar's Charge `"inShape": ["creatures/boar", "creatures/hybrid"]` is on its menu only in
 *     one of those forms; its Spear `"inShape": ["own"]` only in its own; its Tusks in any.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-in-shape-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 547);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const charge = { inShape: ["creatures/boar", "creatures/hybrid"] };
  const fiveE = (gate: Record<string, unknown> = charge): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push({
        id: "wereboar",
        label: "Wereboar",
        creature: {
          health: 78,
          defense: 10,
          initiativeModifier: 0,
          speed: 30,
          tier: "cr_4",
          actions: [
            { id: "tusks", name: "Tusks", budget: "action", toHit: 5, damage: { flat: 10 }, reach: 5 },
            { id: "charge", name: "Charge", budget: "action", toHit: 5, damage: { flat: 7 }, reach: 5, ...gate },
            { id: "spear", name: "Spear", budget: "action", toHit: 5, damage: { flat: 6 }, reach: 5, inShape: ["own"] },
          ],
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
  const definition = parsed(fiveE());
  const wereboar = rulesetCreatureBlock(
    definition,
    definition.catalogs.flatMap((catalog) => catalog.entries).find((one) => one.id === "wereboar"),
  );
  assert.ok(wereboar);
  const state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [{ id: "wereboar", name: "Wereboar", side: "enemy", block: wereboar }],
  });
  state.order = ["wereboar"];
  state.turn = 0;
  const menu = (from: RulesetEncounterState) =>
    rulesetCombatOptions(definition, from, "wereboar")
      .filter((one) => ["Tusks", "Charge", "Spear"].includes(one.label))
      .map((one) => one.label);
  const inForm = (entryId: string) => {
    const shaped = structuredClone(state);
    rulesetCombatant(shaped, "wereboar")!.shape = {
      condition: "shapechanged",
      form: { catalogId: "creatures", entryId },
      name: entryId,
      was: {},
      lacked: [],
    };
    return shaped;
  };

  assert.deepEqual(menu(state), ["Tusks", "Spear"], "its own shape: no charge");
  assert.deepEqual(menu(inForm("boar")), ["Tusks", "Charge"], "a boar: a charge, no spear");
  assert.deepEqual(menu(inForm("hybrid")), ["Tusks", "Charge"]);
  assert.deepEqual(menu(inForm("bear")), ["Tusks"], "a shape it does not name");

  // ── Refusals ──
  refused(fiveE({ inShape: ["boar"] }), /A shape is "own" or a catalog\/entry/);
  refused(fiveE({ inShape: [] }), /inShape/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with creature actions only in a given shape (inShape) requires schemaVersion 2 and capabilityApi 1.547 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(546) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(547) as never, fiveE()), gate);
  }

  console.log(
    "In shape: a wereboar charges only as a boar or hybrid, spears only in its own shape, gores in any; refusals; gated at 1.547.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
